"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.contrib.auth import views as auth_views
from accounts import views
from inspections import views as inspection_views
from django.urls import path, include
from maintenance import views as maintenance_views

urlpatterns = [
    path('api/guided-inspections/', include('guided_inspections.urls')),
    path('api/maintenance/units/', maintenance_views.assigned_units),
    path('api/maintenance/', maintenance_views.requests),
    path('api/maintenance/<str:request_id>/', maintenance_views.detail),
    path('api/maintenance/<str:request_id>/photos/', maintenance_views.photos),
    path('api/maintenance/<str:request_id>/photos/<str:photo_id>/', maintenance_views.photo_detail),
    path('api/maintenance/<str:request_id>/submit/', maintenance_views.submit),
    path('api/maintenance/<str:request_id>/status/', maintenance_views.status),
    path('api/inspections/compare/', inspection_views.compare_photo_view),
    path('api/inspections/recent/', inspection_views.recent_comparisons),
    path('api/inspections/<str:comparison_id>/photos/<str:kind>/', inspection_views.read_comparison_photo),
    path('api/inspections/<str:comparison_id>/decision/', inspection_views.set_comparison_decision),
    path('admin/', admin.site.urls),
    path('api/auth/csrf/', views.csrf_token),
    path('api/auth/firebase/session/', views.firebase_session),
    path('api/auth/firebase/link/', views.link_legacy_account),
    path('api/auth/role/', views.choose_role),
    path('api/auth/session/', views.session_status),
    path('api/auth/login/', views.sign_in),
    path('api/auth/register/', views.register),
    path('api/auth/logout/', views.sign_out),
    path('api/auth/password-reset/', views.password_reset),
    path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('reset/complete/', auth_views.PasswordResetCompleteView.as_view(), name='password_reset_complete'),
]
