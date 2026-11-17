"""Owner isolation, upload safety and AI budget behavior without live provider."""
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, SimpleTestCase
from django.contrib.auth.models import AnonymousUser

from inspections import storage
from inspections.views import compare_photo_view, recent_comparisons
from .test_services import make_image


class ComparisonAPITests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def post(self):
        request = self.factory.post(
            "/api/inspections/compare/",
            {
                "room": "Living room",
                "area": "North wall",
                "baseline": SimpleUploadedFile("baseline.png", make_image(), content_type="image/png"),
                "current": SimpleUploadedFile("current.png", make_image(), content_type="image/png"),
            },
        )
        request.user = SimpleNamespace(is_authenticated=True, pk="owner-test")
        request._dont_enforce_csrf_checks = True
        return request

    def test_unauthenticated_requests_cannot_upload_or_list(self):
        request = self.post()
        request.user = AnonymousUser()
        self.assertEqual(compare_photo_view(request).status_code, 401)
        listing = self.factory.get("/api/inspections/recent/")
        listing.user = AnonymousUser()
        self.assertEqual(recent_comparisons(listing).status_code, 401)

    @patch("inspections.views.storage.get_pair")
    @patch("inspections.views.storage.complete_pair")
    @patch("inspections.views.compare_images_safe")
    @patch("inspections.views.storage.consume_daily_call", return_value=False)
    @patch("inspections.views.storage.create_pair")
    def test_quota_saves_photos_but_never_calls_provider(
        self, create_pair, consume_daily_call, ai, complete_pair, get_pair,
    ):
        timestamp = datetime.now(timezone.utc)
        record = {
            "_id": "a" * 64,
            "owner_id": "owner-test",
            "room": "Living room",
            "area": "North wall",
            "created_at": timestamp,
            "retain_until": timestamp + timedelta(days=90),
            "status": "pending",
            "result": None,
        }
        create_pair.return_value = (record, True)
        get_pair.return_value = {
            **record, "status": "completed",
            "result": {"analysis_status": "unavailable", "requires_manual_review": True},
        }
        response = compare_photo_view(self.post())
        self.assertEqual(response.status_code, 201)
        self.assertEqual(json.loads(response.content)["comparison"]["result"]["analysis_status"], "unavailable")
        ai.assert_not_called()
        complete_pair.assert_called_once()

    def test_content_addressing_is_scoped_to_owner(self):
        first = storage._pair_id("alice", b"x", b"y", "Kitchen", "Sink")
        same = storage._pair_id("alice", b"x", b"y", "Kitchen", "Sink")
        another = storage._pair_id("bob", b"x", b"y", "Kitchen", "Sink")
        self.assertEqual(first, same)
        self.assertNotEqual(first, another)
        self.assertGreaterEqual(storage.RETENTION_DAYS, 90)
        self.assertEqual(storage.DAILY_AI_CALLS_PER_USER, 3)
        self.assertEqual(storage.GLOBAL_AI_CALLS_PER_DAY, 30)
