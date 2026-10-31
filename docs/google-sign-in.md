# Google Sign-In setup

LeaseGuard uses the native system-browser OAuth authorization-code flow through `react-native-app-auth`. The library uses PKCE and a one-time nonce issued by Django. Django validates the Google ID token and creates the existing Django cookie session. Google identities are stored by Google's stable `sub` value. Email/password sign-in remains available.

## Google Cloud credentials

Create a Google Cloud project, configure the OAuth consent screen, and add the testers as test users while the app is in testing. Create two OAuth client IDs in **Google Cloud Console → Google Auth Platform → Clients**:

1. **Android client ID** for application ID `com.frontend`. Get the debug signing SHA-1 with `cd frontend/android && ./gradlew signingReport`. Use the SHA-1 for the Android client you are testing. Create another Android client later if the release signing certificate differs.
2. **iOS client ID** for bundle identifier `org.reactjs.native.example.frontend`.

The app needs the two **client ID strings** only. The Android client is registered with the app's package name and signing SHA-1; the iOS client is registered with the bundle identifier. Enable the custom URI scheme in the Android client's advanced settings if that option is shown. This native authorization-code flow does not need a web client, authorized web origin, callback URL entry, client secret, service-account key, or Firebase project. Never put a client secret in the mobile app.

The OAuth client IDs have the form `<client-id-prefix>.apps.googleusercontent.com`. For each platform, use `com.googleusercontent.apps.<client-id-prefix>` as that client's redirect scheme, and use it in that platform's redirect URL. This follows the native Google setup supported by React Native App Auth.

## Configure the app

Set the backend's allowed audience list in the local backend environment (or the deployment secret manager):

```env
GOOGLE_OAUTH_CLIENT_IDS=<ANDROID_CLIENT_ID>,<IOS_CLIENT_ID>
```

In `frontend/src/services/api.config.json`, fill:

- `googleAndroidClientId` with the Android client ID.
- `googleIosClientId` with the iOS client ID.
- `googleAndroidRedirectScheme` with the Android reversed client ID.
- `googleIosRedirectScheme` with the iOS reversed client ID.

Set `manifestPlaceholders.appAuthRedirectScheme` in `frontend/android/app/build.gradle` to the Android redirect scheme. Set the Xcode build setting `GOOGLE_IOS_REDIRECT_SCHEME` to the iOS redirect scheme for Debug and Release. These values must match the corresponding `api.config.json` values.

After changing the native package or iOS configuration, run `cd frontend/ios && pod install`, then rebuild the iOS app. Rebuild Android after configuring its redirect scheme. App Auth opens the system browser or Android Custom Tab for authorization, so the emulator needs a compatible browser.

## How to test

1. Start Django and Metro using the repository's normal development commands.
2. Use a Google account listed as a test user on the consent screen.
3. On Login, tap **Sign in with Google**, choose Tenant or Landlord for a new account, and finish the Google prompt.
4. Confirm the app opens the role's dashboard and that relaunching the app restores the Django session.
5. Test cancellation, invalid tokens, and an email already registered with a password. The existing account is never linked by matching email; the user must authenticate to LeaseGuard and link the same Google email through the authenticated `/api/auth/google/link/` endpoint.
6. Confirm the regular email/password login, registration, logout, and protected session endpoints still work.

Automated tests mock Google's token-verification result and do not require Cloud credentials. Live Google authentication still requires the two client IDs and native redirect schemes above.

## Apple Sign-In

The iOS login screen supports Sign in with Apple. The app requests a one-time nonce from Django, passes its SHA-256 hash to Apple's native sign-in flow, and sends the returned identity token to Django. Django verifies the signature, issuer, audience, expiry, and nonce before establishing the existing cookie session. Apple identities are linked by Apple's stable subject identifier; an existing account is never linked just because its email matches.

To enable the live flow, turn on **Sign in with Apple** for the iOS App ID in the Apple Developer account, use a provisioning profile that includes the capability, and sign the app with the matching team. The Xcode target already includes the Sign in with Apple entitlement. Set the Django environment variable to the exact app bundle ID used to sign the app:

```env
APPLE_SIGN_IN_CLIENT_IDS=org.reactjs.native.example.frontend
```

For a production app, replace that sample bundle ID with the production bundle ID. Apple OAuth is iOS-only in this implementation; no Apple client secret is needed for this native flow.
