# Jon redesign integration

Integration branch: `merge/jonfork-main`. Main is never a merge destination.

## Starting references and merge ancestry

| Reference | Starting SHA |
| --- | --- |
| `origin/main` | `9f6c51ec07181e0b24aaeb270daefe6b735cbd03` |
| `origin/merge/jonfork-main` | `9f6c51ec07181e0b24aaeb270daefe6b735cbd03` |
| `Jon-Peves/LeaseGuard:redesign-batch-b-c` | `9da0a7410e2ea8a3de29ce4c7c468c87a3d9cef1` |

The source contains four commits (`5c0c111`, `ea6ee2e`, `a877b63`, `9da0a74`).
A three-way, non-fast-forward merge preserves that ancestry. The starting
integration head is also protected by `backup/jon-integration-start-20261121`.
The pre-existing iOS project edit was protected separately and restored after
committing; the pre-existing untracked `tmp/` contents are excluded.

## File decisions

| Files | Resolution |
| --- | --- |
| `backend/settings.py`, `.env.example`, `requirements.txt` | Main retained: official MongoDB backend, four applications, existing middleware, provider settings and upload limits. No AI background-worker setting or dependency replacement. |
| `backend/urls.py` | All maintenance, guided-inspection, private-photo and standalone-review routes retained. Housing presentation adapters live in `maintenance.housing`; appointment routes store scheduling only. |
| `inspections/schemas.py`, `inspections/storage.py`, `inspections/tests/test_services.py` | Main's strict schema, semantic checks, quota reservations, deduplication and tests retained. |
| `inspections/services.py`, `inspections/prompts.py` | Main one-shot transport, 20-second timeout, bounded preprocessing and safe fallback retained; optional bounded tenant context added. |
| `inspections/prompts/image_comparison_v2.txt`, evaluation files | New prompt version; v1 untouched. Added contextual notes, decorations, obstruction, uncertain marks and camera-relative wording. Replay metadata names v2; the existing 21 synthetic cases remain the regression corpus. |
| Jon's `inspections/models.py`, migrations, `review.py`, `urls.py`, `compare_photos.py`, `gemini_check.py` | Reviewed and excluded from the active tree. They introduce competing property/evidence collections, public Cloudinary URLs, automatic/retried AI calls or quota-bypassing provider entry points. Source remains available in the merged ancestry. |
| `maintenance/models.py`, `maintenance/housing.py` | Canonical housing models extended; authenticated manager operations, invitation acceptance, consent and appointments implemented. |
| `guided_inspections/store.py`, `views.py`, `baselines.py`, `urls.py` | Draft-only note ledgers, immutable snapshot/context display, and future unit-area configuration integrated into the existing workflow. |
| Auth/landlord/tenant navigators and `types.ts` | Existing route IDs and role stacks preserved. Added real unit editing and appointments. No missing `InspectionProvider` import. |
| `LandlordDemoContext.tsx`, `TenantDemoContext.tsx`, `leaseService.ts`, `types/housing.ts` | Historical context names now represent server-backed presentation adapters. No in-memory demo store, fake relationships, optimistic persistence claims, alternate photo uploader or automatic AI polling. |
| Dashboards, Add Property, Edit Unit, invite/welcome and consent components | Jon's cards, inputs, buttons, titles, empty states and visual tokens adapted to real records. Extra units supported; invitation delivery status is explicit. |
| Canonical Move-in Baseline, Guided Inspection and AI Inspection Review screens | Jon's progress indicators, capture/reference presentation, review tiles, notes and comparison cards adapted here rather than mounting a second capture workflow. Camera/gallery, drafts, historical photos and human decisions remain connected. The restored move-in tour opens the canonical baseline ledger, and tenants have a read-only approved-baseline screen with a dedicated active-version photo scope; manager draft/history permissions remain unchanged. |
| Shared components and existing maintenance/history/settings/profile/privacy screens | Shared blue/navy palette and card styling applied without removing existing actions. Native photo review uses a contained image and safe-area layout. Unsupported existing settings/profile features stay explicitly labeled. |
| Frontend/backend tests | Existing regressions retained/adapted to connected behavior; new invitation, consent, notes, ownership, race and scheduling checks added. CI files unchanged. |

## Database changes

Apply the normal Django migration workflow on an authorized deployment database:

- `maintenance/0003_property_city_property_creation_key_unit_areas_and_more.py`:
  property city/idempotency, unit bedroom/bathroom/future-area configuration and
  revision, plus `TenantInvitation`, `PolicyConsent`, `InspectionAppointment`.
- `maintenance/0004_unit_creation_key_unitassignment_ended_at_and_more.py`:
  idempotent additional-unit creation and assignment-end actor/time audit.
