"""Session/CSRF protected guided workflow. Provider references never leave Django."""
import hashlib
import re
from datetime import datetime, timedelta

from bson import ObjectId
from django.db import IntegrityError
from django.http import HttpResponse, JsonResponse
from django.utils import timezone

from accounts.models import AccountProfile
from inspections import media
from inspections.services import prepare_image, AIComparisonError
from maintenance.models import Unit, UnitAssignment, MaintenanceRequest
from maintenance.views import endpoint, role, units, body
from maintenance.store import Conflict
from . import store
from .models import InspectionTemplate, GuidedInspection, InspectionNotification


def missing():
    return JsonResponse({'detail': 'Inspection not found.'}, status=404)


def scope(request):
    query = {'unit_id': {'$in': list(units(request).values_list('pk', flat=True))}}
    if role(request) == 'tenant':
        query['tenant_id'] = request.user.pk
    elif role(request) != 'landlord':
        query['unit_id'] = {'$in': []}
    return query


def record_for(request, inspection_id):
    if not re.fullmatch(r'[a-f0-9]{32}', inspection_id):
        return None
    return store.collection().find_one({**scope(request), 'public_id': inspection_id})


def notify(record, message, recipient, event):
    key = hashlib.sha256(f"{record['public_id']}:{event}:{recipient}".encode()).hexdigest()
    InspectionNotification.objects.get_or_create(event_key=key, defaults=dict(
        recipient_id=recipient, inspection_id=record['_id'], message=message))


def photo_json(p):
    return {k: p[k] for k in ('id', 'step_id', 'slot', 'state')}


def serialize(record, detail=True):
    unit = Unit.objects.select_related('property').get(pk=record['unit_id'])
    due = record['due_at']
    if timezone.is_naive(due):
        due = timezone.make_aware(due)
    result = dict(id=record['public_id'], unit_id=str(unit.pk), unit=unit.label, property=unit.property.name,
                  inspection_type=record['inspection_type'], due_at=due.isoformat(), status=record['status'],
                  overdue=due < timezone.now() and record['status'] in store.EDITABLE,
                  upcoming=timezone.now() <= due <= timezone.now()+timedelta(days=7) and record['status'] in store.EDITABLE,
                  revision=record['revision'], progress=len(store.active(record)),
                  required=sum(s['count'] for s in record['steps']), steps=record['steps'],
                  template_version=record['template_version'], recurrence_days=record['recurrence_days'])
    if detail:
        base = store.baseline(record)
        compatible = bool(base and base['inspection_id'] != record['public_id'] and
                          base['template_id'] == str(record['template_id']) and base['template_version'] == record['template_version'])
        result.update(photos=[photo_json(p) for p in store.active(record)],
                      uploads=[photo_json(p) for p in record['photos'] if p['state'] in {'uploading', 'failed'} and not p.get('replaced_at')],
                      history=record['history'], baseline_available=compatible,
                      baseline_photos=[photo_json(p) for p in base['photos']] if compatible else [],
                      comparisons=[{**{k: v for k, v in c.items() if k not in {'baseline_photo', 'current_photo'}},
                                    'baseline_photo_id': c['baseline_photo']['id'], 'current_photo_id': c['current_photo']['id']}
                                   for c in record['comparisons']])
    return result


@endpoint(['GET'])
def options(request):
    eligible = []
    if role(request) == 'landlord':
        for unit in units(request).select_related('property')[:100]:
            eligible.append(dict(id=str(unit.pk), label=unit.label, property=unit.property.name,
                                 tenants=[dict(id=str(a.tenant_id), label=a.tenant.get_full_name() or a.tenant.get_username())
                                          for a in UnitAssignment.objects.filter(unit=unit, active=True).select_related('tenant')[:100]]))
    templates = InspectionTemplate.objects.filter(owner=request.user, active=True) if role(request) == 'landlord' else InspectionTemplate.objects.none()
    return JsonResponse({'units': eligible, 'templates': [dict(id=t.public_id, name=t.name, version=t.version, steps=t.steps) for t in templates[:100]],
                         'default_steps': store.DEFAULT_STEPS})


