"""Offline provider, persistence, authorization and retention regression tests."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from io import StringIO
from unittest.mock import MagicMock, patch

from bson import ObjectId
from django.core.management import call_command, CommandError
from django.test import SimpleTestCase, override_settings
from pymongo.errors import DuplicateKeyError, AutoReconnect

from inspections import media, storage
from inspections.management.commands.cleanup_inspection_media import expired
from inspections.views import read_comparison_photo, compare_photo_view
from . import test_views

CONFIG = 'cloudinary://test-key:test-secret@test-cloud'


def reference():
    now = datetime.now(timezone.utc)
    return {'provider': 'cloudinary', 'asset_id': 'asset-test',
            'public_id': 'leaseguard/inspections/' + 'a' * 32 + '/baseline',
            'resource_type': 'image', 'delivery_type': 'authenticated', 'format': 'jpg',
            'uploaded_at': now, 'retain_until': now + timedelta(days=90)}


@override_settings(CLOUDINARY_URL=CONFIG)
class ProviderTests(SimpleTestCase):
    @patch('cloudinary.uploader.upload')
    def test_upload_is_authenticated_and_never_overwrites(self, upload):
        ref = reference()
        upload.return_value = {'asset_id': 'new', 'public_id': ref['public_id'],
                               'resource_type': 'image', 'type': 'authenticated', 'format': 'jpg',
                               'secure_url': 'must-not-be-persisted'}
        result = media.upload(ref, b'jpeg')
        options = upload.call_args.kwargs
        self.assertEqual(options['type'], 'authenticated')
        self.assertEqual(options['resource_type'], 'image')
        self.assertFalse(options['overwrite'])
        self.assertNotIn('secure_url', result)
        self.assertNotIn('api_secret', result)
        self.assertEqual(result['asset_id'], 'new')

    @patch('cloudinary.uploader.upload')
    def test_public_or_malformed_response_is_rejected(self, upload):
        upload.return_value = {'type': 'upload'}
        with self.assertRaises(media.StorageError):
            media.upload(reference(), b'jpeg')

    def test_configuration_validated_lazily(self):
        for value in ('', 'https://example.com', 'cloudinary://key@cloud',
                      'cloudinary://key:secret@cloud?upload_prefix=http://localhost',
                      'cloudinary://key:secret@cloud:123', 'cloudinary://key:secret@cloud/path'):
            with self.subTest(value=value), override_settings(CLOUDINARY_URL=value):
                with self.assertRaises(media.StorageError):
                    media.configuration()

    @patch('inspections.media.requests.Session')
    def test_retrieval_uses_signed_authenticated_api_download(self, session):
        response = session.return_value.__enter__.return_value.get.return_value.__enter__.return_value
        response.status_code = 200
        response.iter_content.return_value = [b'jpeg']
        self.assertEqual(media.retrieve(reference()), b'jpeg')
        get = session.return_value.__enter__.return_value.get
        url = get.call_args.args[0]
        self.assertTrue(url.startswith('https://api.cloudinary.com/v1_1/test-cloud/image/download?'))
        self.assertIn('type=authenticated', url)
        self.assertIn('signature=', url)
        self.assertFalse(get.call_args.kwargs['allow_redirects'])

    @patch('inspections.media.requests.Session')
    def test_retrieval_failures_and_oversized_responses(self, session):
        response = session.return_value.__enter__.return_value.get.return_value.__enter__.return_value
        for code, chunks in ((302, []), (404, []), (200, []), (200, [b'x' * (media.MAX_BYTES + 1)])):
            response.status_code = code
            response.iter_content.return_value = chunks
            with self.assertRaises(media.StorageError):
                media.retrieve(reference())

    @patch('cloudinary.utils.private_download_url', return_value='http://127.0.0.1/secret')
    @patch('inspections.media.requests.Session')
    def test_retrieval_rejects_unexpected_origin(self, session, url):
        with self.assertRaises(media.StorageError):
            media.retrieve(reference())
        session.assert_not_called()

    @patch('cloudinary.uploader.destroy')
    def test_deletion_requires_confirmation_and_invalidation(self, destroy):
        for result in ('ok', 'not found'):
            destroy.return_value = {'result': result}
            media.delete(reference())
            self.assertTrue(destroy.call_args.kwargs['invalidate'])
            self.assertEqual(destroy.call_args.kwargs['type'], 'authenticated')
        destroy.return_value = {'result': 'error'}
        with self.assertRaises(media.StorageError):
            media.delete(reference())

    @patch('cloudinary.api.resource')
    @patch('cloudinary.uploader.destroy', return_value={'result': 'ok'})
    def test_ambiguous_upload_checks_actual_provider_age(self, destroy, resource):
        ref = reference()
        ref['asset_id'] = None
        resource.return_value = {'created_at': datetime.now(timezone.utc).isoformat()}
        with self.assertRaises(media.StorageError):
            media.delete(ref)
        destroy.assert_not_called()
        resource.return_value = {'created_at': (datetime.now(timezone.utc) - timedelta(days=91)).isoformat()}
        media.delete(ref)
        destroy.assert_called_once()
        resource.side_effect = RuntimeError('provider lookup failed')
        with self.assertRaises(media.StorageError):
            media.delete(ref)
        self.assertEqual(destroy.call_count, 1)


class MemoryCollection:
    """Small persistence double: supports this service's writes, no networking."""
    def __init__(self):
        self.records = {}

    def find_one(self, query):
        r = self.records.get(query['_id'])
        return deepcopy(r) if r and r['owner_id'] == query['owner_id'] else None

    def insert_one(self, record):
        if record['_id'] in self.records:
            raise DuplicateKeyError('duplicate')
        self.records[record['_id']] = deepcopy(record)

    def update_one(self, query, changes):
        record = self.records[query['_id']]
        for op, values in changes.items():
            for key, value in values.items():
                target = record
                parts = key.split('.')
                for part in parts[:-1]:
                    target = target[part]
                if op == '$set':
                    target[parts[-1]] = deepcopy(value)
                elif op == '$unset':
                    target.pop(parts[-1], None)

    def find(self, query):
        result = MagicMock()
        result.limit.return_value = [deepcopy(r) for r in self.records.values()
                                     if r['retain_until'] <= query['retain_until']['$lte']
                                     and not r.get('media_deleted')]
        return result


