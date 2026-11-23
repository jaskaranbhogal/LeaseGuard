"""Revision-checked state transitions; external calls follow durable intent writes.

Evidence and decisions are append-only. No guided evidence is automatically deleted.
"""
import hashlib
import re
import uuid
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone
from pymongo import ReturnDocument
from pymongo.write_concern import WriteConcern

from inspections import media, storage
from inspections.services import compare_images_safe
from inspections.prompts import PROMPT_VERSION
from inspections.views import _manual_result
from maintenance.store import Conflict
from .models import GuidedInspection, UnitBaseline, LandlordBaselineDraft

TYPES = {'move-in', 'periodic', 'move-out', 'follow-up'}
EDITABLE = {'assigned', 'draft', 'retake'}
DEFAULT_STEPS = [dict(id=key, room=room, instructions=instruction, count=1) for key, room, instruction in [
    ('entry-wide', 'Entry', 'Photograph the entrance, door and surrounding walls.'),
    ('living-wide', 'Living room', 'Stand in the doorway and include walls and flooring.'),
    ('kitchen-wide', 'Kitchen', 'Include counters, cabinets and visible appliances.'),
    ('bathroom-wide', 'Bathroom', 'Include sink, fixtures, walls and flooring.'),
    ('bedroom-wide', 'Bedroom', 'Stand in the doorway and include walls and flooring.')]]


def validate_steps(steps):
    if not isinstance(steps, list) or not 1 <= len(steps) <= 20:
        raise ValueError('Provide 1–20 steps.')
    seen = set()
    result = []
    for step in steps:
        key = step['id']
        if not isinstance(key, str) or not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,63}', key) or key in seen:
            raise ValueError('Step IDs must be unique and stable.')
        seen.add(key)
        count = step.get('count', 1)
        if type(count) is not int or not 1 <= count <= 20:
            raise ValueError('Invalid photo count.')
        room, instructions = step['room'].strip(), step['instructions'].strip()
        if not 1 <= len(room) <= 100 or not 1 <= len(instructions) <= 500:
            raise ValueError('Room and instructions are required.')
        result.append(dict(id=key, room=room, instructions=instructions, count=count))
    if not 5 <= sum(s['count'] for s in result) <= 20:
        raise ValueError('Templates require 5–20 photos.')
    return result


def collection(model=GuidedInspection):
    return storage.database()[model._meta.db_table].with_options(write_concern=WriteConcern(w='majority', wtimeout=5000))


def record_collection(record):
    return collection(LandlordBaselineDraft if record.get("workflow") == "landlord-baseline" else GuidedInspection)


def change(record, values, model=None):
    result = (collection(model) if model else record_collection(record)).find_one_and_update(
        {'_id': record['_id'], 'revision': record['revision']},
        {'$set': {**values, 'updated_at': timezone.now()}, '$inc': {'revision': 1}},
        return_document=ReturnDocument.AFTER)
    if result is None:
        raise Conflict('Inspection changed. Refresh before trying again.')
    return result


def audit(record, action, actor, **details):
    if len(record['history']) >= 500:
        raise Conflict('Audit limit reached. Contact support.')
    return record['history'] + [dict(action=action, actor=str(actor), at=timezone.now().isoformat(), **details)]


def active(record):
    return [p for p in record['photos'] if p['state'] == 'ready' and not p.get('replaced_at')]


def editable(record):
    if record['status'] not in EDITABLE:
        raise Conflict('Submitted evidence cannot be changed. Request a retake first.')


def check_revision(record, revision):
    if type(revision) is not int or revision != record['revision']:
        raise Conflict('Inspection changed. Refresh before trying again.')


