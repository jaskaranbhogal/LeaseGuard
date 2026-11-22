jest.mock('../src/services/leaseService', () => ({
  landlordApi: {
    state: jest.fn(async () => ({
      consented: true,
      properties: [],
      activity: [],
    })),
    addProperty: jest.fn(),
    updateUnit: jest.fn(),
    invite: jest.fn(),
  },
  tenantApi: {
    state: jest.fn(async () => ({
      consented: true,
      welcomed: true,
      baselineReviewed: false,
      movePhotos: {},
      unit: null,
      details: null,
      pendingInvite: null,
    })),
  },
  listAppointments: jest.fn(async () => ({ appointments: [] })),
  appointmentAction: jest.fn(async () => ({ saved: true })),
  consent: jest.fn(),
}));
import * as guided from '../src/services/guidedInspectionService';
import { guidedFixture } from '../testFixtures/guided';
import React from 'react';
import {
  act,
  create,
  type ReactTestRenderer,
  type ReactTestInstance,
} from 'react-test-renderer';
import {
  NavigationContainer,
  StackActions,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert, AppState, Image, Text, TextInput } from 'react-native';
import { AuthProvider } from '../src/context/AuthContext';
import RootNavigator from '../src/navigation/RootNavigator';
import type { TenantStackParamList } from '../src/navigation/types';
import LandlordDashboardScreen from '../src/screens/landlord/LandlordDashboardScreen';
import TenantDashboardScreen from '../src/screens/tenant/TenantDashboardScreen';
import GuidedInspectionScreen from '../src/screens/tenant/GuidedInspectionScreen';
import InspectionSubmittedScreen from '../src/screens/tenant/InspectionSubmittedScreen';
import MaintenanceDetailScreen from '../src/screens/tenant/MaintenanceDetailScreen';
import AppointmentsScreen from '../src/screens/shared/AppointmentsScreen';
import * as housing from '../src/services/leaseService';
import ReportMaintenanceScreen from '../src/screens/tenant/ReportMaintenanceScreen';
import UnitHistoryScreen from '../src/screens/tenant/UnitHistoryScreen';
import LoginScreen from '../src/screens/auth/LoginScreen';
import Button from '../src/components/Button';
import * as auth from '../src/services/authService';
import * as maintenance from '../src/services/maintenanceService';
import PhotoReview from '../src/components/PhotoReview';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { ApiError } from '../src/services/api';
import type { User } from '../src/types/user';
import type { MaintenanceRequestId } from '../src/types/maintenance';

jest.mock('../src/services/authService');
jest.mock('../src/services/guidedInspectionService');
jest.mock('../src/services/maintenanceService');
const savedRequest: maintenance.MaintenanceRequest = {
  id: 'a'.repeat(32),
  unit_id: 'b'.repeat(24),
  property: 'Verified property',
  unit: '101',
  area: 'Kitchen sink leak',
  description: 'Water leaking under sink cabinet',
  urgency: 'normal',
  status: 'submitted',
  created_at: '2026-11-18T12:00:00Z',
  updated_at: '2026-11-18T12:00:00Z',
  submitted_at: '2026-11-18T12:00:00Z',
  photos: [],
  history: [],
  comparison_available: false,
  comparison_limitation: 'No verified baseline linked to this unit and area.',
};
const tenant: User = {
  id: '000000000000000000000001',
  name: 'Test Tenant',
  email: 'tenant@example.com',
  role: 'tenant',
};
const landlord: User = {
  id: '000000000000000000000002',
  name: 'Test Landlord',
  email: 'landlord@example.com',
  role: 'landlord',
};
let app: ReactTestRenderer;
let navigation: ReturnType<
  typeof createNavigationContainerRef<TenantStackParamList>
