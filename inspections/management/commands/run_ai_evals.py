"""Run the 19-case golden suite with one command and fail CI below thresholds."""
import json

from django.core.management.base import BaseCommand, CommandError

from inspections.evaluation import evaluate


class Command(BaseCommand):
    help = "Evaluate the image-comparison feature (safe replay or opt-in capped Gemini calls)"

    def add_arguments(self, parser):
        parser.add_argument("--live", action="store_true", help="Use up to 40 REAL Gemini calls; default only replays mocked results")

    def handle(self, *args, **options):
        result = evaluate(live=options["live"])
        self.stdout.write(json.dumps(result, indent=2))
        if not result["passed"]:
            raise CommandError("AI evaluation failed required thresholds")
