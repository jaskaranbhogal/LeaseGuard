# Sprint 3 — Gemini, evaluation and fallback

Django's existing `inspections/services.py` compares an approved unit baseline and
current guided inspection image. Landlords explicitly choose Analyze with Gemini.
The standalone comparison API remains available. Both APIs share durable MongoDB
budget reservations: **3/account and 30 globally per UTC day**. Upload/capture does
not invoke AI. Guided comparisons resolve trusted private Cloudinary references;
client baseline URLs are not accepted. Content-derived claims, revision checks and
pending-result recovery prevent concurrent/repeated paid calls.

## Configuration and validated output

Install `requirements.txt`; Django loads `.env` using python-dotenv, with exported
process values taking precedence, even if blank. Credentials remain backend-only.
A new local settings process read a configured key without printing it. Model remains
`gemini-3.5-flash-lite`; installed SDK is `google-genai 3.1.0`. Google's
[supported model listing](https://firebase.google.com/docs/ai-logic/models) and
[model card](https://deepmind.google/models/model-cards/gemini-3-5-flash-lite/)
were checked; actual project entitlement/provider behavior is pending a live call.
Existing running servers must restart after the dependency/settings update.

The versioned `image_comparison_v1.txt` system prompt distinguishes normal wear and
possible damage, checks photo quality/same-area first, and treats notes, room names
and image text as untrusted. Strict Pydantic schemas reject extra fields and
contradictory change/classification/severity/quality data. Results include quality,
same-area, visible changes, classification, severity, confidence, findings and summary.
No result changes human decisions, permissions or maintenance automatically.

The service makes one request with a 20-second SDK timeout and explicitly sets
`HttpRetryOptions(attempts=1)`. Configuration errors, unavailable provider, timeouts,
invalid JSON/schema and exhausted budgets produce empty, non-accusatory manual-review
results. Private-image retrieval failures persist an unavailable result without an AI
call or budget reservation. Pending/interrupted paid attempts are never automatically
retried. Stored analyses pin exact evidence/model/prompt identities.

## Golden dataset and metrics

All **20 existing synthetic cases** were preserved. The added photographed instruction
case brings the exact total to **21**. Fixtures include identical/no-change, wear,
new damage, unchanged existing damage, severe damage, wrong area, dark/blurry photos,
perspective/lighting differences, obstruction, untrusted notes and image-text injection.
API/integration tests separately cover missing/incompatible baselines, missing uploads,
invalid output, provider timeout/configuration, quotas, duplicate/concurrent attempts,
interrupted calls and retrieval failure. They do not invent expected damage on failure.

| Metric | Definition | Required threshold | Current deterministic replay |
| --- | --- | --- | --- |
| Hallucination rate | Damage asserted on non-damage golden cases | 0.0 maximum | 0.0 |
| Consistency | Agreement of important fields across two outputs per case | 0.95 minimum | 1.0 |
| Expected match | Classification, quality, severity and same-area match labels | 0.80 minimum | 1.0 |

`python manage.py run_ai_evals` injects mocked fixture outputs through the real SDK
response parser/schema and runs each case twice. **Zero provider calls**; 21 cases
pass. This establishes deterministic schema/pipeline behavior. It does **not** measure
Gemini accuracy, model drift or successful resistance to image/text prompt injection.
Tests deliberately degrade hallucination/consistency metrics and ensure Eval fails.

## Live evaluations and approval

No live provider request was made. Two synthetic fixtures are prepared locally at
`/tmp/leaseguard-gemini-smoke/baseline.png` and `current.png`. Request explicit cost
approval for **one** smoke comparison before any live testing. Verify the result,
schema, persistence and a local budget reservation; report failure honestly. This is
separate from the full stored-evidence/device acceptance scenario.

The existing trusted/main-only `AI Live Evaluation` workflow stays manually dispatched.
It now requires comma-separated explicit case IDs. `run_ai_evals --live --case=<id>`
accepts a selected subset of 15–20 known cases, repeated twice, under the existing hard
40-call ceiling. Running all 21 live is rejected **before any provider request**;
the limit was not increased. This separate diagnostic evaluator bypasses application
API quotas and is not a substitute for testing those APIs. Never run it without
separate explicit approval of the selected workload/cost. Ordinary PR checks use
replay and receive no provider secrets.

## Human review and notifications

Inspection review displays saved side-by-side evidence, validated results, severity,
confidence and finding descriptions. Individual/pair decisions support confirmed,
dismissed, manual-review and resolved; resolution requires prior confirmation.
Finalization requires each finding to be decided, and audits persist indexed changes.
Mixed individual decisions are retained without assigning a false pair-level label.
Maintenance actions still require authenticated human/tenant workflows.

Completed high-severity damage with good same-area evidence and medium/high confidence
creates deduplicated in-app **unverified AI finding** alerts for current authorized
property managers. Unavailable/uncertain results do not create damage alerts. The
existing Notifications screen supports read status and opening the authorized record.

## CI, security and remaining gates

Setup → Dependencies → Django/React Native checks → Test → Eval → Deploy remains
intact. Deploy needs both Test and Eval and performs a live deployment only on a main
push; this feature-branch work does not deploy. Branch required-status enforcement is
a separate repository setting: the effective main rules API verified **Eval**,
**Test**, **Django Checks** and **React Native Checks** are required in ruleset
24912861, with one approving review and strict up-to-date checks. No rule was changed. Post-push Actions results must be distinguished from
local test results.

Prompt instructions are an imperfect defense. Tenant notes and photographed text
can still influence model content despite strict schema validation; representative,
consented real-image/adversarial evaluations and ongoing human review remain required.
Application authorization and mutation boundaries, rather than model obedience,
prevent provider output from taking actions.

See [full test results, security audit, provider status, API contracts, iOS acceptance
steps and issue traceability](SPRINT3_FINALIZATION_REPORT.md). Codex assisted with the
implementation, tests and documentation; no real-model performance claim is based on
mocked results.


## Subsequent approved smoke attempt

After the initial offline verification, the user approved exactly one potentially
billable synthetic comparison. The single attempt returned the unavailable/manual
fallback and was persisted locally with a consumed shared budget reservation. No
second attempt was made; validated live output and actual billing remain unverified.
The running simulator backend has Gemini disabled to prevent further paid calls.
See the finalization report's follow-up section for details.
