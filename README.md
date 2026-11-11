# LeaseGuard

**Software Engineering Capstone — Group 4, Farmingdale State College**

[![LeaseGuard CI](https://github.com/jaskaranbhogal/LeaseGuard/actions/workflows/ci.yml/badge.svg)](https://github.com/jaskaranbhogal/LeaseGuard/actions/workflows/ci.yml)

LeaseGuard is a React Native mobile app for landlords and tenants to document rental-property conditions, manage inspections, and report maintenance issues. The goal is to establish a move-in photo baseline and eventually use AI-assisted comparisons to flag potential changes for landlord review.

## Project Links

- [Figma prototype](https://www.figma.com/design/28N5do1M7uUQwJWH3uKGSb/LeaseGuard-%E2%80%93-Sprint-Prototype) — landlord/tenant personas, context diagram, screens, and workflows
- [GitHub project board](https://github.com/users/jaskaranbhogal/projects/1/views/1) — backlog, sprint tasks, and progress
- [User stories and acceptance criteria](USER_STORIES.md)
- [GitHub Actions](https://github.com/jaskaranbhogal/LeaseGuard/actions)

## Features and Current Progress

**Implemented:**
- Registration, login, logout, password reset, and tenant/landlord account roles.
- Role-specific navigation and landlord/tenant dashboard **prototypes**.
- Prototype inspection, maintenance, notifications, settings, and history screens.
- Django backend with MongoDB configuration and automated authentication tests.
- GitHub Actions workflows, pull-request reviews, and branch protection.

**In progress / planned:**
- Connect dashboard, property, inspection, and maintenance screens to persistent backend data.
- Verify the team's MongoDB Atlas connection.
- Add inspection image storage, AI-assisted photo comparison, and notification delivery.
- Complete end-to-end testing and production deployment.

**Status note:** Most dashboard/inspection/maintenance content is currently sample data. AI photo analysis and live deployment are not complete.

## Tech Stack and Architecture

- **Mobile:** React Native, TypeScript (iOS and Android)
- **Backend:** Python 3.12, Django 5.2
- **Database:** MongoDB through Django MongoDB Backend; Atlas connection pending verification
- **Testing and CI:** Jest, Django tests, TypeScript, ESLint, GitHub Actions
- **Design and planning:** Figma, GitHub Projects

```text
Landlord / Tenant
       |
React Native mobile app
       |
   Django API
       |
    MongoDB

Planned: image storage + AI inspection analysis
```

The mobile app communicates with Django, which handles authentication and database access. AI findings will be suggestions for landlord review, not automatic damage decisions.

## Run Locally

**Prerequisites:** Python 3.12, Node.js 22+, a MongoDB connection, and Xcode (iOS) or Android Studio (Android). This project uses React Native CLI, not Expo.

**Backend (repository root):**

```bash
git clone https://github.com/jaskaranbhogal/LeaseGuard.git
cd LeaseGuard
python3 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` to provide `MONGODB_URI` and `MONGODB_DB_NAME` (and other settings if needed). Django reads exported environment variables, **not** `.env` automatically.

```bash
set -a
source .env
set +a
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

For local password-reset testing, run `python manage.py send_password_resets` in another configured terminal; development links print to the console. **Never commit secrets, credentials, or a real MongoDB URI.**

**Mobile app (new terminal):**

```bash
cd frontend
npm ci
npm start
```

In another terminal from `frontend/`, run `npm run ios` or `npm run android`. For iOS CocoaPods setup and platform requirements, see [frontend/README.md](frontend/README.md). For authentication configuration, see [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).

## Testing

- **Frontend:** From `frontend/`, run `npm test -- --ci --runInBand`, `npx tsc --noEmit`, and `npm run lint`.
- **Backend:** From the repository root, run `python manage.py check` and `python manage.py test` using an **isolated local MongoDB replica set** (not a shared Atlas database).
- **Manual:** Verify registration, role-based sign-in, dashboard navigation, password reset, and logout in a simulator.

CI runs the automated checks using a temporary MongoDB replica set. Native iOS and Android build checks run in [mobile-build.yml](.github/workflows/mobile-build.yml).

## Sprint 2: CI/CD and GitHub Workflow

The [main CI/CD workflow](.github/workflows/ci.yml) follows the required **Setup → Dependencies → Test → Deploy** stages, with separate Django and React Native checks. The `main` branch requires a pull request, a teammate approval, and passing required checks.

**Deploy currently packages a release artifact; it is not a verified live Render deployment.** MongoDB Atlas production connectivity also remains unverified.

See the [Sprint 2 CI/CD assignment guide](docs/SPRINT2_CICD.md) for stage details, evidence, ruleset, deployment requirements, and AI-assistance disclosure.

## Team

**Group 4:** Jaskaran Bhogal, Jonathan Peves, Matthew Motieram, and Dev Mondal.

The team uses GitHub Issues/Projects for user stories and tasks, feature branches and pull requests for changes, and GitHub Actions for automated checks.
