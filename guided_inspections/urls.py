from django.urls import path
from . import views

urlpatterns = [
    path('options/', views.options),
    path('templates/', views.templates),
    path('notifications/', views.notifications),
    path('', views.inspections),
    path('<str:inspection_id>/', views.detail),
    path('<str:inspection_id>/photos/', views.upload),
    path('<str:inspection_id>/photos/<str:photo_id>/', views.photo),
    path('<str:inspection_id>/<str:action>/', views.action),
]
