"""Owner-scoped Cloudinary references and legacy GridFS photo storage.

The comparison id is a content-derived key per owner, preventing repeat charges
for the exact same image pair. No direct client-to-MongoDB access is allowed.
"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import gridfs
from bson import ObjectId
from django.conf import settings
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError

from . import media
from .media import StorageError

RETENTION_DAYS = 90
DAILY_AI_CALLS_PER_USER = 3
GLOBAL_AI_CALLS_PER_DAY = 30


@lru_cache(maxsize=1)
def _client():
    return MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)


def database():
    return _client()[settings.DATABASES['default']['NAME']]


def _pair_id(owner_id, baseline_bytes, current_bytes, room, area):
    digest = hashlib.sha256()
    for part in (owner_id.encode(), room.encode(), area.encode(), baseline_bytes, current_bytes):
        digest.update(len(part).to_bytes(8, "big"))
        digest.update(part)
    return digest.hexdigest()


def create_pair(owner_id, room, area, baseline_bytes, current_bytes):
    db = database()
    key = _pair_id(owner_id, baseline_bytes, current_bytes, room, area)
    stored = db.inspection_comparisons.find_one({"_id": key, "owner_id": owner_id})
    if stored:
        return stored, False
    # Invalid local configuration must not poison an otherwise retryable pair.
    media.configuration()
    now = datetime.now(timezone.utc)
    record = {
        "_id": key,
        "owner_id": owner_id,
        "room": room,
        "area": area,
        "created_at": now,
        "retain_until": now + timedelta(days=RETENTION_DAYS),
        "status": "pending",
        "result": None,
        "decision": None,
        "decision_history": [],
    }
    try:
        db.inspection_comparisons.insert_one(record)
    except DuplicateKeyError:
        return db.inspection_comparisons.find_one({"_id": key, "owner_id": owner_id}), False
    # Persist upload intents BEFORE any network operation. Even a timeout or a
    # process crash leaves a discoverable identifier for retention cleanup.
    try:
        for kind, photo in (("baseline", baseline_bytes), ("current", current_bytes)):
            started = datetime.now(timezone.utc)
            ref = {
                "provider": "cloudinary", "public_id": f"leaseguard/inspections/{uuid.uuid4().hex}/{kind}",
                "asset_id": None, "resource_type": "image", "delivery_type": "authenticated",
                "kind": kind, "owner_id": owner_id, "comparison_id": key,
                "uploaded_at": started, "retain_until": started + timedelta(days=RETENTION_DAYS, minutes=5),
                "sha256": hashlib.sha256(photo).hexdigest(), "format": "jpg",
            }
            record[f"{kind}_photo"] = ref
            db.inspection_comparisons.update_one(
                {"_id": key}, {"$set": {f"{kind}_photo": ref, "retain_until": ref["retain_until"]}},
            )
            ref = media.upload(ref, photo)
            finished = datetime.now(timezone.utc)
            ref.update(uploaded_at=finished, retain_until=finished + timedelta(days=RETENTION_DAYS))
            record[f"{kind}_photo"] = ref
            record["retain_until"] = ref["retain_until"]
            db.inspection_comparisons.update_one(
                {"_id": key}, {"$set": {f"{kind}_photo": ref, "retain_until": ref["retain_until"]}},
            )
        record["status"] = "stored"
        db.inspection_comparisons.update_one({"_id": key}, {"$set": {"status": "stored"}})
    except Exception:
        # Do not delete evidence before 90 days, or lose ambiguous timeout IDs.
        db.inspection_comparisons.update_one({"_id": key}, {"$set": {"status": "storage_failed"}})
        raise StorageError("Private photo storage failed") from None
    return record, True


def consume_daily_call(owner_id):
    """Atomic global and per-user limits; never more than 30 model calls/day."""
    db = database()
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def reserve(key, limit):
        try:
            updated = db.inspection_ai_usage.find_one_and_update(
                {"_id": key, "calls": {"$lt": limit}},
                {"$inc": {"calls": 1}, "$setOnInsert": {"day": day}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            return False
        return bool(updated and updated["calls"] <= limit)

    # The global reservation is deliberately first: requests must never
    # exceed the deployment's overall credit budget, even with many accounts.
    return reserve(f"global:{day}", GLOBAL_AI_CALLS_PER_DAY) and reserve(
        f"{owner_id}:{day}", DAILY_AI_CALLS_PER_USER
    )


def complete_pair(owner_id, record_id, result):
    database().inspection_comparisons.update_one(
        {"_id": record_id, "owner_id": owner_id},
        {"$set": {"result": result, "status": "completed"}},
    )


def get_pair(owner_id, record_id):
    if not isinstance(record_id, str) or len(record_id) != 64:
        return None
    return database().inspection_comparisons.find_one({"_id": record_id, "owner_id": owner_id})


def list_pairs(owner_id, limit=20):
    return list(database().inspection_comparisons.find({"owner_id": owner_id}).sort("created_at", -1).limit(limit))


def read_pair_photo(owner_id, record_id, kind):
    if kind not in {"baseline", "current"}:
        return None
    record = get_pair(owner_id, record_id)
    if record is None or record.get("media_deleted"):
        return None
    ref = record.get(f"{kind}_photo")
    if ref:
        return None if ref.get("deleted_at") else media.retrieve(ref)
    file_id = record.get(f"{kind}_file_id")
    if not isinstance(file_id, ObjectId):
        return None
    try:
        return gridfs.GridFS(database()).get(file_id).read()
    except gridfs.errors.NoFile:
        return None


def decide(owner_id, record_id, decision):
    if decision not in {"confirmed", "dismissed", "resolved"}:
        return None
    now = datetime.now(timezone.utc)
    return database().inspection_comparisons.find_one_and_update(
        {"_id": record_id, "owner_id": owner_id, "status": "completed"},
        {"$set": {"decision": decision, "decision_at": now},
         "$push": {"decision_history": {"action": decision, "at": now, "landlord_id": owner_id}}},
        return_document=ReturnDocument.AFTER,
    )
