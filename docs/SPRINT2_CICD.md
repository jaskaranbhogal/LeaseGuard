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

The pipeline preserves the `Django Checks` and `React Native Checks` job names used in the `main` ruleset. The **Protect main** ruleset has now been updated to require **Django Checks**, **React Native Checks**, and **Test**, plus at least one approving teammate review and an up-to-date branch.

The existing [`mobile-build.yml`](../.github/workflows/mobile-build.yml) still performs native iOS and Android build checks.

**Important:** Each job has a separate GitHub Actions runner. Dependencies are installed again in the check and test jobs using the package caches. A successful **Deploy** job that says “artifact only” means a release candidate was packaged, **not** that the live mobile app or Django API has been deployed. Never use that job alone as proof of a completed production deployment.

## MongoDB test configuration

The **Django Checks** and **Test** jobs run on Ubuntu 22.04 and each start a fresh MongoDB 8.0 container configured as a single-node replica set. MongoDB stops at startup on Linux kernels 6.19 through 7.0.13; Ubuntu 22.04 keeps these jobs on a compatible hosted-runner kernel. Each job sets `MONGODB_URI` to that local container and `MONGODB_DB_NAME` to `leaseguard_ci`; Django's test runner uses its separate `test_leaseguard_ci` database. This supports transaction-based registration tests and prevents CI from accessing a shared Atlas cluster. No Atlas credentials are needed in GitHub Actions.

The MongoDB backend migration is merged into `main` in [PR #63](https://github.com/jaskaranbhogal/LeaseGuard/pull/63), and the four-stage CI/CD workflow was merged in [PR #62](https://github.com/jaskaranbhogal/LeaseGuard/pull/62). The [post-merge run](https://github.com/jaskaranbhogal/LeaseGuard/actions/runs/42539454212) passed all six jobs against the MongoDB-backed application. [Native iOS and Android build checks](https://github.com/jaskaranbhogal/LeaseGuard/actions/runs/42539454206) also passed. Real Atlas connectivity is separate and still requires verification.

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

The active [Protect main ruleset](https://github.com/jaskaranbhogal/LeaseGuard/rules/24912861) protects the default branch with pull-request review, **one approving teammate review**, **up-to-date branch requirement**, and green **Django Checks**, **React Native Checks**, and **Test** jobs. Do not remove these protections when preparing future PRs.

## Assignment evidence and video

For the three-minute project video, show the GitHub Projects board, completed development-task issues [#64](https://github.com/jaskaranbhogal/LeaseGuard/issues/64) and [#65](https://github.com/jaskaranbhogal/LeaseGuard/issues/65), merged PRs, ruleset, the successful **Test** job, and the **Deploy** artifact-upload evidence. Eleven development tasks are completed; the larger original application user stories remain open until full end-to-end acceptance criteria pass. If actual live deployment is a grading requirement, provide a separate verified hosted API URL and health check. **Do not** describe the artifact upload as a completed Django deployment.

## AI assistance and verification

AI tools assisted with planning/refining parts of the CI/CD workflow and documentation. The team reviewed proposed changes, tested them through CI and PR review, and addressed MongoDB CI startup issues with clearer failure logs and compatible Ubuntu 22.04 runners in PR #62. See the README's AI-assisted development and verification section. Additional individual uses of AI should be disclosed accurately by the relevant team members; do not invent unverified activities.
