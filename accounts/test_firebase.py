import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, local
from unittest.mock import patch

from bson import ObjectId
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connections
from django.test import Client, TestCase, TransactionTestCase, override_settings

from .firebase_auth import FirebaseAuthenticationError, verify_firebase_id_token
from .models import AccountProfile, FirebaseIdentity


@override_settings(FIREBASE_PROJECT_ID='leaseguard-9141a')
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
    def test_new_verified_firebase_user_gets_objectid_and_session_without_a_role(self, verify):
        verify.return_value = self.claims
        response = self.post('session', {'idToken': 'mock-token'})
        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(pk=response.json()['user']['id'])
        self.assertEqual(user.email, 'firebase@example.com')
        self.assertEqual(user.get_full_name(), 'Firebase Resident')
        self.assertFalse(user.has_usable_password())
        self.assertFalse(AccountProfile.objects.filter(user=user).exists())
        self.assertTrue(ObjectId.is_valid(response.json()['user']['id']))
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
        self.assertEqual(response.json()['user']['id'], str(user.pk))
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
        self.assertEqual(linked.json()['user']['id'], str(user.pk))
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

    @patch('accounts.views.verify_firebase_id_token')
    def test_different_uid_cannot_replace_existing_identity(self, verify):
        verify.return_value = self.claims
        self.assertEqual(self.post('session', {'idToken': 'first'}).status_code, 201)
        verify.return_value = {**self.claims, 'uid': 'other'}
        self.assertEqual(self.post('session', {'idToken': 'second'}).status_code, 409)
        self.assertEqual(FirebaseIdentity.objects.get().uid, self.claims['uid'])

    @patch('accounts.views.verify_firebase_id_token')
    def test_disabled_identity_does_not_get_a_session(self, verify):
        verify.return_value = self.claims
        user = get_user_model().objects.create_user(
            username='disabled', email=self.claims['email'], is_active=False,
        )
        FirebaseIdentity.objects.create(user=user, uid=self.claims['uid'], email=user.email)
        self.assertEqual(self.post('session', {'idToken': 'mock'}).status_code, 403)
        self.assertEqual(self.client.get('/api/auth/session/').status_code, 401)

    @patch('accounts.views.verify_firebase_id_token')
    def test_token_exchange_and_link_require_csrf(self, verify):
        client = Client(enforce_csrf_checks=True)
        for endpoint in ['session', 'link']:
            response = client.post(
                f'/api/auth/firebase/{endpoint}/', {'idToken': 'mock'},
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 403)
        verify.assert_not_called()

    @patch('accounts.views.verify_firebase_id_token', side_effect=FirebaseAuthenticationError)
    def test_rate_limits_apply_before_token_verification(self, verify):
        for endpoint, limit in [('session', 20), ('link', 5)]:
            with self.subTest(endpoint=endpoint):
                verify.reset_mock()
                for _ in range(limit):
                    self.assertEqual(self.post(endpoint, {'idToken': 'mock'}).status_code, 401)
                throttled = self.post(endpoint, {'idToken': 'mock'})
                self.assertEqual(throttled.status_code, 429)
                self.assertEqual(throttled['Retry-After'], '60')
                self.assertEqual(verify.call_count, limit)

    @patch('accounts.views.verify_firebase_id_token')
    def test_firebase_role_can_only_be_set_once(self, verify):
        verify.return_value = self.claims
        self.assertEqual(self.post('session', {'idToken': 'mock'}).status_code, 201)
        url = '/api/auth/role/'
        first = self.client.post(url, {'role': 'tenant'}, content_type='application/json')
        second = self.client.post(url, {'role': 'landlord'}, content_type='application/json')
        self.assertEqual(first.json()['user']['role'], 'tenant')
        self.assertEqual(second.status_code, 409)
        self.assertEqual(AccountProfile.objects.get().role, 'tenant')


@override_settings(FIREBASE_PROJECT_ID='leaseguard-9141a')
class FirebaseConcurrencyTests(TransactionTestCase):
    def setUp(self):
        cache.clear()

    def run_race(self, requests):
        User = get_user_model()
        original_save = User.save
        before_save = Barrier(2, timeout=10)
        thread = local()

        def synchronized_save(user, *args, **kwargs):
            if user._state.adding and not getattr(thread, 'waited', False):
                thread.waited = True
                before_save.wait()
            return original_save(user, *args, **kwargs)

        def post(request):
            try:
                endpoint, data = request
                return Client().post(endpoint, data, content_type='application/json')
            finally:
                connections.close_all()

        with patch.object(User, 'save', synchronized_save), ThreadPoolExecutor(2) as workers:
            return list(workers.map(post, requests))

    def firebase_request(self, uid):
        return '/api/auth/firebase/session/', {'idToken': uid}

    @patch('accounts.views.verify_firebase_id_token')
    def test_different_uids_cannot_create_accounts_for_the_same_email(self, verify):
        verify.side_effect = lambda token: {
            'uid': token, 'email': 'concurrent@example.com', 'email_verified': True,
        }
        responses = self.run_race([
            self.firebase_request('first-uid'), self.firebase_request('second-uid'),
        ])
        self.assertCountEqual([response.status_code for response in responses], [201, 409])
        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertEqual(FirebaseIdentity.objects.count(), 1)

    @patch('accounts.views.verify_firebase_id_token')
    def test_same_uid_reuses_the_committed_account(self, verify):
        verify.return_value = {
            'uid': 'same-uid', 'email': 'concurrent@example.com', 'email_verified': True,
        }
        responses = self.run_race([self.firebase_request('same-uid')] * 2)
        self.assertCountEqual([response.status_code for response in responses], [201, 200])
        self.assertEqual(responses[0].json()['user']['id'], responses[1].json()['user']['id'])
        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertEqual(FirebaseIdentity.objects.count(), 1)

    @patch('accounts.views.verify_firebase_id_token')
    def test_password_registration_and_firebase_share_the_email_guard(self, verify):
        verify.return_value = {
            'uid': 'mixed-uid', 'email': 'concurrent@example.com', 'email_verified': True,
        }
        password = 'Strong-Passphrase-957!'
        firebase_response, password_response = self.run_race([
            self.firebase_request('mixed-uid'),
            ('/api/auth/register/', {
                'name': 'Test Resident', 'email': 'Concurrent@example.com',
                'password': password, 'confirmPassword': password, 'role': 'tenant',
            }),
        ])
        self.assertCountEqual([firebase_response.status_code, password_response.status_code], [201, 409])
        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertEqual(FirebaseIdentity.objects.count(), int(firebase_response.status_code == 201))
        self.assertEqual(AccountProfile.objects.count(), int(password_response.status_code == 201))

    @patch('accounts.views.verify_firebase_id_token')
    def test_uid_conflict_rolls_back_second_user_and_refuses_changed_email(self, verify):
        verify.side_effect = lambda token: {
            'uid': 'one-uid', 'email': f'{token}@example.com', 'email_verified': True,
        }
        responses = self.run_race([self.firebase_request('one'), self.firebase_request('two')])
        self.assertCountEqual([response.status_code for response in responses], [201, 409])
        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertEqual(FirebaseIdentity.objects.get().email, get_user_model().objects.get().email)
