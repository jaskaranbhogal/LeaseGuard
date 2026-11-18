"""Single-document compare-and-swap transitions keep count/status/history atomic.

Network calls run outside database transactions. An expiring upload lease prevents
concurrent retries; every possible provider asset has a persisted intent first.
"""
import hashlib
import uuid
from datetime import timedelta

from django.utils import timezone
from pymongo import ReturnDocument
from pymongo.write_concern import WriteConcern
from inspections import media
from inspections.storage import database
from .models import MaintenanceRequest


class Conflict(Exception):
    pass


def collection():
    return database()[MaintenanceRequest._meta.db_table].with_options(
        write_concern=WriteConcern(w='majority', wtimeout=5000))


def active_photos(record):
    return [p for p in record['photos'] if p['state'] != 'removed']


def change(record, values):
    result = collection().find_one_and_update(
        {'_id': record['_id'], 'revision': record['revision']},
        {'$set': {**values, 'updated_at': timezone.now()}, '$inc': {'revision': 1}},
        return_document=ReturnDocument.AFTER,
    )
    if result is None:
        raise Conflict('Request changed. Refresh and try again.')
    return result


def editable(record):
    if record.get('media_expired'):
        raise Conflict('Draft evidence has expired. Create a new request.')
    if record['status'] != 'draft':
        raise Conflict('Submitted requests cannot be edited.')


def upload(record, data):
    editable(record)
    digest = hashlib.sha256(data).hexdigest()
    now = timezone.now()
    # Embedded dates use ISO strings so ORM JSONField can round-trip them.
    photo = next((p for p in record['photos'] if p['id'] == digest), None)
    if photo and photo['state'] == 'ready':
        return record
    if photo and photo.get('deleted_at'):
        raise Conflict('This evidence has expired. Choose a new photo.')
    if photo and photo['state'] == 'uploading' and photo['lease_until'] > now.isoformat():
        raise Conflict('Photo is still uploading. Wait a minute, then refresh.')
    if (not photo or photo['state'] == 'removed') and len(active_photos(record)) >= 20:
        raise Conflict('A maximum of 20 photos is allowed.')
    if not photo and len(record['photos']) >= 100:
        raise Conflict('Draft upload limit reached. Create a new request.')
    media.configuration()
    token = uuid.uuid4().hex
    ref = (photo or {}).get('ref') or {
        'provider': 'cloudinary', 'resource_type': 'image', 'delivery_type': 'authenticated',
        'public_id': f"leaseguard/maintenance/{record['public_id']}/{digest}",
        'asset_id': None, 'format': 'jpg', 'sha256': digest,
        'uploaded_at': now.isoformat(),
        'retain_until': (now + timedelta(days=90, minutes=5)).isoformat(),
    }
    intent = {'id': digest, 'state': 'uploading', 'ref': ref, 'token': token,
              'lease_until': (now + timedelta(seconds=90)).isoformat()}
    photos = [p for p in record['photos'] if p['id'] != digest] + [intent]
    record = change(record, {'photos': photos})
    try:
        stored = media.upload_or_recover(ref, data)
        finished = timezone.now()
        stored.update(uploaded_at=finished.isoformat(),
                      retain_until=(finished + timedelta(days=90)).isoformat())
    except media.StorageError:
        _finish(record, digest, token, 'failed', ref)
        raise
    return _finish(record, digest, token, 'ready', stored)


def _finish(record, digest, token, state, ref):
    # Other photos may have changed while the network call was in flight.
    for _ in range(5):
        current = collection().find_one({'_id': record['_id']})
        if current.get('media_expired'):
            raise Conflict('Evidence has expired.')
        match = next((p for p in current['photos'] if p['id'] == digest), None)
        if not match or match.get('token') != token or match['state'] != 'uploading':
            raise Conflict('Upload changed. Refresh to recover it.')
        photos = [{**p, 'state': state, 'ref': ref} if p['id'] == digest else p
                  for p in current['photos']]
        try:
            return change(current, {'photos': photos})
        except Conflict:
            continue
    raise Conflict('Refresh to confirm photo storage.')


def remove(record, photo_id):
    editable(record)
    now = timezone.now().isoformat()
    photo = next((p for p in record['photos'] if p['id'] == photo_id), None)
    if not photo:
        raise Conflict('Photo not found.')
    if photo['state'] == 'removed':
        return record
    if photo['state'] == 'uploading' and photo['lease_until'] > now:
        raise Conflict('Wait for the upload to finish before removing it.')
    photos = [{**p, 'state': 'removed'} if p['id'] == photo_id else p for p in record['photos']]
    return change(record, {'photos': photos})


def submit(record, actor):
    if record['status'] != 'draft':
        return record  # Lost responses can be retried without another transition.
    editable(record)
    photos = active_photos(record)
    if not 5 <= len(photos) <= 20 or any(p['state'] != 'ready' or not p['ref'].get('asset_id')
                                         or p.get('deleted_at') for p in photos):
        raise Conflict('Accept and securely upload 5–20 photos before submitting.')
    if not record['area'].strip() or not record['description'].strip():
        raise Conflict('Area and description are required.')
    now = timezone.now()
    return change(record, {'status': 'submitted', 'submitted_at': now,
                          'history': [{'status': 'submitted', 'at': now.isoformat(), 'actor': actor}]})
