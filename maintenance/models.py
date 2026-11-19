"""Verified housing relationships; no public API can create assignments."""
import uuid
from django.conf import settings
from django.db import models


def request_id():
    return uuid.uuid4().hex


class Property(models.Model):
    name = models.CharField(max_length=160)
    managers = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='managed_properties')


class Unit(models.Model):
    property = models.ForeignKey(Property, on_delete=models.PROTECT)
    label = models.CharField(max_length=100)


class UnitAssignment(models.Model):
    tenant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    active = models.BooleanField(default=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name='verified_assignments')
    verified_at = models.DateTimeField(auto_now_add=True)


class MaintenanceRequest(models.Model):
    public_id = models.CharField(max_length=32, unique=True, default=request_id)
    tenant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    # Tenant-scoped deterministic key makes draft creation retryable.
    creation_key = models.CharField(max_length=64, unique=True)
    area = models.CharField(max_length=100)
    description = models.TextField(max_length=2000)
    urgency = models.CharField(max_length=10, default='normal')
    status = models.CharField(max_length=16, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True)
    # Bounded embedded evidence ledger, including failed/removed upload intents.
    photos = models.JSONField(default=list)
    history = models.JSONField(default=list)
    revision = models.PositiveIntegerField(default=0)
    media_expired = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=['tenant', 'created_at']),
                   models.Index(fields=['unit', 'status'])]
