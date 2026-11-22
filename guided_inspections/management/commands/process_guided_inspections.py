from django.core.management.base import BaseCommand
from guided_inspections.operations import reconcile

class Command(BaseCommand):
    help = 'Reconcile persisted in-app notifications and create due recurring assignments; never calls Gemini.'
    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=200)
    def handle(self, *args, **options):
        self.stdout.write(f"Processed {reconcile(max(1, min(options['limit'], 10000)))} inspections.")