@override_settings(CLOUDINARY_URL=CONFIG)
class PersistenceTests(SimpleTestCase):
    def setUp(self):
        self.db = MagicMock()
        self.collection = MemoryCollection()
        self.db.inspection_comparisons = self.collection
        self.db_patch = patch('inspections.storage.database', return_value=self.db)
        self.db_patch.start()
        self.addCleanup(self.db_patch.stop)
        self.upload = patch('inspections.storage.media.upload', side_effect=lambda ref, data: {**ref, 'asset_id': 'asset-test'})
        self.mock_upload = self.upload.start()
        self.addCleanup(self.upload.stop)

    def create(self):
        return storage.create_pair('alice', 'Kitchen', 'Sink', b'baseline', b'current')

    def test_both_photos_metadata_dedup_and_owner_isolation(self):
        record, new = self.create()
        self.assertTrue(new)
        for kind in ('baseline', 'current'):
            ref = record[f'{kind}_photo']
            self.assertEqual(ref['owner_id'], 'alice')
            self.assertEqual(ref['comparison_id'], record['_id'])
            self.assertEqual(ref['kind'], kind)
            self.assertEqual(ref['provider'], 'cloudinary')
            self.assertEqual(len(ref['sha256']), 64)
            self.assertGreaterEqual(ref['retain_until'] - ref['uploaded_at'], timedelta(days=90))
        self.assertNotEqual(record['baseline_photo']['public_id'], record['current_photo']['public_id'])
        self.assertEqual(self.collection.records[record['_id']], record)
        self.assertFalse(self.create()[1])
        self.assertEqual(self.mock_upload.call_count, 2)
        with patch('inspections.storage.media.retrieve') as retrieve:
            self.assertIsNone(storage.read_pair_photo('bob', record['_id'], 'baseline'))
            retrieve.assert_not_called()

    def test_concurrent_reservation_loser_never_uploads(self):
        db = MagicMock()
        db.inspection_comparisons.find_one.side_effect = [None, {'status': 'pending'}]
        db.inspection_comparisons.insert_one.side_effect = DuplicateKeyError('race')
        with patch('inspections.storage.database', return_value=db):
            self.assertFalse(self.create()[1])
        self.mock_upload.assert_not_called()

    def test_partial_upload_failure_keeps_references_for_retention_cleanup(self):
        self.mock_upload.side_effect = [reference(), media.StorageError('timeout')]
        with self.assertRaises(media.StorageError):
            self.create()
        record = next(iter(self.collection.records.values()))
        self.assertEqual(record['status'], 'storage_failed')
        self.assertIn('baseline_photo', record)
        self.assertIn('current_photo', record)
        self.assertFalse(self.create()[1])
        self.assertEqual(self.mock_upload.call_count, 2)

    def test_database_failure_after_upload_retains_the_intent(self):
        update = self.collection.update_one
        count = 0

        def fail_checkpoint(query, changes):
            nonlocal count
            count += 1
            if count == 2:
                raise AutoReconnect('lost upload checkpoint')
            update(query, changes)

        with patch.object(self.collection, 'update_one', side_effect=fail_checkpoint):
            with self.assertRaises(media.StorageError):
                self.create()
        stored = next(iter(self.collection.records.values()))
        self.assertEqual(stored['status'], 'storage_failed')
        self.assertIsNone(stored['baseline_photo']['asset_id'])
        self.assertTrue(stored['baseline_photo']['public_id'].startswith('leaseguard/inspections/'))
        self.mock_upload.assert_called_once()

    def test_missing_config_makes_no_upload(self):
        with override_settings(CLOUDINARY_URL=''), self.assertRaises(media.StorageError):
            self.create()
        self.mock_upload.assert_not_called()

    @patch('inspections.storage.gridfs.GridFS')
    def test_legacy_gridfs_is_owner_scoped(self, fs):
        record, _ = self.create()
        stored = self.collection.records[record['_id']]
        stored.pop('baseline_photo')
        stored['baseline_file_id'] = ObjectId()
        fs.return_value.get.return_value.read.return_value = b'legacy'
        self.assertEqual(storage.read_pair_photo('alice', record['_id'], 'baseline'), b'legacy')
        self.assertIsNone(storage.read_pair_photo('bob', record['_id'], 'baseline'))
        fs.return_value.get.assert_called_once_with(stored['baseline_file_id'])

    def age(self):
        record, _ = self.create()
        stored = self.collection.records[record['_id']]
        old = datetime.now(timezone.utc) - timedelta(days=91)
        stored['created_at'] = old
        stored['retain_until'] = old + timedelta(days=90)
        for kind in ('baseline', 'current'):
            stored[f'{kind}_photo'].update(uploaded_at=old, retain_until=stored['retain_until'])
        return stored

    def cleanup(self, **options):
        with patch('inspections.management.commands.cleanup_inspection_media.database', return_value=self.db):
            call_command('cleanup_inspection_media', stdout=StringIO(), stderr=StringIO(), **options)

    @patch('inspections.media.delete')
    def test_cleanup_dry_run_unexpired_and_success(self, delete):
        record, _ = self.create()
        self.cleanup(execute=True)
        delete.assert_not_called()
        stored = self.age()
        self.cleanup()
        delete.assert_not_called()
        self.cleanup(execute=True)
        self.assertTrue(stored['media_deleted'])
        self.assertEqual(delete.call_count, 2)
        self.cleanup(execute=True)
        self.assertEqual(delete.call_count, 2)
        self.assertIn('baseline_photo', stored)

    @patch('inspections.media.delete')
    def test_partial_cleanup_failure_can_retry(self, delete):
        stored = self.age()
        delete.side_effect = [None, media.StorageError('failed')]
        with self.assertRaises(CommandError):
            self.cleanup(execute=True)
        self.assertIn('deleted_at', stored['baseline_photo'])
        self.assertNotIn('deleted_at', stored['current_photo'])
        self.assertNotIn('media_deleted', stored)
        delete.side_effect = None
        self.cleanup(execute=True)
        self.assertEqual(delete.call_count, 3)
        self.assertTrue(stored['media_deleted'])

    @patch('inspections.management.commands.cleanup_inspection_media.gridfs.GridFS')
    def test_cleanup_legacy_gridfs_and_idempotency(self, fs):
        stored = self.age()
        for kind in ('baseline', 'current'):
            stored.pop(f'{kind}_photo')
            stored[f'{kind}_file_id'] = ObjectId()
        self.cleanup(execute=True)
        self.assertEqual(fs.return_value.delete.call_count, 2)
        self.assertNotIn('baseline_file_id', stored)
        self.assertTrue(stored['media_deleted'])
        self.cleanup(execute=True)
        self.assertEqual(fs.return_value.delete.call_count, 2)

    @patch('inspections.media.delete')
    def test_cleanup_checks_each_photo_retention(self, delete):
        stored = self.age()
        stored['current_photo']['retain_until'] = datetime.now(timezone.utc) + timedelta(days=1)
        self.cleanup(execute=True)
        delete.assert_not_called()
        # Legacy PyMongo timestamps (naive UTC) remain supported.
        stored.pop('baseline_photo')
        stored.pop('current_photo')
        stored['created_at'] = stored['created_at'].replace(tzinfo=None)
        self.assertTrue(expired(stored, datetime.now(timezone.utc)))


