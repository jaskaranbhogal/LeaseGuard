"""Canonical property/invitation/consent integration, isolated replica set only."""
import hashlib
import json
from datetime import datetime, timedelta, timezone as dt_timezone
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client, TransactionTestCase, override_settings
from django.utils import timezone
from accounts.models import AccountProfile
from .models import Property, Unit, UnitAssignment, TenantInvitation, PolicyConsent
from .housing import POLICY_VERSION, issue_invite
from inspections.storage import database


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', GEMINI_API_KEY='', CLOUDINARY_URL='')
class HousingTests(TransactionTestCase):
    def setUp(self):
        User = get_user_model()
        self.manager = User.objects.create_user(username='owner', email='owner@example.com')
        self.tenant = User.objects.create_user(username='tenant', email='tenant@example.com')
        self.other = User.objects.create_user(username='other', email='other@example.com')
        for user, role in [(self.manager, 'landlord'), (self.tenant, 'tenant'), (self.other, 'landlord')]:
            AccountProfile.objects.create(user=user, role=role)
            PolicyConsent.objects.create(consent_key=str(user.pk), user=user, role=role, policy_version=POLICY_VERSION)
        self.client.force_login(self.manager)
        self.payload = dict(street='Verified house', city='NY', unit='1A', bedrooms='2', bathrooms='1.5',
                            areas=['Entry','Living room','Kitchen','Bathroom','Bedroom'],idempotency_key='property_creation_0001')
        result = self.post('/api/landlord/properties/', self.payload)
        self.assertEqual(result.status_code, 200, result.content)
        self.property = Property.objects.get()
        self.unit = Unit.objects.get()
        self.unit_url = f'/api/landlord/units/{self.unit.pk}/'
        self.addCleanup(patch.stopall)
        patch('inspections.services._get_client', side_effect=AssertionError('Paid calls forbidden')).start()

    def post(self, path, data, client=None):
        return (client or self.client).post(path,json.dumps(data),content_type='application/json')

    def invite(self):
        response = self.post(self.unit_url+'tenant/',{'email':' TENANT@example.com '})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(mail.outbox),1)
        return mail.outbox[0].body.split('invitation code: ')[1].split('\n')[0]

    def test_property_ownership_server_ids_and_retry(self):
        self.assertTrue(self.property.managers.filter(pk=self.manager.pk).exists())
        self.assertEqual(self.post('/api/landlord/properties/',{**self.payload,'propertyId':'fake','unitId':'fake'}).status_code,200)
        self.assertEqual(Property.objects.count(),1)
        self.assertEqual(Unit.objects.count(),1)
        self.client.force_login(self.other)
        self.assertEqual(self.post(self.unit_url,dict(name='stolen',bedrooms='1',bathrooms='1',areas=self.payload['areas'],revision=0)).status_code,404)
        self.assertEqual(self.client.get('/api/landlord/state/').json()['properties'],[])

    def test_invite_bound_to_email_single_use_and_dashboard(self):
        token=self.invite()
        invitation=TenantInvitation.objects.get()
        self.assertEqual(invitation.token_hash,hashlib.sha256(token.encode()).hexdigest())
        self.assertNotIn(token,self.client.get('/api/landlord/state/').content.decode())
        self.client.force_login(self.other)
        self.assertEqual(self.post('/api/tenant/invite/accept/',{'token':token}).status_code,403)
        # A different tenant account cannot claim the code either.
        AccountProfile.objects.filter(user=self.other).update(role='tenant')
        PolicyConsent.objects.create(consent_key='other-tenant',user=self.other,role='tenant',policy_version=POLICY_VERSION)
        self.assertEqual(self.post('/api/tenant/invite/accept/',{'token':token}).status_code,409)
        self.client.force_login(self.tenant)
        preview=self.client.get('/api/tenant/state/').json()['pendingInvite']
        self.assertTrue(preview['previewLocked']);self.assertEqual(preview['propertyId'],'')
        self.assertNotIn(self.property.name,json.dumps(preview))
        response=self.post('/api/tenant/invite/accept/',{'token':token})
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['unit']['unitId'],str(self.unit.pk))
        self.assertEqual(UnitAssignment.objects.filter(active=True).count(),1)
        self.assertEqual(self.post('/api/tenant/invite/accept/',{'token':token}).status_code,409)
        self.client.force_login(self.manager)
        self.assertEqual(self.client.get('/api/landlord/state/').json()['properties'][0]['units'][0]['tenant']['status'],'joined')

    def test_expiry_decline_revocation_and_no_silent_replacement(self):
        token=self.invite()
        self.assertEqual(self.post(self.unit_url+'tenant/',{'email':'different@example.com'}).status_code,409)
        TenantInvitation.objects.update(expires_at=timezone.now()-timedelta(seconds=1))
        self.client.force_login(self.tenant)
        self.assertEqual(self.post('/api/tenant/invite/accept/',{'token':token}).status_code,409)
        self.client.force_login(self.manager)
        token=self.invite_again()
        self.client.force_login(self.tenant)
        self.assertEqual(self.post('/api/tenant/invite/decline/',{'token':token}).status_code,200)
        self.assertFalse(UnitAssignment.objects.exists())
        self.client.force_login(self.manager)
        self.assertEqual(self.client.get('/api/landlord/state/').json()['properties'][0]['units'][0]['tenant']['status'],'declined')
        self.client.force_login(self.tenant)
        self.assertEqual(self.post('/api/tenant/invite/accept/',{'token':token}).status_code,409)
        self.client.force_login(self.manager)
        self.post(self.unit_url+'tenant/',{'email':self.tenant.email})
        response=self.client.delete(self.unit_url+'tenant/',json.dumps({'action':'revoke'}),content_type='application/json')
        self.assertEqual(response.status_code,200)
        self.assertFalse(TenantInvitation.objects.filter(status='pending').exists())

    def invite_again(self):
        self.assertEqual(self.post(self.unit_url+'tenant/',{'email':self.tenant.email}).status_code,200)
        return mail.outbox[-1].body.split('invitation code: ')[1].split('\n')[0]

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend')
    def test_no_fake_delivery_or_secret_logging(self):
        with patch('maintenance.housing.send_mail') as send:
            response=self.post(self.unit_url+'tenant/',{'email':self.tenant.email})
        send.assert_not_called()
        self.assertEqual(response.json()['properties'][0]['units'][0]['tenant']['delivery'],'unconfigured')

    def test_email_failure_does_not_claim_delivery(self):
        with patch('maintenance.housing.send_mail',side_effect=RuntimeError('provider-secret')):
            response=self.post(self.unit_url+'tenant/',{'email':self.tenant.email})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['properties'][0]['units'][0]['tenant']['delivery'],'failed')
        self.assertNotIn('provider-secret',response.content.decode())

    def test_consent_version_idempotency_and_server_gate(self):
        PolicyConsent.objects.filter(user=self.manager).delete()
        self.assertEqual(self.post('/api/landlord/properties/',self.payload).status_code,409)
        self.assertEqual(self.post('/api/housing/consent/',{'policy_version':'old','accepted':True}).status_code,400)
        for _ in range(2):
            self.assertEqual(self.post('/api/housing/consent/',{'policy_version':POLICY_VERSION,'accepted':True}).status_code,200)
        self.assertEqual(PolicyConsent.objects.filter(user=self.manager).count(),1)
        self.assertEqual(self.post('/api/guided-inspections/templates/',{'name':'x','steps':[]}).status_code,400)
        PolicyConsent.objects.filter(user=self.manager).delete()
        self.assertEqual(self.post('/api/guided-inspections/templates/',{'name':'x','steps':[]}).status_code,409)

    def test_csrf_and_roles(self):
        secure=Client(enforce_csrf_checks=True);secure.force_login(self.manager)
        self.assertEqual(self.post('/api/landlord/properties/',self.payload,secure).status_code,403)
        self.client.force_login(self.tenant)
        self.assertEqual(self.post('/api/landlord/properties/',self.payload).status_code,403)
        self.assertEqual(self.client.get('/api/landlord/state/').status_code,403)

    def test_area_changes_leave_snapshots_unchanged_and_reject_stale_edits(self):
        from guided_inspections.models import UnitBaseline
        snapshot={'approved_at':timezone.now().isoformat(),'id':'historical','template_version':1,'photos':[{'step_id':'entry','slot':0}]}
        UnitBaseline.objects.create(unit=self.unit,versions=[snapshot],active_id='historical')
        data=dict(name='1B',bedrooms='2',bathrooms='1',areas=['New entry','Living room','Kitchen','Bathroom','Bedroom'],revision=0)
        response=self.post(self.unit_url,data)
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(UnitBaseline.objects.get(unit=self.unit).versions,[snapshot])
        self.assertEqual(self.post(self.unit_url,data).status_code,409)

    def test_concurrent_invitation_acceptance_creates_one_assignment(self):
        token=self.invite()
        def accept():
            from django.db import connections
            client=Client();client.force_login(self.tenant)
            try:return self.post('/api/tenant/invite/accept/',{'token':token},client).status_code
            finally:connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda _:accept(),range(2)))
        self.assertEqual(sorted(results),[200,409])
        self.assertEqual(UnitAssignment.objects.filter(active=True).count(),1)

    def test_appointments_response_confirmation_and_cancellation(self):
        UnitAssignment.objects.create(tenant=self.tenant,unit=self.unit,verified_by=self.manager)
        data=dict(unit_id=str(self.unit.pk),tenant_id=str(self.tenant.pk),idempotency_key='appointment_offer_0001',timezone='America/New_York',slots=[(timezone.now()+timedelta(days=2)).isoformat()])
        response=self.post('/api/housing/appointments/',data)
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(self.post('/api/housing/appointments/',data).status_code,200)
        from .models import InspectionAppointment
        self.assertEqual(InspectionAppointment.objects.count(),1)
        a=response.json()['appointments'][0];url=f"/api/housing/appointments/{a['id']}/"
        self.assertEqual(self.post(url,{'revision':0,'action':'confirm','slot_id':a['slots'][0]['id']}).status_code,409)
        self.client.force_login(self.tenant)
        self.assertEqual(self.post(url,{'revision':0,'action':'respond','slot_ids':[a['slots'][0]['id']]}).status_code,200)
        self.assertEqual(self.post(url,{'revision':1,'action':'confirm','slot_id':a['slots'][0]['id']}).status_code,409)
        self.client.force_login(self.manager)
        self.assertEqual(self.post(url,{'revision':1,'action':'confirm','slot_id':a['slots'][0]['id']}).status_code,200)
        self.assertEqual(self.post(url,{'revision':1,'action':'cancel'}).status_code,409)
        self.assertEqual(self.post(url,{'revision':2,'action':'cancel'}).status_code,200)

    def test_invalid_appointment_dates_and_cross_property_access(self):
        UnitAssignment.objects.create(tenant=self.tenant,unit=self.unit,verified_by=self.manager)
        data=dict(unit_id=str(self.unit.pk),tenant_id=str(self.tenant.pk),timezone='Fake/Zone',slots=['2020-01-01T00:00:00'])
        self.assertEqual(self.post('/api/housing/appointments/',data).status_code,400)
        self.client.force_login(self.other)
        self.assertEqual(self.post('/api/housing/appointments/',{**data,'timezone':'UTC'}).status_code,404)

    def test_add_units_is_idempotent_and_assignment_end_is_audited(self):
        data=dict(name='2B',bedrooms='1',bathrooms='1',areas=self.payload['areas'],idempotency_key='unit_creation_00001')
        url=f'/api/landlord/properties/{self.property.pk}/units/'
        self.assertEqual(self.post(url,data).status_code,200)
        self.assertEqual(self.post(url,data).status_code,200)
        self.assertEqual(Unit.objects.filter(property=self.property).count(),2)
        a=UnitAssignment.objects.create(tenant=self.tenant,unit=self.unit,verified_by=self.manager)
        response=self.client.delete(self.unit_url+'tenant/',json.dumps({'action':'end-assignment','assignment_id':str(a.pk)}),content_type='application/json')
        self.assertEqual(response.status_code,200)
        a.refresh_from_db();self.assertFalse(a.active);self.assertEqual(a.ended_by,self.manager);self.assertIsNotNone(a.ended_at)
        self.assertTrue(UnitAssignment.objects.filter(pk=a.pk).exists())

    def test_standalone_ai_requires_landlord_and_current_consent(self):
        self.client.force_login(self.tenant)
        self.assertEqual(self.client.post('/api/inspections/compare/').status_code,403)
        self.client.force_login(self.manager);PolicyConsent.objects.filter(user=self.manager).delete()
        self.assertEqual(self.client.post('/api/inspections/compare/').status_code,409)

    def test_revoked_manager_authority_invalidates_pending_invitation(self):
        token=self.invite()
        self.property.managers.remove(self.manager)
        self.client.force_login(self.tenant)
        self.assertEqual(self.post('/api/tenant/invite/accept/',{'token':token}).status_code,409)
        self.assertFalse(UnitAssignment.objects.exists())

    @patch("maintenance.housing.timezone.now")
    def test_appointment_local_times_and_dst_are_validated_by_server(self, now):
        now.return_value=datetime(2026,11,21,tzinfo=dt_timezone.utc)
        UnitAssignment.objects.create(tenant=self.tenant,unit=self.unit,verified_by=self.manager)
        data=dict(unit_id=str(self.unit.pk),tenant_id=str(self.tenant.pk),timezone='America/New_York',idempotency_key='local_appointment_0001',slots=['2027-03-14 02:30'])
        self.assertEqual(self.post('/api/housing/appointments/',data).status_code,400)
        self.assertEqual(self.post('/api/housing/appointments/',{**data,'slots':['2027-11-07 01:30']}).status_code,400)
        response=self.post('/api/housing/appointments/',{**data,'slots':[(timezone.now()+timedelta(days=2)).strftime('%Y-%m-%d 14:00')]})
        self.assertEqual(response.status_code,200,response.content)
        self.assertIn('-05:00',response.json()['appointments'][0]['slots'][0]['at'])
