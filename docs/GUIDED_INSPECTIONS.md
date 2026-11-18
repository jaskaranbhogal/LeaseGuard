# Guided photo inspections

Guided inspections use persisted, verified housing relationships. The mobile client
never supplies an owner or a Cloudinary URL. Existing maintenance and standalone
comparison endpoints remain available.

## Architecture and state

`assigned → draft → submitted → reviewed`; a landlord can move `submitted → retake`
and the tenant can replace evidence and resubmit. At least one new photo is required
after a retake request. Reviewed evidence is frozen. A move-in baseline approval
freezes the inspection before publishing its immutable unit baseline snapshot.
An interrupted approval can be retried without adding another baseline version.

Every mutation uses MongoDB single-document compare-and-swap on `revision` with
majority write concern. Clients must refresh on HTTP 409. Upload and AI network
calls occur outside the atomic update; persisted intents precede external writes.
Notifications are separate records with unique event keys. The inspection audit
acts as a durable source for notification reconciliation after process failures.

The frontend reloads confirmed evidence from Django on screen focus. Local previews
are temporary; confirmed progress survives app restarts and logout/login. Transfer
progress reaching 100% means bytes were sent, not that Cloudinary confirmed storage.
Submission success requires a successful Django response and a subsequent status
read on the confirmation screen.

## MongoDB data model

Additive migration: `guided_inspections/migrations/0001_initial.py`.
No bytes are stored in these collections.

| Model | Contents and indexes |
| --- | --- |
| `InspectionTemplate` | Owner, immutable name/version/step definitions, active flag, created timestamp, unique public ID. Steps specify stable ID, room, instructions and count; total is 5–20 photos. A saved template has no update endpoint. |
| `GuidedInspection` | Protected unit/tenant/landlord/template relationships, snapshot of template/version, type, due date, timestamps, status, revision, recurrence, photo/comparison/audit ledgers. Unique public ID and creation key; tenant/status, unit/created and status/due indexes. Progress is derived from confirmed active photos. |
| Embedded `InspectionPhoto` ledger | Step/slot, deterministic content identity, normalized SHA-256, authenticated provider reference, state, server receipt/upload times, retention deadline, upload token/lease and replacement timestamp. Old evidence is retained. Maximum 100 intents per inspection. Camera capture time is not independently verified; `capture_at` records server receipt. |
| `UnitBaseline` | Unique unit head with revision, active version ID and append-only version snapshots. Each snapshot includes approval actor/time, inspection/template/version, immutable photo references and step/slot mappings. Earlier versions are superseded by changing the head, not by rewriting old snapshots. |
| Embedded `GuidedComparison` ledger | Immutable baseline/current references, content identity, result, status, model/prompt version, human decision, optional maintenance ID and timestamps. Audit events retain all decisions. |
| `InspectionNotification` | Unique event key, protected recipient/inspection references, message, created/read timestamps; recipient/created index. |

The existing `inspection_comparisons` collection also holds the durable AI claim
and result. Guided claims are explicitly excluded from the legacy cleanup job.
No existing Atlas collections were migrated or modified during implementation.

## API contract

All paths below start with `/api/guided-inspections/`. Session cookies are required.
All writes require Django CSRF tokens from `/api/auth/csrf/`. JSON errors use `detail`;
401 means sign-in required, 404 includes unauthorized records, 409 means state or
revision conflict, 429 means rate limit, and 503 means storage temporarily unavailable.

