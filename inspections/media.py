"""Private provider operations. Only trusted, server-stored references enter here."""
import io
import re
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit, unquote

import requests
from django.conf import settings

MAX_BYTES = 8 * 1024 * 1024


class StorageError(Exception):
    """Sanitized storage failure; never return provider exceptions to clients."""


def configuration():
    try:
        url = urlsplit(settings.CLOUDINARY_URL)
        if (url.scheme != 'cloudinary' or not url.username or not url.password
                or not re.fullmatch(r'[a-zA-Z0-9_-]+', url.hostname or '')
                or url.port or url.path or url.query or url.fragment):
            raise ValueError
        return dict(cloud_name=url.hostname, api_key=unquote(url.username),
                    api_secret=unquote(url.password), secure=True)
    except (ValueError, AttributeError):
        raise StorageError('Private image storage is not configured') from None


def _options(ref):
    if (ref.get('provider') != 'cloudinary' or ref.get('resource_type') != 'image'
            or ref.get('delivery_type') != 'authenticated'
            or not re.fullmatch(r'leaseguard/(?:inspections/[a-f0-9]{32}/(?:baseline|current)|maintenance/[a-f0-9]{32}/[a-f0-9]{64})', ref.get('public_id', ''))):
        raise StorageError('Invalid image reference')
    return dict(configuration(), resource_type='image', type='authenticated')


def upload(ref, data):
    options = _options(ref)
    try:
        import cloudinary.uploader
        result = cloudinary.uploader.upload(
            io.BytesIO(data), public_id=ref['public_id'], overwrite=False,
            unique_filename=False, timeout=20, **options,
        )
        if (result.get('public_id') != ref['public_id'] or not result.get('asset_id')
                or result.get('resource_type') != 'image' or result.get('type') != 'authenticated'
                or result.get('format') != 'jpg'):
            raise StorageError('Unexpected storage response')
        return {**ref, 'asset_id': result['asset_id'], 'format': 'jpg'}
    except Exception:
        raise StorageError('Private photo upload failed') from None


def retrieve(ref):
    options = _options(ref)
    try:
        import cloudinary.utils
        url = cloudinary.utils.private_download_url(
            ref['public_id'], 'jpg', expires_at=int(time.time()) + 60, **options,
        )
        # Fixed API origin, no request-supplied URLs, no redirects or ambient proxies.
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.netloc != 'api.cloudinary.com':
            raise StorageError('Unexpected download origin')
        with requests.Session() as session:
            session.trust_env = False
            with session.get(url, timeout=(5, 20), stream=True, allow_redirects=False) as response:
                if response.status_code != 200:
                    raise StorageError('Private photo retrieval failed')
                data = bytearray()
                for chunk in response.iter_content(65536):
                    data.extend(chunk)
                    if len(data) > MAX_BYTES:
                        raise StorageError('Stored photo exceeds size limit')
                if not data:
                    raise StorageError('Stored photo is empty')
                return bytes(data)
    except Exception:
        raise StorageError('Private photo retrieval failed') from None


def delete(ref):
    options = _options(ref)
    try:
        import cloudinary.uploader
        if not ref.get('asset_id') or ref['public_id'].startswith('leaseguard/maintenance/'):
            # Maintenance assets and ambiguous inspection timeouts use provider
            # time, not the intent's clock, before destruction. A delayed provider write cannot shorten
            # the minimum evidence retention period.
            import cloudinary.api
            from cloudinary.exceptions import NotFound
            try:
                asset = cloudinary.api.resource(ref['public_id'], timeout=20, **options)
            except NotFound:
                asset = None
            if asset is not None:
                created = datetime.fromisoformat(asset['created_at'].replace('Z', '+00:00'))
                if created.tzinfo is None or datetime.now(timezone.utc) < created + timedelta(days=90):
                    raise StorageError('Unconfirmed upload has not reached minimum retention')
        result = cloudinary.uploader.destroy(ref['public_id'], invalidate=True, timeout=20, **options)
        if result.get('result') not in {'ok', 'not found'}:
            raise StorageError('Deletion not confirmed')
    except Exception:
        raise StorageError('Private photo deletion failed') from None


def upload_or_recover(ref, data):
    """Recover a timed-out maintenance write at its deterministic content address.

    Never overwrite an existing asset; provider metadata confirms private storage.
    Provider URLs never leave this module.
    """
    options = _options(ref)
    try:
        import cloudinary.api
        from cloudinary.exceptions import NotFound
        try:
            asset = cloudinary.api.resource(ref['public_id'], timeout=20, **options)
        except NotFound:
            return upload(ref, data)
        if (asset.get('public_id') != ref['public_id'] or not asset.get('asset_id')
                or asset.get('resource_type') != 'image' or asset.get('type') != 'authenticated'
                or asset.get('format') != 'jpg'):
            raise StorageError('Invalid recovered asset')
        return {**ref, 'asset_id': asset['asset_id'], 'format': 'jpg'}
    except Exception:
        raise StorageError('Private photo upload failed; retry this photo') from None
