import io
import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings
from PIL import Image

from inspections.prompts import build_message
from inspections.services import AIComparisonError, compare_images, prepare_image


def make_image(width=800, height=600):
    buf = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buf, format="PNG")
    return buf.getvalue()


DAMAGE_RESPONSE = {
    "photo_quality": "good",
    "same_area": True,
    "change_detected": True,
    "classification": "damage",
    "severity": "medium",
    "confidence": "high",
    "obstructed_areas": None,
    "findings": [
        {
            "description": "Water staining along the bottom right of the wall near the outlet.",
            "classification": "damage",
            "pre_existing_worsened": False,
        }
    ],
    "summary": "Water damage along the bottom of the wall to the right of the doorway.",
}


def mock_client(response_text):
    client = MagicMock()
    client.models.generate_content.return_value = MagicMock(text=response_text)
    return client


@override_settings(GEMINI_API_KEY="test-key", GEMINI_MODEL="gemini-test")
class CompareImagesTests(SimpleTestCase):

    def test_returns_parsed_result(self):
        client = mock_client(json.dumps(DAMAGE_RESPONSE))
        with patch("inspections.services._get_client", return_value=client):
            result = compare_images(make_image(), make_image(), "Living room", "Entrance")

        self.assertEqual(result["classification"], "damage")
        self.assertEqual(result["severity"], "medium")
        self.assertEqual(len(result["findings"]), 1)

    def test_sends_both_images_and_area_info(self):
        client = mock_client(json.dumps(DAMAGE_RESPONSE))
        with patch("inspections.services._get_client", return_value=client):
            compare_images(
                make_image(), make_image(), "Kitchen", "Oven wall",
                known_issues="Small chip on backsplash",
            )

        kwargs = client.models.generate_content.call_args.kwargs
        contents = kwargs["contents"]
        self.assertEqual(kwargs["model"], "gemini-test")
        self.assertEqual(len(contents), 3)
        self.assertIn("Area: Oven wall", contents[2])
        self.assertIn("Known issues at move-in: Small chip on backsplash", contents[2])

    def test_bad_response_raises(self):
        client = mock_client("not json")
        with patch("inspections.services._get_client", return_value=client):
            with self.assertRaises(AIComparisonError):
                compare_images(make_image(), make_image(), "Kitchen", "Oven wall")

    def test_api_failure_raises(self):
        client = MagicMock()
        client.models.generate_content.side_effect = RuntimeError("429 rate limited")
        with patch("inspections.services._get_client", return_value=client):
            with self.assertRaises(AIComparisonError):
                compare_images(make_image(), make_image(), "Kitchen", "Oven wall")

    @override_settings(GEMINI_API_KEY="")
    def test_missing_key_raises(self):
        with self.assertRaises(AIComparisonError):
            compare_images(make_image(), make_image(), "Kitchen", "Oven wall")


class HelperTests(SimpleTestCase):

    def test_blank_fields_become_none(self):
        message = build_message("Bathroom", "Toilet")
        self.assertIn("Landlord notes: None", message)
        self.assertIn("Known issues at move-in: None", message)

    def test_large_photos_get_resized(self):
        out = Image.open(io.BytesIO(prepare_image(make_image(4032, 3024))))
        self.assertEqual(max(out.size), 1500)
        self.assertEqual(out.format, "JPEG")
