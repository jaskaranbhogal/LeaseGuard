import { chooseRole, getSession, linkLegacyAccount, logout, synchronizeFirebaseUser } from '../src/services/authService';
import { request } from '../src/services/api';

const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;
const firebaseSdk = jest.requireMock('@react-native-firebase/auth');
const firebaseAuth = firebaseSdk.getAuth();
beforeEach(() => {
  globalThis.fetch = fetchMock;
  fetchMock.mockReset();
  firebaseAuth.currentUser = {
    emailVerified: true,
    providerData: [],
    getIdToken: jest.fn().mockResolvedValue('mock-id-token'),
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});
const response = (data: object, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
});

const user = {
  id: '507f1f77bcf86cd799439011',
  email: 'tenant@example.com',
  name: 'Tenant',
  role: 'tenant',
};

it('restores the account from a Firebase token and treats only 401 as signed out', async () => {
  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'csrf' }));
  fetchMock.mockResolvedValueOnce(response({ user }));
  await expect(getSession()).resolves.toEqual(user);
  expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  expect(fetchMock.mock.calls[1][0]).toContain('/auth/firebase/session/');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ idToken: 'mock-id-token' });
  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'csrf' }));
  fetchMock.mockResolvedValueOnce(response({ detail: 'Please sign in.' }, 401));
  await expect(getSession()).resolves.toBeNull();
  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'csrf' }));
  fetchMock.mockResolvedValueOnce(response({}, 503));
  await expect(getSession()).rejects.toThrow();
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  await expect(getSession()).rejects.toThrow('Unable to reach');
});

it.each([null, undefined, 1, '', '1', '507f1f77bcf86cd79943901',
  '507f1f77bcf86cd79943901z', '507f1f77bcf86cd799439011\n',
])('rejects a malformed account ID during restoration (%p)', async id => {
  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'csrf' }));
  fetchMock.mockResolvedValueOnce(response({ user: { ...user, id } }));
  await expect(getSession()).rejects.toThrow('LeaseGuard could not load your account');
});

it('accepts string IDs across exchange, legacy linking, and role selection', async () => {
  const pendingUser = { ...user, role: null };
  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'csrf' }));
  fetchMock.mockResolvedValueOnce(response({ user: pendingUser }, 201));
  await expect(synchronizeFirebaseUser('mock-token')).resolves.toEqual(pendingUser);

  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'csrf' }));
  fetchMock.mockResolvedValueOnce(response({ user }));
  await expect(linkLegacyAccount('mock-token', 'legacy-password')).resolves.toEqual(user);

  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'csrf' }));
  fetchMock.mockResolvedValueOnce(response({ user }));
  await expect(chooseRole('tenant')).resolves.toEqual(user);
});

it('posts logout with a fresh CSRF token and includes the cookie session', async () => {
  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'test-csrf' }));
  fetchMock.mockResolvedValueOnce(response({ detail: 'Signed out.' }));
  await logout();
  expect(fetchMock.mock.calls[1][0]).toContain('/auth/logout/');
  expect(fetchMock.mock.calls[1][1]).toMatchObject({
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRFToken': 'test-csrf' },
  });
});

it('serializes logout before a newer Firebase session exchange', async () => {
  let finishLogout!: (value: ReturnType<typeof response>) => void;
  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'logout-csrf' }));
  fetchMock.mockImplementationOnce(
    () => new Promise(resolve => { finishLogout = resolve; }),
  );
  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'signin-csrf' }));
  fetchMock.mockResolvedValueOnce(response({ user }, 200));

  const pendingLogout = logout();
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledTimes(2);

  const pendingSignIn = synchronizeFirebaseUser('new-account-token');
  await Promise.resolve();
  expect(fetchMock).toHaveBeenCalledTimes(2);

  finishLogout(response({ detail: 'Signed out.' }));
  await pendingLogout;
  await pendingSignIn;
  expect(fetchMock.mock.calls[1][0]).toContain('/auth/logout/');
  expect(fetchMock.mock.calls[3][0]).toContain('/auth/firebase/session/');
});

it('reports request network errors and backend failures', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('network'));
  await expect(request('/auth/csrf/')).rejects.toThrow(
    'Unable to reach LeaseGuard',
  );
  fetchMock.mockResolvedValueOnce(
    response({ detail: 'Unavailable.' }, 503),
  );
  await expect(request('/auth/role/')).rejects.toThrow('Unavailable.');
});

it('times out stalled requests', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementationOnce(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () =>
          reject(new Error('aborted')),
        );
      }),
  );
  await Promise.all([
    expect(request('/auth/csrf/')).rejects.toThrow('timed out'),
    jest.advanceTimersByTimeAsync(15000),
  ]);
});

it('does not restore a Firebase cookie when the native Firebase user is gone', async () => {
  firebaseAuth.currentUser = null;
  fetchMock.mockResolvedValueOnce(response({
    user, firebaseSession: true, firebaseUid: 'firebase-account-a',
  }));
  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'logout-csrf' }));
  fetchMock.mockResolvedValueOnce(response({ detail: 'Signed out.' }));
  await expect(getSession()).resolves.toBeNull();
  expect(fetchMock.mock.calls[2][0]).toContain('/auth/logout/');
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
    firebaseUid: 'firebase-account-a',
  });
});
