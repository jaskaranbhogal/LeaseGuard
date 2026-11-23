"""Shared MongoDB minute buckets; failed/parallel requests cannot bypass limits."""
from datetime import timedelta
from functools import lru_cache

from django.utils import timezone
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from inspections.storage import database

READS_PER_MINUTE = 120
WRITES_PER_MINUTE = 60
GLOBAL_PER_MINUTE = 1200


@lru_cache(maxsize=8)
def _ensure_indexes(database_name):
    # TTL applies ONLY to short-lived usage counters, never evidence documents.
    database().maintenance_api_usage.create_index('expires_at', expireAfterSeconds=0)


def allow(user_id, method):
    db = database()
    _ensure_indexes(db.name)
    now = timezone.now()
    minute = now.strftime('%Y%m%d%H%M')
    category = 'read' if method == 'GET' else 'write'
    limit = READS_PER_MINUTE if category == 'read' else WRITES_PER_MINUTE

    def reserve(key, maximum):
        try:
            return db.maintenance_api_usage.find_one_and_update(
                {'_id': key, 'calls': {'$lt': maximum}},
                {'$inc': {'calls': 1}, '$setOnInsert': {'expires_at': now + timedelta(minutes=5)}},
                upsert=True, return_document=ReturnDocument.AFTER,
            ) is not None
        except DuplicateKeyError:
            return False

    return reserve(f'{user_id}:{category}:{minute}', limit) and reserve(f'global:{minute}', GLOBAL_PER_MINUTE)
