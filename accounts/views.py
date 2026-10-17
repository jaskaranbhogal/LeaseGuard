import json
import hashlib
from functools import wraps

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.debug import sensitive_post_parameters
from django.views.decorators.http import require_GET, require_POST

from .models import AccountProfile, PasswordResetRequest


def user_data(user):
    role = AccountProfile.objects.filter(user=user).values_list('role', flat=True).first()
    return {'id': user.pk, 'email': user.email,
            'name': user.get_full_name() or user.get_username(), 'role': role}


@never_cache
@require_GET
def session_status(request):
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Please sign in.'}, status=401)
    return JsonResponse({'user': user_data(request.user)})


def rate_limit(scope, limit):
    def decorate(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            # Do not trust caller-provided forwarded IP headers.
            key = f"auth:{scope}:{request.META.get('REMOTE_ADDR', '')}"
            if cache.add(key, 1, timeout=60):
                count = 1
            else:
                try:
                    count = cache.incr(key)
                except ValueError:  # The previous window expired between calls.
                    cache.set(key, 1, timeout=60)
                    count = 1
            if count > limit:
                response = JsonResponse({'detail': 'Too many attempts. Try again in a minute.'}, status=429)
                response['Retry-After'] = '60'
                return response
            return view(request, *args, **kwargs)
        return wrapped
    return decorate


def read_body(request):
    try:
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        raise ValidationError('Enter a valid email address.')
    if not isinstance(data, dict):
        raise ValidationError('Invalid request.')
    email = data.get('email', '')
    if not isinstance(email, str):
        raise ValidationError('Enter a valid email address.')
    email = email.strip()
    validate_email(email)
    if len(email) > 254:
        raise ValidationError('Enter a valid email address.')
    return data, email


@never_cache
@require_GET
def csrf_token(request):
    return JsonResponse({'csrfToken': get_token(request)})


@never_cache
@require_POST
@csrf_protect
@rate_limit('register', 5)
@sensitive_post_parameters()
def register(request):
    try:
        data, email = read_body(request)
    except ValidationError:
        return JsonResponse({'detail': 'Enter a valid email address.'}, status=400)
    name = data.get('name')
    password = data.get('password')
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 150:
        return JsonResponse({'detail': 'Enter your full name (up to 150 characters).'}, status=400)
    if not isinstance(password, str) or not password or len(password) > 4096:
        return JsonResponse({'detail': 'Enter a password (up to 4096 characters).'}, status=400)
    if password != data.get('confirmPassword'):
        return JsonResponse({'detail': 'Passwords do not match.'}, status=400)
    role = data.get('role')
    if role not in AccountProfile.Role.values:
        return JsonResponse({'detail': 'Select Tenant or Landlord.'}, status=400)
    User = get_user_model()
    email = email.lower()
    # Django's unique username prevents concurrent registrations for the same
    # normalized email without changing the existing User model. The lookup
    # also protects accounts created previously with arbitrary usernames.
    username = 'email_' + hashlib.sha256(email.encode('utf-8')).hexdigest()
    user = User(username=username, email=email, first_name=name.strip())
    try:
        validate_password(password, user)
    except ValidationError as error:
        return JsonResponse({'detail': ' '.join(error.messages)}, status=400)
    duplicate = {'detail': 'An account with this email already exists. Sign in or reset your password.'}
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse(duplicate, status=409)
    user.set_password(password)
    try:
        with transaction.atomic():
            user.save()
            AccountProfile.objects.create(user=user, role=role)
    except IntegrityError:
        return JsonResponse(duplicate, status=409)
    return JsonResponse({'user': user_data(user)}, status=201)


@never_cache
@require_POST
@csrf_protect
@rate_limit('login', 10)
@sensitive_post_parameters()
def sign_in(request):
    try:
        data, email = read_body(request)
    except ValidationError:
        return JsonResponse({'detail': 'Enter a valid email address.'}, status=400)
    password = data.get('password')
    if not isinstance(password, str) or not password or len(password) > 4096:
        return JsonResponse({'detail': 'Enter your password.'}, status=400)
    User = get_user_model()
    # The existing Django User has a non-unique email. Refuse ambiguity rather
    # than authenticating an arbitrary account. No role is inferred from staff.
    users = list(User.objects.filter(email__iexact=email)[:2])
    user = None
    if len(users) == 1:
        user = authenticate(request, username=users[0].get_username(), password=password)
    else:
        make_password(password)  # Match the password-hashing cost of a failed login.
    if user is None:
        return JsonResponse({'detail': 'Email or password is incorrect.'}, status=401)
    login(request, user)
    return JsonResponse({'user': user_data(user)})


@never_cache
@require_POST
@csrf_protect
def sign_out(request):
    logout(request)
    return JsonResponse({'detail': 'Signed out.'})


@never_cache
@require_POST
@csrf_protect
@rate_limit('reset', 5)
def password_reset(request):
    try:
        _, email = read_body(request)
    except ValidationError:
        return JsonResponse({'detail': 'Enter a valid email address.'}, status=400)
    delivery = settings.PASSWORD_RESET_DELIVERY
    if delivery == 'unconfigured':
        return JsonResponse({'detail': 'Password reset email is not configured. Please try again later.'}, status=503)
    PasswordResetRequest.objects.create(email=email)
    return JsonResponse({'detail': 'If an eligible account exists, a reset email will be sent.',
                         'delivery': delivery}, status=202)
