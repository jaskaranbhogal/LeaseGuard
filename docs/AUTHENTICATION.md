# Authentication development and verification

The original four authentication screens are implemented on `jaskaran`. Registration is now implemented as a follow-up change, described below. No dependencies were added or upgraded. Landlord, tenant, and notification screens remain unchanged. The original changes are organized into the seven commits listed below.

## iOS lifecycle fix

The original app created its window from AppDelegate without adopting scenes. The iOS 27 SDK requires the UIScene lifecycle. The existing uncommitted scene migration was also incomplete: Info.plist contained only fragments (no plist root or bundle metadata), and SceneDelegate.swift had no file reference or Sources entry in the Xcode target.

The full plist now includes UIApplicationSceneManifest, a single UIWindowScene configuration, and the module-qualified SceneDelegate class. SceneDelegate owns the scene-bound UIWindow, retains the React Native factory and its delegate, and starts the registered `frontend` module. Its existing AppDelegate.window compatibility reference is retained. The Xcode project compiles SceneDelegate. The display name is LeaseGuard. The original Podfile, pod versions, deployment target, and application module name are preserved.

This was checked against the installed React Native 0.87.1 factory implementation, which installs the root controller and calls makeKeyAndVisible, and these official references:

- [Apple: migrating to the scene-based lifecycle](https://developer.apple.com/documentation/technotes/tn3187-migrating-to-the-uikit-scene-based-life-cycle)
- [React Native: native integration using RCTReactNativeFactory](https://reactnative.dev/docs/integration-with-existing-apps)
- [Django: password reset forms, tokens, and confirmation views](https://docs.djangoproject.com/en/4.2/topics/auth/default/)

## Screens and navigation

Loading uses the existing, unmodified logo asset, explicit responsive image dimensions, a blue animated indicator, and a short transition after image loading completes. `replace` removes Loading from the stack. The image's white background is blended into the screen in the rendered style; the source asset is unchanged.

Login has controlled email/password fields, secure password entry, validation, Next/Go keyboard actions, request state, and links to Forgot Password and the existing Register route. The backend verifies real Django credentials by email and establishes a cookie-backed session with CSRF protection. Failed or ambiguous credentials cannot authenticate. Successful login clears the password and shows an authenticated state with Sign out. There is no dashboard redirect because both dashboard navigators are empty and no role model exists yet. Session restoration on app restart is not implemented.

Forgot Password pre-fills the email from Login, validates edits, blocks duplicate submissions, and replaces itself with ResetEmailSent only after HTTP acceptance. Confirmation displays the submitted email and uses generic account-existence wording. Development console mode explicitly says no email was sent. Return to sign in resets the stack to one Login route. Back to sign in does the same. Requests are cancelled on unmount to prevent late navigation after leaving.

All three forms/confirmation layouts use safe areas, bounded widths, scrolling, shared components, design tokens, and StyleSheet. The screenshots supplied by the user were the visual target: Figma MCP returned the Starter-plan call limit, so latest frames could not be fetched. The public GitHub README and local README/USER_STORIES were read. The linked project board could not be retrieved.

## Local setup

From the repository root, use the existing Python environment:

```sh
venv/bin/python manage.py migrate
venv/bin/python manage.py runserver 127.0.0.1:8000
```

In a second terminal, start **one** reset worker using the same environment/database:

```sh
venv/bin/python manage.py send_password_resets
```

Use `--once` to process one batch and exit. Development defaults to the console email backend: eligible reset links appear in the worker terminal; no mail is delivered. Use a real existing Django account with an active flag, usable password, and email address. The existing Django User model does not enforce unique emails, so Login deliberately rejects multiple matching accounts. New accounts can now be created through Register. No hardcoded app credentials were added.

Start Metro from `frontend` with `npm start`, then run the `frontend` scheme in `frontend/ios/frontend.xcworkspace`. A Debug build requires Metro to be reachable. Keep the existing local Xcode Node configuration appropriate to your machine.

The automated and simulator tests used disposable databases, including `/tmp/leaseguard-smoke.sqlite3`. The repository's existing `db.sqlite3` was not migrated or seeded during implementation. Apply the migration above before using the normal database. The temporary Django test server was stopped after verification; Metro and the simulator were left available for UI review.

## API URLs and mail configuration

`frontend/src/services/api.config.json` contains non-secret deployment configuration:

- `developmentBaseUrl`: optional complete API base such as `http://localhost:8000/api`. Empty means derive the host from Metro, with localhost for iOS and 10.0.2.2 for the Android emulator.
- `productionBaseUrl`: set to the deployed HTTPS API base before distributing a Release app. Empty or non-HTTPS values produce a configuration error rather than sending credentials to a development server.

For a physical phone, bind the development backend to a reachable interface, add its host to `DJANGO_ALLOWED_HOSTS`, and set the development API URL if Metro uses a different host. This was tested on an iOS simulator, not a physical device or Android.

The root `.env.example` lists configuration names. Settings read the process environment; `.env` is **not** automatically loaded. Export the values in the shell running both Django and the worker. SMTP credentials belong only in private environment configuration, never the mobile app or Git.

For actual email, set `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, host/port, the provider's credentials if required, appropriate TLS/SSL settings, and a verified `DEFAULT_FROM_EMAIL`. Set `PASSWORD_RESET_BASE_URL` to the trusted public origin hosting Django's reset pages, without an API path. It must be HTTPS when `DJANGO_DEBUG=false`. A phone cannot open another machine's localhost link. Set a persistent `DJANGO_SECRET_KEY` and allowed hosts for deployment. Development generates an ignored, permission-restricted `.django-dev-secret` file so links survive server reloads; changing keys invalidates old sessions/reset links.

Real SMTP delivery was **not configured or tested**. A 202 response means the request was queued, not that an inbox received mail. If SMTP configuration is missing outside console development mode, the API returns 503 for every address.

## Reset implementation and operational limits

A reset request validates the email and queues it without looking up a user. Account lookup and email transmission happen in the worker, keeping their timing and failures outside the public endpoint. Existing/unknown/inactive/unusable-password addresses receive identical public responses. The worker delegates account eligibility and token generation to Django's PasswordResetForm. Django's confirmation view validates the one-use token, runs password validators, and updates the password through a CSRF-protected web form. Links expire in one hour.

The queue adds one table and one management command. Run one worker with the current SQLite setup. It retries a transport failure three times, logs only the request ID/error class/attempt, and removes completed, exhausted, or older-than-one-hour requests. Monitor worker errors; requests exhausted after three attempts require a new reset request. A worker crash after SMTP acceptance can cause a duplicate message on retry. This intentionally small queue is not a general concurrent job system.

Login is limited to 10 attempts/minute per remote IP; reset requests to 5. The default Django cache makes this a single-process development limit. Deployments need shared cache or edge rate limiting, worker supervision, HTTPS termination, and the normal Django deployment configuration. No production deployment is claimed.

## Verification

Tested with Xcode 27.0 (27A266a), iPhone 18 Pro simulator running iOS 27.0, React Native 0.87.1, and Django 4.2.30.

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with no warnings.
- `npm test -- --runInBand`: 14 tests passed across three suites. These cover real navigator history, image-ready Loading transition, both sign-in links, secure entry and validation, request failures, acceptance, duplicate suppression, cancellation, and the fetch/CSRF contract.
- `venv/bin/python manage.py check`: passed.
- `venv/bin/python manage.py makemigrations --check --dry-run`: no missing migrations.
- `venv/bin/python manage.py test accounts`: 11 tests passed. These cover actual authentication, CSRF, unknown/inactive/ambiguous accounts, uniform reset responses, throttling, console/unconfigured modes, delivery retries, password validation, expired/invalid/used tokens, and signing in with a reset password.
- Debug iOS build: succeeded using the workspace and existing CocoaPods integration. The app installed, launched, connected to Metro, rendered JavaScript, and remained usable through repeated launches and form interactions.
- Simulator UI: Login validation, editable fields, rejected credentials, real successful sign-in and sign-out using an isolated test account, Forgot Password validation, accepted API request, submitted-email display, and Return to sign in were exercised. Loading, Login, Forgot Password, and confirmation were visually inspected.
- The original verification covered only navigation to the placeholder Register route. Follow-up registration verification is recorded below.
- Release/device/Android builds and real SMTP inbox delivery were not tested. Xcode emitted upstream React Native nullability/deprecation and script-output warnings, but no build errors.

## Files

Native files: modified `frontend/ios/frontend.xcodeproj/project.pbxproj`, `frontend/ios/frontend/Info.plist`, and the newline in the already-modified `frontend/ios/frontend/AppDelegate.swift`; retained the user's already-staged `frontend/ios/frontend/SceneDelegate.swift` implementation and registered it in the target.

Frontend files modified: the four assigned `frontend/src/screens/auth/{Loading,Login,ForgotPassword,ResetEmailSent}Screen.tsx` files; shared `src/components/{Button,Input,ScreenContainer}.tsx`; `src/navigation/types.ts`; `src/services/{api,authService}.ts`; `src/theme/colors.ts`; `src/types/user.ts`; `src/utils/validation.ts`; `jest.config.js`; and `__tests__/App.test.tsx`.

Frontend files added: `src/services/api.config.json`, `src/utils/useAuthRequest.ts`, `jest.setup.js`, `__tests__/AuthFlow.test.tsx`, and `__tests__/authService.test.ts`.

Backend files modified: `backend/settings.py`, `backend/urls.py`, and `.gitignore`. Added `.env.example`; `accounts/models.py`, `accounts/views.py`, `accounts/tests.py`, `accounts/migrations/0001_initial.py`, `accounts/management/commands/send_password_resets.py`, package `__init__.py` files, and five reset templates under `accounts/templates/registration/`. Added this document.

The original work did not edit App.tsx, RootNavigator, AuthNavigator, RegisterScreen, landlord/tenant/notification features, dependencies, or the logo asset. The registration follow-up replaces the RegisterScreen placeholder.

## Commit sequence

1. `fix: resolve iOS startup crash with scene lifecycle support`
2. `feat: add Django authentication and password reset support`
3. `feat: add shared authentication components and API integration`
4. `feat: complete LeaseGuard loading screen and login transition`
5. `feat: implement login screen with authentication and validation`
6. `feat: implement password reset and email confirmation screens`
7. `test: cover authentication flows and document setup`


## Registration follow-up

Register now collects full name, email, password, and password confirmation using the existing form components and visual theme. It validates required fields, email format, name length, password length, and matching passwords; both password fields use secure entry. The form disables editing during submission, prevents duplicate requests, shows API failures inline, and cancels pending UI updates when unmounted. Confirmed creation clears password state and offers Back to sign in, which resets navigation to one Login screen.

`POST /api/auth/register/` accepts `name`, `email`, `password`, and `confirmPassword`. It uses the existing CSRF handshake, applies Django's configured password validators, hashes passwords, and creates an ordinary non-staff Django user. The full name is stored in `first_name` (maximum 150 characters). Emails are trimmed and lowercased. Existing case-insensitive email matches are rejected with 409; a deterministic email-derived unique username prevents concurrent registration requests from creating duplicate accounts. Accounts created through other admin/import paths still need email uniqueness checks because Django's email column remains non-unique. Registration is limited to five attempts per minute per remote IP using the existing cache limiter.

Success returns HTTP 201 with the created user; it does not start a session or send verification email. The user signs in through the existing Login flow. Role selection and dashboard routing remain outside this change because the current account model has no tenant/landlord role. No migration or new dependency is required.

Follow-up validation: 19 frontend tests and 16 backend tests pass, including form validation, API errors, duplicate submission prevention, cancellation, confirmation/navigation, CSRF, password policy, duplicate email rejection, and signing in with a newly registered account. TypeScript, ESLint, Django system checks, and migration drift checks pass. Registration has not been manually exercised in the simulator. The registration changes are grouped into one follow-up commit.
