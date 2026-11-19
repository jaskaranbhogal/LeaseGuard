"""Operator-only bootstrap; deliberately not available to tenant/landlord sessions."""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django_mongodb_backend import transaction
from accounts.models import AccountProfile
from maintenance.models import Property, Unit, UnitAssignment


class Command(BaseCommand):
    help = 'Assign an existing tenant to a unit after operator verification (no public self-assignment)'

    def add_arguments(self, parser):
        parser.add_argument('--operator', required=True, help='Existing active superuser username')
        parser.add_argument('--tenant', required=True)
        parser.add_argument('--landlord', required=True)
        parser.add_argument('--property', required=True)
        parser.add_argument('--unit', required=True)

    def handle(self, *args, **options):
        User = get_user_model()
        try:
            operator = User.objects.get(username=options['operator'], is_superuser=True, is_active=True)
            tenant = User.objects.get(username=options['tenant'], is_active=True)
            landlord = User.objects.get(username=options['landlord'], is_active=True)
        except User.DoesNotExist:
            raise CommandError('Use existing active accounts and an active superuser operator.') from None
        if not (AccountProfile.objects.filter(user=tenant, role='tenant').exists()
                and AccountProfile.objects.filter(user=landlord, role='landlord').exists()):
            raise CommandError('Tenant and landlord must have the corresponding verified account roles.')
        if not options['property'].strip() or not options['unit'].strip():
            raise CommandError('Property and unit labels are required.')
        with transaction.atomic():
            # Existing property reuse requires the SAME verified manager; never
            # attach an arbitrary landlord to a namesake property.
            prop = Property.objects.filter(name=options['property'], managers=landlord).first()
            if not prop:
                prop = Property.objects.create(name=options['property'])
                prop.managers.add(landlord)
            unit, _ = Unit.objects.get_or_create(property=prop, label=options['unit'])
            assignment, _ = UnitAssignment.objects.get_or_create(
                tenant=tenant, unit=unit, active=True, defaults={'verified_by': operator})
        self.stdout.write(f'Verified assignment {assignment.pk}; unit {unit.pk}')
