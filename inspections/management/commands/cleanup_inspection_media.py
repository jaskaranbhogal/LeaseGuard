"""Retryable retention cleanup for private Cloudinary and legacy GridFS files."""
from datetime import datetime, timedelta, timezone

import gridfs
from django.core.management.base import BaseCommand, CommandError
from pymongo.errors import PyMongoError

from inspections import media
from inspections.storage import database, RETENTION_DAYS


def aware(value):
    # PyMongo returns naive UTC by default.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def expired(record, now):
    dates = [record.get('retain_until')]
    if record.get('created_at'):
        dates.append(aware(record['created_at']) + timedelta(days=RETENTION_DAYS))
    for kind in ('baseline', 'current'):
        ref = record.get(f'{kind}_photo')
        if ref:
            if not ref.get('retain_until') or not ref.get('uploaded_at'):
                return False
            dates.extend([ref['retain_until'], aware(ref['uploaded_at']) + timedelta(days=RETENTION_DAYS)])
    return all(value is not None and aware(value) <= now for value in dates)


class Command(BaseCommand):
    help = 'List expired inspection media; --execute deletes confirmed expired assets, retaining review metadata'

    def add_arguments(self, parser):
        parser.add_argument('--execute', action='store_true')
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--limit', type=int, default=100)

    def handle(self, *args, **options):
        if options['execute'] and options['dry_run']:
            raise CommandError('Choose --execute or --dry-run')
        db = database()
        now = datetime.now(timezone.utc)
        records = db.inspection_comparisons.find({
            'retain_until': {'$lte': now}, 'media_deleted': {'$ne': True}, 'guided': {'$ne': True},
        }).limit(max(1, min(options['limit'], 1000)))
        found = deleted = failed = 0
        for record in records:
            if not expired(record, now):
                continue
            found += 1
            if not options['execute']:
                continue
            try:
                for kind in ('baseline', 'current'):
                    ref = record.get(f'{kind}_photo')
                    if ref:
                        if ref.get('deleted_at'):
                            continue
                        media.delete(ref)
                        # Keep identifiers until provider confirmation; checkpoint each
                        # deletion so a later failure never loses the other reference.
                        db.inspection_comparisons.update_one(
                            {'_id': record['_id']}, {'$set': {f'{kind}_photo.deleted_at': now}},
                        )
                    elif record.get(f'{kind}_file_id'):
                        gridfs.GridFS(db).delete(record[f'{kind}_file_id'])
                        db.inspection_comparisons.update_one(
                            {'_id': record['_id']}, {'$unset': {f'{kind}_file_id': ''}},
                        )
                db.inspection_comparisons.update_one(
                    {'_id': record['_id']}, {'$set': {'media_deleted': True}},
                )
                deleted += 1
            except (media.StorageError, PyMongoError):
                failed += 1
                self.stderr.write('Media deletion incomplete; references retained for retry.')
        self.stdout.write(f'Found {found} expired pairs; deleted {deleted}; failed {failed}'
                          + (' (dry run)' if not options['execute'] else ''))
        from maintenance.cleanup import cleanup
        maintenance_counts = cleanup(db, now, options['execute'], max(1, min(options['limit'], 1000)))
        self.stdout.write('Maintenance: found %s; deleted %s; failed %s' % maintenance_counts)
        failed += maintenance_counts[2]
        if failed:
            raise CommandError('Some media deletions require retry')
