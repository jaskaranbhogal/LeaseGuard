"""Canonical housing relationships and audited manager-authorized invitations."""
import uuid
from django.conf import settings
from django.db import models


def request_id():
    return uuid.uuid4().hex


class Property(models.Model):
    name = models.CharField(max_length=160)
    city = models.CharField(max_length=160, blank=True, default="")
    creation_key = models.CharField(max_length=64, null=True, unique=True)
    managers = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='managed_properties')


class Unit(models.Model):
    creation_key = models.CharField(max_length=64, null=True, unique=True)
    property = models.ForeignKey(Property, on_delete=models.PROTECT)
    label = models.CharField(max_length=100)
    bedrooms = models.CharField(max_length=4, default="1")
    bathrooms = models.CharField(max_length=4, default="1")
    areas = models.JSONField(default=list)
    revision = models.PositiveIntegerField(default=0)


class UnitAssignment(models.Model):
    tenant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    active = models.BooleanField(default=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name='verified_assignments')
    verified_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True)
    ended_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="ended_assignments")


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


class TenantInvitation(models.Model):
    public_id = models.CharField(max_length=32, unique=True, default=request_id)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    email = models.EmailField()
    token_hash = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=16, default='pending')
    delivery = models.CharField(max_length=24, default='unconfigured')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    responded_at = models.DateTimeField(null=True)
    responded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name='invitation_responses')

    class Meta:
        indexes = [models.Index(fields=['email', 'status']), models.Index(fields=['unit', 'status'])]


class PolicyConsent(models.Model):
    # Append-only acknowledgments; unique key makes concurrent retries safe.
    consent_key = models.CharField(max_length=64, unique=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    policy_version = models.CharField(max_length=40)
    role = models.CharField(max_length=8)
    accepted_at = models.DateTimeField(auto_now_add=True)
    audit = models.JSONField(default=dict)


class InspectionAppointment(models.Model):
    creation_key = models.CharField(max_length=64, null=True, unique=True)
    public_id = models.CharField(max_length=32, unique=True, default=request_id)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    landlord = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='offered_appointments')
    tenant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='tenant_appointments')
    slots = models.JSONField(default=list)
    tenant_slots = models.JSONField(default=list)
    confirmed_slot = models.CharField(max_length=32, default='')
    timezone = models.CharField(max_length=64)
    status = models.CharField(max_length=20, default='offered')
    revision = models.PositiveIntegerField(default=0)
    history = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
