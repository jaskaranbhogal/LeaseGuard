from django.db import models


class PasswordResetRequest(models.Model):
    # Queue every valid address; account lookup happens only in the worker.
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.PositiveSmallIntegerField(default=0)