@override_settings(CLOUDINARY_URL=CONFIG)
class APIStorageTests(SimpleTestCase):
    def setUp(self):
        access = patch('inspections.views.analysis_access', return_value=None)
        access.start(); self.addCleanup(access.stop)
        self.helper = test_views.ComparisonAPITests()
        self.helper.setUp()
        self.addCleanup(self.helper.doCleanups)
        self.db = MagicMock()
        self.db.inspection_comparisons = MemoryCollection()
        self.mocks = {}
        for name, kwargs in {
            'storage.database': {'return_value': self.db},
            'media.upload': {'side_effect': lambda ref, data: {**ref, 'asset_id': 'test-asset'}},
            'media.retrieve': {'return_value': b'stored-jpeg'},
            'storage.consume_daily_call': {'return_value': True},
            'views.compare_images_safe': {'return_value': {'analysis_status': 'unavailable', 'requires_manual_review': True}},
        }.items():
            mocked = patch('inspections.' + name, **kwargs)
            self.mocks[name] = mocked.start()
            self.addCleanup(mocked.stop)

    def test_success_preserves_images_for_manual_review_and_deduplicates_ai(self):
        response = compare_photo_view(self.helper.post())
        self.assertEqual(response.status_code, 201)
        ai = self.mocks['views.compare_images_safe']
        self.assertEqual(ai.call_args.args[:2], (b'stored-jpeg', b'stored-jpeg'))
        record = next(iter(self.db.inspection_comparisons.records.values()))
        self.assertEqual(record['result']['analysis_status'], 'unavailable')
        self.assertEqual(record['status'], 'completed')
        self.assertIn('baseline_photo', record)
        self.assertIn('current_photo', record)
        self.assertEqual(compare_photo_view(self.helper.post()).status_code, 200)
        ai.assert_called_once()
        self.assertEqual(self.mocks['media.upload'].call_count, 2)

    def test_upload_and_partial_upload_failure_never_call_ai(self):
        for fail_at in (1, 2):
            self.db.inspection_comparisons = MemoryCollection()
            upload = self.mocks['media.upload']
            upload.side_effect = ([reference()] if fail_at == 2 else []) + [media.StorageError('failed')]
            self.assertEqual(compare_photo_view(self.helper.post()).status_code, 503)
            self.assertEqual(compare_photo_view(self.helper.post()).status_code, 503)
            self.mocks['views.compare_images_safe'].assert_not_called()
            self.mocks['storage.consume_daily_call'].assert_not_called()

    def test_retrieval_failure_never_spends_ai_credit(self):
        self.mocks['media.retrieve'].side_effect = media.StorageError('failed')
        self.assertEqual(compare_photo_view(self.helper.post()).status_code, 503)
        self.mocks['views.compare_images_safe'].assert_not_called()
        self.mocks['storage.consume_daily_call'].assert_not_called()

    def test_photo_authorization_and_private_response(self):
        self.assertEqual(compare_photo_view(self.helper.post()).status_code, 201)
        key = next(iter(self.db.inspection_comparisons.records))
        request = self.helper.factory.get('/photo')
        request.user = self.helper.post().user
        response = read_comparison_photo(request, key, 'baseline')
        self.assertEqual(response.status_code, 200)
        self.assertIn('private', response['Cache-Control'])
        self.assertIn('no-store', response['Cache-Control'])
        self.mocks['media.retrieve'].reset_mock()
        request.user.pk = 'other-owner'
        self.assertEqual(read_comparison_photo(request, key, 'baseline').status_code, 404)
        self.mocks['media.retrieve'].assert_not_called()
        request.user.is_authenticated = False
        self.assertEqual(read_comparison_photo(request, key, 'baseline').status_code, 401)

    def test_pending_pair_is_accepted_without_duplicate_upload_or_ai(self):
        request = self.helper.post()
        from inspections.services import prepare_image
        key = storage._pair_id('owner-test', prepare_image(request.FILES['baseline']),
                               prepare_image(request.FILES['current']), 'Living room', 'North wall')
        now = datetime.now(timezone.utc)
        self.db.inspection_comparisons.records[key] = {
            '_id': key, 'owner_id': 'owner-test', 'room': 'Living room', 'area': 'North wall',
            'created_at': now, 'retain_until': now + timedelta(days=90), 'status': 'pending',
        }
        self.assertEqual(compare_photo_view(self.helper.post()).status_code, 202)
        self.mocks['media.upload'].assert_not_called()
        self.mocks['views.compare_images_safe'].assert_not_called()

    def test_gemini_timeout_after_storage_preserves_manual_review(self):
        from inspections.services import compare_images_safe
        from .test_services import make_image
        self.mocks['media.retrieve'].return_value = make_image()
        self.mocks['views.compare_images_safe'].side_effect = compare_images_safe
        client = MagicMock()
        client.models.generate_content.side_effect = TimeoutError('mock provider timeout')
        with patch('inspections.services._get_client', return_value=client):
            self.assertEqual(compare_photo_view(self.helper.post()).status_code, 201)
        record = next(iter(self.db.inspection_comparisons.records.values()))
        self.assertEqual(record['result']['analysis_status'], 'unavailable')
        self.assertTrue(record['result']['requires_manual_review'])
        self.assertIn('baseline_photo', record)
        self.assertIn('current_photo', record)
        client.models.generate_content.assert_called_once()

    def test_photo_endpoint_retrieval_outage_returns_sanitized_503(self):
        self.assertEqual(compare_photo_view(self.helper.post()).status_code, 201)
        key = next(iter(self.db.inspection_comparisons.records))
        request = self.helper.factory.get('/photo')
        request.user = self.helper.post().user
        self.mocks['media.retrieve'].side_effect = media.StorageError('failed')
        self.assertEqual(read_comparison_photo(request, key, 'current').status_code, 503)
