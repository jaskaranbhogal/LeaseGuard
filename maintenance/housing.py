"""Housing UI adapters over canonical models. Never stores inspection evidence.

Invites and assignment changes use replica-set transactions, including a write to
Unit to serialize concurrent tenant changes. SMTP is never emulated by console logs.
"""
import hashlib
import re
import secrets
from datetime import timedelta, timezone as datetime_timezone
from zoneinfo import ZoneInfo

from bson import ObjectId
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from pymongo.read_concern import ReadConcern
from pymongo.write_concern import WriteConcern

from inspections.storage import database
from .models import (Property, Unit, UnitAssignment, TenantInvitation, PolicyConsent,
                     InspectionAppointment)
from .views import endpoint, role, units, body, missing
from .store import Conflict

POLICY_VERSION = '2026-11-21'
DEFAULT_AREAS = ['Entry', 'Living room', 'Kitchen', 'Bathroom', 'Bedroom']


def coll(model):
    return database()[model._meta.db_table]


def consented(request):
    return PolicyConsent.objects.filter(user=request.user, policy_version=POLICY_VERSION, role=role(request)).exists()


def require_consent(request):
    if not consented(request):
        raise Conflict('Read and accept the current privacy policy before continuing.')


def text(data, key, maximum):
    value = data.get(key, '')
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= maximum or any(ord(c) < 32 for c in value):
        raise ValueError
    return value.strip()


def email_address(value):
    if not isinstance(value, str) or len(value) > 254:
        raise ValueError
    value = value.strip().lower()
    try:
        validate_email(value)
    except ValidationError as exc:
        raise ValueError from exc
    return value


def manager_unit(request, unit_id):
    if role(request) != 'landlord':
        return None
    return units(request).filter(pk=ObjectId(unit_id)).first()


def mutate_unit(unit, session):
    # Every invitation/assignment mutation takes the same write lock.
    if not coll(Unit).update_one({'_id': unit.pk}, {'$inc': {'revision': 1}}, session=session).matched_count:
        raise Conflict('Unit no longer available.')


def transaction(callback):
    with database().client.start_session() as session:
        return session.with_transaction(callback, read_concern=ReadConcern('snapshot'),
            write_concern=WriteConcern(w='majority', wtimeout=5000), max_commit_time_ms=5000)


def invitation_json(invite):
    return dict(id=invite.public_id, unitId=str(invite.unit_id), email=invite.email,
                expiresAt=invite.expires_at.isoformat(), delivery=invite.delivery)


def unit_json(unit):
    tenant = UnitAssignment.objects.filter(unit=unit, active=True).select_related('tenant').first()
    invite = TenantInvitation.objects.filter(unit=unit, status='pending', expires_at__gt=timezone.now()).order_by('-created_at').first()
    link = None
    if tenant:
        link = dict(email=tenant.tenant.email, name=tenant.tenant.get_full_name() or tenant.tenant.email,
                    status='joined', invitedOn='', joinedOn=tenant.verified_at.isoformat())
    elif invite:
        link = dict(email=invite.email, status='pending', invitedOn=invite.created_at.isoformat(),
                    invitationId=invite.public_id, delivery=invite.delivery)
    from guided_inspections.models import UnitBaseline
    head = UnitBaseline.objects.filter(unit=unit).first()
    baseline = next((b for b in head.versions if b['id'] == head.active_id), None) if head else None
    latest = TenantInvitation.objects.filter(unit=unit).order_by('-created_at').first() if not tenant and not invite else None
    if latest and latest.status == 'declined':
        link = dict(email=latest.email, status='declined', invitedOn=latest.created_at.isoformat(),
                    declinedOn=latest.responded_at.isoformat() if latest.responded_at else '')
    return dict(id=str(unit.pk), name=unit.label, bedrooms=unit.bedrooms, bathrooms=unit.bathrooms,
                areas=unit.areas or DEFAULT_AREAS, tenant=link, revision=unit.revision,
                assignmentId=str(tenant.pk) if tenant else None,
                baselineRecordedOn=baseline['approved_at'] if baseline else None)