def upload(record, step_id, slot, data, actor):
    editable(record)
    step = next((s for s in record['steps'] if s['id'] == step_id), None)
    if not step or type(slot) is not int or not 0 <= slot < step['count']:
        raise ValueError('Invalid photo step.')
    digest = hashlib.sha256(data).hexdigest()
    # Intent identity includes logical location; identical bytes in different slots
    # cannot accidentally replace each other.
    key = hashlib.sha256(f'{step_id}:{slot}:{digest}'.encode()).hexdigest()
    now = timezone.now()
    old = next((p for p in record['photos'] if p['id'] == key), None)
    if old and old['state'] == 'ready' and not old.get('replaced_at'):
        return record
    if old and old.get('replaced_at'):
        raise Conflict('Previously replaced evidence cannot be reused. Capture a new photo.')
    if any(p['state'] == 'uploading' and p['lease_until'] > now.isoformat() and
           p['step_id'] == step_id and p['slot'] == slot for p in record['photos']):
        raise Conflict('Upload in progress. Refresh after 90 seconds to recover.')
    if not old and len(record['photos']) >= 100:
        raise Conflict('Evidence ledger limit reached.')
    media.configuration()
    token = uuid.uuid4().hex
    ref = old['ref'] if old else dict(provider='cloudinary', resource_type='image', delivery_type='authenticated',
        public_id=f"leaseguard/guided/{record['public_id']}/{key}", asset_id=None, format='jpg', sha256=digest,
        uploaded_at=now.isoformat(), retain_until=(now + timedelta(days=90, minutes=5)).isoformat())
    intent = dict(id=key, step_id=step_id, slot=slot, state='uploading', ref=ref, token=token,
                  capture_at=now.isoformat(), lease_until=(now + timedelta(seconds=90)).isoformat())
    preserved = [{**p, 'replaced_at': now.isoformat()} if p['state'] == 'uploading' and p['step_id'] == step_id and p['slot'] == slot else p
                 for p in record['photos'] if p['id'] != key]
    record = change(record, {'photos': preserved + [intent],
                            'status': 'draft' if record['status'] == 'assigned' else record['status'],
                            'started_at': record.get('started_at') or now})
    try:
        ref = media.upload_or_recover(ref, data)
        finished = timezone.now()
        ref.update(uploaded_at=finished.isoformat(), retain_until=(finished + timedelta(days=90)).isoformat())
    except media.StorageError:
        finish_upload(record, key, token, ref, 'failed', actor)
        raise
    return finish_upload(record, key, token, ref, 'ready', actor)


def finish_upload(record, key, token, ref, state, actor):
    for _ in range(5):
        current = record_collection(record).find_one({'_id': record['_id']})
        editable(current)
        intent = next((p for p in current['photos'] if p['id'] == key), None)
        if not intent or intent.get('replaced_at') or intent.get('token') != token or intent['state'] != 'uploading':
            raise Conflict('Upload changed. Refresh to recover.')
        photos = []
        for p in current['photos']:
            if p['id'] == key:
                p = {**p, 'state': state, 'ref': ref}
            elif state == 'ready' and p['step_id'] == intent['step_id'] and p['slot'] == intent['slot'] and not p.get('replaced_at'):
                p = {**p, 'replaced_at': timezone.now().isoformat()}
            photos.append(p)
        try:
            return change(current, {'photos': photos, 'history': audit(current, 'photo-' + state, actor, photo_id=key)})
        except Conflict:
            continue
    raise Conflict('Refresh to confirm upload completion.')


def submit(record, actor):
    if record['status'] in {'submitted', 'reviewed'}:
        return record
    editable(record)
    if any(p['state'] == 'uploading' and not p.get('replaced_at') for p in record['photos']):
        raise Conflict('Recover pending uploads before submitting.')
    photos = active(record)
    retakes = [h for h in record['history'] if h['action'] == 'retake-requested']
    if retakes and not any(p['ref']['uploaded_at'] > retakes[-1]['at'] for p in photos):
        raise Conflict('Upload a new photo to address the retake request before resubmitting.')
    for step in record['steps']:
        for slot in range(step['count']):
            if not any(p['step_id'] == step['id'] and p['slot'] == slot and p['ref'].get('asset_id') for p in photos):
                raise Conflict('Upload every required photo before submitting.')
    return change(record, dict(status='submitted', submitted_at=timezone.now(),
                               history=audit(record, 'submitted', actor)))


def baseline(record):
    head = collection(UnitBaseline).find_one({'unit_id': record['unit_id']})
    if not head:
        return None
    return next((b for b in head['versions'] if b['id'] == head['active_id']), None)


