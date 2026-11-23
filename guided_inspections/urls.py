from django.urls import path
from . import views, baselines

urlpatterns = [
    path('units/<str:unit_id>/approved-baseline/<str:version_id>/photos/<str:photo_id>/', baselines.approved_baseline_photo),
    path('units/<str:unit_id>/approved-baseline/', baselines.approved_baseline),
    path('baseline-drafts/<str:draft_id>/notes/', baselines.notes),
    path('units/<str:unit_id>/baselines/', baselines.unit_baselines),
    path('units/<str:unit_id>/baselines/<str:version_id>/photos/<str:photo_id>/', baselines.version_photo),
    path('baseline-drafts/<str:draft_id>/', baselines.draft),
    path('baseline-drafts/<str:draft_id>/photos/', baselines.upload),
    path('baseline-drafts/<str:draft_id>/photos/<str:photo_id>/', baselines.photo),
    path('options/', views.options),
    path('templates/', views.templates),
    path('notifications/', views.notifications),
    path('', views.inspections),
    path('<str:inspection_id>/', views.detail),
    path('<str:inspection_id>/photos/', views.upload),
    path('<str:inspection_id>/photos/<str:photo_id>/', views.photo),
    path('<str:inspection_id>/<str:action>/', views.action),
]