def landlord_state(request):
    return dict(consented=consented(request), properties=[dict(id=str(p.pk), street=p.name, city=p.city,
                units=[unit_json(u) for u in Unit.objects.filter(property=p)[:100]])
                for p in Property.objects.filter(managers=request.user)[:100]], activity=[])


def tenant_state(request):
    assignment = UnitAssignment.objects.filter(tenant=request.user, active=True).select_related('unit__property').order_by('-verified_at').first()
    invite = TenantInvitation.objects.filter(email=request.user.email.lower(), status='pending', expires_at__gt=timezone.now()).select_related('unit__property', 'invited_by').first()
    def location(unit, landlord, email):
        return dict(email=email, landlordId=str(landlord.pk), landlordName=landlord.get_full_name() or landlord.email,
                    propertyId=str(unit.property_id), unitId=str(unit.pk), street=unit.property.name, city=unit.property.city,
                    unit=unit.label, bedrooms=unit.bedrooms, bathrooms=unit.bathrooms, areaCount=len(unit.areas or DEFAULT_AREAS))
    # Registration alone does not prove mailbox control. Keep housing details
    # private until the email code is consumed by the intended account.
    pending = dict(id=invite.public_id, email=invite.email, landlordId='', landlordName='Your landlord',
                   propertyId='', unitId='', street='Private invitation', city='', unit='Private',
                   bedrooms='', bathrooms='', areaCount=0, previewLocked=True) if invite else None
    linked = location(assignment.unit, assignment.verified_by, request.user.email) if assignment else None
    return dict(consented=consented(request), welcomed=True, baselineReviewed=False, movePhotos={},
                unit=linked, details=None, pendingInvite=pending)


@endpoint(['GET'])
def state(request, actor):
    if role(request) != actor:
        return JsonResponse({'detail': 'Role access required.'}, status=403)
    return JsonResponse(landlord_state(request) if actor == 'landlord' else tenant_state(request))


@endpoint(['GET', 'POST'])
def consent(request):
    if request.method == 'POST':
        data = body(request)
        if data.get('policy_version') != POLICY_VERSION or data.get('accepted') is not True or role(request) not in {'landlord', 'tenant'}:
            raise ValueError
        key = hashlib.sha256(f'{request.user.pk}:{role(request)}:{POLICY_VERSION}'.encode()).hexdigest()
        PolicyConsent.objects.get_or_create(consent_key=key, defaults=dict(user=request.user,
            policy_version=POLICY_VERSION, role=role(request), audit={'source': 'authenticated-app'}))
    return JsonResponse(dict(policy_version=POLICY_VERSION, consented=consented(request)))


def unit_fields(data):
    label = text(data, 'name', 100)
    bedrooms, bathrooms = text(data, 'bedrooms', 4), text(data, 'bathrooms', 4)
    if not re.fullmatch(r'(?:[0-9]|1[0-9]|20)', bedrooms) or not re.fullmatch(r'(?:[0-9]|1[0-9]|20)(?:\.[05])?', bathrooms):
        raise ValueError
    areas = data.get('areas', DEFAULT_AREAS)
    if not isinstance(areas, list) or not 5 <= len(areas) <= 20 or any(not isinstance(a, str) or not 1 <= len(a.strip()) <= 100 for a in areas):
        raise ValueError
    if len({a.strip().casefold() for a in areas}) != len(areas):
        raise ValueError
    return dict(label=label, bedrooms=bedrooms, bathrooms=bathrooms, areas=[a.strip() for a in areas])


