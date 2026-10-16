# Tenant flow integration

All integration work is on `merge/tenantflow-jaskaran`. The branch started at `origin/main` (`255835a`) and merged `origin/feature/tenant-flow` (`6759532`) with a normal merge commit. This includes Dev’s PR #26 work and the later reusable back button commit. PR #26 was already closed and unmerged when inspected; its status and target were not changed. Neither local nor remote `main` was modified.

## Authentication contract

Django’s built-in User, password hashing, email normalization, session cookies, CSRF handshake, password-reset queue, password validation, and existing rate limits remain in use. No role is inferred from staff/superuser privileges.

`POST /api/auth/register/` requires:

```json
{
  "name": "Example Resident",
  "email": "resident@example.com",
  "password": "your-password",
  "confirmPassword": "your-password",
  "role": "tenant"
}
```

`role` must be exactly `tenant` or `landlord`. Missing/invalid roles receive HTTP 400. Registration creates both User and AccountProfile atomically, returns HTTP 201 with `{ "user": { "id", "email", "name", "role" } }`, and does not sign the user in. The existing success screen sends them back to Login.

Login accepts email/password and returns the saved role. Caller-supplied login roles are ignored. `GET /api/auth/session/` returns the same user payload for an authenticated session and HTTP 401 otherwise. Responses are marked non-cacheable. Logout remains a CSRF-protected POST that invalidates the Django session.

### Migration and legacy accounts

Apply the additive migration before starting the updated app:

```sh
python manage.py migrate
```

`accounts/0002_accountprofile_accountprofile_valid_account_role.py` adds a one-to-one AccountProfile with a database check constraint allowing only the two supported roles. Existing migrations and User records are preserved. Existing accounts have `role: null` until explicitly assigned; no data migration guesses a role.

After confirming an existing user’s intended account type, an authorized project administrator can assign it through the Django shell:

```python
from django.contrib.auth import get_user_model
from accounts.models import AccountProfile
user = get_user_model().objects.get(pk=CONFIRMED_USER_ID)
AccountProfile.objects.update_or_create(
    user=user, defaults={"role": AccountProfile.Role.TENANT}
)
```

Use `Role.LANDLORD` only when that is the confirmed account type. Account type does not establish property ownership, unit membership, or permission to read another user’s records. Future data endpoints must authorize those relationships independently.

### Frontend navigation

One NavigationContainer wraps RootNavigator inside AuthProvider. The original splash waits for its image/animation and the initial session check. The role from Django determines the mounted navigator: TenantNavigator, LandlordNavigator, or an unassigned-account screen. Switching authentication state unmounts the old stack, preventing back navigation into signed-out screens. No role or password is written to local storage.

A foreground check and an active-app check every 60 seconds revalidate the session while tenant data is still mocked. A blocking overlay preserves the mounted navigator and demo progress while checking or showing a network error. HTTP 401 clears the user; network errors allow retry or return to sign-in. A failed logout displays its error and does not claim the server session ended. A successful logout clears navigation and demo state. Platform cookie persistence determines whether a session survives a process restart; no separate token storage was added.

## Tenant prototype behavior

- Home greets the authenticated user. Property, dates, maintenance, and inspection records are prominently labeled sample data and do not imply a real property assignment.
- Home, Inspections, History, and Settings tabs work. Inspections opens the guided demo and availability; Settings provides logout. Dashboard quick actions open maintenance and availability. Existing custom tabs, notification bell, and layouts are retained.
- Guided inspection has four actual step records. An InspectionProvider above the tenant stack retains accepted-step progress across back navigation and tab changes. Each step previews a placeholder, supports retake, and advances once accepted. Completion removes the old review routes and explicitly says no photos were captured, analyzed, saved, or submitted and no landlord was notified. Progress is memory-only and resets on logout or app restart.
- Maintenance uses a shared typed request ID. Dashboard opens the sink record; history can open the separate window-latch record. Missing/unknown IDs show a safe not-found screen. Back returns to the source screen.
- Maintenance reporting retains required area/description validation. Media upload is unavailable; the action previews a demo form without sending an API request.
- Availability retains multi-select state and requires at least one slot. Preview does not send or persist selections. Historical sample dates are explicitly labeled.
- LandlordHome is an intentionally small coming-soon screen identifying the landlord account and providing logout. The landlord team can replace this screen inside LandlordNavigator.

## Native setup