>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest
    .mocked(guided.listGuided)
    .mockResolvedValue({ inspections: [guidedFixture], next: null });
  jest.mocked(guided.getGuided).mockResolvedValue(guidedFixture);
  jest
    .mocked(guided.guidedNotifications)
    .mockResolvedValue({ notifications: [] });
  jest
    .mocked(maintenance.listMaintenance)
    .mockResolvedValue({ requests: [savedRequest], next: null });
  jest
    .mocked(maintenance.assignedUnits)
    .mockResolvedValue([
      { id: savedRequest.unit_id, label: '101', property: 'Verified property' },
    ]);
  jest.mocked(maintenance.getMaintenance).mockImplementation(async id => {
    if (id !== savedRequest.id)
      throw new ApiError('Maintenance request not found.', 404);
    return savedRequest;
  });
  jest.mocked(auth.getSession).mockReset();
  jest.mocked(auth.logout).mockReset().mockResolvedValue(undefined);
  navigation = createNavigationContainerRef<TenantStackParamList>();
});
afterEach(async () => {
  if (app) {
    await act(async () => app.unmount());
  }
  jest.restoreAllMocks();
  jest.useRealTimers();
});
async function mount(user: User | null = tenant) {
  jest.mocked(auth.getSession).mockResolvedValue(user);
  await render();
}
async function render() {
  await act(async () => {
    app = create(
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer ref={navigation}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>,
    );
  });
  await act(async () => app.root.findByType(Image).props.onLoadEnd());
  await act(async () => jest.advanceTimersByTime(1500));
}
async function press(label: string, within?: ReactTestInstance) {
  const scope = within ?? app.root;
  const target = scope
    .findAll(node => typeof node.props.onPress === 'function')
    .find(
      item =>
        item.props.accessibilityLabel === label ||
        item
          .findAllByType(Text)
          .some(
            text => [text.props.children].flat(Infinity).join('') === label,
          ),
    );
  expect(target).toBeDefined();
  await act(async () => {
    target!.props.onPress();
  });
}
async function signIn(user: User) {
  jest.mocked(auth.login).mockResolvedValueOnce(user);
  const screen = app.root.findByType(LoginScreen);
  await act(async () => {
    screen.findAllByType(TextInput)[0].props.onChangeText(user.email);
    screen.findAllByType(TextInput)[1].props.onChangeText('fixture-password');
  });
  await act(async () => screen.findByType(Button).props.onPress());
}
it.each([tenant, landlord])(
  'routes a restored $role session to its dashboard',
  async user => {
    await mount(user);
    expect(navigation.getCurrentRoute()?.name).toBe(
      user.role === 'tenant' ? 'Home' : 'Dashboard',
    );
    expect(app.root.findAllByType(LoginScreen)).toHaveLength(0);
    expect(navigation.canGoBack()).toBe(false);
    if (user.role === 'landlord') {
      expect(app.root.findAllByType(LandlordDashboardScreen)).toHaveLength(1);
    }
  },
);
it('routes repeated logins and clears private inspection screens on logout', async () => {
  await mount(null);
  await signIn(tenant);
  await press('Start guided inspection');
  expect(guided.getGuided).toHaveBeenCalledWith(guidedFixture.id);
  await act(async () => navigation.dispatch(StackActions.popTo('TenantTabs')));
  await press('Settings');
  await press('Log out');
  expect(app.root.findAllByType(GuidedInspectionScreen)).toHaveLength(0);
  expect(navigation.getCurrentRoute()?.name).toBe('Login');
  expect(navigation.canGoBack()).toBe(false);
  await signIn(landlord);
  await press('Settings');
  await press('Log out');
  await signIn(tenant);
  await press('Start guided inspection');
  expect(navigation.getCurrentRoute()?.params).toEqual({
    inspectionId: guidedFixture.id,
  });
});