@endpoint(['POST'])
def properties(request):
    if role(request) != 'landlord':
        return JsonResponse({'detail': 'Manager access required.'}, status=403)
    require_consent(request)
    data = body(request)
    name = text(data, 'street', 160)
    city = data.get('city', '')
    if not isinstance(city, str) or len(city) > 160:
        raise ValueError
    values = unit_fields({**data, 'name': data.get('unit')})
    key = text(data, 'idempotency_key', 80)
    creation_key = hashlib.sha256(f'{request.user.pk}:{key}'.encode()).hexdigest()
    # A transaction prevents properties without a unit after interrupted creation.
    property_id, unit_id = ObjectId(), ObjectId()
    def create(session):
        previous = coll(Property).find_one({'creation_key': creation_key}, session=session)
        if previous:
            return
        coll(Property).insert_one(dict(_id=property_id, name=name, city=city, creation_key=creation_key), session=session)
        coll(Property.managers.through).insert_one(dict(_id=ObjectId(), property_id=property_id, user_id=request.user.pk), session=session)
        coll(Unit).insert_one(dict(_id=unit_id, property_id=property_id, creation_key=None, revision=0, **values), session=session)
    transaction(create)
    saved_property = Property.objects.get(creation_key=creation_key)
    result = landlord_state(request)
    result['created_unit_id'] = str(Unit.objects.filter(property=saved_property).order_by('pk').first().pk)
    return JsonResponse(result)


@endpoint(['POST'])
def add_unit(request, property_id):
    prop = Property.objects.filter(pk=ObjectId(property_id), managers=request.user).first() if role(request) == 'landlord' else None
    if not prop:
        return missing()
    require_consent(request)
    data = body(request)
    values = unit_fields(data)
    key = hashlib.sha256(f"unit:{prop.pk}:{text(data, 'idempotency_key', 80)}".encode()).hexdigest()
    Unit.objects.get_or_create(creation_key=key, defaults=dict(property=prop, **values))
    return JsonResponse(landlord_state(request))


@endpoint(['POST'])
def unit_detail(request, unit_id):
    unit = manager_unit(request, unit_id)
    if not unit:
        return missing()
    require_consent(request)
    data = body(request)
    values = unit_fields(data)
    revision = data.get('revision')
    if type(revision) is not int or not coll(Unit).update_one({'_id': unit.pk, 'revision': revision},
            {'$set': values, '$inc': {'revision': 1}}).matched_count:
        raise Conflict('Unit changed. Refresh and retry.')
    # Future area configuration only. Approved snapshots and saved templates stay immutable.
    return JsonResponse(landlord_state(request))


