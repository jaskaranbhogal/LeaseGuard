"""Failure-path and validation tests that never make real API calls."""
import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from inspections.services import AIComparisonError, compare_images, compare_images_safe
from .test_services import DAMAGE_RESPONSE, make_image


@override_settings(GEMINI_API_KEY="test-key", GEMINI_MODEL="gemini-test")
class SafeFallbackTests(SimpleTestCase):
    def test_timeout_returns_human_review(self):
        client = MagicMock()
        client.models.generate_content.side_effect = TimeoutError("provider timeout")
        with patch("inspections.services._get_client", return_value=client):
            result = compare_images_safe(make_image(), make_image(), "Kitchen", "Sink")
        self.assertEqual(result["analysis_status"], "unavailable")
        self.assertTrue(result["requires_manual_review"])
        self.assertEqual(result["findings"], [])
        self.assertFalse(result["change_detected"])
        client.models.generate_content.assert_called_once()

    def test_invalid_json_returns_human_review(self):
        client = MagicMock()
        client.models.generate_content.return_value = MagicMock(text="not json")
        with patch("inspections.services._get_client", return_value=client):
            result = compare_images_safe(make_image(), make_image(), "Kitchen", "Sink")
        self.assertEqual(result["analysis_status"], "unavailable")

    def test_semantically_invalid_result_is_rejected(self):
        client = MagicMock()
        invalid = {**DAMAGE_RESPONSE, "severity": None}
        client.models.generate_content.return_value = MagicMock(text=json.dumps(invalid))
        with patch("inspections.services._get_client", return_value=client):
            result = compare_images_safe(make_image(), make_image(), "Kitchen", "Sink")
        self.assertEqual(result["analysis_status"], "unavailable")

    @override_settings(GEMINI_API_KEY="")
    def test_missing_key_is_safe(self):
        result = compare_images_safe(make_image(), make_image(), "Kitchen", "Sink")
        self.assertEqual(result["analysis_status"], "unavailable")

    def test_corrupt_photo_rejected_before_api_call(self):
        with patch("inspections.services._get_client") as get_client:
            with self.assertRaises(AIComparisonError):
                compare_images(b"not a picture", make_image(), "Kitchen", "Sink")
            get_client.assert_not_called()

    def test_oversized_photo_rejected_before_api_call(self):
        with patch("inspections.services._get_client") as get_client:
            with self.assertRaises(AIComparisonError):
                compare_images(b"x" * (8 * 1024 * 1024 + 1), make_image(), "Kitchen", "Sink")
            get_client.assert_not_called()
