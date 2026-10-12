import json
from functools import wraps

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.debug import sensitive_post_parameters
from django.views.decorators.http import require_GET, require_POST

from .models import PasswordResetRequest


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
    return JsonResponse({'user': {'id': user.pk, 'email': user.email,
                                 'name': user.get_full_name() or user.get_username()}})


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
