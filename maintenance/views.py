import hashlib
import json
import re
from functools import wraps

from bson import ObjectId
from bson.errors import InvalidId
from django.db import DatabaseError, IntegrityError
from django.core.exceptions import RequestDataTooBig, TooManyFilesSent
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods
from pymongo.errors import PyMongoError

from accounts.models import AccountProfile
from inspections import media
from inspections.services import prepare_image, AIComparisonError, MAX_UPLOAD_BYTES
from .models import MaintenanceRequest, Unit, UnitAssignment
from . import limits, store


def endpoint(methods):
    def decorate(fn):
        @never_cache
        @require_http_methods(methods)
        @csrf_protect
        @wraps(fn)
        def wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({'detail': 'Sign in to access maintenance.'}, status=401)
            try:
                if not limits.allow(str(request.user.pk), request.method):
                    response = JsonResponse({'detail': 'Too many maintenance requests. Wait a minute and retry.'}, status=429)
                    response['Retry-After'] = '60'
                    return response
                return fn(request, *args, **kwargs)
            except (PyMongoError, DatabaseError, media.StorageError):
                return JsonResponse({'detail': 'Secure storage is unavailable. Refresh and retry.'}, status=503)
            except store.Conflict as exc:
                return JsonResponse({'detail': str(exc)}, status=409)
            except (ValueError, TypeError, AttributeError, KeyError, OverflowError, InvalidId, RequestDataTooBig, TooManyFilesSent):
                return JsonResponse({'detail': 'Invalid request. Check your fields and photo.'}, status=400)
        return wrapped
    return decorate


def role(request):
    profile = AccountProfile.objects.filter(user=request.user).first()
    return profile.role if profile else None


def units(request):
    if role(request) == 'tenant':
        return Unit.objects.filter(id__in=UnitAssignment.objects.filter(
            tenant=request.user, active=True).values_list('unit_id', flat=True))
    if role(request) == 'landlord':
        return Unit.objects.filter(property__managers=request.user)
    return Unit.objects.none()


def scope(request):
    query = {'unit_id': {'$in': list(units(request).values_list('pk', flat=True))}}
    if role(request) == 'tenant':
        query['tenant_id'] = request.user.pk
    else:
        query['status'] = {'$in': ['submitted', 'in-review', 'in-progress', 'resolved']}
    return query


def record_for(request, request_id):
    if not re.fullmatch(r'[a-f0-9]{32}', request_id):
        return None
    return store.collection().find_one({**scope(request), 'public_id': request_id})


def serialize(record):
    unit = Unit.objects.select_related('property').get(pk=record['unit_id'])
    return {
        'id': record['public_id'], 'unit_id': str(unit.pk),
        'unit': unit.label, 'property': unit.property.name,
        'area': record['area'], 'description': record['description'],
        'urgency': record['urgency'], 'status': record['status'],
        'created_at': record['created_at'].isoformat(),
        'updated_at': record['updated_at'].isoformat(),
        'submitted_at': record['submitted_at'].isoformat() if record.get('submitted_at') else None,
        'photos': [{'id': p['id'], 'state': p['state'],
                    'available': p['state'] == 'ready' and not p.get('deleted_at') and not record.get('media_expired'),
                    'retain_until': p['ref']['retain_until']}
                   for p in store.active_photos(record)],
        'history': record['history'],
        'comparison_available': False,
        'comparison_limitation': 'No verified baseline linked to this unit and area. Review photos manually.',
    }


def body(request):
    if len(request.body) > 8192:
        raise ValueError
    result = json.loads(request.body)
    if not isinstance(result, dict):
        raise ValueError
    return result


def fields(data):
    area, description = data.get('area', '').strip(), data.get('description', '').strip()
    urgency = data.get('urgency', 'normal')
    if not 1 <= len(area) <= 100 or not 1 <= len(description) <= 2000 or urgency not in {'normal', 'urgent'}:
        raise ValueError
    return {'area': area, 'description': description, 'urgency': urgency}


def missing():
    return JsonResponse({'detail': 'Maintenance request not found.'}, status=404)


@endpoint(['GET'])
def assigned_units(request):
    return JsonResponse({'units': [{'id': str(u.pk), 'label': u.label, 'property': u.property.name}
                                   for u in units(request).select_related('property')[:100]]})


