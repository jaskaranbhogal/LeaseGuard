import { login, requestPasswordReset } from '../src/services/authService';
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
function csrf() {
  fetchMock.mockResolvedValueOnce(response({ csrfToken: 'test-csrf' }));
}

it('uses a CSRF handshake and cookie-backed session for login', async () => {
  csrf();
  fetchMock.mockResolvedValueOnce(
    response({ user: { id: 8, email: 'person@example.com', name: 'Person' } }),
  );
  expect((await login(' person@example.com ', 'fixture-password')).id).toBe(8);
  expect(fetchMock.mock.calls[1][1]).toMatchObject({
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRFToken': 'test-csrf' },
    body: JSON.stringify({
      email: 'person@example.com',
      password: 'fixture-password',
    }),
  });
});
it('rejects missing users in successful HTTP responses', async () => {
  csrf();
  fetchMock.mockResolvedValueOnce(response({}));
  await expect(login('person@example.com', 'fixture-password')).rejects.toThrow(
    'invalid sign-in',
  );
});
it('accepts only the reset API delivery contract', async () => {
  csrf();
  fetchMock.mockResolvedValueOnce(response({ delivery: 'console' }, 202));
  await expect(requestPasswordReset('person@example.com')).resolves.toBe(
    'console',
  );
  csrf();
  fetchMock.mockResolvedValueOnce(response({ message: 'ok' }));
  await expect(requestPasswordReset('person@example.com')).rejects.toThrow(
    'did not confirm',
  );
});
it('reports network errors and backend failures', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('network'));
  await expect(request('/auth/csrf/')).rejects.toThrow(
    'Unable to reach LeaseGuard',
  );
  fetchMock.mockResolvedValueOnce(
    response({ detail: 'Email is not configured.' }, 503),
  );
  await expect(request('/auth/password-reset/')).rejects.toThrow(
    'Email is not configured.',
  );
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