def issue_invite(request, unit, email):
    raw = secrets.token_urlsafe(32)
    now = timezone.now()
    invite_id = ObjectId()
    record = dict(_id=invite_id, public_id=secrets.token_hex(16), unit_id=unit.pk, invited_by_id=request.user.pk,
                  email=email, token_hash=hashlib.sha256(raw.encode()).hexdigest(), status='pending',
                  delivery='unconfigured', created_at=now, expires_at=now+timedelta(days=7),
                  responded_at=None, responded_by_id=None)
    def create(session):
        mutate_unit(unit, session)
        if coll(UnitAssignment).find_one({'unit_id': unit.pk, 'active': True}, session=session):
            raise Conflict('Remove an ended assignment explicitly before inviting another tenant.')
        if coll(TenantInvitation).find_one({'unit_id': unit.pk, 'status': 'pending', 'expires_at': {'$gt': now}}, session=session):
            raise Conflict('Revoke the pending invitation before sending another.')
        coll(TenantInvitation).insert_one(record, session=session)
    transaction(create)
    # Only configured SMTP or in-memory test delivery; never console-print tokens.
    configured = (settings.EMAIL_BACKEND == 'django.core.mail.backends.smtp.EmailBackend' and settings.EMAIL_HOST
                  and settings.DEFAULT_FROM_EMAIL and (settings.DEBUG or settings.EMAIL_USE_TLS or settings.EMAIL_USE_SSL))
    testing = settings.EMAIL_BACKEND == 'django.core.mail.backends.locmem.EmailBackend'
    delivery = 'unconfigured'
    if configured or testing:
        try:
            sent = send_mail('LeaseGuard unit invitation',
                f'You were invited to {unit.property.name}, Unit {unit.label}. Sign in with {email} in LeaseGuard. '
                f'Enter this single-use invitation code: {raw}\nExpires in 7 days. Ignore this message if unexpected.',
                settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
            delivery = 'email-accepted' if sent else 'failed'
        except Exception:
            # Provider exceptions can include server details. Do not leak them or the token.
            delivery = 'failed'
    coll(TenantInvitation).update_one({'_id': invite_id}, {'$set': {'delivery': delivery}})


@endpoint(['POST', 'DELETE'])
def tenant_link(request, unit_id):
    unit = manager_unit(request, unit_id)
    if not unit:
        return missing()
    require_consent(request)
    data = body(request)
    if request.method == 'POST':
        issue_invite(request, unit, email_address(data.get('email')))
    else:
        action = data.get('action')
        if action not in {'revoke', 'end-assignment'}:
            raise ValueError
        now = timezone.now()
        def remove(session):
            mutate_unit(unit, session)
            if action == 'revoke':
                coll(TenantInvitation).update_many({'unit_id': unit.pk, 'status': 'pending'},
                    {'$set': {'status': 'revoked', 'responded_at': now, 'responded_by_id': request.user.pk}}, session=session)
            else:
                assignment = coll(UnitAssignment).find_one({'_id': ObjectId(data.get('assignment_id')), 'unit_id': unit.pk, 'active': True}, session=session)
                if not assignment:
                    raise Conflict('Assignment changed. Refresh and retry.')
                coll(UnitAssignment).update_one({'_id': assignment['_id'], 'active': True}, {'$set': {'active': False, 'ended_at': now, 'ended_by_id': request.user.pk}}, session=session)
        transaction(remove)
    return JsonResponse(landlord_state(request))


@endpoint(['POST'])
def respond_invite(request, decision):
    if role(request) != 'tenant' or decision not in {'accept', 'decline'}:
        return JsonResponse({'detail': 'Tenant access required.'}, status=403)
    require_consent(request)
    data = body(request)
    token = text(data, 'token', 128)
    if not re.fullmatch(r'[a-zA-Z0-9_-]{43}', token):
        raise ValueError
    digest = hashlib.sha256(token.encode()).hexdigest()
    now = timezone.now()
    def respond(session):
        invitation = coll(TenantInvitation).find_one({'token_hash': digest, 'email': request.user.email.lower(),
            'status': 'pending', 'expires_at': {'$gt': now}}, session=session)
        if not invitation:
            raise Conflict('Invitation is invalid, expired, or already used.')
        unit = Unit(pk=invitation['unit_id'])
        mutate_unit(unit, session)
        # Revoked manager authority invalidates their unconsumed invitations too.
        manager = coll(Property.managers.through).find_one({'property_id': coll(Unit).find_one({'_id': unit.pk}, session=session)['property_id'],
                                            'user_id': invitation['invited_by_id']}, session=session)
        if not manager:
            raise Conflict('Invitation is no longer authorized.')
        if decision == 'accept':
            if coll(UnitAssignment).find_one({'unit_id': unit.pk, 'active': True}, session=session):
                raise Conflict('This unit already has an active assignment.')
            coll(UnitAssignment).insert_one(dict(_id=ObjectId(), tenant_id=request.user.pk, unit_id=unit.pk,
                active=True, ended_at=None, ended_by_id=None, verified_by_id=invitation['invited_by_id'], verified_at=now), session=session)
        coll(TenantInvitation).update_one({'_id': invitation['_id'], 'status': 'pending'},
            {'$set': {'status': 'accepted' if decision == 'accept' else 'declined',
                      'responded_at': now, 'responded_by_id': request.user.pk}}, session=session)
    transaction(respond)
    return JsonResponse(tenant_state(request))


@endpoint(['GET', 'POST'])
def appointments(request):
    require_consent(request)
    if request.method == 'POST':
        data = body(request)
        unit = manager_unit(request, text(data, 'unit_id', 24))
        if not unit:
            return missing()
        tenant = UnitAssignment.objects.filter(unit=unit, active=True, tenant_id=ObjectId(data.get('tenant_id'))).first()
        if not tenant:
            raise Conflict('Select a verified tenant assignment.')
        zone = text(data, 'timezone', 64)
        try:
            ZoneInfo(zone)
        except (KeyError, ValueError):
            raise ValueError from None
        slots = data.get('slots')
        if not isinstance(slots, list) or not 1 <= len(slots) <= 10:
            raise ValueError
        offered = []
        for value in slots:
            when = parse_datetime(value) if isinstance(value, str) else None
            if when and timezone.is_naive(when):
                # Resolve wall-clock choices on the server. Reject DST gaps and
                # ambiguous repeated hours instead of silently choosing a time.
                local=when.replace(tzinfo=ZoneInfo(zone), fold=0)
                alternate=when.replace(tzinfo=ZoneInfo(zone), fold=1)
                if local.utcoffset() != alternate.utcoffset() or local.astimezone(datetime_timezone.utc).astimezone(ZoneInfo(zone)).replace(tzinfo=None) != when:
                    raise ValueError
                when=local
            if not when or not timezone.now() < when <= timezone.now()+timedelta(days=366):
                raise ValueError
            offered.append(dict(id=secrets.token_hex(16), at=when.isoformat()))
        key=hashlib.sha256(f"appointment:{request.user.pk}:{text(data, 'idempotency_key', 80)}".encode()).hexdigest()
        saved,_=InspectionAppointment.objects.get_or_create(creation_key=key,defaults=dict(unit=unit,landlord=request.user,tenant=tenant.tenant,
            timezone=zone,slots=offered,history=[dict(action='offered',actor=str(request.user.pk),at=timezone.now().isoformat())]))
        if saved.unit_id != unit.pk or saved.tenant_id != tenant.tenant_id or saved.timezone != zone or [s['at'] for s in saved.slots] != [s['at'] for s in offered]:
            raise Conflict('This creation key belongs to another appointment. Refresh and start a new offer.')
    qs = InspectionAppointment.objects.filter(unit__in=units(request))
    if role(request) == 'tenant':
        qs = qs.filter(tenant=request.user)
    return JsonResponse({'appointments': [dict(id=a.public_id, unit_id=str(a.unit_id), tenant_id=str(a.tenant_id),
        slots=a.slots, tenant_slots=a.tenant_slots, confirmed_slot=a.confirmed_slot, timezone=a.timezone,
        status=a.status, revision=a.revision, history=a.history) for a in qs.order_by('-created_at')[:100]]})


@endpoint(['POST'])
def appointment_action(request, appointment_id):
    require_consent(request)
    record = coll(InspectionAppointment).find_one({'public_id': appointment_id, 'unit_id': {'$in': list(units(request).values_list('pk', flat=True))}})
    if not record or (role(request) == 'tenant' and record['tenant_id'] != request.user.pk):
        return missing()
    data = body(request)
    action = data.get('action')
    if record['status'] == 'cancelled':
        raise Conflict('Appointment was cancelled.')
    if action == 'respond' and role(request) == 'tenant' and record['status'] in {'offered', 'responded'}:
        chosen = data.get('slot_ids')
        if not isinstance(chosen, list) or len(chosen) != len(set(chosen)) or any(s not in {v['id'] for v in record['slots']} for s in chosen):
            raise ValueError
        values = dict(tenant_slots=chosen, status='responded')
    elif action == 'confirm' and role(request) == 'landlord' and record['status'] == 'responded':
        chosen = data.get('slot_id')
        when = next((s['at'] for s in record['slots'] if s['id'] == chosen), '')
        if chosen not in record['tenant_slots'] or not when or parse_datetime(when) <= timezone.now():
            raise ValueError
        values = dict(confirmed_slot=chosen, status='confirmed')
    elif action == 'cancel' and role(request) == 'landlord':
        values = dict(status='cancelled')
    else:
        raise Conflict('This appointment action is not available.')
    if type(data.get('revision')) is not int or not coll(InspectionAppointment).update_one(
        {'_id': record['_id'], 'revision': data['revision']},
        {'$set': values, '$inc': {'revision': 1}, '$push': {'history': dict(action=action, actor=str(request.user.pk), at=timezone.now().isoformat())}}).matched_count:
        raise Conflict('Appointment changed. Refresh and retry.')
    return JsonResponse({'saved': True})