React Native remains 0.87.1 and SVG remains locked to 15.15.5. The [SVG compatibility table](https://github.com/software-mansion/react-native-svg#supported-react-native-versions) supports React Native >=0.78 for SVG >=15.13. Android CLI configuration detects SvgPackage and Fabric descriptors; CocoaPods detects and generates rnsvg code.

Dev’s committed Gemfile.lock records Ruby 2.6.10p210 / Bundler 1.17.2, matching the installed Ruby. `frontend/.ruby-version` now explicitly selects 2.6.10. No guessed Ruby upgrade or CocoaPods version change was made. Keep the existing Gemfile exclusions and bundled CocoaPods 1.15.2.

The SVG filter resource bundle uses `min_ios_version_supported` (15.1 in RN 0.87.1), matching the app rather than hardcoding 15.0. Podfile.lock was regenerated by the existing bundled tooling; pod versions are unchanged, while local podspec checksums reflect regeneration. Existing SceneDelegate, Info.plist, AppDelegate, and Xcode Node setup are preserved. The Android Gradle wrapper executable bit was repaired.

## Verification

- `npm ci`: passed with the existing lockfile; npm reported 54 dependency audit findings (5 moderate, 49 high). No broad or breaking dependency upgrades were applied.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with no warnings.
- `npm test -- --ci --runInBand`: 40 tests passed across four suites.
- `python manage.py check`: passed.
- `python manage.py makemigrations --check --dry-run`: no changes detected.
- `python manage.py test`: 24 tests passed. Local commands used `venv/bin/python` (Python 3.9.6, Django 4.2.30); CI retains Python 3.12.
- `python manage.py migrate --noinput`: all migrations applied successfully to an isolated temporary SQLite database. The user’s normal `db.sqlite3` was not modified; run migrate before normal local use.
- `bundle check` and `bundle exec pod install`: passed.
- Clean iOS Simulator build: passed with Xcode 27.0 (27A266a), targeting iPhone 18 Pro / iOS 27.0, using `xcodebuild -workspace frontend.xcworkspace -scheme frontend -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,id=CDFA8479-56AC-4CDE-A922-043DB609972C' -derivedDataPath /tmp/leaseguard-ios-build clean build CODE_SIGNING_ALLOWED=NO`. An earlier build overlapped generated-header refresh and failed; the clean build after CocoaPods completed passed.
- iOS runtime smoke test: app installed/launched; splash, login, role-selector styling and checked accessibility state visually inspected; disposable tenant/landlord accounts registered through the real local API; tenant login, inspection step advancement and retained progress, tenant logout, landlord login/placeholder, cookie-session restoration after terminating/relaunching the app, and landlord logout verified. All accounts and sessions used the isolated database. Full four-step completion, maintenance ID routing, and expired-session handling are covered by automated tests; no physical-device or Release validation is claimed.
- Android `bash ./gradlew clean assembleDebug`: reached project configuration, then failed because no Android SDK is installed/configured (`SDK location not found`). No Android native build or emulator pass is claimed.

Frontend tests exercise the real navigation tree: role routing after login/restoration, logout and retries, expired sessions, network errors, retained demo progress, retakes, all four inspection steps, completion/back history, both maintenance records, invalid IDs, maintenance validation, and availability selection. Existing authentication assertions remain, adapted to the new dashboard behavior. Backend tests cover both roles, persistence, invalid/missing roles, database constraints, atomic rollback, legacy/staff accounts, session expiry, CSRF, and the existing password-reset behavior.

CI keeps both Django and React Native jobs and adds pushes to `merge/tenantflow-jaskaran` as a trigger, alongside main pushes and PRs into main.

## Remaining work

Property/unit assignments and backend authorization; actual inspection and maintenance APIs; camera/media storage; AI analysis; landlord feature screens; notifications; real SMTP delivery validation; Android SDK/emulator verification and physical-device/release validation remain outside this integration. This branch does not simulate successful production API submissions.

## Files changed from main

Includes Dev’s merged files and integration fixes:

```text
.github/workflows/ci.yml
README.md
accounts/migrations/0002_accountprofile_accountprofile_valid_account_role.py
accounts/models.py
accounts/tests.py
accounts/views.py
backend/urls.py
docs/AUTHENTICATION.md
docs/TENANT_INTEGRATION.md
frontend/.ruby-version
frontend/App.tsx
frontend/__tests__/App.test.tsx
frontend/__tests__/AuthFlow.test.tsx
frontend/__tests__/TenantFlow.test.tsx
frontend/__tests__/authService.test.ts
frontend/android/gradlew
frontend/ios/Podfile
frontend/ios/Podfile.lock
frontend/package-lock.json
frontend/package.json
frontend/src/components/AccountScreen.tsx
frontend/src/components/BackButton.tsx
frontend/src/components/BottomNavigation.tsx
frontend/src/components/DemoNotice.tsx
frontend/src/components/NotificationBell.tsx
frontend/src/context/AuthContext.tsx
frontend/src/context/InspectionContext.tsx
frontend/src/data/guidedInspectionMockData.ts
frontend/src/data/inspectionAvailabilityMockData.ts
frontend/src/data/maintenanceDetailMockData.ts
frontend/src/data/reportMaintenanceMockData.ts
frontend/src/data/reviewInspectionPhotoMockData.ts
frontend/src/data/tenantMockData.ts
frontend/src/data/unitHistoryMockData.ts
frontend/src/navigation/AuthNavigator.tsx
frontend/src/navigation/LandlordNavigator.tsx
frontend/src/navigation/RootNavigator.tsx
frontend/src/navigation/TenantNavigator.tsx
frontend/src/navigation/TenantTabs.tsx
frontend/src/navigation/types.ts
frontend/src/screens/auth/LoadingScreen.tsx
frontend/src/screens/auth/LoginScreen.tsx
frontend/src/screens/auth/RegisterScreen.tsx
frontend/src/screens/tenant/GuidedInspectionScreen.tsx
frontend/src/screens/tenant/InspectionAvailabilityScreen.tsx
frontend/src/screens/tenant/InspectionSubmittedScreen.tsx
frontend/src/screens/tenant/MaintenanceDetailScreen.tsx
frontend/src/screens/tenant/ReportMaintenanceScreen.tsx
frontend/src/screens/tenant/ReviewInspectionPhotoScreen.tsx
frontend/src/screens/tenant/TenantDashboardScreen.tsx
frontend/src/screens/tenant/UnitHistoryScreen.tsx
frontend/src/services/api.ts
frontend/src/services/authService.ts
frontend/src/types/maintenance.ts
frontend/src/types/user.ts
```
