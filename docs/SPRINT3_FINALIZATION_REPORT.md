# Sprint 3 finalization report — 18 November 2026

Branch: `feature/guided-photo-inspections`. Starting commit: `4c44686`.
No new branch, merge, production deployment, history rewrite, issue closure, or paid Gemini call.

## Implementation checklist and six milestones

The starting implementation already had verified unit/tenant assignments, immutable
saved templates, guided camera/gallery capture, authenticated Cloudinary uploads,
persistent MongoDB drafts, tenant submissions, tenant-origin baseline approval,
exact template/step/slot matching, Gemini/Pydantic integration, shared daily budgets,
content-based deduplication, human review, maintenance links, history, notifications,
and 20 golden replay cases. Those systems were reused.

| Milestone | Remaining work completed | Verification boundary |
| --- | --- | --- |
| 1. Landlord baselines | Dedicated `LandlordBaselineDraft` model/additive migration; manager-only create/resume/upload/approve/history/image APIs; real unit selector and `MoveInBaselineScreen`; shared `PhotoReview`, image picker, multipart transport and guided evidence state machine | Local MongoDB lifecycle and mocked storage tested; real phone and live upload still pending |
| 2. Future matching | Reused exact unit + template identity/version + stable step/slot matching; current managers can reuse the unit's saved baseline template; scheduling preselects it; explicit supersession; pinned completed analyses survive active-baseline changes | Cross-unit/template, concurrent-head, historical-reference and retrieval-failure tests |
| 3. Gemini/review | `.env` loaded without overriding exported settings; explicit one-attempt SDK transport; sanitized configuration fallback; private retrieval failure persists manual fallback without budget use; individual finding decisions and post-finalization resolution | Configured key presence and SDK compatibility checked; no live model request |
| 4. Findings/alerts | Persisted individual and pair decisions/audits; completed high-severity damage results with good same-area photos and medium/high confidence notify current authorized managers; deduplicated alerts/reconciliation; notification navigation and read state | Mocked results and real MongoDB persistence/authorization tested; no claim of a real-model alert |
| 5. Evals/security | Original 20 golden cases preserved; image-text injection case added; provider-output permission/status injection rejected; actual concurrent quota/provider-call tests; existing CI Eval gate retained | 21 deterministic replay cases; no real-model accuracy or injection-resistance claim |
| 6. Final checks/docs | Backend/mobile regressions, migration checks, native build attempts, security audits, review description and manual testing instructions | External/provider/device/CI limitations listed below |

## Backend model and API additions

All routes below are under `/api/guided-inspections/`, session-authenticated,
CSRF-protected on writes, rate limited, and manager-membership scoped on every read/write.

- `GET units/<unit_id>/baselines/`: missing/draft/approved status, recoverable drafts,
  active version, immutable approved/superseded history. Provider references omitted.
- `POST units/<unit_id>/baselines/`: `{template_id}` creates/resumes one draft for the
  unit/current head. No tenant or tenant assignment is required.
- `GET baseline-drafts/<draft_id>/`: confirmed progress, steps, safe photo identities,
  revision and audit history.
- `POST baseline-drafts/<draft_id>/photos/`: existing multipart `photo`, `step_id`,
  `slot`, `revision`; returns `draft` only after private storage confirmation.
- `POST baseline-drafts/<draft_id>/`: `{revision, supersedes?}` validates complete
  5–20-photo evidence and publishes the approved snapshot. Replacing a baseline
  requires its exact active version ID as `supersedes`. Lost-response retries return
  the already published version without creating another version.
- `GET baseline-drafts/<draft_id>/photos/<photo_id>/` and
  `GET units/<unit_id>/baselines/<version_id>/photos/<photo_id>/`: authorized JPEG
  proxies with `private, no-store` and `nosniff` headers.

`LandlordBaselineDraft` stores the unit, real manager, immutable template snapshot,
expected active version, upload intents/confirmed evidence, status, revision and audit.
Migration `guided_inspections/0002_landlordbaselinedraft.py` only adds its collection
and indexes; it does not migrate, delete or rewrite prior evidence.

Existing tenant baseline approval also requires explicit supersession when another
version is active. The mobile review screen asks for confirmation. Publishing the
version and active head is one MongoDB revision-checked update. Interrupted evidence
freezing/publication remains discoverable and retryable. Previous baseline snapshots
are unchanged. Guided Cloudinary assets remain under an indefinite retention hold,
including superseded/replaced evidence and references reused by maintenance. Ordinary
upload metadata retains the existing minimum 90-day deadline; nothing is deleted.

