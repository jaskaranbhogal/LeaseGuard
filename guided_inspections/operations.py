"""Idempotent local operations. No external notifications or Gemini calls."""
import hashlib
from datetime import timedelta
from django.utils import timezone
from maintenance.models import UnitAssignment
from .models import GuidedInspection
from .views import notify
from . import store


def reconcile(limit=200):
    processed = 0
    for record in store.collection().find({}).sort('_id', 1).limit(limit):
        notify(record, 'A photo inspection has been assigned.', record['tenant_id'], 'assigned')
        for event in record['history']:
            if event['action'] == 'submitted':
                notify(record, 'An inspection is ready for review.', record['landlord_id'], 'submitted-event:'+event['at'])
            elif event['action'] in {'retake-requested', 'review-completed', 'baseline-approved'}:
                notify(record, 'Inspection update: '+event['action']+'. Open the inspection for details.', record['tenant_id'], event['action']+':'+event['at'])
        days = record.get('recurrence_days', 0)
        if record['status'] == 'reviewed' and days and UnitAssignment.objects.filter(unit_id=record['unit_id'], tenant_id=record['tenant_id'], active=True).exists():
            # Reverify manager access before creating another assignment.
            from maintenance.models import Unit
            if not Unit.objects.filter(pk=record['unit_id'], property__managers=record['landlord_id']).exists():
                continue
            key = hashlib.sha256(f"recurrence:{record['public_id']}".encode()).hexdigest()
            GuidedInspection.objects.get_or_create(creation_key=key, defaults=dict(
                unit_id=record['unit_id'], tenant_id=record['tenant_id'], landlord_id=record['landlord_id'],
                template_id=record['template_id'], template_version=record['template_version'], steps=record['steps'],
                due_at=record['due_at']+timedelta(days=days), inspection_type='periodic', recurrence_days=days,
                history=[dict(action='assigned', actor='scheduler', at=timezone.now().isoformat(), previous=record['public_id'])]))
        processed += 1
    return processed
