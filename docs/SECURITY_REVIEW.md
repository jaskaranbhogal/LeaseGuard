> **Current audit update, 18 November 2026:** npm audit now reports **0 vulnerabilities**;
> the historical picomatch counts below describe the earlier review. Current tests,
> provider boundaries and Python audit result are recorded in
> [Sprint 3 finalization report](SPRINT3_FINALIZATION_REPORT.md).

# Maintenance security review — 2026-11-18

This review covers the maintenance feature and its integration with the existing
session, MongoDB, private Cloudinary and Gemini implementation. It is a targeted
code/configuration review and automated dependency audit, not a penetration test
or a guarantee that the repository has no security risks.

## Findings fixed

- A delayed upload completion could restore a removed photo after its lease had
  expired. Completion now requires both the matching token and an actively
  uploading state. A regression test confirms removed evidence stays removed.
- Maintenance endpoints had bounded payloads/ledgers but lacked request throttling.
  Shared MongoDB minute buckets now allow 120 reads and 60 writes per account per
  minute, with a 1,200-request global minute ceiling. Counters use atomic updates;
  storage failures fail closed. A 429 includes Retry-After: 60. Only counter records
  have a five-minute TTL; photo/evidence records never use TTL expiration.
- Landlord visibility now explicitly allows submitted/review/in-progress/resolved
  states instead of accepting any status other than draft. Unknown/internal states
  remain private.
- Updated vulnerable Python pins: Pillow 12.3.0 → 13.0.0, Django REST Framework
  3.16.1 → 3.18.2, and sqlparse 0.5.5 → 0.6.0. The post-update pip-audit reports
  **no known vulnerabilities** in resolved requirements; pip check passes.
- Applied compatible frontend lockfile updates with npm audit fix --ignore-scripts.
  No force option, framework downgrade or arbitrary install script execution was used.

Upstream release references: [Pillow 13.0.0](https://pillow.readthedocs.io/en/stable/releasenotes/13.0.0.html),
[DRF release notes](https://www.django-rest-framework.org/community/release-notes/).

## Confirmed controls

- Session authentication and CSRF remain required; tenant identity and actor IDs
  come from the authenticated session. No public API creates housing assignments.
- Verified active tenant/unit assignment and explicit landlord/property-manager
  membership scope each request and photo. Same-unit tenants cannot access one
  another's requests. Creator-only drafts are hidden from landlords.
- Server-side JPEG/PNG signature, byte/pixel validation and EXIF normalization;
  streaming upload limits, bounded embedded ledgers, safe identifiers and history
  pagination limit resource consumption. MongoDB revision checks atomically enforce
  counts, immutability, submission and history. Uploads do not call Gemini.
- Private provider references are server-generated and never serialized to clients.
  Downloads remain bounded, use a fixed HTTPS provider origin, and disable redirects
  and ambient proxies. Clients receive private/no-store JPEG bytes.
- For an existing live maintenance asset, authenticated backend retrieval succeeded;
  unsigned original and transformed Cloudinary requests both returned **401**.
  No signed URLs, credentials or image contents were printed. This is a delivery
  spot-check, not an audit of every Cloudinary account setting.
- Removed/failed intents remain discoverable. Cleanup freezes expired media,
  verifies local deadlines and actual provider creation age, checkpoints confirmed
  deletion and preserves references for retry. No live deletion was performed.
- Existing Gemini behavior, schemas and 3/account/day plus 30/global/day limits are
  preserved. The maintenance path has no paid execution route. Evaluations used
  mocked replay only.
- Source scanning compared files against configured secret values without printing
  them and checked common private-key/token patterns. No matches were found.
  Private .env and local signing keys are ignored. Temporary files, database data,
  node_modules, virtual environments and user-specific Xcode edits are excluded
  from the commits. The target remote is the existing LeaseGuard repository.

## Remaining dependency finding

npm audit still exits nonzero with **67 high-severity package entries**, all
inheriting the same underlying [picomatch ReDoS advisory
GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
The registry's current picomatch version is 4.0.7; the advisory lists no patched
release. These are not 67 independent flaws. Forcing npm's suggested React Native,
CLI or Jest downgrades is not a verified security fix and would risk the working
mobile stack, so no such downgrade or unverified override was applied.

The reported attack requires attacker-controlled glob patterns. The added app and
Django maintenance code do not accept or evaluate glob patterns; picomatch is in
the Node development/build toolchain. This limits the identified exposure but does
not eliminate the advisory. Keep Metro/build tooling on trusted development hosts,
avoid untrusted project/glob inputs, and update/re-audit when an upstream fix ships.
This branch is suitable for review with that finding disclosed; this review does
not certify a production deployment as risk-free.

## Validation

- Full Django suite: **90 passed** on a disposable local MongoDB 8.0 replica set,
  never shared Atlas. All provider calls in the suite were mocked.
- Frontend: **91 Jest tests passed**; TypeScript passed; lint passed with only five
  pre-existing no-void warnings in LiveComparisonPanel.tsx.
- Django system check and migration consistency check passed.
- AI replay: **19 cases passed**, zero provider calls.
- Python requirement audit: no known vulnerabilities; pip check passed.
- npm audit: remaining unpatched picomatch finding described above.
- Updated-dependency Debug iOS simulator build: **BUILD SUCCEEDED**.
- Diff whitespace and staged-content credential checks passed.

## Operational limits

The current loopback development server intentionally uses DEBUG and HTTP. Public
production operation still requires DEBUG=false, private production secrets,
HTTPS/TLS, secure host/proxy settings, ingress body/concurrency limits, trusted
housing verification, scheduled retention cleanup, and database/provider access
controls and backups. Application quotas do not replace ingress protection for
unauthenticated traffic. No production deployment or configuration changes are part
of this push. Dependency/advisory databases and provider settings can change;
re-run audits before any release.


## Baseline/finding security extension

Dedicated manager-only baseline endpoints preserve tenant-only capture authorization.
Unit scoping, confirmed private uploads, revision CAS, deterministic draft identity,
explicit expected-head supersession and immutable snapshots are integration-tested.
Active/historical guided assets remain indefinitely retained. Interrupted publication
is recoverable without creating duplicate versions or silently replacing another head.

Adversarial tests reject extra model fields that attempt to set human decisions,
ownership or maintenance actions. Room/notes and photographed instructions remain
untrusted; the versioned prompt cautions against them. The added photographed-text
fixture is replayed, not a validated real-model injection defense. The model has no
tools or write authority, and only authenticated human endpoints change decisions.
Individual findings retain independent decisions and indexed audit events.

Actual parallel tests exercise account/global quota contention and one provider call
for a contested pair. SDK transport explicitly allows one attempt with a 20-second
timeout. Private retrieval failure stores an empty manual fallback before any budget
reservation. Completed results retain their exact original evidence after supersession.
High-severity alerts are unverified, deduplicated, manager-scoped and suppressed on
unavailable or low-confidence results. Notification opening revalidates record access.
No branch protections, provider secrets, billing, remote assignments or assets changed.
