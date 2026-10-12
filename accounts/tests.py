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

from .models import PasswordResetRequest


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