| Method/path | Contract |
| --- | --- |
| `GET options/` | Managed property/unit labels, eligible verified tenant choices, owner's active templates, default five-step layout. |
| `POST templates/` | `{name, steps:[{id,room,instructions,count}]}`; returns immutable template ID. |
| `GET /` | Authorized inspections, keyset pagination via `before`; response `inspections,next`. Unit names accompany each record for history. |
| `POST /` | `{unit_id,tenant_id,template_id,inspection_type,due_at,idempotency_key,recurrence_days}`. Types: `move-in`, `periodic`, `move-out`, `follow-up`. Timezone-aware ISO due date; recurrence 0/30/90/180/365. Creation key 16–80 alphanumeric/underscore/hyphen characters. Reusing a key with different fields fails. |
| `GET <id>/` | `{inspection}` with steps, progress, confirmed photos, pending/failed uploads, compatible baseline candidates, comparisons, audit history and revision. No provider reference or URL. |
| `POST <id>/photos/` | Multipart `photo,step_id,slot,revision`. One JPEG/PNG; 8 MB and 20-megapixel limits. Returns updated inspection only after provider confirmation. |
| `GET <id>/photos/<photo-id>/` | Authorized private JPEG proxy with `private,no-store` and `nosniff`. Historical evidence remains protected by the inspection's unit/user scope. |
| `GET <id>/photos/<photo-id>/?baseline=1` | Active compatible approved baseline photo. |
| `GET <id>/photos/<photo-id>/?comparison=<comparison-id>` | Exact immutable photo used by a stored analysis, even after baseline supersession. |
| `POST <id>/submit/` | Tenant `{revision}`. Requires all configured slots to be securely stored; repeated submission is idempotent. |
| `POST <id>/approve-baseline/` | Landlord `{revision}`; submitted/reviewed move-in only. Retrying recovers interrupted approval. |
| `POST <id>/compare/` | Landlord `{revision,photo_id}`; explicit action on a submitted inspection. Baseline comes only from the server. |
| `POST <id>/decision/` | Landlord `{revision,comparison_id,decision}`; `confirmed`, `dismissed`, or `manual-review`. |
| `POST <id>/retake/` | Landlord `{revision,reason}`; opens a submitted record without removing previous photos. |
| `POST <id>/finalize/` | Landlord `{revision}`; pending analysis or missing human decisions prevents finalization. |
| `POST <id>/maintenance-draft/` | Tenant `{comparison_id}` for a confirmed finding; returns `maintenance_id`. Idempotently creates the tenant's maintenance draft with reused distinct private evidence references. |
| `POST <id>/maintenance/` | Landlord `{revision,comparison_id,maintenance_id}` links a confirmed finding to a submitted maintenance request for the same tenant and unit. |
| `GET notifications/` | Recipient's notifications within currently authorized units. In-app only. |
| `POST notifications/` | `{id}` marks an authorized notification read; idempotent. |

Templates support multiple photos per step. Stable matching uses **template ID +
version + step ID + slot**, never array index. A different template is deliberately
incompatible; no automatic layout-version migration or guessed matching occurs.

## Storage, recovery and retention

Cloudinary namespace: `leaseguard/guided/<inspection-id>/<intent-id>`. The intent ID
binds step, slot and normalized content SHA-256. Images are EXIF-corrected, converted
to JPEG and normalized using the existing `prepare_image` service. Authenticated
uploads use `overwrite=False`. A 90-second upload lease and provider lookup recover
ambiguous uploads. Failed replacements leave the previous confirmed photo active;
stale upload completion cannot replace newer evidence.

Regular evidence has a minimum 90-day deadline. **All guided evidence currently has
an indefinite deletion hold**, including active/superseded baselines, comparisons,
retaken photos and dispute evidence. There is no automatic guided deletion policy.
`media.delete` rejects guided references, and maintenance cleanup skips records
sharing guided evidence. This deliberately trades storage usage for preservation;
a future authorized retention-review process must verify every reference and hold
before enabling guided deletion. Never run destructive cleanup against existing
provider assets as part of testing.

Maintenance follow-up reuses secure references without reuploading. Identical
normalized images are deduplicated in the maintenance draft. Its normal 5–20-photo
submission rule still applies, so a tenant may need additional distinct images.
The draft records its originating inspection and comparison. Landlords cannot edit
or submit tenant drafts; they link the resulting submitted request from review.

## Gemini and security

The existing structured schema, versioned prompt, 20-second provider timeout,
one-shot service and safe fallback are reused. The same MongoDB quota function
reserves **3 calls/account/day and 30 globally/day** across both workflows. Global
reservation happens first and is conservative: rejected account requests may still
consume a global reservation. A unit/content/room/step claim prevents duplicate
charges across managed inspections and managers. The first manager requesting new
analysis consumes their account quota.

No photo capture, upload, scheduler or ordinary test calls Gemini. A durable claim
is written before quota/provider invocation. Interrupted claims are not retried.
After 90 seconds an explicit Analyze action recovers a saved result or records
manual-review fallback. Cloudinary reads and all user-provided metadata remain
server controlled. AI results are advisory; finalization requires human decisions.
Historical comparison previews use their pinned references rather than the newest
active baseline.

All list/detail/photo/action paths recheck current verified tenant assignments or
property management. Sharing a unit does not let tenants see each other's records.
Notifications also recheck current unit access. API read/write limits reuse the
existing per-account and global minute buckets. Templates, photo counts, payloads,
file bytes, dimensions and upload intent counts are bounded. Audit history is capped
at 500 events; hitting that limit requires operator support, not evidence deletion.

## Local setup and checks

Commands below use the isolated local instance created for this task. They do not
load the repository's `.env` (its remote database was not classified as safe).