def approve(record, actor, supersedes=''):
    authored = record.get('workflow') == 'landlord-baseline'
    if not authored and (record['inspection_type'] != 'move-in' or record['status'] not in {'submitted', 'reviewed'}):
        raise Conflict('Only submitted move-in inspections can become baselines.')
    UnitBaseline.objects.get_or_create(unit_id=record['unit_id'])
    head = collection(UnitBaseline).find_one({'unit_id': record['unit_id']})
    if any(b['inspection_id'] == record['public_id'] for b in head['versions']):
        return mark_approved(record, actor)
    expected = record['expected_active_id'] if authored else supersedes
    if head['active_id'] != expected or (expected and supersedes != expected):
        raise Conflict('Baseline changed or already exists. Explicitly confirm the active version to supersede it.')
    if authored:
        record = submit(record, actor)  # Completeness and confirmed storage, then freeze.
    if record['status'] != 'reviewed':
        record = change(record, dict(status='reviewed', reviewed_at=timezone.now(),
                                     history=audit(record, 'baseline-approval-requested', actor)))
    snapshot = dict(id=record['public_id'], inspection_id=record['public_id'],
                    source='landlord' if authored else 'tenant',
                    template_id=str(record['template_id']), template_version=record['template_version'],
                    photos=active(record), approved_by=str(actor), approved_at=timezone.now().isoformat(),
                    supersedes=expected)
    # A single CAS publishes the immutable version and head together. Never retry
    # against a different head: concurrent approvals require a new explicit decision.
    try:
        change(head, {'versions': head['versions'] + [snapshot], 'active_id': snapshot['id']}, UnitBaseline)
    except Conflict:
        latest = collection(UnitBaseline).find_one({'unit_id': record['unit_id']})
        if not any(b['inspection_id'] == record['public_id'] for b in latest['versions']):
            raise
    return mark_approved(record, actor)


def mark_approved(record, actor):
    current = record_collection(record).find_one({'_id': record['_id']})
    if any(h['action'] == 'baseline-approved' for h in current['history']):
        return current
    return change(current, {'history': audit(current, 'baseline-approved', actor)})


def match(record, photo_id):
    current = next((p for p in active(record) if p['id'] == photo_id), None)
    base = baseline(record)
    if not current or not base or base['inspection_id'] == record['public_id']:
        raise Conflict('No approved baseline for this photo.')
    if base['template_id'] != str(record['template_id']) or base['template_version'] != record['template_version']:
        raise Conflict('Baseline template is incompatible. Review manually.')
    previous = next((p for p in base['photos'] if p['step_id'] == current['step_id'] and p['slot'] == current['slot']), None)
    if not previous:
        raise Conflict('No matching baseline step. Review manually.')
    return base, previous, current


