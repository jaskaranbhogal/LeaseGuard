# Private inspection and maintenance evidence storage

New pairs use Cloudinary; MongoDB retains owner-scoped comparison records, storage
references, content hashes, AI findings, timestamps and decision history. Existing
`baseline_file_id` / `current_file_id` records without photo references still use
GridFS. No existing data is automatically migrated. The live deployment's GridFS
inventory has not been inspected; do not assume it is empty.

## Configuration and local checks

Install `requirements.txt` in your Python virtual environment. Set `MONGODB_URI`
and `MONGODB_DB_NAME` for your own development MongoDB replica set. Copy
`.env.example` to the ignored `.env` and enter credentials privately. Django loads
it automatically without overriding exported process settings:

```sh
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
python manage.py run_ai_evals
```

`CLOUDINARY_URL` is a backend environment variable with the format
`cloudinary://API_KEY:API_SECRET@CLOUD_NAME`. Never put it in React Native or commit
it. GitHub repository Secrets do not populate your local Django process or your
hosting service: configure each separately. Normal CI tests mock Cloudinary and
Gemini and need neither secret. Do not inject these secrets into PR checks.
`python manage.py test inspections` runs the offline inspection regression tests
without needing a database server (settings still require a local MongoDB URI).
The full account suite needs an isolated local replica set; settings reject a
remote database for tests. The default evaluator replays 21 golden cases with
zero provider calls. Do not run `--live` without explicit paid-call authorization.

Missing or malformed Cloudinary configuration is checked when a media operation
is requested and yields a sanitized storage error. It does not prevent Django
startup. Credentials are passed explicitly to SDK calls, not exposed in API data.

## Upload and retrieval

Session authentication and CSRF protection run before uploads. Django validates
size, JPEG/PNG format and pixel limits, normalizes EXIF orientation, and stores
processed JPEGs. Each photo receives a random public ID under
`leaseguard/inspections/<random UUID>/<baseline|current>`. Uploads always specify
`resource_type=image`, `type=authenticated`, and `overwrite=False`. Both original
and derived assets require authentication. There are no unsigned upload presets,
public delivery URLs, or automatic expiration rules in this integration.

The existing content-derived, owner-scoped comparison `_id` remains the atomic
MongoDB uniqueness guard. Only the request that inserts it uploads images or
spends AI credit. Completed duplicates return 200; in-flight duplicates return
202 with the existing response shape and never restart work. Failed-storage
pairs return 503. A new current photo creates a new pair, never overwriting the
baseline of an existing pair. Pair hashing uses normalized image content as before.

Each `baseline_photo` / `current_photo` reference contains provider, asset ID,
public ID, resource/delivery type, kind, owner, comparison ID, SHA-256 hash,
format, upload time and retention deadline. No credentials, signed URLs, or image
bytes are persisted in these MongoDB records. Asset ID can be null for an
interrupted upload intent; its known public ID supports later cleanup.

