# Maintenance implementation report — 2026-11-18

Implemented in the existing `ai-image-comparison` working tree. No merge, deployment, GitHub Secrets change, or live paid Gemini evaluation was
made. The changes are committed/pushed only to this feature branch.
The pre-existing untracked `tmp/` directory was left untouched.

## Files changed

- `docs/SECURITY_REVIEW.md`
- `requirements.txt`
- `frontend/package-lock.json`
- `frontend/src/services/photoAsset.ts`
- `maintenance/limits.py`
- `.github/workflows/ci.yml`
- `README.md`
- `backend/settings.py`
- `backend/urls.py`
- `docs/CLOUDINARY_STORAGE.md`
- `docs/LANDLORD_INTEGRATION.md`
- `docs/MAINTENANCE_IMPLEMENTATION_REPORT.md`
- `docs/SPRINT3_MAINTENANCE.md`
- `docs/TENANT_INTEGRATION.md`
- `frontend/__tests__/TenantFlow.test.tsx`
- `frontend/__tests__/maintenanceService.test.ts`
- `frontend/src/components/MaintenanceRecords.tsx`
- `frontend/src/components/PhotoReview.tsx`
- `frontend/src/navigation/LandlordNavigator.tsx`
- `frontend/src/navigation/types.ts`
- `frontend/src/screens/landlord/LandlordDashboardScreen.tsx`
- `frontend/src/screens/landlord/SavedMaintenanceScreens.tsx`
- `frontend/src/screens/tenant/MaintenanceDetailScreen.tsx`
- `frontend/src/screens/tenant/ReportMaintenanceScreen.tsx`
- `frontend/src/screens/tenant/TenantDashboardScreen.tsx`
- `frontend/src/screens/tenant/UnitHistoryScreen.tsx`
- `frontend/src/services/maintenanceService.ts`
- `inspections/management/commands/cleanup_inspection_media.py`
- `inspections/media.py`
- `inspections/views.py`
- `maintenance/__init__.py`
- `maintenance/apps.py`
- `maintenance/cleanup.py`
- `maintenance/management/__init__.py`
- `maintenance/management/commands/__init__.py`
- `maintenance/management/commands/assign_maintenance_unit.py`
- `maintenance/migrations/0001_initial.py`
- `maintenance/migrations/0002_maintenancerequest_media_expired.py`
- `maintenance/migrations/__init__.py`
- `maintenance/models.py`
- `maintenance/store.py`
- `maintenance/tests.py`
- `maintenance/upload_handlers.py`
- `maintenance/views.py`

## Features implemented

- Individual camera/gallery review, discard/accept queue, remove/replace, live
  5–20-photo guidance, field validation and normal/urgent selection.
- Backend-persisted drafts and accepted photos, explicit save, guarded navigation,
  upload progress, safe retry and recovery after interrupted operations.
- Confirmed submission success, duplicate-tap protection and idempotent writes.
- Real paginated tenant history/details and draft resume after restart/relogin.
- Authorized landlord list/details/private photos and persisted forward-only
  status updates with history, separate from unrelated sample screens.

## API endpoints

