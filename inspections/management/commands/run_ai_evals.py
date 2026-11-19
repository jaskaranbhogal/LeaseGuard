"""Run the golden suite with one command and fail CI below thresholds."""
import json

from django.core.management.base import BaseCommand, CommandError

from inspections.evaluation import evaluate, golden_cases


class Command(BaseCommand):
    help = "Evaluate the image-comparison feature (safe replay or opt-in capped Gemini calls)"

    def add_arguments(self, parser):
        parser.add_argument("--live", action="store_true", help="Use up to 40 REAL Gemini calls; default only replays mocked results")

        parser.add_argument('--case', action='append', dest='case_ids', help='Explicit golden-case subset (minimum 15, maximum 20 live); repeat for each ID')

    def handle(self, *args, **options):
        cases = golden_cases()
        if options.get('case_ids'):
            wanted = set(options['case_ids'])
            if wanted - {c['id'] for c in cases}:
                raise CommandError('Unknown golden case ID')
            cases = [c for c in cases if c['id'] in wanted]
        try:
            result = evaluate(live=options["live"], cases=cases)
        except ValueError as exc:
            raise CommandError(str(exc)) from None
        self.stdout.write(json.dumps(result, indent=2))
        if not result["passed"]:
            raise CommandError("AI evaluation failed required thresholds")
