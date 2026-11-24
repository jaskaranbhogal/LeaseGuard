"""Verify Firebase ID tokens for Django."""

from threading import Lock

import firebase_admin
import google.auth.exceptions
from firebase_admin import auth
from firebase_admin.exceptions import FirebaseError
from django.conf import settings


class FirebaseAuthenticationError(Exception):
    """Raised when Firebase cannot verify a client ID token."""


_app_lock = Lock()


def get_firebase_app():
    with _app_lock:
        try:
            return firebase_admin.get_app()
        except ValueError:
            return firebase_admin.initialize_app(
                options={"projectId": settings.FIREBASE_PROJECT_ID}
            )


# Keep the previous private helper name for existing integrations and tests.
def _firebase_app():
    return get_firebase_app()


def verify_firebase_id_token(id_token):
    if not isinstance(id_token, str) or not id_token or len(id_token) > 8192:
        raise FirebaseAuthenticationError("Missing or invalid Firebase ID token.")
    if not settings.FIREBASE_PROJECT_ID:
        raise FirebaseAuthenticationError("Firebase project is not configured.")

    try:
        decoded = auth.verify_id_token(
            id_token,
            app=_firebase_app(),
            check_revoked=True,
        )
    except (
        FirebaseError,
        google.auth.exceptions.DefaultCredentialsError,
        ValueError,
        TypeError,
    ) as error:
        raise FirebaseAuthenticationError(
            "Firebase ID token could not be verified."
        ) from error

    if (
        decoded.get("aud") != settings.FIREBASE_PROJECT_ID
        or decoded.get("iss")
        != f"https://securetoken.google.com/{settings.FIREBASE_PROJECT_ID}"
    ):
        raise FirebaseAuthenticationError("Firebase ID token is for another project.")
    if not isinstance(decoded.get("uid"), str) or not 1 <= len(decoded["uid"]) <= 128:
        raise FirebaseAuthenticationError("Firebase ID token has no user ID.")
    return decoded