```bash
cd /Users/jaskaranbhogal/CapstoneProjectGroup4
export MONGODB_URI='mongodb://127.0.0.1:27019/?directConnection=true'
export MONGODB_DB_NAME=leaseguard_guided_local
export GEMINI_API_KEY=''
export CLOUDINARY_URL=''
venv/bin/python manage.py check
venv/bin/python manage.py makemigrations --check --dry-run
venv/bin/python manage.py test --noinput
venv/bin/python manage.py run_ai_evals
# Only the explicitly isolated local database above:
venv/bin/python manage.py migrate
venv/bin/python manage.py runserver 0.0.0.0:8000
```

The dedicated container is `leaseguard-guided-test` (MongoDB 8, replica set
`guided-test`, host port 27019). If creating a fresh instance, initialize a local
replica set and use its explicit local URI. Do not run migrations or destructive
tests against Atlas/shared databases without separately verifying and authorizing
them. Provider tests use mocks; blank provider configuration intentionally prevents
live uploads and paid calls.

In another terminal:

```bash
cd /Users/jaskaranbhogal/CapstoneProjectGroup4/frontend
npm start
# Separate terminal, existing workspace:
npm run ios
open /Users/jaskaranbhogal/CapstoneProjectGroup4/frontend/ios/frontend.xcworkspace
npx --no-install tsc --noEmit
npm run lint
npm test -- --ci --runInBand
```

Native simulator build command used:

```bash
xcodebuild -workspace frontend/ios/frontend.xcworkspace -scheme frontend \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/leaseguard-guided-xcode CODE_SIGNING_ALLOWED=NO build
```

Android: install/configure the Android SDK first, set `ANDROID_HOME`, then run
`cd frontend/android && ./gradlew :app:assembleDebug`; launch using `npm run android`
from `frontend`. No signing identities or Android SDK settings were changed here.

For operations, run `venv/bin/python manage.py process_guided_inspections` in a
verified environment. It streams records in bounded batches, reconciles in-app
notifications and idempotently creates the next periodic assignment after a review.
It rechecks active tenant and manager relationships and never invokes Gemini.
No cron/worker deployment was installed. Schedule this command through the team's
approved operations system when ready; running it repeatedly is safe.

## Tenant/landlord demonstration

1. In an isolated development database, register a landlord and tenant. Use an
   existing verified unit or have an operator provision it with
   `assign_maintenance_unit --operator <superuser> --tenant <username>
   --landlord <username> --property <label> --unit <label>`. Do not bootstrap fake
   relationships in a shared database.
2. After verifying the Cloudinary environment is development-only, configure its
   existing backend environment variable. Keep provider credentials on the server.
3. Landlord: **Assign photo inspection**, choose verified property/unit/tenant,
   save/select a layout template, choose move-in and due date, review and confirm.
4. Tenant: open the saved assignment, camera/gallery → preview → X or ✓. Confirm
   transfer and server confirmation. Navigate Previous/Next, replace a draft photo,
   leave/reopen, and log out/in to verify saved progress.
5. Complete every slot and submit. Landlord opens saved evidence and approves the
   move-in baseline. The approved record cannot be retaken or edited.
6. Assign a periodic inspection using the **same saved template** and unit. Tenant
   completes and submits it. Landlord sees matching baseline/current pairs.
7. Only with separately authorized live Gemini usage, press **Analyze with Gemini**.
   For ordinary development use the mocked integration tests instead. Test missing
   baseline, quota exhaustion and provider failure through the test suite.
8. Confirm/dismiss a finding or require manual review. Request a reasoned retake
   when needed; tenant must upload new evidence, with prior evidence retained.
9. For a confirmed finding, tenant chooses **Create maintenance follow-up**, reviews
   the reused draft, adds distinct photos if needed, fills repair details and submits.
   Landlord links that submitted request ID from inspection review and uses existing
   maintenance status controls. Finalize review and inspect both roles' history.
10. Open Notifications to verify persisted assignment/submission/retake/review
    updates. In-app persistence is not email or push delivery.

## External verification still required

Cloudinary console access redirected to the public site in this session. Verify
product environment identity, authenticated delivery for existing and guided assets,
unsigned originals/transformation denial, upload presets/access controls, namespace
separation, storage usage/limits, and a synthetic upload/recovery/private-proxy check
in a designated development environment. Do not use real evidence for testing.

Atlas configuration points to a remote host of unverified environment classification.
No remote connection or writes were attempted. An authorized operator must confirm
cluster/database purpose, collection/index definitions and migration history before
applying the additive migration. Local tests exercised real MongoDB indexes and
migrations in a dedicated test database.

The iOS simulator build and process launch succeeded. Camera/gallery/session-cookie
image rendering, airplane-mode recovery, full live-provider workflow and physical
device testing remain manual. The computer-use tool did not expose Simulator for
visual inspection. Android build is blocked by an unconfigured SDK. Golden replay
checks schema/pipeline behavior, not real-model accuracy or resistance to injection;
consented real-image evaluation is still required before production use.