The photo endpoint first looks up the comparison by authenticated owner and kind.
Only server-stored references are used. Cloudinary's `private_download_url`
generates a signed API download for `type=authenticated` with a 60-second lifetime.
Django fetches it from the fixed HTTPS `api.cloudinary.com` origin, with redirects
and environment proxies disabled, bounded response size and network timeouts.
The URL stays inside the backend. The client receives JPEG bytes with
`Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. Unknown
IDs and other owners' photos both return 404; anonymous requests return 401.
Landlord decisions still require landlord role and ownership (403 otherwise).
Inspection comparisons remain owner-scoped. Maintenance requests separately use verified property/unit authorization; see [Sprint 3 maintenance](SPRINT3_MAINTENANCE.md).

Before Gemini, the server reads both photos through the same owner-scoped storage
path. Upload/retrieval failure returns 503 without invoking Gemini or reserving
AI usage. Existing global/per-account budgets, prompt, schema and one-shot safe
fallback remain in place. Gemini failure preserves both photos for manual review.
No automatic retry of the comparison or Gemini request is introduced.

## Partial failure and recovery

Cloudinary and MongoDB have no shared transaction. Before **each** upload, MongoDB
records the exact random public ID and retention deadline. If upload succeeds but
its response or subsequent database write fails, that intent remains discoverable.
Never delete the comparison reservation as an upload rollback: doing so loses
orphan references and permits duplicate uploads and charges. Failed or ambiguous
uploads remain tracked for cleanup after their retention period. This is a
retention-safe rollback of the workflow, not immediate destruction of evidence.

For confirmed uploads, `uploaded_at` is backend upload completion time and
`retain_until = uploaded_at + 90 days`. Intents use start time plus 90 days and a
five-minute allowance for the bounded 20-second SDK request. For unconfirmed assets, cleanup additionally queries Cloudinary's authenticated
resource API and checks its actual creation time plus 90 days before destruction.
Missing/invalid provider timestamps or lookup errors prevent deletion. Never
shorten a provider-confirmed upload's 90-day deadline.

A process crash can leave `pending` or `stored` pairs with no AI result. Retrieval
failure can also leave a stored pair available for manual review. Duplicates
return 202 in these states; there is deliberately no automatic AI resubmission.
Operators should reconcile known asset IDs, inspect both private photos and
record manual review rather than resetting reservations blindly. Monitor stalled
records, storage errors, and scheduler failures. Database availability and durable
MongoDB writes are prerequisites; backup MongoDB to preserve the upload journal.

## Retention cleanup

```sh
python manage.py cleanup_inspection_media --dry-run
python manage.py cleanup_inspection_media --execute --limit 100
```

Default is dry run; real deletion requires `--execute`. Cleanup checks the pair
and each photo's retention deadline and minimum 90-day age. It handles legacy
naive UTC timestamps. Unexpired photos are skipped. Cloudinary destruction uses
authenticated image type and CDN invalidation. Only `ok` or `not found` confirms
deletion. A failed deletion keeps its reference available for retry; each successful
delete is checkpointed. Repeated runs are safe even if the provider deleted a file
but MongoDB failed to checkpoint it. The command exits nonzero on partial failure.

Cleanup also deletes expired legacy GridFS binaries, without migrating them.
Comparison findings and decision history are retained; `media_deleted` and
per-photo `deleted_at` mark confirmed deletion. Photo endpoints then return 404.
No automatic re-upload occurs for an expired duplicate.

Schedule this on a trusted worker with backend environment variables, e.g. daily
cron at 03:00 server time (adjust paths and securely load the environment):

```cron
0 3 * * * cd /srv/leaseguard && /srv/leaseguard/venv/bin/python manage.py cleanup_inspection_media --execute --limit 100
```

Capture exit status/logs and alert on failures. Increase frequency or batch limit
if the expiry backlog exceeds 100 pairs/day. Without scheduling, files are kept
longer than 90 days. Do not configure provider auto-expiration. A legal hold policy
is not implemented; add an explicit hold check before deployment if required.

## GridFS migration procedure (future, explicit operation)

1. Inventory GridFS references, ownership, hashes and retention deadlines using
   read-only database access; back up metadata and binaries. No live inventory was
   performed for this change.
2. In a separately reviewed migration tool, upload each referenced legacy photo
   as authenticated under a new random public ID and persist an upload journal
   before the network operation. Preserve comparison IDs, ownership and review data.
3. Read the private Cloudinary copy back, validate the content hash and ownership,
   and atomically attach the new reference. Keep the old GridFS reference for
   rollback; normal reads prefer the new reference.
4. Retain each new upload for at least 90 days from upload, extending the pair
   deadline as needed. Delete old GridFS copies only after verification, backup
   review, and their own retention deadline. Never bulk-delete collections or
   remove the GridFS compatibility reader without an inventory proving migration.

## Manual staging verification (still required)

Use synthetic room photos without personal information and a dedicated Cloudinary
test environment. Keep `GEMINI_API_KEY` unset to exercise manual fallback without
paid calls. Sign in through Django, obtain CSRF, submit a JPEG/PNG baseline and
current pair with room/area, and check both authenticated assets in Cloudinary.
Check MongoDB references contain both asset IDs and no signed URLs or bytes.

Fetch both photos as the owner and inspect private/no-store headers. Repeat with
an unrelated account and anonymously (404 and 401). Repeat the same pair and
verify no extra assets or model requests. Upload a different current image and
verify the earlier baseline remains unchanged. Test provider outages/missing
configuration with safe staging credentials and verify sanitized 503 responses.

Using test asset IDs only, verify unsigned original **and transformed** delivery
URLs are rejected, and Django's authenticated API download succeeds. Never print
signed URLs or credentials. Validate Cloudinary product-environment access settings,
network allowlists, backups and CDN invalidation on that actual environment.
Dry-run retention cleanup first. Use mocks or staging records with genuinely
expired synthetic assets for execution testing; do not shorten real evidence
retention dates to test deletion. These mock tests do not prove production access
control, provider connectivity or real Gemini accuracy.

SDK references: [authenticated media](https://cloudinary.com/documentation/control_access_to_media),
[upload and private download API](https://cloudinary.com/documentation/image_upload_api_reference),
[Python SDK 1.47.0](https://pypi.org/project/cloudinary/1.47.0/).

## Verification for this change (2026-11-17)

- `python manage.py check`: passed, no issues. Also passed with a deliberately
  malformed `CLOUDINARY_URL` to verify lazy configuration validation.
- `python manage.py makemigrations --check --dry-run`: passed, no changes detected.
- `python manage.py test --noinput`: 70 tests passed on a disposable local MongoDB
  8.0 replica set (port 27168, separate verification database).
- `python manage.py test inspections`: 45 offline tests passed.
- `python manage.py run_ai_evals`: all 19 mocked golden cases passed; hallucination
  rate 0, consistency 1.0, expected match 1.0, zero provider calls.
- `python -m pip check` and `git diff --check`: passed.

Initial full-suite/migration attempts could not connect to local MongoDB; both
were rerun successfully against the isolated replica set. No real Cloudinary
upload, retrieval or deletion, production database inspection, or paid Gemini
request was performed. Staging verification above remains required.


## Maintenance evidence extension (2026-11-18)

The shared helpers also accept server-generated
`leaseguard/maintenance/{requestId}/{normalizedContentHash}` references. Maintenance
uses the same authenticated upload, bounded private retrieval, and retention-safe
deletion. `upload_or_recover` verifies existing provider metadata at a deterministic
address before deciding whether an upload is needed. Draft upload leases and
MongoDB revision checks prevent concurrent mutations; failed/removed intents remain
in the embedded ledger until retention cleanup. No Gemini request occurs during
maintenance uploads or submission.

The existing cleanup command includes maintenance records, freezes expired media
before deletion, and checkpoints successful deletes. It skips evidence with any
unexpired/missing retention metadata or a request updated within 90 days. Existing
inspection behavior and legacy GridFS compatibility remain unchanged. Complete
API, authorization, retry and iOS procedures are in
[the maintenance guide](SPRINT3_MAINTENANCE.md).

## Guided inspection evidence

The guided workflow reuses authenticated uploads, normalization, recovery and Django
proxy delivery at `leaseguard/guided/<inspection-id>/<intent-id>`. Guided references
and maintenance records sharing them are excluded from destructive cleanup. All
guided evidence is under an indefinite hold; minimum timestamps alone do not permit
deletion. See [guided storage and retention](GUIDED_INSPECTIONS.md#storage-recovery-and-retention).
Live provider checks for this namespace remain pending.


## Landlord baseline extension — 18 November 2026

Landlord drafts reuse the `leaseguard/guided/<draft-id>/<content-location-id>`
authenticated namespace, JPEG/PNG normalization, EXIF removal, size/pixel bounds,
private upload confirmation and interrupted-upload recovery. No second storage
framework or public image URLs were introduced. Every draft/photo/history route
rechecks current property-manager membership and exact unit scope. Approved versions
and shared references remain under the existing indefinite guided-evidence hold,
which also protects active baselines beyond 90 days. Supersession never deletes assets.

The browser's `leaseguard (Test)` Usage Reports page was accessible in this run;
64 assets / 161.44 MB were visible. No synthetic upload or asset access experiment
was performed, and local credential-to-environment correspondence remains pending.
See [current verification boundaries](SPRINT3_FINALIZATION_REPORT.md).
