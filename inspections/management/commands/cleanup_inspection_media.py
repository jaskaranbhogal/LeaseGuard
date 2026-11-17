"""Owner-safe retention cleanup; never deletes photos younger than 90 days."""
from datetime import datetime, timezone

import gridfs
from django.core.management.base import BaseCommand

from inspections.storage import database


class Command(BaseCommand):
    help = "List expired inspection pairs; add --execute to delete media after 90 days"

    def add_arguments(self, parser):
        parser.add_argument("--execute", action="store_true", help="Permanently remove expired pairs and their photos")
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        db = database()
        fs = gridfs.GridFS(db)
        limit = max(1, min(options["limit"], 1000))
        now = datetime.now(timezone.utc)
        expired = db.inspection_comparisons.find({"retain_until": {"$lt": now}}).limit(limit)
        count = 0
        for record in expired:
            count += 1
            if options["execute"]:
                for kind in ("baseline", "current"):
                    file_id = record.get(f"{kind}_file_id")
                    if file_id and fs.exists(file_id):
                        fs.delete(file_id)
                db.inspection_comparisons.delete_one({"_id": record["_id"], "retain_until": {"$lt": now}})
        action = "Deleted" if options["execute"] else "Found (dry run)"
        self.stdout.write(f"{action} {count} comparison pairs older than 90 days.")
