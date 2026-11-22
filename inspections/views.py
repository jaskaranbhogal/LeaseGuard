"""Authenticated inspection comparison endpoints. No image URLs are public."""
import json

from django.http import HttpResponse, JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST
from pymongo.errors import PyMongoError

from accounts.models import AccountProfile
from . import storage
from .services import AIComparisonError, MAX_UPLOAD_BYTES, compare_images_safe, prepare_image


def _auth(request):
    return request.user.is_authenticated


def _owner_id(request):
    return str(request.user.pk)


def _serialize(record):
    return {
        "id": record["_id"],
        "room": record["room"],
        "area": record["area"],
        "created_at": record["created_at"].isoformat(),
        "retain_until": record["retain_until"].isoformat(),
        "status": record["status"],
        "result": record.get("result"),
        "decision": record.get("decision"),
    }


def _manual_result(message="AI comparison unavailable. Review both photos manually."):
    return {
        "analysis_status": "unavailable", "requires_manual_review": True,
        "photo_quality": "unknown", "same_area": None, "change_detected": False,
        "classification": "none", "severity": None, "confidence": "low",
        "obstructed_areas": None, "findings": [], "summary": message,
    }


@never_cache
@require_POST
@csrf_protect
def compare_photo_view(request):
    if not _auth(request):
        return JsonResponse({"detail": "Sign in to compare photos."}, status=401)
    baseline, current = request.FILES.get("baseline"), request.FILES.get("current")
    if getattr(request, "upload_limit_exceeded", False):
        return JsonResponse({"detail": "Each photo must be 8 MB or smaller."}, status=413)
    if not baseline or not current:
        return JsonResponse({"detail": "Upload a baseline and current photo."}, status=400)
    if baseline.size > MAX_UPLOAD_BYTES or current.size > MAX_UPLOAD_BYTES:
        return JsonResponse({"detail": "Each photo must be 8 MB or smaller."}, status=413)
    room = request.POST.get("room", "").strip()
    area = request.POST.get("area", "").strip()
    if not (1 <= len(room) <= 100 and 1 <= len(area) <= 100):
        return JsonResponse({"detail": "Room and area are required (100 characters max)."}, status=400)
    notes = request.POST.get("notes", "")[:1200]
    known_issues = request.POST.get("known_issues", "")[:1200]
    try:
        # Normalize and validate uploads before storage and before any paid call.
        first, second = prepare_image(baseline), prepare_image(current)
    except AIComparisonError:
        return JsonResponse({"detail": "Use valid JPEG/PNG photos of up to 8 MB each."}, status=400)
    owner = _owner_id(request)
    try:
        record, new = storage.create_pair(owner, room, area, first, second)
        if not new:
            if record["status"] == "storage_failed":
                raise storage.StorageError("Previous upload failed")
            if record["status"] != "completed":
                return JsonResponse({"comparison": _serialize(record)}, status=202)
            # Concurrent re-submissions never trigger a second paid request.
            return JsonResponse({"comparison": _serialize(record)}, status=200)
        # Retrieve the owner-authorized stored evidence before reserving AI credit.
        first = storage.read_pair_photo(owner, record["_id"], "baseline")
        second = storage.read_pair_photo(owner, record["_id"], "current")
        if first is None or second is None:
            raise storage.StorageError("Stored photos unavailable")
        if not storage.consume_daily_call(owner):
            result = _manual_result("Daily AI comparison budget reached. Photos saved for manual review.")
        else:
            result = compare_images_safe(first, second, room, area, notes, known_issues)
        storage.complete_pair(owner, record["_id"], result)
        record = storage.get_pair(owner, record["_id"])
    except (PyMongoError, storage.StorageError):
        return JsonResponse({"detail": "Secure photo storage is temporarily unavailable. Try again later."}, status=503)
    return JsonResponse({"comparison": _serialize(record)}, status=201)


@never_cache
@require_GET
def recent_comparisons(request):
    if not _auth(request):
        return JsonResponse({"detail": "Sign in to view comparisons."}, status=401)
    try:
        records = storage.list_pairs(_owner_id(request))
    except (PyMongoError, storage.StorageError):
        return JsonResponse({"detail": "Comparison history is temporarily unavailable."}, status=503)
    return JsonResponse({"comparisons": [_serialize(r) for r in records]})


@never_cache
@require_GET
def read_comparison_photo(request, comparison_id, kind):
    if not _auth(request):
        return JsonResponse({"detail": "Sign in to view photos."}, status=401)
    try:
        data = storage.read_pair_photo(_owner_id(request), comparison_id, kind)
    except (PyMongoError, storage.StorageError):
        return JsonResponse({"detail": "Photo retrieval is temporarily unavailable."}, status=503)
    if data is None:
        return JsonResponse({"detail": "Photo not found."}, status=404)
    response = HttpResponse(data, content_type="image/jpeg")
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


@never_cache
@require_POST
@csrf_protect
def set_comparison_decision(request, comparison_id):
    if not _auth(request):
        return JsonResponse({"detail": "Sign in to review findings."}, status=401)
    if not AccountProfile.objects.filter(user=request.user, role="landlord").exists():
        return JsonResponse({"detail": "Landlord access required."}, status=403)
    if len(request.body) > 1024:
        return JsonResponse({"detail": "Invalid decision."}, status=400)
    try:
        payload = json.loads(request.body)
        action = payload.get("decision")
    except (ValueError, AttributeError):
        return JsonResponse({"detail": "Invalid decision."}, status=400)
    if action not in ("confirmed", "dismissed", "resolved"):
        return JsonResponse({"detail": "Invalid decision."}, status=400)
    try:
        record = storage.decide(_owner_id(request), comparison_id, action)
    except (PyMongoError, storage.StorageError):
        return JsonResponse({"detail": "Could not save decision."}, status=503)
    if record is None:
        return JsonResponse({"detail": "Comparison not found or not ready."}, status=404)
    return JsonResponse({"comparison": _serialize(record)})