See [request/response details and permission rules](SPRINT3_MAINTENANCE.md#api).

- `GET /api/maintenance/units/`
- `POST, GET /api/maintenance/`
- `GET, PATCH /api/maintenance/{id}/`
- `POST /api/maintenance/{id}/photos/`
- `GET, DELETE /api/maintenance/{id}/photos/{photoId}/`
- `POST /api/maintenance/{id}/submit/`
- `POST /api/maintenance/{id}/status/`

## MongoDB models and collections

`Property` (`maintenance_property`), `Unit` (`maintenance_unit`),
`UnitAssignment` (`maintenance_unitassignment`) and `MaintenanceRequest`
(`maintenance_maintenancerequest`), plus Django's property-manager membership
collection `maintenance_property_managers`. Requests embed bounded photo intent
ledgers and status history. New migrations must be applied to a development
backend before use; only the isolated test database was migrated here.

## Cloudinary integration

The existing `inspections/media.py` private implementation now recognizes
maintenance content-addressed references. Uploads use authenticated image assets,
no overwrite, individual bounded requests, normalized JPEG/PNG content, and
metadata-only MongoDB persistence. SHA-256 identity, persisted upload intents,
expiring leases, provider lookup and MongoDB revision checks allow safe recovery.
Clients receive authorized JPEG bytes from Django and never provider signed URLs.

Evidence remains for at least 90 days. Removed/failed/abandoned draft evidence
stays tracked. The existing explicit retention command now processes maintenance,
checks every deadline and actual provider creation age, freezes expired media,
and checkpoints confirmed deletions for retry. No cleanup worker was deployed.

## Authorization safeguards

Existing session/CSRF handling is retained. Tenants need an active, operator-verified
assignment and ownership of the request. Landlords need explicit manager membership
on the request's property and cannot access drafts. Every read/write/photo operation
checks object/unit scope; unrelated accounts receive the same 404 as missing IDs.
The server derives tenant and status-history actor identity from the session.
No public self-assignment endpoint exists. The operator-only setup command requires
an active superuser and matching account roles. Streaming byte limits, pixel/type
validation, safe IDs, bounded ledgers/pages and sanitized provider errors apply.

## Test commands and results

Backend commands used `venv/bin/python` with an explicitly isolated local MongoDB
8.0 replica set, not `.env` or shared Atlas:

```sh
export MONGODB_URI='mongodb://127.0.0.1:27019/?directConnection=true&replicaSet=leaseguard-maintenance'
export MONGODB_DB_NAME=leaseguard_maintenance_local
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test --noinput
python manage.py run_ai_evals
```

| Check | Result |
| --- | --- |
| Django system check | Passed, no issues |
| Migration check | Passed, no changes detected |
| Full Django suite | **90 passed**, including 20 maintenance tests |
| Mocked AI replay | **19 cases passed**, zero provider calls |
| `npm test -- --ci --runInBand` | **91 passed**, six suites |
| `npx --no-install tsc --noEmit` | Passed |
| `npm run lint` | Passed, zero errors; five pre-existing `no-void` warnings in `LiveComparisonPanel.tsx` |
| `git diff --check` | Passed |
| Xcode Debug iOS simulator build | **BUILD SUCCEEDED**, code signing disabled |

Frontend commands ran from `frontend`. Native validation ran from `frontend/ios`:

```sh
xcodebuild -workspace frontend.xcworkspace -scheme frontend \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/leaseguard-maintenance-ios \
  CODE_SIGNING_ALLOWED=NO build
```

Backend tests cover 4/5/20/21 boundaries, deduplication, interrupted/provider-failed
uploads, retention metadata and cleanup, stale concurrent writes, repeat submission,
MongoDB persistence/relogin, history, cross-account and same-unit tenant isolation,
landlord membership, immutable submitted evidence, status history, assignment
revocation, operator setup, malformed images/IDs/fields, CSRF and anonymous access.
Frontend tests cover individual multi-photo review, discard, five-photo submission,
transfer/security behavior, failed camera upload retry, gallery-queue preservation,
minimum validation, real record navigation, and waiting for confirmed submission
while preventing duplicate taps. Existing authentication/inspection/AI tests pass.
Provider calls were mocked and maintenance tests assert no Gemini client execution.

## Manual Xcode steps and remaining verification

Follow [the detailed simulator/device checklist](SPRINT3_MAINTENANCE.md#manual-xcode--ios-verification):
apply migrations to a dedicated development database, provision verified tenant/unit
relationships, privately configure a Cloudinary test environment, start Django and
Metro, then run `frontend.xcworkspace`. Test photo review at 4/5/20 boundaries,
relaunch/relogin, network interruptions, landlord status updates and unrelated-user
denial. Camera/permission/orientation behavior requires a physical device when the
simulator has no camera.

**Not verified:** comprehensive Cloudinary account access controls, physical-device
behavior, Android runtime, Release distribution, or production networking. Local
development setup connected to the configured Atlas database, the user confirmed
image upload works, authenticated retrieval succeeded, and unsigned original and
transformed delivery were denied. No live deletion was performed. Automated tests
continue to use only an isolated local replica set.
A trusted operator must create actual verified housing assignments; the demo
property screens do not provision them. Unuploaded picker files do not survive
app termination; confirmed server uploads do. Cleanup scheduling and deployment
rate limits remain operational setup tasks, documented in the maintenance guide.

There is no verified baseline linked to the same unit and area in the existing
inspection workflow. Maintenance explicitly displays this limitation and provides
manual review; it does not fabricate baselines or initiate paid comparisons.
The existing one-shot Gemini implementation and 3/account/day, 30/global/day limits
are preserved.


See [the security review](SECURITY_REVIEW.md) for dependency updates, concurrency
and quota hardening, credential checks, and the remaining unpatched advisory.
