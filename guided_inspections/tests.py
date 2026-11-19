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
        # Raw provider ledgers are not Django model tables and are not flushed by
        # TransactionTestCase. Isolate them between cases just like ORM records.
        storage.database().inspection_ai_usage.delete_many({})
        storage.database().inspection_comparisons.delete_many({})
        self.addCleanup(lambda: storage.database().inspection_ai_usage.delete_many({}))
        self.addCleanup(lambda: storage.database().inspection_comparisons.delete_many({}))
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
        if response.status_code == 200 and 'inspection' in response.json():
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

    def test_landlord_baseline_through_guided_sdk_analysis_and_final_review(self):
        """Exercise the real SDK serialization across the complete guided API flow."""
        try:
            import httpx
        except ImportError:
            import httpx2 as httpx
        from google import genai
        from google.genai import types
        from inspections.tests.test_services import DAMAGE_RESPONSE

        draft = self.fill_baseline(self.baseline_draft())
        self.assertEqual(self.approve_draft(draft).status_code, 200)
        baseline_id = UnitBaseline.objects.get(unit=self.unit).active_id
        self.record = self.create('periodic', 'guided_sdk_lifecycle_01')
        self.client.force_login(self.tenant)
        self.assertEqual(self.refresh()['status'], 'assigned')
        self.fill()
        self.client.logout()
        self.client.force_login(self.tenant)
        self.assertEqual(self.refresh()['status'], 'submitted')
        self.client.force_login(self.landlord)
        self.refresh()
        requests = []

        def respond(request):
            payload = json.loads(request.content)
            requests.append(payload)
            config = payload['generationConfig']
            self.assertNotIn('responseSchema', config)
            self.assertIs(config['responseJsonSchema']['additionalProperties'], False)
            self.assertNotIn('additional_properties', json.dumps(payload))
            return httpx.Response(200, json={'candidates': [{'content': {
                'parts': [{'text': json.dumps(DAMAGE_RESPONSE)}], 'role': 'model',
            }}]})

        def offline_client():
            return genai.Client(api_key='test-key', http_options=types.HttpOptions(
                client_args={'transport': httpx.MockTransport(respond)},
                retry_options=types.HttpRetryOptions(attempts=1),
            ))

        # Five steps in this fixture; production's three-call daily limit is unchanged.
        with patch('guided_inspections.store.media.retrieve', return_value=image().read()), \
                patch('inspections.services._get_client', side_effect=offline_client), \
                patch('inspections.storage.DAILY_AI_CALLS_PER_USER', 5):
            for photo in self.record['photos']:
                self.assertEqual(self.action('compare', photo_id=photo['id']).status_code, 200)
                self.assertEqual(self.action('compare', photo_id=photo['id']).status_code, 200)
        self.assertEqual(len(requests), 5)  # repeat actions never charge again
        self.assertEqual(len(self.record['comparisons']), 5)
        self.assertEqual(self.action('finalize').status_code, 409)
        for comparison in self.record['comparisons']:
            self.assertEqual(comparison['baseline_id'], baseline_id)
            self.assertEqual(comparison['result']['analysis_status'], 'completed')
            self.assertEqual(comparison['result']['classification'], 'damage')
            self.assertEqual(self.action('decision', comparison_id=comparison['id'],
                                         decision='confirmed').status_code, 200)
        self.assertEqual(self.action('finalize').status_code, 200)
        self.client.logout()
        self.client.force_login(self.landlord)
        self.assertEqual(self.refresh()['status'], 'reviewed')
        self.assertTrue(all(c['decision'] == 'confirmed' for c in self.record['comparisons']))
        self.client.force_login(self.tenant)
        self.assertEqual(self.refresh()['status'], 'reviewed')

    def test_assignment_cross_account_and_role_boundaries(self):
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.base+self.record['id']+'/').status_code, 404)
        self.assertEqual(self.client.get(self.base).json()['inspections'], [])
        self.client.force_login(self.tenant)
        self.assertEqual(self.post('templates/', {'name': 'No'}).status_code, 404)
        self.assertEqual(self.action('approve-baseline').status_code, 404)
        UnitAssignment.objects.filter(tenant=self.tenant).update(active=False)
        self.assertEqual(self.client.get(self.base+'notifications/').json()['notifications'], [])
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

    def test_private_photo_proxy_and_wrong_user(self):
        self.fill()
        photo = self.record['photos'][0]['id']
        url = self.base+self.record['id']+'/photos/'+photo+'/'
        with patch('guided_inspections.views.media.retrieve', return_value=b'private-jpeg') as retrieve:
            response = self.client.get(url)
            self.assertEqual(response.content, b'private-jpeg')
            self.assertIn('no-store', response['Cache-Control'])
            self.client.force_login(self.other)
            self.assertEqual(self.client.get(url).status_code, 404)
            self.assertEqual(retrieve.call_count, 1)
        self.client.force_login(self.landlord)
        payload = json.dumps(self.refresh())
        self.assertNotIn('cloudinary', payload)
        self.assertNotIn('public_id', payload)
        self.assertNotIn('asset_id', payload)

    def test_concurrent_revisions_reject_lost_updates(self):
        from maintenance.store import Conflict
        record = store.collection().find_one({'public_id': self.record['id']})
        store.change(record, {'status': 'draft'})
        with self.assertRaises(Conflict):
            store.change(record, {'status': 'submitted'})

    def test_idempotent_assignment_and_invalid_input(self):
        values = dict(unit_id=str(self.unit.pk), tenant_id=str(self.tenant.pk), template_id=self.template,
                      due_at=(timezone.now()+timedelta(days=3)).isoformat(), inspection_type='periodic', idempotency_key='retry_assignment_0001')
        first = self.post('', values)
        second = self.post('', values)
        self.assertEqual(first.json()['inspection']['id'], second.json()['inspection']['id'])
        self.assertEqual(self.post('', {**values, 'inspection_type': 'move-out'}).status_code, 409)
        self.assertEqual(self.post('', {}).status_code, 400)
        self.assertEqual(self.post('', {**values, 'unit_id': 'invalid'}).status_code, 400)

    def test_template_mismatch_never_matches_by_position(self):
        self.fill(); self.client.force_login(self.landlord); self.action('approve-baseline')
        self.template = self.post('templates/', dict(name='Different layout', steps=store.DEFAULT_STEPS)).json()['id']
        self.record = self.create('periodic', 'layout_test_0001'); self.fill(); self.client.force_login(self.landlord)
        with patch('guided_inspections.store.compare_images_safe') as ai:
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 409)
            ai.assert_not_called()

    def test_scheduler_and_notifications_are_idempotent(self):
        from .operations import reconcile
        GuidedInspection.objects.filter(public_id=self.record['id']).update(recurrence_days=30)
        self.fill(); self.client.force_login(self.landlord); self.action('approve-baseline')
        reconcile(); count = InspectionNotification.objects.count(); reconcile()
        self.assertEqual(GuidedInspection.objects.count(), 2)
        # Second pass publishes the newly-created assignment once.
        self.assertEqual(InspectionNotification.objects.count(), count+1)
        reconcile(); self.assertEqual(InspectionNotification.objects.count(), count+1)
        self.client.force_login(self.tenant)
        notifications = self.client.get(self.base+'notifications/').json()['notifications']
        self.assertTrue(notifications)
        self.assertEqual(self.post('notifications/', {'id': notifications[0]['id']}).status_code, 200)
        self.assertIsNotNone(InspectionNotification.objects.get(event_key=notifications[0]['id']).read_at)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.base+'notifications/').json()['notifications'], [])

    def test_tenant_maintenance_followup_reuses_evidence_and_keeps_retention(self):
        from maintenance.models import MaintenanceRequest
        from maintenance.cleanup import cleanup
        self.fill(); self.client.force_login(self.landlord); self.action('approve-baseline')
        self.record = self.create('periodic', 'maintenance_test_001'); self.fill(); self.client.force_login(self.landlord)
        with patch('guided_inspections.store.media.retrieve', return_value=b'photo'), patch('guided_inspections.store.compare_images_safe', return_value=_manual_result()):
            self.action('compare', photo_id=self.record['photos'][0]['id'])
        comparison = self.record['comparisons'][0]['id']; self.action('decision', comparison_id=comparison, decision='confirmed')
        self.client.force_login(self.tenant)
        response = self.action('maintenance-draft', comparison_id=comparison)
        self.assertEqual(response.status_code, 200, response.content)
        maintenance_id = response.json()['maintenance_id']
        self.assertEqual(self.action('maintenance-draft', comparison_id=comparison).json()['maintenance_id'], maintenance_id)
        draft = MaintenanceRequest.objects.get(public_id=maintenance_id)
        self.assertEqual(len(draft.photos), 5)
        response = self.client.post('/api/maintenance/'+maintenance_id+'/submit/', '{}', content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        self.client.force_login(self.landlord)
        self.assertEqual(self.action('maintenance', comparison_id=comparison, maintenance_id=maintenance_id).status_code, 200)
        with patch('maintenance.cleanup.media.delete') as delete:
            cleanup(storage.database(), timezone.now()+timedelta(days=365), True, 100)
            delete.assert_not_called()

    def test_shared_manager_dedup_and_interrupted_analysis_recovery(self):
        self.fill(); self.client.force_login(self.landlord); self.action('approve-baseline')
        self.record = self.create('periodic', 'manager_test_001'); self.fill(); self.client.force_login(self.landlord)
        with patch('guided_inspections.store.media.retrieve', return_value=b'photo'), patch('guided_inspections.store.compare_images_safe', return_value=_manual_result()) as ai:
            self.action('compare', photo_id=self.record['photos'][0]['id'])
            self.unit.property.managers.add(self.other)
            self.client.force_login(self.other)
            self.action('compare', photo_id=self.record['photos'][0]['id'])
            self.assertEqual(ai.call_count, 1)
            record = store.collection().find_one({'public_id': self.record['id']})
            entry = {**record['comparisons'][0], 'status': 'pending', 'result': None}
            store.change(record, {'comparisons': [entry]}); self.refresh()
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 200)
            self.assertEqual(self.record['comparisons'][0]['status'], 'completed')
            self.assertEqual(ai.call_count, 1)

    def test_late_upload_cannot_replace_newer_evidence(self):
        from maintenance.store import Conflict
        self.client.force_login(self.tenant)
        self.client.post(self.base+self.record['id']+'/photos/', dict(photo=image(), step_id='entry-wide', slot=0, revision=0))
        current = store.collection().find_one({'public_id': self.record['id']})
        ready = current['photos'][0]
        old = {**ready, 'id': 'd'*64, 'state': 'uploading', 'token': 'old', 'replaced_at': timezone.now().isoformat()}
        updated = store.change(current, {'photos': [ready, old]})
        with self.assertRaises(Conflict):
            store.finish_upload(updated, old['id'], 'old', old['ref'], 'ready', self.tenant.pk)
        self.assertEqual(store.active(store.collection().find_one({'_id': current['_id']})), [ready])

    def test_late_ai_response_cannot_overwrite_a_recovered_human_decision(self):
        self.fill(); self.client.force_login(self.landlord); self.action('approve-baseline')
        self.record = self.create('periodic', 'late_result_test_001'); self.fill(); self.client.force_login(self.landlord)
        def delayed_response(*args):
            record = store.collection().find_one({'public_id': self.record['id']})
            entry = {**record['comparisons'][0], 'status': 'completed', 'decision': 'manual-review',
                     'result': _manual_result('Recovered for manual review.')}
            store.change(record, {'comparisons': [entry]})
            return _manual_result('Late provider response.')
        with patch('guided_inspections.store.media.retrieve', return_value=b'photo'), patch('guided_inspections.store.compare_images_safe', side_effect=delayed_response):
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 200)
        self.assertEqual(self.record['comparisons'][0]['result']['summary'], 'Recovered for manual review.')
        self.assertEqual(self.record['comparisons'][0]['decision'], 'manual-review')

    def baseline_draft(self):
        self.client.force_login(self.landlord)
        response = self.post(f'units/{self.unit.pk}/baselines/', {'template_id': self.template})
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()['draft']

    def fill_baseline(self, draft):
        for i, step in enumerate(store.DEFAULT_STEPS):
            response = self.client.post(self.base+f"baseline-drafts/{draft['id']}/photos/", dict(
                photo=image(i), step_id=step['id'], slot=0, revision=draft['revision']))
            self.assertEqual(response.status_code, 200, response.content)
            draft = response.json()['draft']
        return draft

    def approve_draft(self, draft, **extra):
        return self.post(f"baseline-drafts/{draft['id']}/", dict(revision=draft['revision'], **extra))

    def test_landlord_baseline_without_tenant_and_future_matching(self):
        # No tenant assignment is needed to create, capture, resume or approve.
        UnitAssignment.objects.all().delete()
        draft = self.baseline_draft()
        self.assertEqual(self.baseline_draft()['id'], draft['id'])
        self.assertEqual(self.approve_draft(draft).status_code, 409)
        draft = self.fill_baseline(draft)
        self.client.logout(); self.client.force_login(self.landlord)
        url = self.base+f"baseline-drafts/{draft['id']}/"
        self.assertEqual(self.client.get(url).json()['draft']['progress'], 5)
        approved = self.approve_draft(draft)
        self.assertEqual(approved.status_code, 200, approved.content)
        self.assertEqual(self.approve_draft(draft).status_code, 200)  # lost-response retry
        head = UnitBaseline.objects.get(unit=self.unit)
        self.assertEqual(len(head.versions), 1)
        self.assertEqual(head.versions[0]['source'], 'landlord')
        UnitAssignment.objects.create(unit=self.unit, tenant=self.tenant, verified_by=self.landlord)
        self.record = self.create('periodic', 'landlord_base_future_01'); self.fill()
        self.client.force_login(self.landlord); self.refresh()
        self.assertTrue(self.record['baseline_available'])
        with patch('guided_inspections.store.media.retrieve', return_value=b'photo'), patch('guided_inspections.store.compare_images_safe', return_value=_manual_result()) as ai:
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 200)
            ai.assert_called_once()
        self.assertEqual(self.record['comparisons'][0]['baseline_id'], head.active_id)

    def test_landlord_baseline_permissions_and_private_evidence(self):
        draft = self.fill_baseline(self.baseline_draft())
        self.assertEqual(self.approve_draft(draft).status_code, 200)
        head = UnitBaseline.objects.get(unit=self.unit)
        urls = [f"baseline-drafts/{draft['id']}/", f"baseline-drafts/{draft['id']}/photos/{draft['photos'][0]['id']}/",
                f'units/{self.unit.pk}/baselines/', f"units/{self.unit.pk}/baselines/{head.active_id}/photos/{draft['photos'][0]['id']}/"]
        for user in [self.tenant, self.other]:
            self.client.force_login(user)
            for url in urls:
                self.assertEqual(self.client.get(self.base+url).status_code, 404)
            self.assertEqual(self.approve_draft(draft).status_code, 404)
        self.client.force_login(self.landlord)
        with patch('guided_inspections.baselines.media.retrieve', return_value=b'private'):
            response = self.client.get(self.base+urls[-1])
            self.assertEqual(response.content, b'private')
            self.assertIn('no-store', response['Cache-Control'])
        content = self.client.get(self.base+urls[2]).content
        for secret in [b'public_id', b'asset_id', b'cloudinary', b'api_key']:
            self.assertNotIn(secret, content)

    def test_explicit_supersession_immutability_and_pinned_analysis(self):
        draft = self.fill_baseline(self.baseline_draft()); self.approve_draft(draft)
        old = UnitBaseline.objects.get(unit=self.unit)
        self.record = self.create('periodic', 'supersession_periodic_1'); self.fill(); self.client.force_login(self.landlord)
        with patch('guided_inspections.store.media.retrieve', return_value=b'photo'), patch('guided_inspections.store.compare_images_safe', return_value=_manual_result()):
            self.action('compare', photo_id=self.record['photos'][0]['id'])
        pinned = self.record['comparisons'][0]
        second = self.fill_baseline(self.baseline_draft())
        self.assertEqual(self.approve_draft(second).status_code, 409)
        self.assertEqual(self.approve_draft(second, supersedes=old.active_id).status_code, 200)
        updated = UnitBaseline.objects.get(unit=self.unit)
        self.assertEqual(updated.versions[0], old.versions[0])
        self.assertEqual(len(updated.versions), 2)
        with patch('guided_inspections.store.media.retrieve') as retrieve, patch('guided_inspections.store.compare_images_safe') as ai:
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 200)
            retrieve.assert_not_called(); ai.assert_not_called()
        self.assertEqual(self.record['comparisons'][0], pinned)
        response = self.client.post(self.base+f"baseline-drafts/{draft['id']}/photos/", dict(photo=image(99), step_id='entry-wide', slot=0, revision=self.client.get(self.base+f"baseline-drafts/{draft['id']}/").json()['draft']['revision']))
        self.assertEqual(response.status_code, 409)
        with self.assertRaises(media.StorageError): media.delete(old.versions[0]['photos'][0]['ref'])

    def test_baseline_concurrent_approval_requires_exact_head(self):
        draft = self.fill_baseline(self.baseline_draft())
        self.fill(); self.client.force_login(self.landlord)
        self.assertEqual(self.action('approve-baseline').status_code, 200)
        self.assertEqual(self.approve_draft(draft).status_code, 409)
        self.assertEqual(len(UnitBaseline.objects.get(unit=self.unit).versions), 1)

    def test_baseline_upload_failure_recovery_replacement_and_revision(self):
        draft = self.baseline_draft()
        url = self.base+f"baseline-drafts/{draft['id']}/photos/"
        def upload(d, value=0):
            return self.client.post(url, dict(photo=image(value), step_id='entry-wide', slot=0, revision=d['revision']))
        with patch('guided_inspections.store.media.upload_or_recover', side_effect=media.StorageError('timeout')):
            self.assertEqual(upload(draft).status_code, 503)
        draft = self.client.get(self.base+f"baseline-drafts/{draft['id']}/").json()['draft']
        self.assertEqual(draft['progress'], 0)
        ready = upload(draft).json()['draft']
        self.assertEqual(upload(draft, 1).status_code, 409)
        self.assertEqual(upload(ready).json()['draft']['progress'], 1)
        new = upload(ready, 9).json()['draft']
        self.assertNotEqual(new['photos'][0]['id'], ready['photos'][0]['id'])
        from .models import LandlordBaselineDraft
        self.assertEqual(len(LandlordBaselineDraft.objects.get(public_id=draft['id']).photos), 2)

    def test_high_severity_alert_is_unverified_scoped_and_idempotent(self):
        from inspections.tests.test_services import DAMAGE_RESPONSE
        draft = self.fill_baseline(self.baseline_draft()); self.approve_draft(draft)
        self.record = self.create('periodic', 'high_severity_alert_01'); self.fill(); self.client.force_login(self.landlord)
        self.unit.property.managers.add(self.other)
        result = {**DAMAGE_RESPONSE, 'severity': 'high', 'analysis_status': 'completed', 'requires_manual_review': True}
        with patch('guided_inspections.store.media.retrieve', return_value=b'photo'), patch('guided_inspections.store.compare_images_safe', return_value=result):
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 200)
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 200)
        alerts = InspectionNotification.objects.filter(message__startswith='Unverified')
        self.assertEqual(alerts.count(), 2)
        self.assertEqual(set(alerts.values_list('recipient_id', flat=True)), {self.landlord.pk, self.other.pk})
        self.assertIsNone(self.record['comparisons'][0]['decision'])
        self.unit.property.managers.remove(self.other)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.base+'notifications/').json()['notifications'], [])

    def test_unavailable_or_uncertain_analysis_never_alerts(self):
        from .views import notify_high_severity
        from inspections.tests.test_services import DAMAGE_RESPONSE
        record = store.collection().find_one({'public_id': self.record['id']})
        for result in [_manual_result(), {**DAMAGE_RESPONSE, 'analysis_status': 'completed', 'severity': 'high', 'confidence': 'low'}]:
            notify_high_severity({**record, 'comparisons': [dict(id='fixture', status='completed', result=result)]})
        self.assertFalse(InspectionNotification.objects.filter(message__startswith='Unverified').exists())

    def test_resolved_decision_requires_confirmation_and_retains_audit(self):
        draft = self.fill_baseline(self.baseline_draft()); self.approve_draft(draft)
        self.record = self.create('periodic', 'resolved_review_test_1'); self.fill(); self.client.force_login(self.landlord)
        with patch('guided_inspections.store.media.retrieve', return_value=b'photo'), patch('guided_inspections.store.compare_images_safe', return_value=_manual_result()):
            self.action('compare', photo_id=self.record['photos'][0]['id'])
        key = self.record['comparisons'][0]['id']
        self.assertEqual(self.action('decision', comparison_id=key, decision='resolved').status_code, 409)
        self.assertEqual(self.action('decision', comparison_id=key, decision='confirmed').status_code, 200)
        self.assertEqual(self.action('finalize').status_code, 200)
        self.assertEqual(self.action('decision', comparison_id=key, decision='resolved').status_code, 200)
        self.assertEqual(self.record['comparisons'][0]['decision'], 'resolved')
        self.assertIn('confirmed', [h['action'] for h in self.record['history']])
        self.assertIn('resolved', [h['action'] for h in self.record['history']])

    def test_local_ai_quotas_are_atomic_across_concurrent_requests(self):
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=8) as pool:
            reservations = list(pool.map(lambda _: storage.consume_daily_call('concurrent-account'), range(12)))
        self.assertEqual(sum(reservations), 3)
        storage.database().inspection_ai_usage.delete_many({})  # isolated test DB only
        with ThreadPoolExecutor(max_workers=8) as pool:
            reservations = list(pool.map(lambda i: storage.consume_daily_call(f'account-{i}'), range(42)))
        self.assertEqual(sum(reservations), 30)

    def test_cross_unit_baselines_and_incompatible_templates_never_compare(self):
        from .models import LandlordBaselineDraft
        draft = self.fill_baseline(self.baseline_draft()); self.approve_draft(draft)
        other_unit = Unit.objects.create(property=self.unit.property, label='202')
        UnitAssignment.objects.create(unit=other_unit, tenant=self.tenant, verified_by=self.landlord)
        GuidedInspection.objects.filter(public_id=self.record['id']).update(unit=other_unit)
        self.fill(); self.client.force_login(self.landlord)
        self.assertFalse(self.refresh()['baseline_available'])
        with patch('guided_inspections.store.media.retrieve') as retrieve:
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 409)
            retrieve.assert_not_called()
        source = LandlordBaselineDraft.objects.get(public_id=draft['id'])
        self.assertEqual(source.unit_id, self.unit.pk)

    def test_interrupted_baseline_publication_remains_resumable(self):
        draft = self.fill_baseline(self.baseline_draft())
        from .models import LandlordBaselineDraft
        record = store.collection(LandlordBaselineDraft).find_one({'public_id': draft['id']})
        frozen = store.change(store.submit(record, self.landlord.pk), {'status': 'reviewed'})
        history = self.client.get(self.base+f'units/{self.unit.pk}/baselines/').json()
        self.assertEqual(history['drafts'][0]['id'], draft['id'])
        self.assertEqual(self.approve_draft({**draft, 'revision': frozen['revision']}).status_code, 200)
        self.assertEqual(len(UnitBaseline.objects.get(unit=self.unit).versions), 1)

    def test_private_retrieval_failure_persists_manual_fallback_without_budget(self):
        draft = self.fill_baseline(self.baseline_draft()); self.approve_draft(draft)
        self.record = self.create('periodic', 'retrieval_failure_test'); self.fill(); self.client.force_login(self.landlord)
        with patch('guided_inspections.store.media.retrieve', side_effect=media.StorageError('private failure')), patch('guided_inspections.store.compare_images_safe') as ai, patch('guided_inspections.store.storage.consume_daily_call') as budget:
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 200)
            self.assertEqual(self.action('compare', photo_id=self.record['photos'][0]['id']).status_code, 200)
            ai.assert_not_called(); budget.assert_not_called()
        self.assertEqual(self.record['comparisons'][0]['result']['analysis_status'], 'unavailable')
        self.assertEqual(self.record['comparisons'][0]['result']['findings'], [])

    def test_current_manager_can_reuse_units_saved_baseline_template(self):
        draft = self.fill_baseline(self.baseline_draft()); self.approve_draft(draft)
        self.unit.property.managers.add(self.other)
        self.client.force_login(self.other)
        choices = self.client.get(self.base+'options/').json()
        self.assertEqual(choices['units'][0]['baseline_template_id'], self.template)
        self.assertIn(self.template, [t['id'] for t in choices['templates']])
        values = dict(unit_id=str(self.unit.pk), tenant_id=str(self.tenant.pk), template_id=self.template,
                      due_at=(timezone.now()+timedelta(days=3)).isoformat(), inspection_type='periodic', idempotency_key='other_manager_layout_1')
        self.assertEqual(self.post('', values).status_code, 200)

    def test_individual_findings_have_independent_decisions_and_audit(self):
        from inspections.tests.test_services import DAMAGE_RESPONSE
        draft = self.fill_baseline(self.baseline_draft()); self.approve_draft(draft)
        self.record = self.create('periodic', 'individual_findings_01'); self.fill(); self.client.force_login(self.landlord)
        result = {**DAMAGE_RESPONSE, 'analysis_status': 'completed', 'findings': DAMAGE_RESPONSE['findings'] * 2}
        with patch('guided_inspections.store.media.retrieve', return_value=b'photo'), patch('guided_inspections.store.compare_images_safe', return_value=result):
            self.action('compare', photo_id=self.record['photos'][0]['id'])
        key = self.record['comparisons'][0]['id']
        self.assertEqual(self.action('decision', comparison_id=key, finding_index=99, decision='confirmed').status_code, 400)
        self.assertEqual(self.action('decision', comparison_id=key, finding_index=0, decision='confirmed').status_code, 200)
        self.assertEqual(self.action('finalize').status_code, 409)
        self.assertEqual(self.action('decision', comparison_id=key, finding_index=1, decision='dismissed').status_code, 200)
        self.assertEqual(self.record['comparisons'][0]['finding_decisions'], ['confirmed', 'dismissed'])
        self.assertEqual(self.action('finalize').status_code, 200)
        self.assertEqual(self.action('decision', comparison_id=key, finding_index=0, decision='resolved').status_code, 200)
        self.assertEqual(self.record['comparisons'][0]['finding_decisions'], ['resolved', 'dismissed'])
        self.assertEqual(self.record['history'][-1]['finding_index'], 0)

    def test_concurrent_comparisons_make_one_bounded_provider_call(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Event
        from maintenance.store import Conflict
        draft = self.fill_baseline(self.baseline_draft()); self.approve_draft(draft)
        self.record = self.create('periodic', 'concurrent_pair_test_1'); self.fill(); self.client.force_login(self.landlord)
        record = store.collection().find_one({'public_id': self.record['id']})
        photo = self.record['photos'][0]['id']
        started, release = Event(), Event()
        def provider(*args):
            started.set()
            self.assertTrue(release.wait(5))
            return _manual_result()
        with patch('guided_inspections.store.media.retrieve', return_value=b'photo'), patch('guided_inspections.store.compare_images_safe', side_effect=provider) as ai, ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(store.compare, record, photo, self.landlord.pk)
            self.assertTrue(started.wait(5))
            try:
                with self.assertRaises(Conflict):
                    store.compare(record, photo, self.landlord.pk)
            finally:
                release.set()
            self.assertEqual(first.result(timeout=10)['comparisons'][0]['status'], 'completed')
            self.assertEqual(ai.call_count, 1)
