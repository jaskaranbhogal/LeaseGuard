import { getSession, logout } from '../src/services/authService';
import { request } from '../src/services/api';

const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = fetchMock;
  fetchMock.mockReset();
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

it('restores only a valid server session and treats only 401 as signed out', async () => {
  const user = {
    id: 1,
    email: 'tenant@example.com',
    name: 'Tenant',
    role: 'tenant',
  };
  fetchMock.mockResolvedValueOnce(response({ user }));
  await expect(getSession()).resolves.toEqual(user);
  expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  fetchMock.mockResolvedValueOnce(response({ detail: 'Please sign in.' }, 401));
  await expect(getSession()).resolves.toBeNull();
  fetchMock.mockResolvedValueOnce(response({}, 503));
  await expect(getSession()).rejects.toThrow();
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  await expect(getSession()).rejects.toThrow('Unable to reach');
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
