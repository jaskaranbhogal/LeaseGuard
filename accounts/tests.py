import json
import re
from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from .firebase_auth import FirebaseAuthenticationError, verify_firebase_id_token
from .models import AccountProfile, FirebaseIdentity, PasswordResetRequest


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
                   PASSWORD_RESET_DELIVERY='email', PASSWORD_RESET_BASE_URL='https://leaseguard.example')
class AuthenticationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.password = 'Original-Passphrase-957!'
        self.user = get_user_model().objects.create_user(
            username='resident', email='resident@example.com', password=self.password)

    def post(self, path, data, client=None, **extra):
        return (client or self.client).post('/api/auth/' + path + '/',
                                            json.dumps(data), content_type='application/json', **extra)

    def test_real_login_and_logout(self):
        response = self.post('login', {'email': ' RESIDENT@example.com ', 'password': self.password})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(int(self.client.session['_auth_user_id']), self.user.pk)
        self.assertEqual(self.post('logout', {}).status_code, 200)
        self.assertNotIn('_auth_user_id', self.client.session)

    def test_role_selection_requires_session_and_is_one_time_but_idempotent(self):
        self.assertEqual(self.post('role', {'role': 'tenant'}).status_code, 401)
        self.client.force_login(self.user)
        for role in [None, '', 'admin', 'Tenant', [], {}]:
            self.assertEqual(self.post('role', {'role': role}).status_code, 400)
        first = self.post('role', {'role': 'tenant'})
        repeat = self.post('role', {'role': 'tenant'})
        change = self.post('role', {'role': 'landlord'})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(repeat.status_code, 200)
        self.assertEqual(change.status_code, 409)
        self.assertEqual(self.client.get('/api/auth/session/').json()['user']['role'], 'tenant')

    def test_invalid_unknown_inactive_and_ambiguous_login(self):
        responses = [self.post('login', {'email': 'unknown@example.com', 'password': self.password}),
                     self.post('login', {'email': self.user.email, 'password': 'wrong'})]
        self.user.is_active = False
        self.user.save()
        responses.append(self.post('login', {'email': self.user.email, 'password': self.password}))
        self.user.is_active = True
        self.user.save()
        get_user_model().objects.create_user(username='duplicate', email=self.user.email, password=self.password)
        responses.append(self.post('login', {'email': self.user.email, 'password': self.password}))
        for response in responses:
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json(), responses[0].json())

    def test_csrf_required_and_handshake_works(self):
        client = Client(enforce_csrf_checks=True)
        data = {'email': self.user.email}
        self.assertEqual(self.post('password-reset', data, client).status_code, 403)
        token = client.get('/api/auth/csrf/').json()['csrfToken']
        self.assertEqual(self.post('password-reset', data, client, HTTP_X_CSRFTOKEN=token).status_code, 202)
        self.assertEqual(self.post('login', {'email': self.user.email, 'password': self.password}, client,
                                   HTTP_X_CSRFTOKEN=token).status_code, 200)

    def test_reset_is_queued_without_account_lookup_and_same_response(self):
        with patch('django.contrib.auth.models.UserManager.filter', side_effect=AssertionError('account lookup')):
            existing = self.post('password-reset', {'email': self.user.email})
            missing = self.post('password-reset', {'email': 'unknown@example.com'})
        self.assertEqual(existing.status_code, 202)
        self.assertEqual(existing.json(), missing.json())
        self.assertEqual(PasswordResetRequest.objects.count(), 2)
        self.assertEqual(len(mail.outbox), 0)
        call_command('send_password_resets', once=True)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(PasswordResetRequest.objects.count(), 0)

    def test_full_reset_link_password_validation_and_single_use(self):
        self.post('password-reset', {'email': self.user.email})
        call_command('send_password_resets', once=True)
        url = re.search(r'https://leaseguard.example(/reset/\S+)', mail.outbox[0].body).group(1)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
        set_url = response.url
        weak = self.client.post(set_url, {'new_password1': '123', 'new_password2': '123'})
        self.assertContains(weak, 'too short')
        password = 'New-Strong-Passphrase-857!'
        self.assertRedirects(self.client.post(set_url, {'new_password1': password, 'new_password2': password}),
                             '/reset/complete/')
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(password))
        self.assertContains(self.client.get(url), 'invalid or expired')
        self.assertEqual(self.post('login', {'email': self.user.email, 'password': self.password}).status_code, 401)
        self.assertEqual(self.post('login', {'email': self.user.email, 'password': password}).status_code, 200)

    def test_expired_and_invalid_links(self):
        self.post('password-reset', {'email': self.user.email})
        call_command('send_password_resets', once=True)
        url = re.search(r'https://leaseguard.example(/reset/\S+)', mail.outbox[0].body).group(1)
        with override_settings(PASSWORD_RESET_TIMEOUT=-1):
            self.assertContains(self.client.get(url), 'invalid or expired')
        self.assertContains(self.client.get('/reset/invalid/invalid/'), 'invalid or expired')

    def test_inactive_and_unusable_passwords_get_no_mail(self):
        self.user.is_active = False
        self.user.save()
        self.post('password-reset', {'email': self.user.email})
        call_command('send_password_resets', once=True)
        self.user.is_active = True
        self.user.set_unusable_password()
        self.user.save()
        self.post('password-reset', {'email': self.user.email})
        call_command('send_password_resets', once=True)
        self.assertEqual(len(mail.outbox), 0)

    def test_bad_requests_and_throttle(self):
        for data in ({'email': 'bad'}, {'email': []}, []):
            self.assertEqual(self.post('password-reset', data).status_code, 400)
        cache.clear()
        for _ in range(5):
            self.assertEqual(self.post('password-reset', {'email': 'unknown@example.com'}).status_code, 202)
        self.assertEqual(self.post('password-reset', {'email': self.user.email}).status_code, 429)
        self.assertEqual(self.client.get('/api/auth/password-reset/').status_code, 405)

    def test_unconfigured_mail_is_a_global_failure(self):
        with override_settings(PASSWORD_RESET_DELIVERY='unconfigured'):
            for email in (self.user.email, 'unknown@example.com'):
                self.assertEqual(self.post('password-reset', {'email': email}).status_code, 503)
        self.assertEqual(PasswordResetRequest.objects.count(), 0)

    def test_console_mode_does_not_claim_email_delivery(self):
        with override_settings(PASSWORD_RESET_DELIVERY='console'):
            response = self.post('password-reset', {'email': self.user.email})
            self.assertEqual(response.json()['delivery'], 'console')

    def test_transport_failure_retries_and_expires_queue(self):
        self.post('password-reset', {'email': self.user.email})
        with patch('accounts.management.commands.send_password_resets.send_mail', side_effect=OSError('offline')):
            for _ in range(3):
                call_command('send_password_resets', once=True, stderr=StringIO())
        self.assertFalse(PasswordResetRequest.objects.exists())
        item = PasswordResetRequest.objects.create(email=self.user.email)
        PasswordResetRequest.objects.filter(pk=item.pk).update(created_at=timezone.now() - timedelta(hours=2))
        call_command('send_password_resets', once=True)
        self.assertEqual(len(mail.outbox), 0)


class RegistrationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.data = {'name': ' New Resident ', 'email': ' NEW@example.com ',
                     'password': 'Fresh-Passphrase-583!', 'confirmPassword': 'Fresh-Passphrase-583!',
                     'role': 'tenant'}

    def post(self, data=None, client=None, **extra):
        return (client or self.client).post('/api/auth/register/',
                                            json.dumps(self.data if data is None else data),
                                            content_type='application/json', **extra)

    def test_registration_creates_hashed_account_that_can_sign_in(self):
        response = self.post()
        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(pk=response.json()['user']['id'])
        self.assertEqual(user.email, 'new@example.com')
        self.assertEqual(user.get_full_name(), 'New Resident')
        self.assertTrue(user.check_password(self.data['password']))
        self.assertNotEqual(user.password, self.data['password'])
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(int(self.client.session['_auth_user_id']), user.pk)
        response = self.client.post('/api/auth/login/', json.dumps({
            'email': user.email, 'password': self.data['password']}), content_type='application/json')
        self.assertEqual(response.status_code, 200)

    def test_duplicate_email_including_existing_accounts_is_rejected(self):
        get_user_model().objects.create_user(username='legacy', email='NEW@example.com',
                                             password='Existing-Passphrase-123!')
        self.assertEqual(self.post().status_code, 409)
        self.assertEqual(get_user_model().objects.count(), 1)

    def test_repeated_registration_is_rejected(self):
        self.assertEqual(self.post().status_code, 201)
        self.assertEqual(self.post().status_code, 409)
        self.assertEqual(get_user_model().objects.count(), 1)

    def test_invalid_fields_and_password_policy_do_not_create_accounts(self):
        for overrides in ({'name': ''}, {'name': 'a' * 151}, {'name': []}, {'email': 'bad'},
                          {'password': []}, {'confirmPassword': 'different'},
                          {'password': '12345678', 'confirmPassword': '12345678'},
                          {'password': 'tiny', 'confirmPassword': 'tiny'},
                          {'password': 'new@example.com', 'confirmPassword': 'new@example.com'},
                          {'password': 'x' * 4097, 'confirmPassword': 'x' * 4097}):
            with self.subTest(overrides=overrides):
                cache.clear()
                self.assertEqual(self.post({**self.data, **overrides}).status_code, 400)
        cache.clear()
        self.assertEqual(self.post([]).status_code, 400)
        self.assertFalse(get_user_model().objects.exists())

    def test_csrf_method_and_throttling(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(self.post(client=client).status_code, 403)
        token = client.get('/api/auth/csrf/').json()['csrfToken']
        self.assertEqual(self.post(client=client, HTTP_X_CSRFTOKEN=token).status_code, 201)
        self.assertEqual(self.client.get('/api/auth/register/').status_code, 405)
        for _ in range(4):
            self.assertEqual(self.post().status_code, 409)
        self.assertEqual(self.post().status_code, 429)

    def test_both_roles_persist_through_login_and_session(self):
        for role in AccountProfile.Role.values:
            with self.subTest(role=role):
                data = {**self.data, 'email': f'{role}@example.com', 'role': role}
                response = self.post(data)
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.json()['user']['role'], role)
                user = get_user_model().objects.get(pk=response.json()['user']['id'])
                self.assertEqual(user.account_profile.role, role)
                self.assertTrue(user.check_password(data['password']))
                self.assertFalse(user.is_staff)
                login = self.client.post('/api/auth/login/', json.dumps({
                    'email': data['email'], 'password': data['password'],
                    'role': 'landlord' if role == 'tenant' else 'tenant',
                }), content_type='application/json')
                self.assertEqual(login.json()['user']['role'], role)
                session = self.client.get('/api/auth/session/')
                self.assertEqual(session.json()['user'], login.json()['user'])
                self.assertIn('no-store', session['Cache-Control'])
                self.client.post('/api/auth/logout/')
                self.assertEqual(self.client.get('/api/auth/session/').status_code, 401)

    def test_missing_role_creates_pending_account_and_invalid_roles_are_rejected(self):
        missing = {key: value for key, value in self.data.items() if key != 'role'}
        response = self.post(missing)
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.json()['user']['role'])
        self.assertTrue(self.client.get('/api/auth/session/').json()['user'])
        get_user_model().objects.all().delete()
        cache.clear()
        for data in [{**self.data, 'role': role}
                     for role in ['', 'admin', 'Tenant', [], {}, 1]]:
            with self.subTest(data=data):
                cache.clear()
                self.assertEqual(self.post(data).status_code, 400)
        self.assertFalse(AccountProfile.objects.exists())

    def test_profile_failure_rolls_back_user_creation(self):
        from django.db import IntegrityError
        with patch('accounts.views.AccountProfile.objects.create', side_effect=IntegrityError):
            self.assertEqual(self.post().status_code, 409)
        self.assertFalse(get_user_model().objects.exists())

    def test_database_rejects_invalid_role(self):
        from django.db import IntegrityError, transaction
        self.post()
        with self.assertRaises(IntegrityError), transaction.atomic():
            AccountProfile.objects.update(role='admin')


class SessionTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_legacy_and_staff_users_remain_unassigned(self):
        for staff in [False, True]:
            with self.subTest(staff=staff):
                user = get_user_model().objects.create_user(
                    username=f'legacy-{staff}', email=f'legacy-{staff}@example.com',
                    password='Legacy-Passphrase-583!', is_staff=staff, is_superuser=staff)
                response = self.client.post('/api/auth/login/', json.dumps({
                    'email': user.email, 'password': 'Legacy-Passphrase-583!', 'role': 'landlord',
                }), content_type='application/json')
                self.assertEqual(response.status_code, 200)
                self.assertIsNone(response.json()['user']['role'])
                self.assertIsNone(self.client.get('/api/auth/session/').json()['user']['role'])
                self.assertFalse(AccountProfile.objects.filter(user=user).exists())

    def test_session_requires_authentication_and_get(self):
        self.assertEqual(self.client.get('/api/auth/session/').status_code, 401)
        self.assertEqual(self.client.post('/api/auth/session/').status_code, 405)

    def test_expired_and_inactive_sessions_are_rejected(self):
        user = get_user_model().objects.create_user(username='session-user')
        self.client.force_login(user)
        session = self.client.session
        session.set_expiry(-1)
        session.save()
        self.assertEqual(self.client.get('/api/auth/session/').status_code, 401)
        self.client.force_login(user)
        user.is_active = False
        user.save()
        self.assertEqual(self.client.get('/api/auth/session/').status_code, 401)

    def test_logout_requires_csrf_and_invalidates_session(self):
        user = get_user_model().objects.create_user(username='logout-user')
        client = Client(enforce_csrf_checks=True)
        client.force_login(user)
        self.assertEqual(client.post('/api/auth/logout/').status_code, 403)
        self.assertEqual(client.get('/api/auth/session/').status_code, 200)
        token = client.get('/api/auth/csrf/').json()['csrfToken']
        self.assertEqual(client.post('/api/auth/logout/', HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.assertEqual(client.get('/api/auth/session/').status_code, 401)


class FirebaseSessionTests(TestCase):
    def setUp(self):
        cache.clear()
        self.claims = {
            'uid': 'firebase-user-123',
            'email': 'firebase@example.com',
            'email_verified': True,
            'name': 'Firebase Resident',
            'aud': 'leaseguard-9141a',
            'iss': 'https://securetoken.google.com/leaseguard-9141a',
        }

    def post(self, endpoint, data):
        return self.client.post(
            f'/api/auth/firebase/{endpoint}/', json.dumps(data),
            content_type='application/json',
        )

    @patch('accounts.views.verify_firebase_id_token')
    def test_new_verified_firebase_user_gets_one_pending_profile_and_session(self, verify):
        verify.return_value = self.claims
        response = self.post('session', {'idToken': 'mock-token'})
        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(pk=response.json()['user']['id'])
        self.assertEqual(user.email, 'firebase@example.com')
        self.assertEqual(user.get_full_name(), 'Firebase Resident')
        self.assertFalse(user.has_usable_password())
        self.assertIsNone(user.account_profile.role)
        self.assertEqual(user.firebase_identity.uid, self.claims['uid'])
        self.assertEqual(self.client.get('/api/auth/session/').status_code, 200)
        verify.assert_called_once_with('mock-token')

    @patch('accounts.views.verify_firebase_id_token')
    def test_returning_firebase_user_keeps_existing_role_and_record(self, verify):
        verify.return_value = self.claims
        user = get_user_model().objects.create_user(
            username='firebase_user', email='firebase@example.com')
        AccountProfile.objects.create(user=user, role='tenant')
        FirebaseIdentity.objects.create(user=user, uid=self.claims['uid'], email=user.email)
        response = self.post('session', {'idToken': 'mock-token'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['user']['id'], user.pk)
        self.assertEqual(response.json()['user']['role'], 'tenant')
        self.assertEqual(get_user_model().objects.count(), 1)

    @patch('accounts.views.verify_firebase_id_token')
    def test_existing_email_is_not_automatically_linked(self, verify):
        verify.return_value = self.claims
        user = get_user_model().objects.create_user(
            username='legacy', email='firebase@example.com', password='Original-Passphrase-957!')
        AccountProfile.objects.create(user=user, role='landlord')
        response = self.post('session', {'idToken': 'mock-token'})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['code'], 'account_link_required')
        self.assertFalse(FirebaseIdentity.objects.exists())
        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertEqual(user.account_profile.role, 'landlord')

    @patch('accounts.views.verify_firebase_id_token')
    def test_legacy_account_link_requires_existing_password_and_preserves_role(self, verify):
        verify.return_value = self.claims
        user = get_user_model().objects.create_user(
            username='legacy', email='firebase@example.com', password='Original-Passphrase-957!')
        AccountProfile.objects.create(user=user, role='tenant')
        bad = self.post('link', {'idToken': 'mock-token', 'legacyPassword': 'wrong'})
        self.assertEqual(bad.status_code, 401)
        linked = self.post('link', {
            'idToken': 'mock-token', 'legacyPassword': 'Original-Passphrase-957!',
        })
        self.assertEqual(linked.status_code, 200)
        self.assertEqual(linked.json()['user']['id'], user.pk)
        self.assertEqual(user.account_profile.role, 'tenant')
        self.assertEqual(FirebaseIdentity.objects.get().user, user)
        self.assertEqual(get_user_model().objects.count(), 1)

    def test_missing_or_invalid_token_is_rejected(self):
        response = self.post('session', {})
        self.assertEqual(response.status_code, 401)
        with patch('accounts.views.verify_firebase_id_token', side_effect=FirebaseAuthenticationError):
            response = self.post('session', {'idToken': 'expired-or-invalid'})
        self.assertEqual(response.status_code, 401)
        self.assertFalse(get_user_model().objects.exists())

    def test_unverified_email_is_rejected(self):
        claims = {**self.claims, 'email_verified': False}
        with patch('accounts.views.verify_firebase_id_token', return_value=claims):
            response = self.post('session', {'idToken': 'unverified'})
        self.assertEqual(response.status_code, 401)
        self.assertFalse(get_user_model().objects.exists())

    @patch('accounts.firebase_auth.auth.verify_id_token')
    @patch('accounts.firebase_auth._firebase_app')
    @override_settings(FIREBASE_PROJECT_ID='leaseguard-9141a')
    def test_token_for_another_project_is_rejected(self, app, verify):
        verify.return_value = {
            **self.claims,
            'aud': 'other-firebase-project',
            'iss': 'https://securetoken.google.com/other-firebase-project',
        }
        with self.assertRaises(FirebaseAuthenticationError):
            verify_firebase_id_token('signed-token')