- `maintenance/0005_inspectionappointment_creation_key.py`:
  retry-safe appointment offers.

All are additive. Existing ownership and evidence collections are retained.
Photo notes use the existing embedded evidence ledger, requiring no competing
photo model or guided-evidence collection.

## Connected behavior and security

Landlords create canonical properties/units and issue pending invitations.
Only configured SMTP is used for external invitation delivery. Console/dummy
email backends do not print invitation secrets or pretend to deliver messages.
`email-accepted` means the mail backend accepted the message, not guaranteed
inbox delivery. Failed/unconfigured delivery is visible; revoke and reissue after
configuration is repaired.

Invitations use 256-bit random, seven-day, single-use codes, with only SHA-256
hashes stored. Codes travel in email and authenticated POST bodies, never URLs,
logs or dashboard responses. Acceptance requires the intended account email,
current consent and still-valid manager authority. Before mailbox-code proof,
pending-invitation API responses conceal the housing details. Acceptance and
revocation serialize through the canonical Unit in snapshot/majority replica-set
transactions; concurrent acceptance creates one assignment. Existing assignments
are never silently replaced. Ended assignments retain the record, actor and time.

Policy `2026-11-21` acknowledgments persist user, role, version, timestamp and audit
source. The server gates maintenance/guided writes and standalone analysis;
standalone analysis additionally requires landlord role. Historical reads retain
main's object authorization. The policy describes private storage, authorized
services/processors, explicit Gemini processing, advisory AI, at least 90 days'
retention and the guided-evidence preservation hold. It promises no automatic
90-day deletion.

Photo notes attach actor/time, unit, template version, step, slot and photo to a
bounded correction ledger. Approval/submission freezes evidence; explicit audited
retake flows preserve previous observations. Baseline versions and comparison
snapshots keep the notes used for that comparison. Context is marked UNTRUSTED;
notes cannot set permissions, decisions or budgets.

Unit area edits configure future templates. Saved template IDs/versions,
approved baseline mappings and historical results are never renamed in place.
Remote assignments continue through existing guided APIs. Appointments store
1–10 offered times, tenant availability, landlord confirmation, cancellation and
history. The server resolves wall-clock choices with IANA time zones and rejects
DST gaps/ambiguous hours. Rescheduling means cancelling the old appointment and
creating a new offer, retaining the previous history. No email/push notification
is invented for appointment changes.

## Verification and limits

All Python checks use the isolated local replica set on port 27019 with a
separate test database and blank Gemini/Cloudinary settings. Golden replay makes
zero provider calls and is **not evidence of improved live-model accuracy**.
The SDK transport/schema tests use mocked HTTP responses.

The iPhone 18 Pro / iOS 27 simulator build succeeded with signing disabled.
Manual simulator validation used a separate local database and provider-disabled
server: landlord/tenant login, correct dashboards and roles, real property save,
unit editor, settings/logout, assigned guided-inspection navigation and progress,
gallery-picker launch/cancel, and maintenance navigation. Full native photo
selection/upload, private Cloudinary delivery and live Gemini were not exercised.
The native gallery picker loaded slowly; its cancellation returned to the app.

An offline Android debug build reached Gradle configuration but could not build:
no Android SDK/`ANDROID_HOME`/`local.properties` is installed. Android native build
and device validation remain required. No SDK was silently installed.

Production SMTP delivery and provider/device spot checks remain deployment
validation requirements. Existing prototype settings preferences/profile changes
remain clearly labeled; this integration does not claim they are persisted.
No production database migration or production-provider test was performed.

### Recorded check results

| Check | Result |
| --- | --- |
| `python manage.py check` | No issues, 0 silenced |
| `python manage.py makemigrations --check --dry-run` | No changes detected |
| `python manage.py test --noinput` | 146 tests passed in 44.127 seconds |
| `python manage.py run_ai_evals` | 21 synthetic cases passed; 0 provider calls; replay consistency/expected match 1.0, replay hallucination rate 0.0 |
| `npx --no-install tsc --noEmit` | Passed |
| `npm run lint` | Passed, 0 errors and 0 warnings |
| `npm test -- --runInBand` | 9 suites, 116 tests passed in 3.376 seconds |
| iOS Debug simulator build | `BUILD SUCCEEDED`; signing disabled |
| Android offline Debug build | Blocked: Android SDK location not found |
| Merge markers / staged whitespace / secret-pattern checks | Passed |

The implementation merge is `9724d84`; the subsequent documentation checkpoint
records these results. These are local checks, not a claim that remote CI or live
providers have been verified.