def compare(record, photo_id, actor):
    if record['status'] != 'submitted':
        raise Conflict('Only submitted inspections can be analyzed.')
    pending = next((c for c in record['comparisons'] if c['photo_id'] == photo_id and c['status'] == 'pending'), None)
    if pending:
        return recover_comparison(record, pending)
    if any(c['photo_id'] == photo_id and c['status'] == 'completed' for c in record['comparisons']):
        return record
    base, previous, current = match(record, photo_id)
    # Shared durable claim prevents duplicate provider calls, including across
    # inspections and managers, using the existing hash helper with a unit namespace.
    try:
        first, second = media.retrieve(previous['ref']), media.retrieve(current['ref'])
    except media.StorageError:
        key = hashlib.sha256(f"unavailable:{record['unit_id']}:{previous['id']}:{current['id']}".encode()).hexdigest()
        entry = dict(id=key, photo_id=photo_id, baseline_id=base['id'], baseline_photo=previous,
                     current_photo=current, status='completed',
                     result=_manual_result('Private photo retrieval unavailable. Review manually; no AI call was made.'),
                     decision=None, model=settings.GEMINI_MODEL, prompt_version=PROMPT_VERSION,
                     created_at=timezone.now().isoformat(), completed_at=timezone.now().isoformat())
        return change(record, {'comparisons': record['comparisons'] + [entry],
                               'history': audit(record, 'analysis-unavailable', actor, comparison_id=key)})
    step = next(s for s in record['steps'] if s['id'] == current['step_id'])
    key = storage._pair_id('guided-unit:' + str(record['unit_id']), first, second, step['room'], step['id'])
    existing = next((c for c in record['comparisons'] if c['id'] == key), None)
    if existing:
        if existing['status'] == 'completed':
            return record
        return recover_comparison(record, existing)
    entry = dict(id=key, photo_id=photo_id, baseline_id=base['id'], baseline_photo=previous,
                 current_photo=current, status='pending', result=None, decision=None,
                 model=settings.GEMINI_MODEL, prompt_version=PROMPT_VERSION, created_at=timezone.now().isoformat())
    record = change(record, {'comparisons': record['comparisons'] + [entry]})
    from pymongo.errors import DuplicateKeyError
    pairs = storage.database().inspection_comparisons
    try:
        pairs.insert_one(dict(_id=key, owner_id=str(actor), room=step['room'], area=step['id'],
                              created_at=timezone.now(), retain_until=timezone.now()+timedelta(days=90),
                              status='pending', guided=True, result=None, decision=None, decision_history=[]))
        claimed = True
    except DuplicateKeyError:
        claimed = False
    if claimed:
        context = dict(landlord_notes=note_context(previous, 'baseline'), known_issues=note_context(previous, 'known-issue'),
                       tenant_notes=note_context(current, 'observation'))
        context = {k: v for k, v in context.items() if v}
        result = (compare_images_safe(first, second, step['room'], step['id'], **context) if storage.consume_daily_call(str(actor))
                  else _manual_result('Daily AI budget reached. Review stored evidence manually.'))
        storage.complete_pair(str(actor), key, result)
    else:
        pair = pairs.find_one({'_id': key})
        result = pair.get('result') or _manual_result('Previous analysis is pending or interrupted. Manual review required; no automatic retry.')
    for _ in range(5):
        current_record = collection().find_one({'_id': record['_id']})
        if not any(c['id'] == key and c['status'] == 'pending' for c in current_record['comparisons']):
            return current_record  # Never overwrite a recovered result or human decision.
        comparisons = [{**c, 'result': result, 'status': 'completed', 'completed_at': timezone.now().isoformat()} if c['id'] == key else c for c in current_record['comparisons']]
        try:
            return change(current_record, {'comparisons': comparisons, 'history': audit(current_record, 'analysis-completed', actor, comparison_id=key)})
        except Conflict:
            continue
    raise Conflict('Analysis saved. Refresh to view it.')


def recover_comparison(record, entry):
    pair = storage.database().inspection_comparisons.find_one({'_id': entry['id']})
    result = (pair or {}).get('result')
    if not result and datetime.fromisoformat(entry['created_at']) + timedelta(seconds=90) > timezone.now():
        raise Conflict('Analysis is still pending. Refresh after 90 seconds; it will not be retried.')
    result = result or _manual_result('Analysis was interrupted. Review manually; no second paid call will be made.')
    return change(record, {'comparisons': [{**c, 'status': 'completed', 'result': result} if c['id'] == entry['id'] else c for c in record['comparisons']]})


def annotate(record, photo_id, note, kind, actor):
    """Draft-only, revision-checked observations attached to a stable photo identity."""
    editable(record)
    if kind not in {'observation', 'baseline', 'known-issue'} or not isinstance(note, str) or len(note) > 1200:
        raise ValueError('Notes must be at most 1200 characters.')
    if any(ord(c) < 32 and c not in '\n\t' for c in note):
        raise ValueError('Invalid control characters in note.')
    target = next((p for p in active(record) if p['id'] == photo_id), None)
    if not target:
        raise ValueError('Choose a saved photo.')
    # A bounded append-only ledger also records draft corrections; never erase notes.
    if len(target.get('notes', [])) >= 20:
        raise Conflict('Note correction limit reached.')
    entry = dict(text=note.strip(), kind=kind, actor=str(actor), at=timezone.now().isoformat(),
                 unit_id=str(record['unit_id']), template_version=record['template_version'],
                 step_id=target['step_id'], slot=target['slot'])
    photos = [{**p, 'notes': p.get('notes', []) + [entry]} if p['id'] == photo_id else p for p in record['photos']]
    return change(record, dict(photos=photos, history=audit(record, 'photo-note-added', actor, photo_id=photo_id, kind=kind)))


def note_context(photo, kind):
    # Last draft correction of a kind wins for AI context; the full ledger stays visible.
    return next((n['text'] for n in reversed(photo.get('notes', [])) if n['kind'] == kind), '')
