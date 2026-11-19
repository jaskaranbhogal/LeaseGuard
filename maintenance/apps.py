from django.apps import AppConfig


class MaintenanceConfig(AppConfig):
    default_auto_field = 'django_mongodb_backend.fields.ObjectIdAutoField'
    name = 'maintenance'