## Matching and human decisions

Matching uses the unit-scoped active baseline, exact saved template ID/version,
stable step ID and slot. No positional or room-name guessing. Missing/incompatible
baselines require manual review. Each saved analysis pins the exact baseline version,
baseline/current photo snapshots, model, prompt version, result and timestamps.
A repeated Analyze action on an already completed photo returns its original result,
even after supersession; no retrieval or second paid call occurs.

The `decision` action accepts `confirmed`, `dismissed`, `manual-review`, `resolved`.
Optional `finding_index` selects one immutable result finding. Omitting it applies a
pair decision to every finding. Mixed individual decisions leave the pair aggregate
unset and remain visible individually; finalization requires every finding to have a
decision. Resolution requires prior confirmation and remains possible after review
finalization. Audits retain actor, time, comparison and finding index. AI availability,
human decisions and maintenance repair state are separate. A model cannot write any
of these decisions or create maintenance automatically.

## Automated verification

See the latest command outputs recorded for this run in the final chat report.
The final executed totals are recorded below.

- Django full regression suite: **126 tests passed**.
- React Native/Jest: **103 tests passed in six suites**.
- Django system checks and migration consistency: passed.
- TypeScript: passed. ESLint: zero errors, five pre-existing `no-void` warnings in
  `LiveComparisonPanel.tsx`.
- AI golden replay: **21 cases passed**, hallucination rate **0.0**, consistency
  **1.0**, expected match **1.0**, zero provider calls. Thresholds: 0.0 maximum,
  0.95 minimum, 0.80 minimum, respectively. These are fixture/parser regressions.
- iOS Debug simulator build: **BUILD SUCCEEDED** with signing disabled using the
  existing workspace and `/tmp/leaseguard-guided-xcode` derived data.
- Android offline Debug build: **failed**, SDK location/`ANDROID_HOME` missing.
- `git diff --check`: passed. Python `pip check`: passed.
- npm audit: **0 vulnerabilities** in the current registry response. The historical
  picomatch advisory counts in earlier reports are not the current result.
- Python advisory scan: **no known vulnerabilities in the final installed dependency set**.

Database tests use the dedicated local MongoDB 8 replica set `guided-test` on port
27019 and isolated `test_leaseguard_sprint3_local`. Provider calls are mocked. Raw
comparison/quota ledgers are explicitly isolated between Django transaction tests.
Concurrent tests enforce 3/account/day, 30/global/day and one call for a contested pair.
No test connects to, drops, migrates, or writes the configured shared Atlas database.

## Actual service and device verification

