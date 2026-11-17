"""Owner-scoped MongoDB GridFS storage for 90+-day inspection-photo retention.

The comparison id is a content-derived key per owner, preventing repeat charges
for the exact same image pair. No direct client-to-MongoDB access is allowed.
"""
import hashlib
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import gridfs
from bson import ObjectId
from django.conf import settings
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError

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
    fs = gridfs.GridFS(db)
    uploaded = []
    try:
        for which, photo in (("baseline", baseline_bytes), ("current", current_bytes)):
            photo_id = fs.put(
                photo, content_type="image/jpeg", filename=f"{which}.jpg",
                metadata={"owner_id": owner_id, "comparison_id": key, "retain_until": record["retain_until"]},
            )
            uploaded.append(photo_id)
        db.inspection_comparisons.update_one(
            {"_id": key, "owner_id": owner_id},
            {"$set": {"baseline_file_id": uploaded[0], "current_file_id": uploaded[1]}},
        )
    except Exception:
        for photo_id in uploaded:
            fs.delete(photo_id)
        db.inspection_comparisons.delete_one({"_id": key, "owner_id": owner_id})
        raise
    record.update({"baseline_file_id": uploaded[0], "current_file_id": uploaded[1]})
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
    if record is None:
        return None
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