it('explains an empty inspection list and offers maintenance without an inspection', async () => {
  jest
    .mocked(guided.listGuided)
    .mockResolvedValue({ inspections: [], next: null });
  await mount();
  await press('Inspections');
  expect(JSON.stringify(app.toJSON())).toContain(
    'Your landlord needs to assign',
  );
  expect(
    app.root
      .findAllByType(Button)
      .filter(b => b.props.title === 'Start guided inspection'),
  ).toHaveLength(0);
  await press('Report maintenance');
  expect(navigation.getCurrentRoute()?.name).toBe('ReportMaintenance');
});
it('resumes an assigned draft from its saved inspection record', async () => {
  jest.mocked(guided.listGuided).mockResolvedValue({
    inspections: [{ ...guidedFixture, status: 'draft', progress: 1 }],
    next: null,
  });
  await mount();
  await press('Resume guided inspection');
  expect(guided.getGuided).toHaveBeenCalledWith(guidedFixture.id);
  expect(navigation.getCurrentRoute()?.params).toEqual({
    inspectionId: guidedFixture.id,
  });
});
it('shows logout failures and permits a retry', async () => {
  await mount(landlord);
  jest
    .mocked(auth.logout)
    .mockRejectedValueOnce(new ApiError('Unable to reach LeaseGuard.'));
  await press('Settings');
  await press('Log out');
  // Landlord Settings is a nested stack; its first screen is SettingsHome.
  expect(navigation.getCurrentRoute()?.name).toBe('SettingsHome');
  expect(JSON.stringify(app.toJSON())).toContain('Unable to reach LeaseGuard.');
  await press('Log out');
  expect(navigation.getCurrentRoute()?.name).toBe('Login');
});
it('recovers from network failures and removes expired dashboard sessions', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  jest
    .mocked(auth.getSession)
    .mockRejectedValueOnce(new ApiError('Connection unavailable.'));
  await render();
  expect(JSON.stringify(app.toJSON())).toContain('Connection unavailable.');
  expect(app.root.findAllByType(TenantDashboardScreen)).toHaveLength(0);
  jest.mocked(auth.getSession).mockResolvedValueOnce(tenant);
  await press('Retry session check');
  expect(navigation.getCurrentRoute()?.name).toBe('Home');
  jest.mocked(auth.getSession).mockResolvedValueOnce(null);
  const callback = listener.mock.calls[listener.mock.calls.length - 1][1];
  await act(async () => callback('active'));
  expect(navigation.getCurrentRoute()?.name).toBe('Login');
  expect(navigation.canGoBack()).toBe(false);
  expect(app.root.findAllByType(TenantDashboardScreen)).toHaveLength(0);
});
it('captures five real photos, discards previews, waits for uploads and submits', async () => {
  let saved = { ...guidedFixture, photos: [...guidedFixture.photos] };
  jest.mocked(guided.getGuided).mockImplementation(async () => saved);
  jest
    .mocked(guided.uploadGuided)
    .mockImplementation(async (_record, step, slot) => {
      saved = {
        ...saved,
        revision: saved.revision + 1,
        progress: saved.progress + 1,
        photos: [
          ...saved.photos,
          { id: step, step_id: step, slot, state: 'ready' },
        ],
      };
      return saved;
    });
  jest.mocked(guided.guidedAction).mockImplementation(async () => {
    saved = { ...saved, status: 'submitted' };
    return saved;
  });
  jest.mocked(launchCamera).mockResolvedValue({
    assets: [{ uri: 'file:///camera.jpg', type: 'image/jpeg' }],
  });
  jest.mocked(launchImageLibrary).mockResolvedValue({
    assets: [{ uri: 'file:///gallery.jpg', type: 'image/jpeg' }],
  });
  await mount();
  await press('Start guided inspection');
  await press('Take photo', app.root.findByType(GuidedInspectionScreen));
  await act(async () => app.root.findByType(PhotoReview).props.onDiscard());
  expect(guided.uploadGuided).not.toHaveBeenCalled();
  for (let i = 0; i < 5; i++) {
    await press(
      i % 2 ? 'Choose from gallery' : 'Take photo',
      app.root.findByType(GuidedInspectionScreen),
    );
    await act(async () => app.root.findByType(PhotoReview).props.onAccept());
  }
  expect(guided.uploadGuided).toHaveBeenCalledTimes(5);
  await press('Previous', app.root.findByType(GuidedInspectionScreen));
  await press('Next', app.root.findByType(GuidedInspectionScreen));
  await press('Submit inspection', app.root.findByType(GuidedInspectionScreen));
  expect(navigation.getCurrentRoute()?.name).toBe('InspectionSubmitted');
  expect(JSON.stringify(app.toJSON())).toContain('Inspection submitted');
  await press(
    'Back to dashboard',
    app.root.findByType(InspectionSubmittedScreen),
  );
  expect(navigation.getCurrentRoute()?.name).toBe('Home');
});

