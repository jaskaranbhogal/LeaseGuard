import json

from django.core.management.base import BaseCommand, CommandError

from inspections.services import AIComparisonError, compare_images


class Command(BaseCommand):
    help = "Run a baseline vs current photo through Gemini and print the result"

    def add_arguments(self, parser):
        parser.add_argument("baseline")
        parser.add_argument("current")
        parser.add_argument("--room", required=True)
        parser.add_argument("--area", required=True)
        parser.add_argument("--notes")
        parser.add_argument("--known-issues")

    def handle(self, *args, **opts):
        with open(opts["baseline"], "rb") as b, open(opts["current"], "rb") as c:
            try:
                result = compare_images(
                    b, c, opts["room"], opts["area"],
                    landlord_notes=opts["notes"],
                    known_issues=opts["known_issues"],
                )
            except AIComparisonError as e:
                raise CommandError(str(e))

        self.stdout.write(json.dumps(result, indent=2))
