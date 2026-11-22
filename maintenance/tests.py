"""Real MongoDB integration with mocked provider I/O; no paid calls."""
import io
import json
from datetime import timedelta
from unittest.mock import patch

from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TransactionTestCase, override_settings
from django.utils import timezone

from accounts.models import AccountProfile
from inspections import media
from . import store
from .cleanup import cleanup
from .models import Property, Unit, UnitAssignment, MaintenanceRequest


def image(number=0):
    out = io.BytesIO()
    Image.new('RGB', (32, 32), (number * 10 % 256, number * 3 % 256, number * 7 % 256)).save(out, 'PNG')
    return SimpleUploadedFile('photo.png', out.getvalue(), content_type='image/png')


@override_settings(CLOUDINARY_URL='cloudinary://test:test@fixture', GEMINI_API_KEY='')
class MaintenanceTests(TransactionTestCase):
    def setUp(self):
        User = get_user_model()
        self.tenant = User.objects.create_user(username='tenant')
        self.other = User.objects.create_user(username='other')
        self.landlord = User.objects.create_user(username='landlord')
        self.stranger = User.objects.create_user(username='stranger')
        for user, role in [(self.tenant, 'tenant'), (self.other, 'tenant'),
                           (self.landlord, 'landlord'), (self.stranger, 'landlord')]:
            AccountProfile.objects.create(user=user, role=role)
            from maintenance.models import PolicyConsent
            from maintenance.housing import POLICY_VERSION
            PolicyConsent.objects.create(consent_key=str(user.pk), user=user, role=role, policy_version=POLICY_VERSION)
        self.prop = Property.objects.create(name='Verified property')
        self.prop.managers.add(self.landlord)
        self.unit = Unit.objects.create(property=self.prop, label='101')
        UnitAssignment.objects.create(tenant=self.tenant, unit=self.unit, verified_by=self.landlord)
        self.client.force_login(self.tenant)
        self.upload_mock = patch('maintenance.store.media.upload_or_recover',
                                 side_effect=lambda ref, data: {**ref, 'asset_id': 'asset-test'})
        self.upload = self.upload_mock.start()
        self.addCleanup(self.upload_mock.stop)
        self.ai = patch('inspections.services._get_client', side_effect=AssertionError('Unexpected AI call')).start()
        self.addCleanup(patch.stopall)
        # The existing raw PyMongo helper follows Django's isolated test NAME.
        self.base = '/api/maintenance/'
        self.draft = self.create()
        self.url = f"{self.base}{self.draft['id']}/"

    def post(self, url, data=None, client=None):
        return (client or self.client).post(url, json.dumps(data or {}), content_type='application/json')

    def create(self, key='test_creation_key_0001'):
        response = self.post(self.base, {'unit_id': str(self.unit.pk), 'area': 'Kitchen sink',
                                        'description': 'Leaking cabinet', 'idempotency_key': key})
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()['request']

    def add(self, number=0):
        return self.client.post(self.url + 'photos/', {'photo': image(number)})

    def add_count(self, count):
        for number in range(count):
            response = self.add(number)
            self.assertEqual(response.status_code, 200, response.content)

    def test_four_rejected_five_submitted_and_idempotent_persistent_history(self):
        self.add_count(4)
        self.assertEqual(self.post(self.url + 'submit/').status_code, 409)
        self.assertEqual(self.add(4).status_code, 200)
        response = self.post(self.url + 'submit/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['request']['status'], 'submitted')
        repeated = self.post(self.url + 'submit/').json()['request']
        self.assertEqual(len(repeated['history']), 1)
        self.client.logout()
        self.client.force_login(self.tenant)
        self.assertEqual(self.client.get(self.base).json()['requests'][0]['id'], self.draft['id'])
        saved = MaintenanceRequest.objects.get(public_id=self.draft['id'])
        self.assertEqual(saved.status, 'submitted')
        self.assertEqual(len(saved.photos), 5)
        self.ai.assert_not_called()

    def test_twenty_allowed_twenty_first_rejected(self):
        self.add_count(20)
        self.assertEqual(self.add(20).status_code, 409)
        self.assertEqual(self.post(self.url + 'submit/').status_code, 200)
        self.assertEqual(self.upload.call_count, 20)

    def test_upload_dedup_removal_and_retention(self):
        self.assertEqual(self.create()['id'], self.draft['id'])
        self.add(0)
        self.add(0)
        self.upload.assert_called_once()
        record = store.collection().find_one({'public_id': self.draft['id']})
        photo = record['photos'][0]
        ref = photo['ref']
        self.assertEqual(ref['delivery_type'], 'authenticated')
        self.assertTrue(ref['public_id'].startswith('leaseguard/maintenance/'))
        self.assertGreaterEqual(timezone.datetime.fromisoformat(ref['retain_until']) - timezone.datetime.fromisoformat(ref['uploaded_at']), timedelta(days=90))
        photo_url = self.url + f"photos/{photo['id']}/"
        self.assertEqual(self.client.delete(photo_url).status_code, 200)
        self.assertEqual(self.client.delete(photo_url).status_code, 200)
        self.assertEqual(self.client.get(photo_url).status_code, 404)
        self.assertEqual(len(MaintenanceRequest.objects.get(public_id=self.draft['id']).photos), 1)
        self.add(0)
        self.assertEqual(self.client.get(self.url).json()['request']['photos'][0]['state'], 'ready')

    def test_provider_failure_and_interrupted_lease_can_recover(self):
        self.add_count(4)
        self.upload.side_effect = media.StorageError('secret must not escape')
        response = self.add(4)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn(b'secret must', response.content)
        self.assertEqual(self.post(self.url + 'submit/').status_code, 409)
        self.assertEqual(MaintenanceRequest.objects.get(public_id=self.draft['id']).status, 'draft')
        record = store.collection().find_one({'public_id': self.draft['id']})
        record['photos'][-1].update(state='uploading', lease_until=(timezone.now() - timedelta(seconds=1)).isoformat())
        store.collection().update_one({'_id': record['_id']}, {'$set': {'photos': record['photos']}})
        self.upload.side_effect = lambda ref, data: {**ref, 'asset_id': 'recovered'}
        self.assertEqual(self.add(4).status_code, 200)
        self.assertEqual(self.post(self.url + 'submit/').status_code, 200)
        self.ai.assert_not_called()

    def test_busy_lease_blocks_retry_and_submit(self):
        self.add(0)
        record = store.collection().find_one({'public_id': self.draft['id']})
        record['photos'][0].update(state='uploading', lease_until=(timezone.now() + timedelta(seconds=60)).isoformat())
        store.collection().update_one({'_id': record['_id']}, {'$set': {'photos': record['photos']}})
        self.assertEqual(self.add(0).status_code, 409)
        self.assertEqual(self.post(self.url + 'submit/').status_code, 409)

    def test_types_bytes_pixels_and_fields(self):
        for file in [SimpleUploadedFile('bad.txt', b'no image', content_type='text/plain'),
                     SimpleUploadedFile('bad.png', b'bad bytes', content_type='image/png')]:
            self.assertEqual(self.client.post(self.url + 'photos/', {'photo': file}).status_code, 400)
        huge = SimpleUploadedFile('huge.jpg', b'x' * (8 * 1024 * 1024 + 1), content_type='image/jpeg')
        self.assertEqual(self.client.post(self.url + 'photos/', {'photo': huge}).status_code, 413)
        with patch('inspections.services.MAX_IMAGE_PIXELS', 100):
            self.assertEqual(self.add().status_code, 400)
        self.assertEqual(self.client.patch(self.url, json.dumps({'area': '', 'description': 'x'}), content_type='application/json').status_code, 400)
        self.upload.assert_not_called()

    def test_object_unit_and_draft_isolation_and_landlord_status(self):
        self.add_count(5)
        photo_id = self.client.get(self.url).json()['request']['photos'][0]['id']
        photo_url = self.url + f'photos/{photo_id}/'
        self.client.force_login(self.landlord)
        self.assertEqual(self.client.get(self.url).status_code, 404)  # creator-only draft
        self.client.force_login(self.tenant)
        self.post(self.url + 'submit/')
        for user in [self.other, self.stranger]:
            self.client.force_login(user)
            self.assertEqual(self.client.get(self.base).json()['requests'], [])
            for url in [self.url, photo_url]:
                self.assertEqual(self.client.get(url).status_code, 404)
            self.assertEqual(self.post(self.url + 'submit/').status_code, 404)
            self.assertEqual(self.client.delete(photo_url).status_code, 404)
        self.client.force_login(self.other)
        self.assertEqual(self.post(self.base, {'unit_id': str(self.unit.pk), 'area': 'x', 'description': 'x', 'idempotency_key': 'other_creation_key_01'}).status_code, 404)
        self.client.force_login(self.landlord)
        self.assertEqual(self.client.get(self.base).json()['requests'][0]['id'], self.draft['id'])
        with patch('maintenance.views.media.retrieve', return_value=b'jpeg'):
            response = self.client.get(photo_url)
            self.assertEqual(response.status_code, 200)
            self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(self.post(self.url + 'status/', {'status': 'resolved'}).status_code, 409)
        self.assertEqual(self.post(self.url + 'status/', {'status': 'in-review'}).status_code, 200)
        self.post(self.url + 'status/', {'status': 'in-review'})
        self.assertEqual(len(self.client.get(self.url).json()['request']['history']), 2)
        self.assertEqual(self.client.delete(photo_url).status_code, 404)
        self.client.force_login(self.tenant)
        self.assertEqual(self.client.delete(photo_url).status_code, 409)
        self.assertEqual(self.post(self.url + 'status/', {'status': 'in-progress'}).status_code, 404)

    def test_csrf_unauthenticated_and_assignment_revocation(self):
        self.client.logout()
        self.assertEqual(self.client.get(self.base).status_code, 401)
        secure = Client(enforce_csrf_checks=True)
        secure.force_login(self.tenant)
        self.assertEqual(self.post(self.url + 'submit/', client=secure).status_code, 403)
        token = secure.get('/api/auth/csrf/').json()['csrfToken']
        self.assertEqual(secure.post(self.url + 'submit/', '{}', content_type='application/json', HTTP_X_CSRFTOKEN=token).status_code, 409)
        self.client.force_login(self.tenant)
        UnitAssignment.objects.filter(tenant=self.tenant).update(active=False)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.add().status_code, 404)

    def test_compare_and_swap_prevents_stale_transition(self):
        record = store.collection().find_one({'public_id': self.draft['id']})
        store.change(record, {'area': 'New area'})
        with self.assertRaises(store.Conflict):
            store.change(record, {'status': 'submitted'})

    @patch('maintenance.cleanup.media.delete')
    def test_retention_freezes_old_media_and_retries_provider_deletion(self, delete):
        self.add(0)
        db = store.database()
        now = timezone.now()
        self.assertEqual(cleanup(db, now, True, 100), (0, 0, 0))
        record = store.collection().find_one({'public_id': self.draft['id']})
        old = now - timedelta(days=91)
        ref = record['photos'][0]['ref']
        ref.update(uploaded_at=old.isoformat(), retain_until=(old + timedelta(days=90)).isoformat())
        store.collection().update_one({'_id': record['_id']}, {'$set': {'photos': record['photos'], 'updated_at': old}})
        self.assertEqual(cleanup(db, now, False, 100), (1, 0, 0))
        delete.assert_not_called()
        delete.side_effect = media.StorageError('failure')
        self.assertEqual(cleanup(db, now, True, 100), (1, 0, 1))
        self.assertEqual(self.add(1).status_code, 409)
        delete.side_effect = None
        self.assertEqual(cleanup(db, now, True, 100), (1, 1, 0))
        self.assertEqual(cleanup(db, now, True, 100), (0, 0, 0))

    def test_removal_replacement_and_max_count_use_atomic_revision(self):
        from inspections.services import prepare_image
        self.add_count(19)
        stale = store.collection().find_one({'public_id': self.draft['id']})
        self.assertEqual(self.add(19).status_code, 200)
        with self.assertRaises(store.Conflict):
            store.upload(stale, prepare_image(image(20)))
        self.assertEqual(len(MaintenanceRequest.objects.get(public_id=self.draft['id']).photos), 20)
        photo_id = self.client.get(self.url).json()['request']['photos'][0]['id']
        self.assertEqual(self.client.delete(self.url + f'photos/{photo_id}/').status_code, 200)
        self.assertEqual(self.add(20).status_code, 200)
        self.assertEqual(self.post(self.url + 'submit/').status_code, 200)

    def test_units_only_list_verified_relationships_and_invalid_ids_are_safe(self):
        self.assertEqual(self.client.get(self.base + 'units/').json()['units'][0]['id'], str(self.unit.pk))
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.base + 'units/').json()['units'], [])
        for invalid in ['not-an-id', 'a' * 33, '$ne']:
            self.assertEqual(self.client.get(self.base + invalid + '/').status_code, 404)
        self.assertEqual(self.client.get(self.base + '?before=invalid').status_code, 400)

    def test_same_unit_does_not_grant_access_to_another_tenants_request(self):
        UnitAssignment.objects.create(tenant=self.other, unit=self.unit, verified_by=self.landlord)
        self.add_count(5)
        self.post(self.url + 'submit/')
        photo_id = self.client.get(self.url).json()['request']['photos'][0]['id']
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.base).json()['requests'], [])
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(self.client.get(self.url + f'photos/{photo_id}/').status_code, 404)
        self.assertEqual(self.add(6).status_code, 404)

    def test_operator_setup_rejects_self_assignment_and_is_repeatable(self):
        from django.core.management import call_command, CommandError
        from io import StringIO
        options = {'operator': self.tenant.username, 'tenant': self.tenant.username,
                   'landlord': self.landlord.username, 'property': 'Operator property', 'unit': '202',
                   'stdout': StringIO()}
        with self.assertRaises(CommandError):
            call_command('assign_maintenance_unit', **options)
        operator = get_user_model().objects.create_user(username='operator', is_superuser=True)
        options['operator'] = operator.username
        call_command('assign_maintenance_unit', **options)
        call_command('assign_maintenance_unit', **options)
        assignment = UnitAssignment.objects.get(tenant=self.tenant, unit__label='202')
        self.assertEqual(assignment.verified_by, operator)
        self.assertEqual(Unit.objects.filter(label='202').count(), 1)

    def test_delayed_upload_cannot_restore_a_removed_photo(self):
        self.add(0)
        record = store.collection().find_one({'public_id': self.draft['id']})
        photo = record['photos'][0]
        photo.update(state='uploading', lease_until=(timezone.now() - timedelta(seconds=1)).isoformat())
        store.collection().update_one({'_id': record['_id']}, {'$set': {'photos': record['photos']}})
        removed = store.remove(record, photo['id'])
        with self.assertRaises(store.Conflict):
            store._finish(removed, photo['id'], photo['token'], 'ready', photo['ref'])
        persisted = store.collection().find_one({'_id': record['_id']})
        self.assertEqual(persisted['photos'][0]['state'], 'removed')

    def test_account_and_global_limits_are_persistent_and_fail_closed(self):
        from . import limits
        # Force separate time buckets from other tests without weakening defaults.
        with patch('maintenance.limits.READS_PER_MINUTE', 2):
            self.assertTrue(limits.allow('quota-test-account', 'GET'))
            self.assertTrue(limits.allow('quota-test-account', 'GET'))
            self.assertFalse(limits.allow('quota-test-account', 'GET'))
            self.assertTrue(limits.allow('different-quota-account', 'GET'))
        minute = timezone.now().strftime('%Y%m%d%H%M')
        db = store.database()
        db.maintenance_api_usage.update_one({'_id': f'global:{minute}'}, {'$set': {'calls': limits.GLOBAL_PER_MINUTE}}, upsert=True)
        try:
            response = self.client.get(self.base)
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response['Retry-After'], '60')
        finally:
            db.maintenance_api_usage.delete_one({'_id': f'global:{minute}'})
        indexes = db.maintenance_api_usage.index_information()
        self.assertTrue(any(i.get('expireAfterSeconds') == 0 for i in indexes.values()))

    def test_unknown_non_draft_status_is_not_shared_with_landlord(self):
        store.collection().update_one({'public_id': self.draft['id']}, {'$set': {'status': 'internal-only'}})
        self.client.force_login(self.landlord)
        self.assertEqual(self.client.get(self.url).status_code, 404)