**Gemini:** a newly initialized Django settings process reads a nonempty local key;
its value was never printed. Configured model remains `gemini-3.5-flash-lite`, SDK
`google-genai 3.1.0`; installed SDK accepts the timeout/retry configuration and LOW
thinking enum. Official [Google model documentation](https://firebase.google.com/docs/ai-logic/models)
and [model card](https://deepmind.google/models/model-cards/gemini-3-5-flash-lite/)
confirm the model family/identifier; account/project entitlement and live schema
behavior remain unverified. Existing server process environment was not inspected;
restart Django to pick up dependency/settings changes. No paid request was made.
Synthetic fixtures are prepared at `/tmp/leaseguard-gemini-smoke/baseline.png` and
`current.png`. One approved synthetic smoke comparison is still required; a full
real-model golden evaluation needs separate cost approval and representative data.

**Cloudinary:** authorized browser inspection reached the existing Usage Reports
page and read the selected `leaseguard (Test)` label, 64 assets and 161.44 MB storage.
No credentials or private asset contents were inspected. That label alone does not
prove `.env` points to this product environment. Authenticated upload, interrupted
recovery, signed retrieval and unsigned-original/transformation denial still require
a controlled development smoke test. No new assets were uploaded or deleted.
Browser extension tab control errored; native accessibility supplied the usage data.

**MongoDB:** real local replica-set migrations, indexes and persistence exercised by
the suite. An Atlas browser tab exists, but its collection/index data were not
successfully read through the tools. Remote environment classification, migration
history and index inspection remain pending; no remote writes or migrations.

**Devices:** the iOS build passed; a complete simulator/physical-device interaction
pass was not performed. Sandbox `simctl` could not reach CoreSimulator services.
Computer-use inventory did not expose a Simulator app. No camera, gallery, cookies,
network-interruption or private-image rendering success is claimed on a device.
Android requires SDK installation/configuration.

**GitHub:** PR #68 was read and remains open, draft, unmerged, targeting `main` from
`ai-image-comparison`. No guided-branch PR exists at inspection time. The guided PR
should target `ai-image-comparison`, then be retargeted after its parent merges.
The classic Branches settings page displayed no existing classic protection rule;
repository ruleset details were not verified. Owner action: verify/create a rule
covering `main` that requires the exact **Eval** check alongside **Test** and the
team's review requirements. No rules or protections were changed. Workflow source
already makes Deploy depend on both Test and Eval and deploys only on main pushes.
Fresh pushed-commit CI results must be checked separately from these local results.

## Exact iOS acceptance walkthrough

1. Install updated Python requirements. Set an explicit approved development/local
   MongoDB URI and database name before running migrations. Apply the additive
   migration there; restart Django. Start Metro in `frontend` and launch the existing
   `frontend.xcworkspace` Debug app. Keep Gemini disabled for ordinary capture tests.
2. Use a real verified landlord/property/unit relationship. Dashboard → **Create
   Move-In Baseline** → select property/unit. Inspect missing/draft/approved status.
3. Select an existing saved template, or create the standard five-room template.
   Custom templates can be saved in the existing Assign photo inspection screen.
4. **Take photo** or **Choose from gallery** → actual preview → X to discard or ✓
   to accept. Confirm transfer reaches 100% and then server storage confirmation.
5. Capture several slots; leave/reopen the screen/app and resume the saved draft.
   Replace a photo, check Previous/Next and progress, and complete all required slots.
6. **Review full baseline** → inspect every image → **Approve and Save Baseline**.
   Reopen the unit and verify approved history. Draft images are now immutable.
7. Start another baseline for the same unit. Approval must ask to supersede; Cancel
   must leave the prior head active. Confirm only when intentional; check both versions.
8. Assign a **periodic** inspection to the same unit's verified tenant. The saved
   baseline template is preselected; retain it. Tenant captures/submits current photos.
9. Landlord opens the submitted record. Verify room/slot pairing and both images.
   A different template/unit must show manual review, without guessed matches.
10. Only after explicit approval to spend Gemini credits, select **Analyze with
    Gemini** for one pair. Verify saved validated output or empty/manual fallback,
    then reopen the record to verify persistence. Repeated analysis must not charge again.
11. Record individual/pair decisions; confirm then resolve a finding. Finalize only
    after all findings have decisions. Reopen audit history and original analyzed images.
12. Verify high-severity alerts with the deterministic mocked test first. A genuine
    eligible live high result should produce an **unverified** in-app notification;
    Mark read and Open inspection must work for current authorized managers only.
13. For confirmed findings, exercise the existing tenant maintenance-draft and
    landlord-link/status flow. Replaced/superseded evidence and prior decisions remain.

Test session expiry, failed upload, app interruption, image retrieval failure, expired
tenant membership and removed manager membership using isolated development records.
Do not mutate shared assignments or real tenant evidence to demonstrate edge cases.

## Issue recommendations and PR readiness

Reviewed the actual issue acceptance text for #9, #10, #11, #12, #13, #14, #47, #51,
#52. Recommend **In review**, with these explicit remaining gates:

| Issues | Implementation ready for review | Still needed before Done |
| --- | --- | --- |
| #9, #10, #47 | Guided instructions, actual capture/retake/storage, permissions and landlord baselines | Real camera/gallery/private-delivery device acceptance and integration |
| #11, #12, #51 | Stored secure pair comparison, validated classification/severity and fallback | Approved live-provider smoke and representative real-model evaluation |
| #13, #52 | Persisted individual/pair confirm/dismiss/manual/resolve, audits and finalization | Teammate review and manual integrated acceptance |
| #14 | Persisted deduplicated authorized unverified high-severity alert and navigation | Genuine provider-result acceptance in development |

Prepared PR text: [SPRINT3_PR_DESCRIPTION.md](SPRINT3_PR_DESCRIPTION.md). Suitable for
teammate review with disclosed external gates; **not a claim that all Sprint 3 live
acceptance criteria have passed**. No issue was closed or PR merged.

AI assistance: Codex assisted with implementation, test additions, review and this
report. Tests use synthetic/mocked provider outputs; application flows use persisted
records and never manufacture successful provider findings.
