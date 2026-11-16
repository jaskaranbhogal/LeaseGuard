from django.apps import AppConfig


class InspectionsConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "inspections"
