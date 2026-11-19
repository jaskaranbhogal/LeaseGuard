"""Retention cleanup shares the inspection command's explicit --execute policy."""
from datetime import datetime, timedelta, timezone
from pymongo.errors import PyMongoError
from inspections import media


def aware(value):
    value = datetime.fromisoformat(value) if isinstance(value, str) else value
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def cleanup(db, now, execute, limit):
    collection = db.maintenance_maintenancerequest
    found = deleted = failed = 0
    cutoff = now - timedelta(days=90)
    for record in collection.find({'updated_at': {'$lte': cutoff}, 'photos.0': {'$exists': True},
                                    'media_deleted': {'$ne': True}}).limit(limit):
        refs = [p['ref'] for p in record['photos']]
        if any(ref.get('public_id', '').startswith('leaseguard/guided/') for ref in refs):
            continue  # Shared inspection evidence is under an indefinite retention hold.
        if not all(ref.get('uploaded_at') and ref.get('retain_until')
                   and aware(ref['retain_until']) <= now
                   and aware(ref['uploaded_at']) + timedelta(days=90) <= now for ref in refs):
            continue
        found += 1
        if not execute:
            continue
        # Freeze media mutations atomically BEFORE deleting any provider asset.
        claimed = collection.update_one({'_id': record['_id'], 'revision': record['revision']},
                                         {'$set': {'media_expired': True}, '$inc': {'revision': 1}})
        if not claimed.modified_count:
            continue
        try:
            for index, photo in enumerate(record['photos']):
                if photo.get('deleted_at'):
                    continue
                media.delete(photo['ref'])
                collection.update_one({'_id': record['_id']},
                                      {'$set': {f'photos.{index}.deleted_at': now.isoformat()}})
            collection.update_one({'_id': record['_id']}, {'$set': {'media_deleted': True}})
            deleted += 1
        except (media.StorageError, PyMongoError):
            failed += 1
    return found, deleted, failed
