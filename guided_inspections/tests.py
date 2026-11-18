"""Real isolated MongoDB lifecycle with mocked private storage and AI."""
import json
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, Client, override_settings
from django.utils import timezone
from accounts.models import AccountProfile
from maintenance.models import Property, Unit, UnitAssignment
from maintenance.tests import image
from inspections.views import _manual_result
from inspections import media, storage
from .models import GuidedInspection, UnitBaseline, InspectionNotification
from . import store


@override_settings(CLOUDINARY_URL='cloudinary://test:test@fixture', GEMINI_API_KEY='')
class GuidedTests(TransactionTestCase):
    def setUp(self):
        User = get_user_model()
        self.landlord = User.objects.create_user(username='manager')
        self.tenant = User.objects.create_user(username='resident')
        self.other = User.objects.create_user(username='outsider')
        for user, role in [(self.landlord, 'landlord'), (self.tenant, 'tenant'), (self.other, 'landlord')]:
            AccountProfile.objects.create(user=user, role=role)
        prop = Property.objects.create(name='Test property'); prop.managers.add(self.landlord)
        self.unit = Unit.objects.create(property=prop, label='101')
        UnitAssignment.objects.create(unit=self.unit, tenant=self.tenant, verified_by=self.landlord)
        self.base = '/api/guided-inspections/'
        self.client.force_login(self.landlord)
        self.template = self.post('templates/', {'name': 'Apartment', 'steps': store.DEFAULT_STEPS}).json()['id']
        self.storage_mock = patch('guided_inspections.store.media.upload_or_recover', side_effect=lambda ref, data: {**ref, 'asset_id': 'fixture'})
        self.storage_mock.start(); self.addCleanup(patch.stopall)
        patch('inspections.services._get_client', side_effect=AssertionError('Paid calls forbidden')).start()
        self.record = self.create()

    def post(self, path, data):
        return self.client.post(self.base + path, json.dumps(data), content_type='application/json')

    def create(self, kind='move-in', key='assignment_test_0001'):
        self.client.force_login(self.landlord)
        response = self.post('', dict(unit_id=str(self.unit.pk), tenant_id=str(self.tenant.pk), template_id=self.template,
                                     due_at=(timezone.now()+timedelta(days=7)).isoformat(), inspection_type=kind, idempotency_key=key))
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()['inspection']

    def refresh(self):
        response = self.client.get(self.base+self.record['id']+'/')
        self.assertEqual(response.status_code, 200, response.content)
        self.record = response.json()['inspection']
        return self.record

    def action(self, name, **values):
        response = self.post(self.record['id']+'/'+name+'/', dict(revision=self.record['revision'], **values))
        if response.status_code == 200:
            self.record = response.json()['inspection']
        return response

    def fill(self):
        self.client.force_login(self.tenant)
        for i, step in enumerate(store.DEFAULT_STEPS):
            response = self.client.post(self.base+self.record['id']+'/photos/', dict(photo=image(i), step_id=step['id'], slot=0, revision=self.record['revision']))
            self.assertEqual(response.status_code, 200, response.content)
            self.record = response.json()['inspection']
        self.assertEqual(self.action('submit').status_code, 200)

    def test_complete_baseline_future_comparison_and_human_review(self):
        self.fill(); self.client.force_login(self.landlord)
        self.assertEqual(self.action('approve-baseline').status_code, 200)
        self.assertEqual(UnitBaseline.objects.get(unit=self.unit).versions[0]['inspection_id'], self.record['id'])
        self.record = self.create('periodic', 'periodic_test_0001'); self.fill()
        self.client.force_login(self.landlord); self.refresh()
        self.assertTrue(self.record['baseline_available'])
        with patch('guided_inspections.store.media.retrieve', return_value=b'photo'), patch('guided_inspections.store.compare_images_safe', return_value=_manual_result()) as ai:
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 200)
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 200)
            self.assertEqual(ai.call_count, 1)
        comparison = self.record['comparisons'][0]
        self.assertEqual(self.action('finalize').status_code, 409)
        self.assertEqual(self.action('decision', comparison_id=comparison['id'], decision='dismissed').status_code, 200)
        self.assertEqual(self.action('finalize').status_code, 200)
        self.assertEqual(self.record['status'], 'reviewed')
        self.assertGreater(InspectionNotification.objects.count(), 0)

    def test_assignment_cross_account_and_role_boundaries(self):
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.base+self.record['id']+'/').status_code, 404)
        self.assertEqual(self.client.get(self.base).json()['inspections'], [])
        self.client.force_login(self.tenant)
        self.assertEqual(self.post('templates/', {'name': 'No'}).status_code, 404)
        self.assertEqual(self.action('approve-baseline').status_code, 404)
        UnitAssignment.objects.filter(tenant=self.tenant).update(active=False)
        self.assertEqual(self.client.get(self.base+self.record['id']+'/').status_code, 404)

    def test_draft_resume_and_incomplete_submission(self):
        self.client.force_login(self.tenant)
        self.assertEqual(self.action('submit').status_code, 409)
        response = self.client.post(self.base+self.record['id']+'/photos/', dict(photo=image(), step_id='entry-wide', slot=0, revision=0))
        self.assertEqual(response.status_code, 200, response.content)
        self.client.logout(); self.client.force_login(self.tenant)
        self.assertEqual(self.refresh()['progress'], 1)
        self.assertEqual(self.record['status'], 'draft')

    def test_upload_failure_recovery_dedup_and_concurrency(self):
        self.client.force_login(self.tenant)
        with patch('guided_inspections.store.media.upload_or_recover', side_effect=media.StorageError('failed')):
            response = self.client.post(self.base+self.record['id']+'/photos/', dict(photo=image(), step_id='entry-wide', slot=0, revision=0))
            self.assertEqual(response.status_code, 503)
        self.refresh()
        self.assertEqual(self.record['progress'], 0)
        for _ in range(2):
            response = self.client.post(self.base+self.record['id']+'/photos/', dict(photo=image(), step_id='entry-wide', slot=0, revision=self.record['revision']))
            self.assertEqual(response.status_code, 200, response.content)
            self.record = response.json()['inspection']
        self.assertEqual(self.record['progress'], 1)
        stale = self.client.post(self.base+self.record['id']+'/photos/', dict(photo=image(2), step_id='entry-wide', slot=0, revision=0))
        self.assertEqual(stale.status_code, 409)

    def test_retake_preserves_submitted_evidence(self):
        self.fill(); self.client.force_login(self.landlord)
        self.assertEqual(self.action('retake', reason='Photograph the entry again.').status_code, 200)
        self.client.force_login(self.tenant)
        response = self.client.post(self.base+self.record['id']+'/photos/', dict(photo=image(99), step_id='entry-wide', slot=0, revision=self.record['revision']))
        self.assertEqual(response.status_code, 200, response.content)
        record = GuidedInspection.objects.get(public_id=self.record['id'])
        self.assertEqual(len(record.photos), 6)
        self.assertEqual(len([p for p in record.photos if p.get('replaced_at')]), 1)

    def test_baseline_immutable_and_retained(self):
        self.fill(); self.client.force_login(self.landlord)
        self.assertEqual(self.action('approve-baseline').status_code, 200)
        base = UnitBaseline.objects.get(unit=self.unit)
        self.assertEqual(self.action('retake', reason='No').status_code, 409)
        self.assertEqual(self.action('approve-baseline').status_code, 200)
        self.assertEqual(UnitBaseline.objects.get(unit=self.unit).versions, base.versions)
        with self.assertRaises(media.StorageError): media.delete(base.versions[0]['photos'][0]['ref'])

    def test_csrf_and_authentication(self):
        c = Client(enforce_csrf_checks=True)
        self.assertEqual(c.get(self.base).status_code, 401)
        c.force_login(self.landlord)
        self.assertEqual(c.post(self.base, '{}', content_type='application/json').status_code, 403)

    def test_invalid_templates(self):
        for steps in [[], store.DEFAULT_STEPS[:1], [store.DEFAULT_STEPS[0]]*5]:
            self.assertEqual(self.post('templates/', dict(name='Invalid', steps=steps)).status_code, 400)

    def test_no_baseline_and_shared_budget(self):
        self.fill(); self.client.force_login(self.landlord)
        self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 409)
        self.assertEqual(self.action('approve-baseline').status_code, 200)
        self.record = self.create('periodic', 'periodic_budget_001'); self.fill(); self.client.force_login(self.landlord)
        for _ in range(3): self.assertTrue(storage.consume_daily_call(str(self.landlord.pk)))
        with patch('guided_inspections.store.media.retrieve', return_value=b'photo'), patch('guided_inspections.store.compare_images_safe') as ai:
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 200)
            ai.assert_not_called()
        self.assertEqual(self.record['comparisons'][0]['result']['analysis_status'], 'unavailable')
