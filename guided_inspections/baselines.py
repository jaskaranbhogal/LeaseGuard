"""Explicit manager-only authoring; reuses the guided evidence state machine."""
import hashlib
import re

from bson import ObjectId
from django.db import IntegrityError
from django.http import HttpResponse, JsonResponse
from django.utils import timezone

from inspections import media
from inspections.services import prepare_image, AIComparisonError
from maintenance.views import endpoint, role, units, body
from maintenance.store import Conflict
from . import store
from .models import LandlordBaselineDraft, UnitBaseline
from .views import missing, photo_json, available_templates


def unit_for(request, unit_id):
    return units(request).filter(pk=ObjectId(unit_id)).first() if role(request) == 'landlord' else None


def draft_for(request, draft_id):
    if role(request) != 'landlord' or not re.fullmatch(r'[a-f0-9]{32}', draft_id):
        return None
    return store.collection(LandlordBaselineDraft).find_one({
        'public_id': draft_id, 'unit_id': {'$in': list(units(request).values_list('pk', flat=True))}})


def serialize(record):
    return dict(id=record['public_id'], unit_id=str(record['unit_id']), status=record['status'],
                revision=record['revision'], steps=record['steps'], template_id=str(record['template_id']),
                template_version=record['template_version'], expected_active_id=record['expected_active_id'],
                progress=len(store.active(record)), required=sum(s['count'] for s in record['steps']),
                photos=[photo_json(p) for p in store.active(record)],
                uploads=[photo_json(p) for p in record['photos'] if p['state'] != 'ready' and not p.get('replaced_at')],
                history=record['history'])


@endpoint(['GET', 'POST'])
def unit_baselines(request, unit_id):
    unit = unit_for(request, unit_id)
    if not unit:
        return missing()
    head = store.collection(UnitBaseline).find_one({'unit_id': unit.pk})
    active_id = head['active_id'] if head else ''
    if request.method == 'POST':
        data = body(request)
        template = available_templates(request, unit).filter(public_id=data.get('template_id')).first()
        if not template:
            raise ValueError('Select a saved template.')
        # One recoverable authoring ledger per unit/head, shared by its verified managers.
        key = hashlib.sha256(f'baseline:{unit.pk}:{active_id}'.encode()).hexdigest()
        values = dict(unit=unit, landlord=request.user, template=template, template_version=template.version,
                      steps=store.validate_steps(template.steps), expected_active_id=active_id,
                      history=[dict(action='baseline-draft-created', actor=str(request.user.pk), at=timezone.now().isoformat())])
        try:
            obj, _ = LandlordBaselineDraft.objects.get_or_create(creation_key=key, defaults=values)
        except IntegrityError:
            obj = LandlordBaselineDraft.objects.get(creation_key=key)
        if obj.template_id != template.pk:
            raise Conflict('Resume the existing draft using its saved template.')
        return JsonResponse({'draft': serialize(draft_for(request, obj.public_id))})
    drafts = list(store.collection(LandlordBaselineDraft).find({'unit_id': unit.pk, 'history.action': {'$ne': 'baseline-approved'}}).sort('_id', -1).limit(20))
    versions = [dict(id=b['id'], source=b.get('source', 'tenant'),
                     status='approved' if b['id'] == active_id else 'superseded',
                     approved_at=b['approved_at'], approved_by=b['approved_by'],
                     template_id=b['template_id'], template_version=b['template_version'],
                     photos=[photo_json(p) for p in b['photos']]) for b in (head or {}).get('versions', [])]
    return JsonResponse(dict(active_id=active_id, status='approved' if active_id else 'draft' if drafts else 'missing',
                             drafts=[serialize(d) for d in drafts], versions=versions))


@endpoint(['GET', 'POST'])
def draft(request, draft_id):
    record = draft_for(request, draft_id)
    if not record:
        return missing()
    if request.method == 'POST':
        data = body(request)
        # Retry after a lost response must return the published version even with
        # the pre-approval revision. No other mutation skips revision checks.
        head = store.collection(UnitBaseline).find_one({'unit_id': record['unit_id']})
        published = head and any(b['inspection_id'] == draft_id for b in head['versions'])
        if not published:
            store.check_revision(record, data.get('revision'))
        record = store.approve(record, request.user.pk, data.get('supersedes', ''))
    return JsonResponse({'draft': serialize(record)})


@endpoint(['POST'])
def upload(request, draft_id):
    record = draft_for(request, draft_id)
    if not record:
        return missing()
    files = request.FILES
    if getattr(request, 'upload_limit_exceeded', False):
        return JsonResponse({'detail': 'Photo exceeds 8 MB.'}, status=413)
    photo = files.get('photo')
    if not photo or len(files) != 1 or len(files.getlist('photo')) != 1 or photo.content_type not in {'image/jpeg', 'image/png'}:
        raise ValueError
    store.check_revision(record, int(request.POST.get('revision', '-1')))
    try:
        data = prepare_image(photo)
    except AIComparisonError:
        return JsonResponse({'detail': 'Use JPEG/PNG photos under 8 MB and 20 megapixels.'}, status=400)
    record = store.upload(record, request.POST.get('step_id'), int(request.POST.get('slot', '-1')),
                          data, request.user.pk)
    return JsonResponse({'draft': serialize(record)})


@endpoint(['GET'])
def photo(request, draft_id, photo_id):
    record = draft_for(request, draft_id)
    if not record:
        return missing()
    evidence = next((p for p in record['photos'] if p['id'] == photo_id and p['state'] == 'ready'), None)
    return image_response(evidence)


def image_response(evidence):
    if not evidence:
        return missing()
    response = HttpResponse(media.retrieve(evidence['ref']), content_type='image/jpeg')
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response


@endpoint(['GET'])
def version_photo(request, unit_id, version_id, photo_id):
    unit = unit_for(request, unit_id)
    if not unit:
        return missing()
    head = store.collection(UnitBaseline).find_one({'unit_id': unit.pk})
    version = next((b for b in (head or {}).get('versions', []) if b['id'] == version_id), None)
    return image_response(next((p for p in (version or {}).get('photos', []) if p['id'] == photo_id and p['state'] == 'ready'), None))
