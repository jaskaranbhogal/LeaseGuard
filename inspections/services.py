import io

from django.conf import settings
from google import genai
from google.genai import types
from PIL import Image, ImageOps
from pydantic import ValidationError

from .prompts import SYSTEM_PROMPT, build_message
from .schemas import InspectionResult

MAX_IMAGE_SIDE = 1500
REQUEST_TIMEOUT_MS = 120_000


class AIComparisonError(Exception):
    pass


def _get_client():
    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if not api_key:
        raise AIComparisonError("GEMINI_API_KEY is not set")
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS),
    )


def prepare_image(image):
    data = image if isinstance(image, bytes) else image.read()
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85)
    return out.getvalue()


def compare_images(baseline, current, room, area, landlord_notes=None, known_issues=None):
    client = _get_client()

    contents = [
        types.Part.from_bytes(data=prepare_image(baseline), mime_type="image/jpeg"),
        types.Part.from_bytes(data=prepare_image(current), mime_type="image/jpeg"),
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
    except Exception as e:
        raise AIComparisonError(f"Gemini request failed: {e}") from e

    try:
        result = InspectionResult.model_validate_json(response.text or "")
    except ValidationError as e:
        raise AIComparisonError(f"Gemini returned an unexpected response: {e}") from e

    return result.model_dump()
