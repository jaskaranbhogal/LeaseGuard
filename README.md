# LeaseGuard

**Software Engineering Capstone | Group 4 | Farmingdale State College**

[![LeaseGuard CI](https://github.com/jaskaranbhogal/LeaseGuard/actions/workflows/ci.yml/badge.svg)](https://github.com/jaskaranbhogal/LeaseGuard/actions/workflows/ci.yml)

LeaseGuard is a mobile application that helps landlords and tenants document rental-property conditions, complete inspections, and track maintenance issues. It aims to establish a consistent move-in baseline and use future AI-assisted photo comparisons to flag potential changes **for landlord review**, not make automatic damage decisions.

**Project links:** [Figma prototype](https://www.figma.com/design/28N5do1M7uUQwJWH3uKGSb/LeaseGuard-%E2%80%93-Sprint-Prototype) · [GitHub Kanban board](https://github.com/users/jaskaranbhogal/projects/1/views/1) · [User stories and acceptance criteria](USER_STORIES.md) · [GitHub Actions](https://github.com/jaskaranbhogal/LeaseGuard/actions)

## Guided photo inspections

Verified landlords can create and resume private move-in baselines for individual
units without a tenant, and assign customizable move-in, periodic, move-out and follow-up
inspections. Tenants capture/review real photos, resume saved drafts and submit through
Django. Landlords approve immutable unit baselines, explicitly request Gemini analysis,
record individual finding decisions (including resolution), receive unverified
high-severity alerts, and link maintenance follow-ups. Images stay in authenticated
Cloudinary storage; MongoDB persists the workflow and in-app notifications. Shared AI
limits remain 3/account/day and 30 globally/day.

See [architecture, API, retention, local setup and demonstration](docs/GUIDED_INSPECTIONS.md)
and the [Sprint 3 finalization report](docs/SPRINT3_FINALIZATION_REPORT.md).
Provider/dashboard and physical-device verification remain separate from local tests.
Property/unit setup, tenant invitations, durable consent, and in-person appointment availability now use canonical backend records. See [Jon integration report](docs/JON_INTEGRATION.md).

## Sprint 0 — Project Scope and Backlog

| Implemented / prototype | Planned or in progress |
| --- | --- |
| Registration, login, password reset, tenant/landlord roles | Property/unit management and tenant assignments |
| Role-specific dashboard and inspection UI **using sample data** | Persistent inspection, maintenance, and history records |
| Guided inspection, maintenance, history, notifications, and settings **prototypes** | Image storage, baseline comparisons, and AI-assisted damage findings |
| Django authentication backed by MongoDB, automated tests, and CI | Verify live MongoDB Atlas connection and production deployment |

**Original Sprint 0 scope:** Screens for properties, inspections, maintenance, and history were prototypes; completing a screen does not complete its full user story. Details and priorities are tracked on the [project board](https://github.com/users/jaskaranbhogal/projects/1/views/1). The initial backlog and acceptance criteria are in [USER_STORIES.md](USER_STORIES.md).

## Sprint 3 — Maintenance workflow

Tenants with verified unit assignments can save drafts, review camera/gallery
photos individually, submit **5–20** private photos, and retrieve real maintenance
history. Authorized property managers can view requests/photos and advance status.
MongoDB persists housing relationships, drafts, photo references and review history;
Cloudinary stores authenticated images with at least 90-day retention. Maintenance
does not call Gemini; guided inspections now provide approved unit baselines and explicit comparisons.

Run `python manage.py migrate` on your development database and provision verified
relationships using the operator-only `assign_maintenance_unit` command. See
[maintenance API, setup, recovery and iOS testing](docs/SPRINT3_MAINTENANCE.md) and
[Cloudinary retention](docs/CLOUDINARY_STORAGE.md). Settings preferences and unsupported profile actions remain explicitly labeled prototypes. Live upload/private-delivery spot checks passed; physical-device validation remains
required. See the [security review and remaining dependency advisory](docs/SECURITY_REVIEW.md).

## Prototype (Sprint 1)

The [Figma prototype](https://www.figma.com/design/28N5do1M7uUQwJWH3uKGSb/LeaseGuard-%E2%80%93-Sprint-Prototype) includes **personas, a context diagram, UI designs, and UX workflows**, as required for the prototype assignment.

- **Landlord persona — Marcus Reed:** Manages multiple rental units and needs a way to schedule inspections, review condition changes, and track repairs remotely.
- **Tenant persona — Alyssa Patel:** Needs a clear way to document existing damage, submit inspection photos, and report maintenance concerns.
- **Context diagram:** Identifies tenants and landlords as users, plus planned AI analysis and notification services as external systems.
- **Interface designs:** Authentication, dashboards, property/unit management, inspections, photo review, maintenance, history, notifications, and settings.
- **Landlord workflow:** Sign in → select a property → schedule inspection → review submitted photos/findings → track maintenance and history.
- **Tenant workflow:** Sign in → start guided inspection → capture/review photos → report maintenance or availability → view history.

## Architecture (Sprint 1)

LeaseGuard uses a **client–server architecture**:

- **Frontend:** React Native and TypeScript for iOS/Android screens, navigation, forms, and HTTP/JSON requests.
- **Backend:** Python 3.12 and Django 5.2 for authentication, sessions, API logic, and data access.
- **Database:** MongoDB using the official Django MongoDB Backend. Automated CI tests use an isolated replica set; the team's hosted Atlas connection still needs verification.
- **Integrations:** Authenticated Cloudinary storage and explicit Gemini comparisons between approved baseline and later inspection images, with findings reviewed by landlords.

```mermaid
flowchart TD
    A[Landlord / Tenant] --> B[React Native App]
    B -->|HTTP / JSON| C[Django Backend]
    C --> D[(MongoDB)]
    C --> E[Private Photo Storage + Explicit AI Analysis]
    C --> F[Persisted In-app Notifications]
```

The React Native app never connects directly to MongoDB or stores database credentials. Tenant invitations use configured SMTP delivery; unavailable or failed delivery is reported explicitly. Invitation codes are never printed by the console email backend. Push notification delivery is not implemented.

## Getting Started

**Requirements:** Python 3.12, Node.js 22+, npm, a MongoDB replica set or Atlas URI, and Xcode/CocoaPods (iOS) or Android Studio (Android). LeaseGuard uses React Native CLI, not Expo.

**1. Backend — from the repository root (macOS/Linux):**

```bash
git clone https://github.com/jaskaranbhogal/LeaseGuard.git
cd LeaseGuard
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set `MONGODB_URI` and `MONGODB_DB_NAME` for an authorized development database in
the ignored `.env`. Django loads it automatically; exported settings take precedence.

```bash
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

**2. Frontend — in a new terminal:**

```bash
cd frontend
npm ci
npm start
```

In another terminal inside `frontend/`, use `npm run ios` or `npm run android`. For a new iOS environment, install CocoaPods from `frontend/` with `bundle install`, then `cd ios && bundle exec pod install` before launching. See [React Native setup](https://reactnative.dev/docs/set-up-your-environment) for platform requirements.

**Authentication:** Registration and login use Django sessions with CSRF protection. For local password-reset testing, run `python manage.py send_password_resets` in a separate configured backend terminal; console email mode does not send real messages. See [authentication details](docs/AUTHENTICATION.md) and [tenant/landlord integration](docs/TENANT_INTEGRATION.md).

**Security:** Never commit `.env`, secret keys, API credentials, or MongoDB connection strings.

## Test Plan (Sprint 1)

Testing covers individual components, connected workflows, manual mobile behavior, and automated CI.

| Test level | Example checks | Tools |
| --- | --- | --- |
| **Unit** | Registration validation, invalid credentials, UI behavior | Django tests; Jest |
| **Integration** | Register/login, persisted user role, sessions, logout, navigation | Django test client; frontend tests with mocked API |
| **System / manual** | Launch on simulator, choose tenant/landlord, navigate dashboards, test password reset and sign-out | Xcode iOS Simulator; Android emulator |
| **CI** | Django configuration/migrations/tests; TypeScript, lint, Jest; native builds in separate workflow | GitHub Actions |

**Run frontend checks** from `frontend/`:

```bash
npm test -- --ci --runInBand
npx tsc --noEmit
npm run lint
```

**Run backend checks** from the repository root with your virtual environment active:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Backend tests must use an **isolated local MongoDB replica set**, not a shared Atlas cluster: the Django test runner creates and removes a temporary test database. The CI workflow provisions its own disposable MongoDB instance automatically. See [CI configuration](.github/workflows/ci.yml).

## Sprint 2 — CI/CD, Reviews, and Branch Protection

The [main GitHub Actions workflow](.github/workflows/ci.yml) implements the required four stages:

| Stage | Purpose |
| --- | --- |
| **Setup** | Configure Python and Node.js |
| **Dependencies** | Install/cache backend and mobile dependencies |
| **Test** | Run Django and Jest tests after Django and React Native checks |
| **Deploy** | Package a versioned backend artifact; optionally deploy to Render after configuration |

**Deployment status:** The current Deploy job prepares an **artifact only**; it is **not proof of a live Render deployment**. Production Atlas connectivity remains unverified. The separate [mobile build workflow](.github/workflows/mobile-build.yml) checks iOS/Android builds.

**Team Git workflow:** Work is tracked as user stories/tasks on the [Kanban board](https://github.com/users/jaskaranbhogal/projects/1/views/1), implemented in feature branches, submitted as pull requests, and reviewed before merge. The active [`main` ruleset](https://github.com/jaskaranbhogal/LeaseGuard/rules/24912861) requires a teammate approval, up-to-date branches, and passing **Django Checks**, **React Native Checks**, and **Test** jobs.

**Assignment evidence:** [CI/CD PR #62](https://github.com/jaskaranbhogal/LeaseGuard/pull/62) · [MongoDB PR #63](https://github.com/jaskaranbhogal/LeaseGuard/pull/63) · [passing post-merge CI run](https://github.com/jaskaranbhogal/LeaseGuard/actions/runs/42539454212) · [completed task #64](https://github.com/jaskaranbhogal/LeaseGuard/issues/64) · [completed task #65](https://github.com/jaskaranbhogal/LeaseGuard/issues/65). The broader application user stories remain open until their acceptance criteria are met.

**AI assistance disclosure:** AI tools assisted with planning/refining parts of the CI/CD workflow and documentation. The team reviewed changes, verified GitHub Actions results, and resolved MongoDB CI issues. AI-assisted output was not treated as verified without testing and review.

For full pipeline stages, branch-protection settings, deployment setup, and assignment/video evidence, see [Sprint 2 CI/CD documentation](docs/SPRINT2_CICD.md).

## Team — Group 4

| Member | Main areas of contribution |
| --- | --- |
| Jaskaran Bhogal | Authentication, frontend/backend integration, CI |
| Jonathan Peves | Landlord interface and workflows |
| Matthew Motieram | Notifications, settings, and shared UI |
| Dev Mondal | Tenant workflows and media features |

All four members participate in planning, implementation, testing, and peer review.

## Sprint 3 — AI Image Comparison and Golden Evals

Guided and standalone comparisons share the existing Gemini service, versioned
prompt, strict structured schema, manual fallback and daily 3/account + 30/global
budgets. Stored findings remain advisory; landlords record individual or pair
confirmation, dismissal, manual review and resolution. Eligible high-severity results
create unverified in-app alerts. Provider keys remain backend-only.

`python manage.py run_ai_evals` replays **21 synthetic cases with zero provider calls**.
Thresholds are 0% hallucination, at least 95% consistency and 80% expected matching.
Replay does not measure model accuracy or prompt-injection resistance. Paid live
checks require explicit approval; the trusted manual suite accepts 15–20 selected
cases under its 40-call ceiling. Never start that suite as an ordinary PR test.

See [evaluation details](docs/SPRINT3_AI_EVAL.md) and [the finalization report](docs/SPRINT3_FINALIZATION_REPORT.md)
for executed tests, live-service/device gaps, security mitigations and AI assistance
disclosure. Keep the related issues open until review, integration and manual
acceptance are complete.

New inspection photos use backend-only **authenticated Cloudinary** storage;
MongoDB stores references, AI findings and review history. The existing owner-only
photo endpoint proxies private bytes. Both photos are retained for at least 90
days; cleanup is dry-run unless `--execute` is specified. Configure
`CLOUDINARY_URL` in the local Django process or hosting environment, separately
from GitHub Secrets. See [storage configuration, failure recovery, cleanup,
GridFS transition and manual verification](docs/CLOUDINARY_STORAGE.md).