@endpoint(['POST'])
def templates(request):
    if role(request) != 'landlord':
        return missing()
    data = body(request)
    name = data.get('name', '').strip()
    if not 1 <= len(name) <= 100:
        raise ValueError
    steps = store.validate_steps(data.get('steps', store.DEFAULT_STEPS))
    template = InspectionTemplate.objects.create(owner=request.user, name=name, steps=steps)
    return JsonResponse({'id': template.public_id}, status=201)


@endpoint(['GET', 'POST'])
def inspections(request):
    if request.method == 'GET':
        query = scope(request)
        before = request.GET.get('before')
        if before:
            query['_id'] = {'$lt': ObjectId(before)}
        records = list(store.collection().find(query).sort('_id', -1).limit(51))
        return JsonResponse({'inspections': [serialize(r, False) for r in records[:50]],
                             'next': str(records[49]['_id']) if len(records) > 50 else None})
    if role(request) != 'landlord':
        return missing()
    data = body(request)
    unit = units(request).filter(pk=ObjectId(data['unit_id'])).first()
    if not unit:
        return missing()
    assignment = UnitAssignment.objects.filter(unit=unit, tenant_id=ObjectId(data['tenant_id']), active=True).first()
    template = InspectionTemplate.objects.filter(public_id=data['template_id'], owner=request.user, active=True).first()
    if not assignment or not template or not AccountProfile.objects.filter(user_id=assignment.tenant_id, role='tenant').exists() or data.get('inspection_type') not in store.TYPES:
        raise ValueError
    due = datetime.fromisoformat(data['due_at'].replace('Z', '+00:00'))
    due = due.replace(microsecond=(due.microsecond // 1000) * 1000)  # MongoDB datetime precision
    recurrence = data.get('recurrence_days', 0)
    if timezone.is_naive(due) or type(recurrence) is not int or recurrence not in {0, 30, 90, 180, 365}:
        raise ValueError
    key = data.get('idempotency_key', '')
    if not isinstance(key, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{16,80}', key):
        raise ValueError
    creation_key = hashlib.sha256(f'{request.user.pk}:{key}'.encode()).hexdigest()
    if due < timezone.now() and not GuidedInspection.objects.filter(creation_key=creation_key).exists():
        raise ValueError('Due date must be in the future.')
    values = dict(unit=unit, tenant_id=assignment.tenant_id, landlord=request.user, template=template,
                  template_version=template.version, steps=store.validate_steps(template.steps), due_at=due,
                  inspection_type=data['inspection_type'], recurrence_days=recurrence,
                  history=[dict(action='assigned', actor=str(request.user.pk), at=timezone.now().isoformat())])
    try:
        obj, _ = GuidedInspection.objects.get_or_create(creation_key=creation_key, defaults=values)
    except IntegrityError:
        obj = GuidedInspection.objects.get(creation_key=creation_key)
    if (obj.unit_id != unit.pk or obj.tenant_id != assignment.tenant_id or obj.template_id != template.pk or
            obj.inspection_type != data['inspection_type'] or obj.due_at != due or obj.recurrence_days != recurrence):
        raise Conflict('Creation key already belongs to a different assignment.')
    record = record_for(request, obj.public_id)
    notify(record, 'A photo inspection has been assigned.', record['tenant_id'], 'assigned')
    return JsonResponse({'inspection': serialize(record)}, status=200)


@endpoint(['GET'])
def detail(request, inspection_id):
    record = record_for(request, inspection_id)
    return JsonResponse({'inspection': serialize(record)}) if record else missing()


@endpoint(['POST'])
def upload(request, inspection_id):
    record = record_for(request, inspection_id)
    if not record or role(request) != 'tenant':
        return missing()
    files = request.FILES
    if getattr(request, 'upload_limit_exceeded', False):
        return JsonResponse({'detail': 'Photo exceeds 8 MB.'}, status=413)
    photo = files.get('photo')
    if not photo or len(files) != 1 or len(files.getlist('photo')) != 1 or photo.content_type not in {'image/jpeg', 'image/png'}:
        raise ValueError
    try:
        data = prepare_image(photo)
    except AIComparisonError:
        return JsonResponse({'detail': 'Use JPEG/PNG photos under 8 MB and 20 megapixels.'}, status=400)
    store.check_revision(record, int(request.POST.get('revision', '-1')))
    record = store.upload(record, request.POST.get('step_id'), int(request.POST.get('slot', '-1')), data, request.user.pk)
    return JsonResponse({'inspection': serialize(record)})


@endpoint(['GET'])
def photo(request, inspection_id, photo_id):
    record = record_for(request, inspection_id)
    if not record:
        return missing()
    # Historical evidence remains accessible only within the authorized record.
    photos = record['photos']
    if request.GET.get('baseline') == '1':
        base = store.baseline(record)
        photos = base['photos'] if base and base['template_id'] == str(record['template_id']) and base['template_version'] == record['template_version'] else []
    if request.GET.get('comparison'):
        comparison = next((c for c in record['comparisons'] if c['id'] == request.GET['comparison']), None)
        photos = [comparison['baseline_photo'], comparison['current_photo']] if comparison else []
    evidence = next((p for p in photos if p['id'] == photo_id and p['state'] == 'ready'), None)
    if not evidence:
        return missing()
    response = HttpResponse(media.retrieve(evidence['ref']), content_type='image/jpeg')
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response


@endpoint(['POST'])
def action(request, inspection_id, action):
    record = record_for(request, inspection_id)
    if not record:
        return missing()
    data = body(request)
    actor = request.user.pk
    landlord = role(request) == 'landlord'
    if action == 'maintenance-draft' and role(request) == 'tenant':
        if record['status'] not in {'submitted', 'reviewed'}:
            raise Conflict('Submit the inspection before creating maintenance follow-up.')
        comparison = next((c for c in record['comparisons'] if c['id'] == data.get('comparison_id') and c.get('decision') == 'confirmed'), None)
        if not comparison:
            raise Conflict('A confirmed finding is required.')
        key = hashlib.sha256(f"guided-maintenance:{record['public_id']}:{comparison['id']}".encode()).hexdigest()
        # Reuse private references, preserving their original retention metadata.
        # Deduplicate identical bytes to preserve maintenance photo semantics.
        references = {p['ref']['sha256']: p for p in store.active(record)}
        photos = [dict(id=digest, state='ready', ref=p['ref']) for digest, p in references.items()]
        current = comparison['current_photo']
        step = next(s for s in record['steps'] if s['id'] == current['step_id'])
        draft, _ = MaintenanceRequest.objects.get_or_create(creation_key=key, defaults=dict(
            tenant=request.user, unit_id=record['unit_id'], area=step['room'],
            description='Follow-up for a confirmed inspection finding. Please describe the requested repair.',
            photos=photos, history=[dict(action='inspection-follow-up', inspection_id=record['public_id'], comparison_id=comparison['id'], at=timezone.now().isoformat())]))
        return JsonResponse({'maintenance_id': draft.public_id})
    elif action == 'submit' and role(request) == 'tenant':
        if record['status'] not in {'submitted', 'reviewed'}:
            store.check_revision(record, data.get('revision'))
        record = store.submit(record, actor)
        notify(record, 'An inspection is ready for review.', record['landlord_id'], 'submitted-event:' + next(h['at'] for h in reversed(record['history']) if h['action'] == 'submitted'))
    elif landlord and action == 'approve-baseline':
        store.check_revision(record, data.get('revision'))
        record = store.approve(record, actor)
        notify(record, 'Your move-in baseline has been approved.', record['tenant_id'], 'baseline-approved:' + next(h['at'] for h in reversed(record['history']) if h['action'] in {'baseline-approved', 'review-completed'}))
    elif landlord and action == 'compare':
        store.check_revision(record, data.get('revision'))
        record = store.compare(record, data.get('photo_id'), actor)
    elif landlord and action in {'retake', 'finalize', 'decision', 'maintenance'}:
        store.check_revision(record, data.get('revision'))
        if record['status'] != 'submitted':
            raise Conflict('Review requires a submitted inspection.')
        if any(c['status'] == 'pending' for c in record['comparisons']) and action in {'retake', 'finalize'}:
            raise Conflict('Analysis is pending. Refresh before finalizing.')
        if action == 'retake':
            reason = data.get('reason', '').strip()
            if not 1 <= len(reason) <= 1000:
                raise ValueError
            record = store.change(record, dict(status='retake', history=store.audit(record, 'retake-requested', actor, reason=reason)))
            notify(record, 'A retake has been requested. Open the inspection for details.', record['tenant_id'], 'retake-requested:' + record['history'][-1]['at'])
        elif action == 'finalize':
            if any(c.get('decision') is None for c in record['comparisons']):
                raise Conflict('Record a human decision for each analysis before finalizing.')
            record = store.change(record, dict(status='reviewed', reviewed_at=timezone.now(), history=store.audit(record, 'review-completed', actor)))
            notify(record, 'Your inspection review is complete.', record['tenant_id'], 'review-completed:' + record['history'][-1]['at'])
        else:
            comparison = next((c for c in record['comparisons'] if c['id'] == data.get('comparison_id')), None)
            if not comparison or comparison['status'] != 'completed':
                raise Conflict('Completed comparison required.')
            if action == 'decision':
                decision = data.get('decision')
                if decision not in {'confirmed', 'dismissed', 'manual-review'}:
                    raise ValueError
                comparisons = [{**c, 'decision': decision} if c['id'] == comparison['id'] else c for c in record['comparisons']]
                record = store.change(record, dict(comparisons=comparisons, history=store.audit(record, decision, actor, comparison_id=comparison['id'])))
            else:
                # Link an existing tenant-submitted request; never bypass its
                # ownership, submission validation or 5–20-photo requirement.
                maintenance = MaintenanceRequest.objects.filter(public_id=data.get('maintenance_id'), unit_id=record['unit_id'], tenant_id=record['tenant_id']).first()
                if not maintenance or maintenance.status == 'draft' or comparison.get('decision') != 'confirmed':
                    raise Conflict('Choose a submitted maintenance request from this tenant and unit for a confirmed finding.')
                comparisons = [{**c, 'maintenance_id': maintenance.public_id} if c['id'] == comparison['id'] else c for c in record['comparisons']]
                record = store.change(record, dict(comparisons=comparisons, history=store.audit(record, 'maintenance-linked', actor, comparison_id=comparison['id'], maintenance_id=maintenance.public_id)))
    else:
        return missing()
    return JsonResponse({'inspection': serialize(record)})


@endpoint(['GET', 'POST'])
def notifications(request):
    authorized = InspectionNotification.objects.filter(recipient=request.user,
        inspection__unit_id__in=list(units(request).values_list('pk', flat=True)))
    if role(request) == 'tenant':
        authorized = authorized.filter(inspection__tenant=request.user)
    if request.method == 'POST':
        data = body(request)
        target = authorized.filter(event_key=data.get('id')).first()
        if target:
            # MongoDB update cannot use a joined filter; authorize first, then
            # update the recipient-scoped document by its primary key.
            InspectionNotification.objects.filter(pk=target.pk, recipient=request.user).update(read_at=timezone.now())
    records = authorized.order_by('-created_at')[:100]
    return JsonResponse({'notifications': [dict(id=n.event_key, inspection_id=n.inspection.public_id, message=n.message,
                                                created_at=n.created_at.isoformat(), read=n.read_at is not None) for n in records]})
