"""Additive MongoDB models; photo/comparison/audit ledgers are embedded for atomicity."""
from django.conf import settings
from django.db import models
from maintenance.models import request_id

class InspectionTemplate(models.Model):
    public_id = models.CharField(max_length=32, unique=True, default=request_id)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    name = models.CharField(max_length=100)
    version = models.PositiveIntegerField(default=1)
    steps = models.JSONField(default=list)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

class GuidedInspection(models.Model):
    public_id = models.CharField(max_length=32, unique=True, default=request_id)
    creation_key = models.CharField(max_length=64, unique=True)
    unit = models.ForeignKey('maintenance.Unit', on_delete=models.PROTECT)
    tenant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='guided_assignments')
    landlord = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='guided_created')
    inspection_type = models.CharField(max_length=20)
    template = models.ForeignKey(InspectionTemplate, on_delete=models.PROTECT)
    template_version = models.PositiveIntegerField()
    steps = models.JSONField(default=list)
    due_at = models.DateTimeField()
    status = models.CharField(max_length=20, default='assigned')
    photos = models.JSONField(default=list)
    comparisons = models.JSONField(default=list)
    history = models.JSONField(default=list)
    revision = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True)
    submitted_at = models.DateTimeField(null=True)
    reviewed_at = models.DateTimeField(null=True)
    recurrence_days = models.PositiveIntegerField(default=0)
    class Meta:
        indexes = [models.Index(fields=['tenant', 'status']), models.Index(fields=['unit', 'created_at']), models.Index(fields=['status', 'due_at'])]

class UnitBaseline(models.Model):
    # One atomic head per unit. Append-only versions retain all immutable mappings.
    unit = models.OneToOneField('maintenance.Unit', on_delete=models.PROTECT)
    versions = models.JSONField(default=list)
    active_id = models.CharField(max_length=32, default='')
    revision = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

class InspectionNotification(models.Model):
    event_key = models.CharField(max_length=64, unique=True)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    inspection = models.ForeignKey(GuidedInspection, on_delete=models.PROTECT)
    message = models.CharField(max_length=250)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True)
    class Meta:
        indexes = [models.Index(fields=['recipient', 'created_at'])]
