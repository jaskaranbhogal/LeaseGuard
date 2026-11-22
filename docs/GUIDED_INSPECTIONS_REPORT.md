> Historical guided implementation report. For the latest Sprint 3 code, test totals,
> provider verification and remaining gates, read
> [Sprint 3 finalization report](SPRINT3_FINALIZATION_REPORT.md).

# Guided inspections implementation report

Verification date: November 18, 2026. Branch: `feature/guided-photo-inspections`,
based directly on `origin/ai-image-comparison` at `3f98d1d` after fetching origin.
Use `git log --oneline origin/ai-image-comparison..HEAD` for the exact commit list;
the final chat records the final SHA after this report is committed.

## Phase status

| Phase | Status and evidence |
| --- | --- |
| 1 Architecture/reuse | Implemented; revision-based state machine and embedded ledgers. Existing storage, image preparation, Gemini, quota, permissions and rate-limit services reused. Shared mobile multipart transport and PhotoReview. Regression suite passes. |
| 2 MongoDB models | Implemented and locally tested; four additive models plus embedded photo/comparison ledgers, unique/index constraints and migration consistency. Atlas migration not applied. |
| 3 Assignments | Implemented and tested; verified unit/tenant selection, customizable immutable templates, future due dates, type selection, review/confirm and idempotent creation. |
| 4 Cloudinary | Implemented; authenticated guided namespace, pre-upload journal, provider recovery, proxy reads, validation and retention holds. Provider I/O mocked in tests; real dashboard/uploads not verified. |
| 5 Mobile capture | Implemented; camera/gallery, actual preview, discard/accept, transfer vs storage status, previous/next, draft replacement and saved progress. Jest tested; physical camera/gallery behavior pending. |
| 6 Draft/submission | Implemented and tested; server resume, required-slot validation, idempotent submit, revision conflicts, stale-upload protection and historical evidence retention. |
| 7 Baselines | Implemented and tested; immutable approval snapshots and version heads; exact template/step/slot matching, mismatch rejection and retryable approval. |
| 8 Gemini | Implemented and mocked-tested; explicit landlord action, stored private images, pinned evidence, durable dedup, shared 3/30 budgets and manual fallback. No live Gemini call made. |
| 9 Human review | Implemented and tested; real side-by-side evidence, advisory findings, confirm/dismiss/manual-review, retake reasons, finalization and audit history. |
| 10 Maintenance/history | Implemented and tested; tenant-owned draft from confirmed finding, private-reference reuse, unchanged 5–20 rule, landlord linking and authorized real history views. |
| 11 Operations | Implemented and tested; due/upcoming/overdue, in-app notification records, read status, reconciliation and idempotent recurrence command. No email/push claim and no production scheduler installed. |
| 12 Verification/docs | Automated checks and iOS build passed. Android SDK, live provider/Atlas verification, visual simulator interaction and physical-device E2E remain incomplete. |

This is a locally verified implementation, **not** proof of the complete live
Cloudinary → Gemini → physical-device workflow.

## Tests and builds actually executed

- Django system checks: passed, no issues.
- Migration consistency: `makemigrations --check --dry-run` passed.
- Full Django suite: **108 tests passed**, including 18 guided integration tests.
  Real MongoDB 8 replica set in a dedicated local Docker container; provider calls
  mocked. Tests create/drop only the dedicated `test_leaseguard_guided_local` DB.
- TypeScript: `npx --no-install tsc --noEmit` passed.
- ESLint: passed, zero errors; five existing `no-void` warnings in LiveComparisonPanel.
- Jest: **93 tests passed in six suites**, including updated live-record navigation,
  camera/gallery preview controls, uploads/submission, review decisions, notifications
  and shared multipart transport.
- AI replay: **20 cases passed**, zero possible provider calls, all replay metrics 1.0
  except hallucination rate 0.0. This measures deterministic mocked behavior, not model accuracy.
