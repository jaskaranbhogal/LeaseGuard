# Firebase Authentication

LeaseGuard uses Firebase Auth for mobile email/password and Google sign-in. A
verified Firebase ID token is exchanged for a Django cookie session. Django
stores the Firebase UID alongside the existing MongoDB account. Users with a
legacy LeaseGuard account can link it by verifying the same email in Firebase
and supplying their previous LeaseGuard password. The login screen also links
to the legacy password-reset flow.

## Local setup

1. Configure MongoDB using the existing replica-set instructions and set the
   variables in `.env.example`.
2. Enable Email/Password and Google in Firebase Authentication for the project
   matching the iOS app configuration. Set `FIREBASE_PROJECT_ID` to that project.
3. Provide Firebase Admin Application Default Credentials to Django. For local
   development, set `GOOGLE_APPLICATION_CREDENTIALS` to the path of a credential
   JSON stored outside this repository. Keep private keys out of Git and logs.
4. Run `python manage.py migrate` on the intended database and start Django.
5. In `frontend`, use Node 22.13+ within Node 22 and run `npm ci`. Run
   `pod install` in `frontend/ios`, start Metro and build the iOS workspace.
   The checked-in Firebase plist contains iOS client settings. If using another
   Firebase project, use a matching client plist, bundle identifier and
   reversed client ID URL scheme.

## Android Google Sign-In setup

The Android Firebase client configuration is in
`frontend/android/app/google-services.json` for Firebase project
`leaseguard-9141a` and Android package `com.leaseguard.app`. The Web OAuth
client ID from this project is configured in
`frontend/src/services/firebaseAuthService.ts`. The Gradle files apply the
Google Services plugin when this JSON file is present, while CI can build
without a developer-specific Firebase file.

Before testing or releasing:

1. In Firebase Console > Authentication > Sign-in method, verify that Google
   and Email/Password are enabled for `leaseguard-9141a`. The client JSON does
   not prove the provider settings are enabled.
2. In `frontend/android`, run `./gradlew :app:signingReport`. Add the SHA-1 and
   SHA-256 fingerprints for each signing variant you use to the
   `com.leaseguard.app` Android app in Firebase Project settings. Debug
   fingerprints cover local development; release builds need the release
   keystore fingerprints.
3. Rebuild and test Google sign-in on an Android emulator/device. Confirm the
   Firebase token exchange creates a Django session and returning tenants and
   landlords reach their existing dashboard.

The checked-in `google-services.json` contains mobile client configuration; it
does not contain Firebase Admin private credentials. Never place a Firebase
Admin service-account key in the mobile app or repository.

## Legacy Django password-login limitation

The Django route `/api/auth/login/` is intentionally retained unchanged for
legacy compatibility. It checks a Django email/password and creates a Django
session directly. Although the route is CSRF-protected and rate-limited, it
does not verify a Firebase ID token or require Firebase email verification, so
it can bypass the Firebase-authentication checks if a caller uses it. The
current React Native login and account-linking screens use Firebase; repository
search found no screen calling this legacy route. The route remains covered by
backend compatibility tests. Before removing or restricting it, check for
external clients that still depend on it and migrate them to Firebase sign-in
or the explicit legacy-account linking flow.

Firebase backend tests use the existing disposable MongoDB CI replica set and
mock Firebase token verification. Jest mocks the native SDK. Before merging,
verify Google and email sign-in, email verification and reset, legacy account
linking, role selection, relaunch restoration, and sign-out on iOS.
