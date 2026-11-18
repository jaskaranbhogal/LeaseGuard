# Sprint 3: persistent maintenance requests

Maintenance uses the existing Django 5.2 MongoDB backend, session authentication,
CSRF handshake, and private Cloudinary helpers. It does not invoke Gemini.

## Setup and verified housing relationships

Use the backend environment variables documented in `.env.example`:
`MONGODB_URI`, `MONGODB_DB_NAME`, `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`,
`DJANGO_ALLOWED_HOSTS`, and backend-only `CLOUDINARY_URL`. Gemini credentials are
optional for maintenance. No new provider credentials are required. Keep secrets
out of React Native, source control, logs, and CI. Export your private environment
before running Django; `manage.py` does not automatically load `.env`.

Run `python manage.py migrate` on your own development database, then create
accounts through registration and an operator with `createsuperuser`. An operator
must independently verify the lease and property manager before assigning access:

```sh
python manage.py assign_maintenance_unit \
  --operator operator_username --tenant tenant_username \
  --landlord landlord_username --property 'Development property' --unit '101'
```

This server-side command requires an existing active superuser and matching
existing tenant/landlord profiles. It creates/reuses a property belonging to that
manager, a unit, and an audited active tenant assignment. It never adopts an
unrelated namesake property. It is suitable for synthetic development/test data;
in production, the trusted operator must verify actual relationships first.
There is no public self-assignment API. Existing demo property screens do not
create these verified records. Revocation uses operator-controlled
`UnitAssignment.active=False`; manager removal uses `Property.managers.remove`.
Do not delete assignment or evidence records to revoke access.

Django models/collections:

| Model | MongoDB collection | Relationship |
| --- | --- | --- |
| `Property` | `maintenance_property` | Explicit `managers` user membership |
| Property managers | `maintenance_property_managers` | Django-managed membership join |
| `Unit` | `maintenance_unit` | Belongs to one property |
| `UnitAssignment` | `maintenance_unitassignment` | Tenant, unit, active flag, verifier and timestamp |
| `MaintenanceRequest` | `maintenance_maintenancerequest` | Tenant, unit, unique public ID and creation key, form fields, timestamps, status, revision, embedded photo intents/history |

A tenant must have an active verified assignment for every request operation.
Drafts are visible only to their creator. Landlords require explicit manager
membership on the unit's property and see only submitted requests. Account role
alone grants no housing access. Assignments and manager membership are checked
again on each request and private photo read. Revocation also removes access to
historical requests for that unit; records remain persisted for operators.
Tenant/landlord IDs supplied by clients are never used for identity or ownership.

## API

