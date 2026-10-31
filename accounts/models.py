from django.conf import settings
from django.db import models


class AccountProfile(models.Model):
    class Role(models.TextChoices):
        TENANT = 'tenant', 'Tenant'
        LANDLORD = 'landlord', 'Landlord'

    # Account type only: property membership/ownership needs separate authorization.
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name='account_profile')
    role = models.CharField(max_length=8, choices=Role.choices, null=True, blank=True)

    class Meta:
        constraints = [models.CheckConstraint(
            check=models.Q(role__in=['tenant', 'landlord']) | models.Q(role__isnull=True),
            name='valid_account_role')]


class PasswordResetRequest(models.Model):
    # Queue every valid address; account lookup happens only in the worker.
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.PositiveSmallIntegerField(default=0)


class GoogleIdentity(models.Model):
    """A verified Google OpenID Connect subject linked to one LeaseGuard user."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name='google_identity')
    subject = models.CharField(max_length=255, unique=True)
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)


class AppleIdentity(models.Model):
    """A verified Apple OpenID Connect subject linked to one LeaseGuard user."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name='apple_identity')
    subject = models.CharField(max_length=255, unique=True)
    email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class FirebaseIdentity(models.Model):
    """A Firebase Authentication UID linked to one LeaseGuard user."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name='firebase_identity')
    uid = models.CharField(max_length=128, unique=True)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