@endpoint(['GET', 'POST'])
def requests(request):
    if request.method == 'GET':
        # Keyset pagination; bounded response, including older saved records.
        query = scope(request)
        before = request.GET.get('before')
        if before:
            if not re.fullmatch(r'[a-f0-9]{24}', before):
                raise ValueError
            query['_id'] = {'$lt': ObjectId(before)}
        records = list(store.collection().find(query).sort('_id', -1).limit(51))
        return JsonResponse({'requests': [serialize(r) for r in records[:50]],
                             'next': str(records[49]['_id']) if len(records) > 50 else None})
    if role(request) != 'tenant':
        return JsonResponse({'detail': 'Tenant access required.'}, status=403)
    data = body(request)
    values = fields(data)
    unit_id = data.get('unit_id', '')
    if not isinstance(unit_id, str) or not re.fullmatch(r'[a-f0-9]{24}', unit_id):
        raise ValueError
    unit = units(request).filter(pk=ObjectId(unit_id)).first()
    if not unit:
        return missing()
    key = data.get('idempotency_key', '')
    if not isinstance(key, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{16,80}', key):
        raise ValueError
    creation_key = hashlib.sha256(f'{request.user.pk}:{key}'.encode()).hexdigest()
    existing = MaintenanceRequest.objects.filter(creation_key=creation_key).first()
    if existing is None:
        if MaintenanceRequest.objects.filter(tenant=request.user, status='draft', media_expired=False).count() >= 10:
            return JsonResponse({'detail': 'Resume an existing draft (maximum 10).'}, status=429)
        try:
            existing = MaintenanceRequest.objects.create(tenant=request.user, unit=unit,
                                                         creation_key=creation_key, **values)
        except IntegrityError:
            existing = MaintenanceRequest.objects.get(creation_key=creation_key)
    if existing.unit_id != unit.pk:
        raise store.Conflict('This creation key belongs to a different unit. Resume that draft or start a new report.')
    record = record_for(request, existing.public_id)
    if not record:
        return missing()
    return JsonResponse({'request': serialize(record)}, status=200)


@endpoint(['GET', 'PATCH'])
def detail(request, request_id):
    record = record_for(request, request_id)
    if not record:
        return missing()
    if request.method == 'PATCH':
        if role(request) != 'tenant':
            return JsonResponse({'detail': 'Tenant access required.'}, status=403)
        store.editable(record)
        record = store.change(record, fields(body(request)))
    return JsonResponse({'request': serialize(record)})


@endpoint(['POST'])
def photos(request, request_id):
    record = record_for(request, request_id)
    if not record or role(request) != 'tenant':
        return missing()
    files = request.FILES
    if getattr(request, 'upload_limit_exceeded', False):
        return JsonResponse({'detail': 'Photos must be 8 MB or smaller.'}, status=413)
    photo = files.get('photo')
    if not photo or len(files) != 1 or len(files.getlist('photo')) != 1:
        raise ValueError
    if photo.size > MAX_UPLOAD_BYTES:
        return JsonResponse({'detail': 'Photos must be 8 MB or smaller.'}, status=413)
    if photo.content_type not in {'image/jpeg', 'image/png'}:
        raise ValueError
    try:
        data = prepare_image(photo)
    except AIComparisonError:
        return JsonResponse({'detail': 'Use a valid JPEG/PNG under 8 MB and 20 megapixels.'}, status=400)
    record = store.upload(record, data)
    return JsonResponse({'request': serialize(record)})


@endpoint(['GET', 'DELETE'])
def photo_detail(request, request_id, photo_id):
    record = record_for(request, request_id)
    if not record or not re.fullmatch(r'[a-f0-9]{64}', photo_id):
        return missing()
    if request.method == 'DELETE':
        if role(request) != 'tenant':
            return missing()
        record = store.remove(record, photo_id)
        return JsonResponse({'request': serialize(record)})
    photo = next((p for p in store.active_photos(record) if p['id'] == photo_id), None)
    if not photo or photo['state'] != 'ready' or photo.get('deleted_at') or record.get('media_expired'):
        return missing()
    response = HttpResponse(media.retrieve(photo['ref']), content_type='image/jpeg')
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response


@endpoint(['POST'])
def submit(request, request_id):
    record = record_for(request, request_id)
    if not record or role(request) != 'tenant':
        return missing()
    return JsonResponse({'request': serialize(store.submit(record, str(request.user.pk)))})


@endpoint(['POST'])
def status(request, request_id):
    record = record_for(request, request_id)
    if not record or role(request) != 'landlord':
        return missing()
    target = body(request).get('status')
    transitions = {'submitted': 'in-review', 'in-review': 'in-progress', 'in-progress': 'resolved'}
    if target == record['status']:
        return JsonResponse({'request': serialize(record)})
    if target != transitions.get(record['status']) or len(record['history']) >= 10:
        raise store.Conflict('Choose the next status in the review process.')
    history = record['history'] + [{'status': target, 'actor': str(request.user.pk),
                                    'at': timezone.now().isoformat()}]
    return JsonResponse({'request': serialize(store.change(record, {'status': target, 'history': history}))})
