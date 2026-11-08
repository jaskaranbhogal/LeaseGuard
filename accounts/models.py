from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class AccountProfile(models.Model):
    class Role(models.TextChoices):
        TENANT = 'tenant', 'Tenant'
        LANDLORD = 'landlord', 'Landlord'

    # Account type only: property membership/ownership needs separate authorization.
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name='account_profile')
    role = models.CharField(max_length=8, choices=Role.choices)

    def save(self, *args, **kwargs):
        # MongoDB doesn't support Django CheckConstraint, so validate roles in
        # the model's normal save path as well as in the registration endpoint.
        if self.role not in self.Role.values:
            raise ValidationError({'role': 'Select Tenant or Landlord.'})
        return super().save(*args, **kwargs)


class PasswordResetRequest(models.Model):
    # Queue every valid address; account lookup happens only in the worker.
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.PositiveSmallIntegerField(default=0)