it('opens persisted maintenance records from dashboard and history', async () => {
  await mount();
  await press('Kitchen sink leak', app.root.findByType(TenantDashboardScreen));
  expect(navigation.getCurrentRoute()?.params).toEqual({
    requestId: savedRequest.id,
  });
  expect(maintenance.getMaintenance).toHaveBeenCalledWith(savedRequest.id);
  expect(JSON.stringify(app.toJSON())).toContain(savedRequest.description);
  await press(
    'Back to my requests',
    app.root.findByType(MaintenanceDetailScreen),
  );
  expect(navigation.getCurrentRoute()?.name).toBe('History');
  await press('Kitchen sink leak', app.root.findByType(UnitHistoryScreen));
  expect(navigation.getCurrentRoute()?.params).toEqual({
    requestId: savedRequest.id,
  });
});
it('opens History when a maintenance detail has no previous route', async () => {
  await mount();
  await act(async () =>
    navigation.reset({
      index: 0,
      routes: [
        { name: 'MaintenanceDetail', params: { requestId: savedRequest.id } },
      ],
    }),
  );
  await press(
    'Back to my requests',
    app.root.findByType(MaintenanceDetailScreen),
  );
  expect(navigation.getCurrentRoute()?.name).toBe('History');
  await press('Back to dashboard', app.root.findByType(UnitHistoryScreen));
  expect(navigation.getCurrentRoute()?.name).toBe('Home');
  expect(navigation.canGoBack()).toBe(false);
});
it.each(['unknown', undefined])(
  'handles invalid or missing maintenance IDs (%s)',
  async id => {
    await mount();
    await act(async () =>
      navigation.navigate('MaintenanceDetail', {
        requestId: id as MaintenanceRequestId,
      }),
    );
    expect(JSON.stringify(app.toJSON())).toContain(
      'Maintenance request not found.',
    );
    await press('Back to my requests');
    expect(navigation.getCurrentRoute()?.name).toBe('History');
  },
);
it('validates fields and requires five securely saved photos', async () => {
  await mount();
  await press('Report maintenance');
  const form = app.root.findByType(ReportMaintenanceScreen);
  await press('Save draft', form);
  expect(JSON.stringify(app.toJSON())).toContain(
    'enter an area and description',
  );
  const submit = form
    .findAll(node => typeof node.props.onPress === 'function')
    .find(node =>
      node.findAllByType(Text).some(t => t.props.children === 'Submit request'),
    )!;
  expect(submit.props.disabled).toBe(true);
  expect(maintenance.submitMaintenance).not.toHaveBeenCalled();
  expect(JSON.stringify(app.toJSON())).not.toContain('Preview demo request');
});
it('reviews multiple gallery photos individually and confirms real submission', async () => {
  let draft: maintenance.MaintenanceRequest = {
    ...savedRequest,
    status: 'draft',
    submitted_at: null,
  };
  jest
    .mocked(maintenance.createDraft)
    .mockImplementation(async (_id, fields) => {
      draft = { ...draft, ...fields };
      return draft;
    });
  jest.mocked(maintenance.saveDraft).mockImplementation(async (_id, fields) => {
    draft = { ...draft, ...fields };
    return draft;
  });
  jest.mocked(maintenance.getMaintenance).mockImplementation(async () => draft);
  jest
    .mocked(maintenance.uploadMaintenancePhoto)
    .mockImplementation(async (_id, _asset, progress) => {
      progress(100);
      draft = {
        ...draft,
        photos: [
          ...draft.photos,
          {
            id: String(draft.photos.length),
            state: 'ready',
            available: true,
            retain_until: '2027-02-18',
          },
        ],
      };
      return draft;
    });
  jest.mocked(maintenance.submitMaintenance).mockImplementation(async () => {
    draft = {
      ...draft,
      status: 'submitted',
      submitted_at: '2026-11-18T12:00:00Z',
    };
    return draft;
  });
  jest.mocked(launchImageLibrary).mockResolvedValue({
    assets: Array.from({ length: 6 }, (_, i) => ({
      uri: `file:///photo-${i}.jpg`,
      type: 'image/jpg',
    })),
  });
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  await press('Report maintenance');
  const form = app.root.findByType(ReportMaintenanceScreen);
  await act(async () => {
    form.findAllByType(TextInput)[0].props.onChangeText('Kitchen');
    form.findAllByType(TextInput)[1].props.onChangeText('Leak');
  });
  await press('Add photos', form);
  const actions = alert.mock.calls[alert.mock.calls.length - 1][2]!;
  await act(async () =>
    actions.find(a => a.text === 'Choose from Library')!.onPress!(),
  );
  expect(maintenance.uploadMaintenancePhoto).not.toHaveBeenCalled();
  await act(async () => app.root.findByType(PhotoReview).props.onDiscard());
  for (let i = 0; i < 5; i++)
    await act(async () => app.root.findByType(PhotoReview).props.onAccept());
  expect(maintenance.uploadMaintenancePhoto).toHaveBeenCalledTimes(5);
  expect(maintenance.uploadMaintenancePhoto).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ type: 'image/jpeg' }),
    expect.any(Function),
  );
  expect(maintenance.uploadMaintenancePhoto).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ uri: 'file:///photo-0.jpg' }),
    expect.anything(),
  );
  await press('Submit request', form);
  expect(maintenance.submitMaintenance).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(app.toJSON())).toContain('Request submitted');
});
it('recovers a failed accepted camera upload and does not show false success', async () => {
  const draft = {
    ...savedRequest,
    status: 'draft' as const,
    submitted_at: null,
  };
  jest.mocked(maintenance.createDraft).mockResolvedValue(draft);
  jest.mocked(maintenance.getMaintenance).mockResolvedValue(draft);
  jest.mocked(maintenance.saveDraft).mockResolvedValue(draft);
  jest
    .mocked(maintenance.uploadMaintenancePhoto)
    .mockRejectedValueOnce(new ApiError('Storage unavailable. Retry.'))
    .mockResolvedValueOnce({
      ...draft,
      photos: [
        {
          id: '1',
          state: 'ready',
          available: true,
          retain_until: '2027-02-18',
        },
      ],
    });
  jest.mocked(launchCamera).mockResolvedValue({
    assets: [{ uri: 'file:///camera.jpg', type: 'image/jpeg' }],
  });
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  await press('Report maintenance');
  const form = app.root.findByType(ReportMaintenanceScreen);
  await act(async () => {
    form.findAllByType(TextInput)[0].props.onChangeText('Kitchen');
    form.findAllByType(TextInput)[1].props.onChangeText('Leak');
  });
  await press('Add photos', form);
  await act(async () =>
    alert.mock.calls[alert.mock.calls.length - 1][2]!.find(
      a => a.text === 'Take Photo',
    )!.onPress!(),
  );
  await act(async () => app.root.findByType(PhotoReview).props.onAccept());
  expect(JSON.stringify(app.toJSON())).toContain('Storage unavailable');
  expect(JSON.stringify(app.toJSON())).not.toContain('Request submitted');
  await press('Retry accepted photo', form);
  expect(maintenance.uploadMaintenancePhoto).toHaveBeenCalledTimes(2);
  expect(maintenance.submitMaintenance).not.toHaveBeenCalled();
});
it('keeps the next gallery photo awaiting review after an upload retry', async () => {
  const draft = {
    ...savedRequest,
    status: 'draft' as const,
    submitted_at: null,
  };
  jest.mocked(maintenance.createDraft).mockResolvedValue(draft);
  jest.mocked(maintenance.getMaintenance).mockResolvedValue(draft);
  jest.mocked(maintenance.saveDraft).mockResolvedValue(draft);
  jest
    .mocked(maintenance.uploadMaintenancePhoto)
    .mockRejectedValueOnce(new ApiError('Interrupted'))
    .mockResolvedValueOnce(draft);
  jest.mocked(launchImageLibrary).mockResolvedValue({
    assets: [{ uri: 'file:///first.jpg' }, { uri: 'file:///next.jpg' }],
  });
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  await press('Report maintenance');
  const form = app.root.findByType(ReportMaintenanceScreen);
  await act(async () => {
    form.findAllByType(TextInput)[0].props.onChangeText('Kitchen');
    form.findAllByType(TextInput)[1].props.onChangeText('Leak');
  });
  await press('Add photos', form);
  await act(async () =>
    alert.mock.calls[alert.mock.calls.length - 1][2]!.find(
      a => a.text === 'Choose from Library',
    )!.onPress!(),
  );
  await act(async () => app.root.findByType(PhotoReview).props.onAccept());
  await press('Retry accepted photo', form);
  expect(app.root.findByType(PhotoReview).props.asset.uri).toBe(
    'file:///next.jpg',
  );
  expect(maintenance.uploadMaintenancePhoto).toHaveBeenCalledTimes(2);
});
it('waits for backend submission confirmation and prevents repeated taps', async () => {
  const draft: maintenance.MaintenanceRequest = {
    ...savedRequest,
    status: 'draft',
    submitted_at: null,
    photos: Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      state: 'ready',
      available: true,
      retain_until: '2027-02-18',
    })),
  };
  jest.mocked(maintenance.getMaintenance).mockResolvedValue(draft);
  jest.mocked(maintenance.saveDraft).mockResolvedValue(draft);
  let confirm!: (record: maintenance.MaintenanceRequest) => void;
  jest.mocked(maintenance.submitMaintenance).mockImplementation(
    () =>
      new Promise(resolve => {
        confirm = resolve;
      }),
  );
  await mount();
  await act(async () =>
    navigation.navigate('ReportMaintenance', { draftId: draft.id }),
  );
  const form = app.root.findByType(ReportMaintenanceScreen);
  await press('Submit request', form);
  expect(JSON.stringify(app.toJSON())).not.toContain('Request submitted');
  await press('Submit request', form);
  expect(maintenance.submitMaintenance).toHaveBeenCalledTimes(1);
  await act(async () =>
    confirm({
      ...draft,
      status: 'submitted',
      submitted_at: '2026-11-18T12:00:00Z',
    }),
  );
  expect(JSON.stringify(app.toJSON())).toContain('Request submitted');
});
it('saves availability against a real appointment and retains the selected slot', async () => {
  const appointment = {
    id: 'a'.repeat(32),
    unit_id: 'b'.repeat(24),
    tenant_id: tenant.id,
    timezone: 'America/New_York',
    status: 'offered',
    revision: 0,
    slots: [{ id: 'slot', at: '2027-12-01T14:00:00-05:00' }],
    tenant_slots: [],
    confirmed_slot: '',
    history: [],
  };
  jest
    .mocked(housing.listAppointments)
    .mockResolvedValue({ appointments: [appointment] });
  await mount();
  await press('In-person appointments');
  const screen = app.root.findByType(AppointmentsScreen);
  await press('Available at this time', screen);
  await press('Send availability', screen);
  expect(housing.appointmentAction).toHaveBeenCalledWith(appointment, {
    action: 'respond',
    slot_ids: ['slot'],
  });
  expect(JSON.stringify(app.toJSON())).toContain('✓ Available at this time');
});

it('reloads persisted inspection progress during session revalidation', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  const saved = { ...guidedFixture, progress: 1, status: 'draft' };
  jest.mocked(guided.getGuided).mockResolvedValue(saved);
  await mount();
  await press('Start guided inspection');
  jest.mocked(auth.getSession).mockResolvedValueOnce(tenant);
  await act(async () =>
    listener.mock.calls[listener.mock.calls.length - 1][1]('active'),
  );
  expect(navigation.getCurrentRoute()?.params).toEqual({
    inspectionId: guidedFixture.id,
  });
  expect(JSON.stringify(app.toJSON())).toContain('photos securely saved');
  expect(guided.getGuided).toHaveBeenCalledWith(guidedFixture.id);
});

it('does not restore a session while logout is pending', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  await mount(landlord);
  let resolve!: () => void;
  jest.mocked(auth.logout).mockImplementationOnce(
    () =>
      new Promise(accept => {
        resolve = accept;
      }),
  );
  await press('Settings');
  await press('Log out');
  await act(async () =>
    listener.mock.calls[listener.mock.calls.length - 1][1]('active'),
  );
  expect(auth.getSession).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  expect(navigation.getCurrentRoute()?.name).toBe('Login');
});
