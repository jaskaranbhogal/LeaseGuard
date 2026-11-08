# Sprint 2 — CI/CD Pipeline (Module 9)

This document describes the current **pre-deployment** workflow. It is not evidence that the Django API has been deployed to Render.

## Four required pipeline stages

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

| Stage | What it does | Current status |
| --- | --- | --- |
| **Setup** | Checks out the repository and configures Python 3.12 and Node.js 22. | Implemented |
| **Dependencies** | Installs the backend and frontend dependencies and populates package caches. | Implemented |
| **Test** | After the existing **Django Checks** and **React Native Checks** succeed, runs Django's test suite against an isolated MongoDB replica set and frontend Jest. | Implemented; uses a disposable local database, not Atlas |
| **Deploy** | Packages a versioned backend release candidate and uploads a GitHub Actions artifact. On a tested `main` push, can additionally trigger and verify a Render deployment once configured. | **Artifact-only; not a live deployment** until Render is configured |

The workflow runs on every branch push, pull requests to `main`, and manually. Only a successful `main` push can trigger the live Render deployment. Do not add real Atlas credentials to a PR workflow; untrusted PR code must not receive production secrets.

The pipeline preserves the existing `Django Checks` and `React Native Checks` job names used in the `main` ruleset. Once the new `Test` job has run and passed, add `Test` to the required status checks in the existing **Protect main** ruleset.

The existing [`mobile-build.yml`](../.github/workflows/mobile-build.yml) still performs native iOS and Android build checks.

**Important:** Each job has a separate GitHub Actions runner. Dependencies are installed again in the check and test jobs using the package caches. A successful **Deploy** job that says “artifact only” means a release candidate was packaged, **not** that the live mobile app or Django API has been deployed. Never use that job alone as proof of a completed production deployment.

## MongoDB test configuration

The **Django Checks** and **Test** jobs each start a fresh MongoDB 8.0 container configured as a single-node replica set. Each job sets `MONGODB_URI` to that local container and `MONGODB_DB_NAME` to `leaseguard_ci`; Django's test runner uses its separate `test_leaseguard_ci` database. This supports transaction-based registration tests and prevents CI from accessing a shared Atlas cluster. No Atlas credentials are needed in GitHub Actions.

The Django migration branch is available in PR #63. Until it is merged, `main` still uses its SQLite configuration; after integration, the same checks and test job exercise the MongoDB backend. Keep the Android/iOS build checks and existing protected status check names while migrating.

## Activating a real Render deployment

The Django backend (not the React Native iOS app) can later be hosted on Render while Django connects securely to MongoDB Atlas.

1. Create a Render Web Service connected to `main`. Configure its Python build/start/migration commands, HTTPS health-check endpoint, and production Django settings. Disable Render automatic deploys if GitHub Actions is to be the deployment gate.
2. In Render's environment settings, set `MONGODB_URI`, `MONGODB_DB_NAME`, `DJANGO_SECRET_KEY`, production allowed hosts and other required secrets. Do not place a real MongoDB connection string in GitHub workflow YAML, app code, or React Native.
3. In GitHub > Settings > Secrets and variables > Actions, set the repository **secrets**:
   - `RENDER_DEPLOY_HOOK_URL` — private Render deploy hook URL.
   - `RENDER_API_KEY` — private Render API key for checking the deployed commit and status.
4. Set the repository **variables**:
   - `RENDER_SERVICE_ID` — Render Web Service ID (e.g. `srv-...`).
   - `RENDER_HEALTHCHECK_URL` — public HTTPS URL returning success only when the API is healthy.
5. Merge a PR with a teammate approval and all required checks green.
6. On the `main` push, Deploy triggers Render for the exact tested Git SHA, polls Render for `live`, verifies that the deployed SHA matches, and checks the HTTPS health URL.
7. Inspect the Render service logs and verify an actual API request and MongoDB connection from the deployed service. A successful deploy-hook HTTP response alone is **not** proof of deployment.

If `RENDER_DEPLOY_HOOK_URL` is absent, Deploy deliberately records **“artifact only (NOT a live deployment)”**. This is a **temporary placeholder** suitable for pipeline development, but it does not by itself satisfy the assignment's deployed-app sanity check.

## Branch protection

Keep **Protect main** active: block direct pushes, require a pull request and at least one approval, and require green checks. Add the `Test` job as a required status check only after GitHub reports that check at least once. Keep the existing checks required until replacements are verified.

## Assignment evidence and video

When recording the three-minute video, show the user story issue, feature/merge PR, teammate approval, green **Test** job, and (once connected) the verified live **Deploy** job and running API URL. Do **not** label a placeholder artifact upload as a completed Django deployment. Record a new commit and green run with the MongoDB-based tests if those changes are required to demonstrate the final application.

## AI-use statement (to complete truthfully)

Describe which tasks you asked AI to assist with (for example, drafting pipeline stages or documentation), which generated configurations you checked, and **any actual errors you found and fixed**. Do not claim a specific error was discovered or corrected unless that happened.
