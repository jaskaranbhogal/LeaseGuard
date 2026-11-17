"""One-shot Gemini photo comparison with safe structured fallback."""
import io

from django.conf import settings
from google import genai
from google.genai import types
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import ValidationError

from .prompts import SYSTEM_PROMPT, build_message
from .schemas import InspectionResult

MAX_IMAGE_SIDE = 1500
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
REQUEST_TIMEOUT_MS = 20_000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


class AIComparisonError(Exception):
    pass


def _get_client():
    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if not api_key:
        raise AIComparisonError("Gemini comparison is not configured")
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS),
    )


def prepare_image(image):
    if isinstance(image, bytes):
        data = image
    else:
        # Bounded read prevents arbitrarily large uploads from exhausting memory.
        data = image.read(MAX_UPLOAD_BYTES + 1)
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise AIComparisonError("Photo is empty or exceeds the 8 MB limit")
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format not in {"JPEG", "PNG"}:
                raise AIComparisonError("Only JPEG and PNG photos are supported")
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise AIComparisonError("Photo dimensions exceed safety limits")
            img = ImageOps.exif_transpose(source).convert("RGB")
            img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=85)
            return out.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise AIComparisonError("Invalid or unsupported photo") from exc


def compare_images(baseline, current, room, area, landlord_notes=None, known_issues=None):
    """Low-level operation. Exactly one call, no automatic retries or loops."""
    # Validate input before constructing a client or spending provider credits.
    images = [prepare_image(baseline), prepare_image(current)]
    client = _get_client()
    contents = [
        types.Part.from_bytes(data=images[0], mime_type="image/jpeg"),
        types.Part.from_bytes(data=images[1], mime_type="image/jpeg"),
        build_message(room, area, landlord_notes, known_issues),
    ]
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=InspectionResult,
        temperature=0.2,
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
    )
    try:
        response = client.models.generate_content(
            model=getattr(settings, "GEMINI_MODEL", "gemini-3.5-flash-lite"),
            contents=contents,
            config=config,
        )
    except Exception as exc:
        # Do not include provider exception bodies in user-facing responses;
        # provider messages may contain sensitive request information.
        raise AIComparisonError("Gemini request failed") from exc
    try:
        return InspectionResult.model_validate_json(response.text or "").model_dump()
    except (ValidationError, ValueError) as exc:
        raise AIComparisonError("Gemini returned an invalid result") from exc


def compare_images_safe(baseline, current, room, area, landlord_notes=None, known_issues=None):
    """Fail safely; the original photos remain available for human review."""
    try:
        result = compare_images(baseline, current, room, area, landlord_notes, known_issues)
        return {"analysis_status": "completed", "requires_manual_review": True, **result}
    except AIComparisonError:
        return {
            "analysis_status": "unavailable",
            "requires_manual_review": True,
            "photo_quality": "unknown",
            "same_area": None,
            "change_detected": False,
            "classification": "none",
            "severity": None,
            "confidence": "low",
            "obstructed_areas": None,
            "findings": [],
            "summary": "AI comparison unavailable. Review the baseline and current photos manually.",
        }