- Xcode 27.0: existing `frontend.xcworkspace`, Debug simulator build **succeeded**,
  signing disabled. App installed and launched on booted iPhone 18 Pro / iOS 27.0;
  launch returned a process ID. Computer-use tooling did not expose Simulator for
  visual inspection, so no visual/full interaction pass is claimed.
- Android: `./gradlew --offline :app:assembleDebug` executed and **failed** because
  SDK location/ANDROID_HOME is not configured. No SDK or signing settings changed.
- No new GitHub Actions success is claimed until the pushed branch's workflow completes.

## Backend and mobile scope

Backend: `guided_inspections` app, additive migration, authorized routes under
`/api/guided-inspections/`, immutable templates, inspections, unit baseline heads,
embedded evidence/comparison ledgers and notifications. Existing maintenance paths
retain their authentication, status progression and photo-count constraints.

Mobile: ScheduleInspection, AIInspectionReview, GuidedInspection,
ReviewInspectionPhoto (legacy entry redirected to assignments), InspectionSubmitted,
TenantDashboard, LandlordDashboard, UnitHistory, ConditionHistory, Notifications,
TenantTabs and navigation types. New GuidedRecords and guidedInspectionService;
shared privatePhotoUpload used by maintenance too. Dead mock inspection context and
its data files removed. Unrelated property/availability demos remain clearly labeled.

Cloudinary, MongoDB, Gemini, role boundaries, retention, all API request contracts,
exact Django/Metro/Xcode commands and a tenant/landlord demonstration are documented
in [GUIDED_INSPECTIONS.md](GUIDED_INSPECTIONS.md).

## Completed and pending external checks

**Cloudinary:** inspected integration code and configuration presence without
exposing credentials. Console navigation redirected to the public site; no signed-in
dashboard was accessible. Development environment identity, authenticated existing
assets, unsigned delivery/transformation denial, upload/access settings, usage/limits,
namespace separation and a permitted synthetic live upload remain pending. No assets
were uploaded/deleted or provider settings changed in this task.

**MongoDB:** inspected configuration classification without logging URI/credentials.
Configured `.env` endpoint is remote; development/staging/production status unknown.
No remote connection, migration or write attempted. Local isolated replica-set
migrations, indexes and real ORM/PyMongo lifecycle tested. Atlas collection/index and
migration-history verification remains pending operator review.

**Devices:** iOS build and process launch verified as above; camera/gallery,
private-image cookies, offline interruption/recovery and physical-device behavior
remain pending. Android build blocked by missing SDK. An existing Metro and Django
server were detected, but no account sign-in or mutations were performed against
that running backend during smoke testing.

## Remaining limitations and operational choices

- Guided evidence, including superseded and shared maintenance evidence, is retained
  indefinitely. Automatic guided deletion is deliberately disabled pending a
  separately approved retention/dispute review process; storage usage will grow.
- Matching requires the same saved template ID/version and stable step/slot. There
  is no automatic compatibility migration between independently created templates.
- Retakes reopen the inspection with a reason and require new evidence; they do not
  provide per-step landlord locking. Historical evidence remains immutable.
- A client that restarts during an unconfirmed upload must reselect the same photo
  after the 90-second lease; only server-confirmed photos are guaranteed to resume.
- An interrupted AI call is never retried automatically. An explicit Analyze action
  after 90 seconds reconciles a stored result or marks manual review. Cost safety
  takes priority over automatically obtaining another response.
- Notifications are in-app only; no email/push transport or scheduler deployment.
- A landlord links a submitted maintenance request by ID; the tenant initiates and
  submits the draft, preserving role boundaries. No landlord impersonation of tenants.
- Full live-provider and physical-device end-to-end validation is still required.

## Repository safety

`main` and `ai-image-comparison` branches and their existing PR were not modified or
merged. No force-push, branch deletion, secret change, deployment, paid Gemini call,
shared-database mutation or existing Cloudinary asset deletion was performed.
The pre-existing Xcode project edits and untracked `tmp/` were preserved and excluded
from feature commits. The isolated test container was left available for repeatable
local verification; it is not a production service.
