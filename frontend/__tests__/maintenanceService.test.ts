import {
  uploadGuided,
  guidedAction,
} from '../src/services/guidedInspectionService';
import { guidedFixture } from '../testFixtures/guided';
import { ApiError, request } from '../src/services/api';
import {
  createDraft,
  uploadMaintenancePhoto,
} from '../src/services/maintenanceService';

jest.mock('../src/services/api', () => ({
  API_BASE_URL: 'http://localhost:8000/api',
  ApiError: class extends Error {},
  request: jest.fn(),
  authPost: jest.fn(),
}));

let xhr: {
  open: jest.Mock;
  setRequestHeader: jest.Mock;
  send: jest.Mock;
  withCredentials: boolean;
  timeout: number;
  status: number;
  responseText: string;
  upload: { onprogress?: (event: object) => void };
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
};
const nativeXHR = globalThis.XMLHttpRequest;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(request).mockResolvedValue({ csrfToken: 'fixture-csrf' });
  xhr = {
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    send: jest.fn(),
    withCredentials: false,
    timeout: 0,
    status: 200,
    responseText: '{}',
    upload: {},
  };
  globalThis.XMLHttpRequest = jest.fn(
    () => xhr,
  ) as unknown as typeof XMLHttpRequest;
});
afterEach(() => {
  globalThis.XMLHttpRequest = nativeXHR;
});

it('uploads with session cookies, CSRF, bounded timeout and per-photo transfer progress', async () => {
  const progress = jest.fn();
  const result = uploadMaintenancePhoto(
    'a'.repeat(32),
    { uri: 'file:///photo.png', type: 'image/png' },
    progress,
  );
  await Promise.resolve();
  expect(xhr.withCredentials).toBe(true);
  expect(xhr.timeout).toBe(65000);
  expect(xhr.setRequestHeader).toHaveBeenCalledWith(
    'X-CSRFToken',
    'fixture-csrf',
  );
  expect(xhr.setRequestHeader).not.toHaveBeenCalledWith(
    'Content-Type',
    expect.anything(),
  );
  xhr.upload.onprogress!({ lengthComputable: true, loaded: 5, total: 10 });
  expect(progress).toHaveBeenCalledWith(50);
  xhr.responseText = JSON.stringify({ request: { id: 'saved' } });
  xhr.onload!();
  await expect(result).resolves.toEqual({ id: 'saved' });
});
it('reports recoverable timeouts without automatically retrying', async () => {
  const result = uploadMaintenancePhoto(
    'draft',
    { uri: 'file:///photo.jpg' },
    jest.fn(),
  );
  await Promise.resolve();
  xhr.ontimeout!();
  await expect(result).rejects.toThrow('Upload interrupted');
  expect(xhr.send).toHaveBeenCalledTimes(1);
});
it('surfaces sanitized server errors and rejects absent CSRF tokens', async () => {
  const result = uploadMaintenancePhoto(
    'draft',
    { uri: 'file:///photo.jpg' },
    jest.fn(),
  );
  await Promise.resolve();
  xhr.status = 503;
  xhr.responseText = JSON.stringify({ detail: 'Storage unavailable.' });
  xhr.onload!();
  await expect(result).rejects.toThrow('Storage unavailable.');
  jest.mocked(request).mockResolvedValue({ csrfToken: '' });
  await expect(
    uploadMaintenancePhoto('draft', { uri: 'file:///photo.jpg' }, jest.fn()),
  ).rejects.toBeInstanceOf(ApiError);
  expect(xhr.send).toHaveBeenCalledTimes(1);
});
it('keeps draft-creation idempotency keys in the authenticated API call', async () => {
  const { authPost } = jest.requireMock('../src/services/api');
  authPost.mockResolvedValue({ request: { id: 'saved' } });
  await createDraft(
    'unit',
    { area: 'Kitchen', description: 'Leak', urgency: 'normal' },
    'same-key',
  );
  expect(authPost).toHaveBeenCalledWith(
    '/maintenance/',
    expect.objectContaining({ unit_id: 'unit', idempotency_key: 'same-key' }),
  );
});

it('normalizes the native iOS image/jpg MIME before multipart upload', async () => {
  const append = jest.spyOn(FormData.prototype, 'append');
  try {
    const result = uploadMaintenancePhoto(
      'draft',
      { uri: 'file:///ios.jpg', type: 'image/jpg' },
      jest.fn(),
    );
    await Promise.resolve();
    expect(append).toHaveBeenCalledWith(
      'photo',
      expect.objectContaining({ type: 'image/jpeg', uri: 'file:///ios.jpg' }),
    );
    xhr.responseText = JSON.stringify({ request: { id: 'saved' } });
    xhr.onload!();
    await expect(result).resolves.toEqual({ id: 'saved' });
  } finally {
    append.mockRestore();
  }
});

it('includes stable guided step, slot and revision and waits for server confirmation', async () => {
  const append = jest.spyOn(FormData.prototype, 'append');
  const confirmed = jest.fn();
  try {
    const result = uploadGuided(
      guidedFixture,
      'step-0',
      0,
      { uri: 'file:///photo.jpg' },
      jest.fn(),
    );
    result.then(confirmed);
    await Promise.resolve();
    expect(append).toHaveBeenCalledWith('step_id', 'step-0');
    expect(append).toHaveBeenCalledWith('revision', '0');
    expect(append).toHaveBeenCalledWith('slot', '0');
    xhr.upload.onprogress!({ lengthComputable: true, loaded: 10, total: 10 });
    expect(confirmed).not.toHaveBeenCalled();
    xhr.responseText = JSON.stringify({
      inspection: { ...guidedFixture, progress: 1 },
    });
    xhr.onload!();
    await expect(result).resolves.toEqual(
      expect.objectContaining({ progress: 1 }),
    );
  } finally {
    append.mockRestore();
  }
});
it('sends revision with explicit comparison actions and never retries them', async () => {
  const { authPost } = jest.requireMock('../src/services/api');
  authPost.mockRejectedValueOnce(new ApiError('Interrupted'));
  await expect(
    guidedAction(guidedFixture, 'compare', { photo_id: 'photo' }),
  ).rejects.toThrow('Interrupted');
  expect(authPost).toHaveBeenCalledTimes(1);
  expect(authPost).toHaveBeenCalledWith(expect.stringContaining('/compare/'), {
    revision: 0,
    photo_id: 'photo',
  });
});
