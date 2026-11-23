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

Firebase backend tests use the existing disposable MongoDB CI replica set and
mock Firebase token verification. Jest mocks the native SDK. Before merging,
verify Google and email sign-in, email verification and reset, legacy account
linking, role selection, relaunch restoration, and sign-out on iOS.