class MediaRecoveryTests(TransactionTestCase):
    @override_settings(CLOUDINARY_URL='cloudinary://test:test@fixture')
    @patch('cloudinary.api.resource')
    @patch('inspections.media.upload')
    def test_existing_private_asset_recovers_without_reupload(self, upload, resource):
        ref = {'provider': 'cloudinary', 'resource_type': 'image', 'delivery_type': 'authenticated',
               'public_id': 'leaseguard/maintenance/' + 'a' * 32 + '/' + 'b' * 64}
        resource.return_value = {'public_id': ref['public_id'], 'asset_id': 'recovered',
                                 'resource_type': 'image', 'type': 'authenticated', 'format': 'jpg'}
        self.assertEqual(media.upload_or_recover(ref, b'jpeg')['asset_id'], 'recovered')
        upload.assert_not_called()
        resource.return_value['type'] = 'upload'
        with self.assertRaises(media.StorageError):
            media.upload_or_recover(ref, b'jpeg')

    @override_settings(CLOUDINARY_URL='cloudinary://test:test@fixture')
    @patch('cloudinary.api.resource')
    @patch('inspections.media.upload')
    def test_missing_asset_is_uploaded_once_and_provider_failure_is_sanitized(self, upload, resource):
        from cloudinary.exceptions import NotFound
        ref = {'provider': 'cloudinary', 'resource_type': 'image', 'delivery_type': 'authenticated',
               'public_id': 'leaseguard/maintenance/' + 'a' * 32 + '/' + 'b' * 64}
        resource.side_effect = NotFound('missing')
        upload.return_value = {**ref, 'asset_id': 'new'}
        self.assertEqual(media.upload_or_recover(ref, b'jpeg')['asset_id'], 'new')
        upload.assert_called_once()
        resource.side_effect = TimeoutError('credential-bearing provider exception')
        with self.assertRaisesMessage(media.StorageError, 'Private photo upload failed; retry this photo'):
            media.upload_or_recover(ref, b'jpeg')


    @override_settings(CLOUDINARY_URL='cloudinary://test:test@fixture')
    @patch('cloudinary.api.resource')
    @patch('cloudinary.uploader.destroy')
    def test_confirmed_maintenance_asset_requires_provider_verified_age_before_deletion(self, destroy, resource):
        ref = {'provider': 'cloudinary', 'resource_type': 'image', 'delivery_type': 'authenticated',
               'asset_id': 'confirmed', 'public_id': 'leaseguard/maintenance/' + 'a' * 32 + '/' + 'b' * 64}
        resource.return_value = {'created_at': timezone.now().isoformat()}
        with self.assertRaises(media.StorageError):
            media.delete(ref)
        destroy.assert_not_called()
        resource.return_value = {'created_at': (timezone.now() - timedelta(days=91)).isoformat()}
        destroy.return_value = {'result': 'ok'}
        media.delete(ref)
        destroy.assert_called_once()