All paths have trailing slashes. GETs require a session; mutations additionally
require `X-CSRFToken` from `GET /api/auth/csrf/` and the same session cookies.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/api/maintenance/units/` | Assigned units / explicitly managed units |
| POST | `/api/maintenance/` | Create retryable draft |
| GET | `/api/maintenance/` | Authorized history, 50 records/page |
| GET, PATCH | `/api/maintenance/{id}/` | Details / save creator's draft fields |
| POST | `/api/maintenance/{id}/photos/` | Single multipart `photo` upload |
| GET | `/api/maintenance/{id}/photos/{photoId}/` | Authorized JPEG byte proxy |
| DELETE | `/api/maintenance/{id}/photos/{photoId}/` | Remove from unsubmitted draft; retain provider evidence |
| POST | `/api/maintenance/{id}/submit/` | Atomically finalize 5–20 confirmed photos |
| POST | `/api/maintenance/{id}/status/` | Authorized manager's next status |

Draft creation JSON: `unit_id`, `area` (1–100 characters), `description`
(1–2000), `urgency` (`normal` or `urgent`), and `idempotency_key` (16–80 ASCII
letters/digits/underscore/hyphen). The creation key is hashed with the signed-in
tenant's identity and uniquely indexed. PATCH takes the three form fields.
`?before=<next>` retrieves the next history page using the returned opaque cursor.
The public request ID is 32 lowercase hexadecimal characters; photo IDs are
normalized-content SHA-256 hashes. Responses never contain Cloudinary references,
provider URLs, or credentials. Request details include photo state/availability,
retention deadline, status history, and the baseline limitation.

Status transitions: `draft → submitted → in-review → in-progress → resolved`.
Only the creator submits. Only an assigned property manager advances submitted
requests. Repeating the current status or submitting an already-submitted request
returns its saved state without another history event. Submitted fields/photos
are immutable. MongoDB revision-based compare-and-swap includes photo count,
status and history in one document update, with majority write acknowledgement.
A stale writer gets 409 and must refresh. No provider network call runs inside a
MongoDB transaction. Housing setup uses the official backend's transaction API.

## Photo acceptance, storage, and recovery

Enter a unit, area, description and urgency. Camera and gallery selections enter
an individual review queue: discard with X or accept with the checkmark. Each
accepted photo saves the draft fields and uploads individually, then waits for
backend confirmation. The counter shows confirmed saved photos. Remove a photo
to make space for a replacement. Save draft explicitly before leaving edited
fields. The navigation guard warns about unuploaded photos/unsaved fields and
waits for active operations. Request success appears only after confirmed
submission. History and the report screen both offer saved draft recovery after
restart/relogin; the report resume list shows the latest history page, and older
drafts remain accessible through paginated history.

`maintenanceService.ts` uses the existing API origin, cookies, and CSRF flow.
Uploads use XHR for byte-transfer progress, followed by a server-confirmation
state; 100% transfer alone is not success. The client upload timeout is 65 seconds;
provider calls each have a 20-second bound. Failed accepted photos can be retried
from the same screen. Refresh checks saved state before retrying a lost response.
A successful lost submission response is recovered without editing/resubmitting
an immutable record. No device credential or provider URL storage is introduced.

The backend permits JPEG/PNG only, with byte signatures validated by Pillow,
8 MB/file, at most 20 megapixels, EXIF orientation normalization, metadata removal,
and the existing 1500-pixel processed JPEG limit. A streaming handler limits
incoming file bytes before temporary storage grows without bound. The shared
multipart parser allows two files for existing inspection comparisons; the
maintenance endpoint accepts exactly one. Upload processing is sequential in the
client; each draft allows at most 20 active photo slots and 100 lifetime content
intents, including removed/failed ones. Draft creation limits a tenant to 10 open
drafts (a quota guard, not a global rate limiter). Shared MongoDB minute quotas enforce 120 reads and 60 writes per account and
1,200 total maintenance requests globally; 429 responses include Retry-After. Only
usage counters have a five-minute TTL. A reverse proxy must additionally bound
total request size/concurrency and unauthenticated traffic.

Before network I/O, MongoDB journals an authenticated Cloudinary intent at
`leaseguard/maintenance/{requestId}/{contentHash}`. Retries use the same address,
`overwrite=False`, and a 90-second upload lease. An existing private asset is
recovered using provider metadata rather than uploaded again. A timed-out or
crashed operation stays discoverable. Before the lease expires, retries return
409; refresh/retry after a minute or reselect the same original image after app
restart. Failed slots can also be removed and replaced. A ready duplicate does
not consume another slot or provider upload. No retry invokes Gemini.

MongoDB stores references and metadata, never raw photo bytes. Private retrieval
rechecks unit/object authorization and streams provider bytes through Django.
Signed downloads stay on the server; responses use private/no-store and nosniff.
See [Cloudinary storage](CLOUDINARY_STORAGE.md) for provider security details.

## Retention and cleanup

Confirmed uploads retain evidence for at least 90 days from successful storage;
intents include a five-minute safety allowance. Removing a draft photo only hides
it from the draft; it does not delete evidence. Abandoned drafts retain all intents.
The existing command now also handles maintenance evidence:

```sh
python manage.py cleanup_inspection_media --dry-run
python manage.py cleanup_inspection_media --execute --limit 100
```

Maintenance cleanup requires every photo's verified deadline and minimum age to
have passed and the request to be inactive for 90 days. An atomic revision check
freezes media changes before deletion; expired drafts cannot accept new photos.
Provider deletion verifies actual Cloudinary creation time for maintenance assets before destruction.
Each confirmed deletion is checkpointed. Partial failures preserve references and
are retryable; the command exits nonzero. Request/status metadata is retained.
There is no TTL index or immediate rollback deletion. Without a trusted scheduled
cleanup worker, images remain longer than 90 days. No scheduler was deployed.

## Errors

401: sign in. 403: CSRF/session or wrong role. 404: missing or unauthorized object
(the same response). 400/413: invalid fields/type/pixels/bytes. 409: incomplete
photos, active upload lease, stale update or invalid transition; refresh and
review the draft. 429: resume an existing draft if at the draft limit, or wait a minute for the request quota. 503: MongoDB/provider unavailable;
refresh and retry the same photo. Provider exception details are sanitized.
No Cloudinary failure can transition a draft with an unconfirmed photo to submitted.

## Manual Xcode / iOS verification

1. Use a dedicated development replica set and Cloudinary test environment. Run
   migrations and the verified-assignment command for synthetic tenant/manager
   accounts. Leave `GEMINI_API_KEY` unset. Start Django with the private backend
   environment; never use shared Atlas for tests.
2. In `frontend`, run `npm ci` if needed, `cd ios && pod install`, then open
   `frontend/ios/frontend.xcworkspace` in Xcode. Choose the `frontend` scheme and an
   installed simulator. Start Metro with `npm start` and run the app. Configure the
   existing API config for the host only if its defaults do not reach Django.
3. Sign in as the assigned tenant. Open Report issue, choose the real assigned
   unit and enter an area/description. Import synthetic JPEG/PNG files into the
   simulator Photos app, select several, and verify individual X/checkmark review.
   The simulator may have no camera: test camera permission, capture, retake and
   orientation on a physical device separately.
4. Try four accepted photos (submission disabled/rejected), then five (success).
   Verify removal/replacement, twenty accepted photos, and rejection of photo 21
   through the API. Inspect live progress and server confirmation separately.
5. Save a draft, terminate/relaunch and logout/login. Resume it from history.
   Interrupt the network during upload and submission; refresh before retrying.
   Verify same-content retry does not create extra provider assets or history.
6. Sign in as the property's manager. Use View saved maintenance requests, open
   the request/photos and advance its status. Confirm tenant history updates.
   Repeat as an unrelated tenant and landlord: lists exclude it and guessed
   request/photo endpoints return 404. Revoke assignment/manager membership and
   verify access disappears.
7. Check the dedicated Cloudinary environment: originals and transformations
   reject unsigned delivery, MongoDB contains private references/deadlines without
   bytes or secrets, and Django's authorized photo endpoint succeeds. Test storage
   outages and missing configuration with sanitized errors. Dry-run cleanup;
   never shorten real evidence retention to test deletion.

## Validation and limitations

Automated tests mock provider I/O and use an isolated MongoDB 8.0 replica set.
They cannot prove actual Cloudinary account settings, production network access,
or physical-device camera/cookie behavior. Real provider/device verification
above remains required. No deployment, merge, secrets change or paid evaluation
is part of this change. See the final change report for current check results.

There is no verified unit-and-area baseline model/workflow in the existing
inspection implementation. Maintenance explicitly reports comparison unavailable
and offers manual photo review. No fabricated baseline or new paid path is added.
Existing one-shot inspection comparison, schema validation, content deduplication,
3/account/day and 30/global/day budgets remain intact. Other demo inspection,
property, availability and notification screens remain clearly marked samples.
Saved maintenance is separate from those sample records. Unuploaded local picker
photos cannot survive an app termination; accepted server-confirmed photos do.


See [the security review](SECURITY_REVIEW.md) for audit findings, fixes, validation,
and the remaining unpatched picomatch toolchain advisory.
