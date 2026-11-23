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
  consent: jest.fn(),
}));
import * as baselines from '../src/services/baselineService';
import MoveInBaselineScreen from '../src/screens/landlord/MoveInBaselineScreen';
import PhotoReview from '../src/components/PhotoReview';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import NotificationsScreen from '../src/screens/shared/NotificationsScreen';
import * as guided from '../src/services/guidedInspectionService';
import { guidedFixture, assignmentOptions } from '../testFixtures/guided';
import React from 'react';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert, Image, Text, TextInput } from 'react-native';
import { AuthProvider } from '../src/context/AuthContext';
import RootNavigator from '../src/navigation/RootNavigator';
import type { LandlordStackParamList } from '../src/navigation/types';
import type { User } from '../src/types/user';
import * as auth from '../src/services/authService';
import { ApiError } from '../src/services/api';
import Button from '../src/components/Button';
import * as housing from '../src/services/leaseService';
import ScreenTitle from '../src/components/ScreenTitle';
import Header from '../src/components/Header';
import BackButton from '../src/components/BackButton';
import NotificationBell from '../src/components/NotificationBell';
import BottomNavigation from '../src/components/BottomNavigation';
import LoginScreen from '../src/screens/auth/LoginScreen';
import LandlordDashboardScreen from '../src/screens/landlord/LandlordDashboardScreen';
import AddPropertyScreen from '../src/screens/landlord/AddPropertyScreen';
import ScheduleInspectionScreen from '../src/screens/landlord/ScheduleInspectionScreen';
import AIInspectionReviewScreen from '../src/screens/landlord/AIInspectionReviewScreen';
import ConditionHistoryScreen from '../src/screens/landlord/ConditionHistoryScreen';
import SettingsScreen from '../src/screens/shared/SettingsScreen';
import {
  bedroomCountError,
  bathroomCountError,
  inspectionDateError,
} from '../src/utils/landlordValidation';

jest.mock('../src/services/authService');
jest.mock('../src/services/baselineService');
jest.mock('../src/services/guidedInspectionService');
const landlord: User = {
  id: '000000000000000000000002',
  name: 'Alex Owner',
  email: 'owner@example.com',
  role: 'landlord',
};
const tenant: User = {
  id: '000000000000000000000001',
  name: 'Test Tenant',
  email: 'tenant@example.com',
  role: 'tenant',
};
let app: ReactTestRenderer;
let navigation: ReturnType<
  typeof createNavigationContainerRef<LandlordStackParamList>
>;
let alert: jest.SpyInstance;
beforeEach(() => {
  jest
    .mocked(housing.landlordApi.state)
    .mockResolvedValue({ consented: true, properties: [], activity: [] });
  jest
    .mocked(baselines.baselinePhotoUrl)
    .mockImplementation(
      (id, photo) =>
        `http://localhost/api/guided-inspections/baseline-drafts/${id}/photos/${photo}/`,
    );
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest
    .mocked(guided.listGuided)
    .mockResolvedValue({ inspections: [guidedFixture], next: null });
  jest.mocked(guided.getGuided).mockResolvedValue(guidedFixture);
  jest.mocked(guided.getAssignmentOptions).mockResolvedValue(assignmentOptions);
  jest
    .mocked(guided.guidedNotifications)
    .mockResolvedValue({ notifications: [] });
  jest.mocked(auth.getSession).mockReset();
  jest.mocked(auth.logout).mockReset().mockResolvedValue(undefined);
  navigation = createNavigationContainerRef<LandlordStackParamList>();
  alert = jest.spyOn(Alert, 'alert');
});
afterEach(async () => {
  if (app) await act(async () => app.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});
async function mount(user: User | null = landlord) {
  jest.mocked(auth.getSession).mockResolvedValue(user);
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
function json() {
  return JSON.stringify(app.toJSON());
}
async function press(label: string, scope: ReactTestInstance = app.root) {
  const target = scope
    .findAll(n => typeof n.props.onPress === 'function')
    .find(
      n =>
        n.props.accessibilityLabel === label ||
        n
          .findAllByType(Text)
          .some(t => [t.props.children].flat(Infinity).join('') === label),
    );
  expect(target).toBeDefined();
  await act(async () => {
    target!.props.onPress();
  });
}
async function fill(scope: ReactTestInstance, values: Record<string, string>) {
  await act(async () => {
    for (const [label, value] of Object.entries(values)) {
      scope
        .findAllByType(TextInput)
        .find(n => n.props.accessibilityLabel === label)!
        .props.onChangeText(value);
    }
  });
}

it('logs a landlord in and shows authenticated API-backed dashboard', async () => {
  await mount(null);
  jest.mocked(auth.login).mockResolvedValueOnce(landlord);
  const login = app.root.findByType(LoginScreen);
  await fill(login, { Email: landlord.email, Password: 'fixture-password' });
  await act(async () => login.findByType(Button).props.onPress());
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
  expect(json()).toContain('Alex Owner');
  expect(json()).not.toContain('Marcus');
  expect(json()).not.toContain('Sample records and dates');
  expect(navigation.canGoBack()).toBe(false);
  expect(
    app.root
      .findByType(LandlordDashboardScreen)
      .findByType(ScreenTitle)
      .findAllByType(NotificationBell),
  ).toHaveLength(1);
});
it('falls back safely when the account name is blank', async () => {
  await mount({ ...landlord, name: '  ' });
  expect(json()).toContain(landlord.email);
});
it.each([landlord, tenant])(
  'restores $role sessions and preserves role-specific navbar items',
  async user => {
    await mount(user);
    const bar = app.root.findByType(BottomNavigation);
    expect(bar.props.role).toBe(user.role);
    expect(bar.props.state.routes.map((r: { name: string }) => r.name)).toEqual(
      user.role === 'landlord'
        ? ['HomeStack', 'History', 'Settings']
        : ['Home', 'Inspections', 'Settings'],
    );
    expect(bar.props.state.index).toBe(0);
    await press('Settings');
    expect(app.root.findByType(BottomNavigation).props.state.index).toBe(2);
    const settings = app.root.findByType(SettingsScreen);
    expect(settings.findByType(Header).props.onBack).toBeUndefined();
    expect(settings.findAllByType(BackButton)).toHaveLength(0);
  },
);
it('validates property fields and saves through the canonical housing API', async () => {
  jest
    .mocked(housing.landlordApi.addProperty)
    .mockResolvedValue({ consented: true, properties: [], activity: [] });
  await mount();
  await press('+ Add property');
  const form = app.root.findByType(AddPropertyScreen);
  await press('Save property', form);
  expect(json()).toContain('Enter the property address');
  expect(json()).toContain('Enter a unit name');
  await fill(form, {
    'Property address': '18 Example St',
    Unit: '1A',
    Bedrooms: '1.5',
    Bathrooms: '1.25',
  });
  await press('Save property', form);
  expect(json()).toContain('nonnegative whole number');
  expect(json()).toContain('half increments');
  await fill(form, { Bedrooms: '0', Bathrooms: '1.5' });
  await press('Save property', form);
  expect(housing.landlordApi.addProperty).toHaveBeenCalledWith(
    expect.objectContaining({ street: '18 Example St', unit: '1A' }),
  );
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
});
it('rejects an invalid optional tenant invitation email before saving', async () => {
  await mount();
  await press('+ Add property');
  const form = app.root.findByType(AddPropertyScreen);
  await fill(form, {
    'Property address': '18 Example St',
    Unit: '1A',
    Bedrooms: '2',
    Bathrooms: '0',
    'Tenant email': 'invalid',
  });
  await press('Save & send invite', form);
  expect(housing.landlordApi.addProperty).not.toHaveBeenCalled();
  expect(navigation.getCurrentRoute()?.name).toBe('AddProperty');
});
it('reviews a verified assignment and creates it through Django', async () => {
  jest.mocked(guided.createAssignment).mockResolvedValue(guidedFixture);
  await mount();
  await press('Schedule inspection');
  const form = app.root.findByType(ScheduleInspectionScreen);
  await press('Verified property · 101', form);
  await press('Resident', form);
  await press('Apartment v1', form);
  await fill(form, { 'Due date': '2027-12-01' });
  await press('Review assignment', form);
  await press('Confirm assignment', form);
  expect(guided.createAssignment).toHaveBeenCalledWith(
    expect.objectContaining({
      unit_id: guidedFixture.unit_id,
      template_id: 'template',
      inspection_type: 'move-in',
    }),
  );
  expect(navigation.getCurrentRoute()?.name).toBe('AIInspectionReview');
});

it('shows stored photos side by side and saves a human decision', async () => {
  const photo = { id: 'photo', step_id: 'step-0', slot: 0, state: 'ready' };
  const record = {
    ...guidedFixture,
    status: 'submitted',
    photos: [photo],
    baseline_available: true,
    baseline_photos: [{ ...photo, id: 'baseline' }],
    comparisons: [
      {
        id: 'comparison',
        photo_id: 'photo',
        status: 'completed',
        decision: null,
        result: {
          summary: 'Review a visible change.',
          classification: 'possible_damage',
          severity: 'low',
          confidence: 'medium',
          findings: [],
        },
      },
    ],
  };
  jest.mocked(guided.getGuided).mockResolvedValue(record);
  jest.mocked(guided.guidedAction).mockResolvedValue({
    ...record,
    comparisons: [{ ...record.comparisons[0], decision: 'confirmed' }],
  });
  await mount();
  await press('Open move-in inspection');
  const screen = app.root.findByType(AIInspectionReviewScreen);
  expect(screen.findAllByType(Image)).toHaveLength(2);
  expect(json()).toContain('Review a visible change.');
  expect(json()).not.toContain('PLACEHOLDER');
  await press('confirmed', screen);
  expect(guided.guidedAction).toHaveBeenCalledWith(record, 'decision', {
    comparison_id: 'comparison',
    decision: 'confirmed',
  });
  await press('Back', screen);
  await press('History');
  expect(app.root.findAllByType(ConditionHistoryScreen)).toHaveLength(1);
});

it('keeps settings switches local, marks unsupported rows unavailable, and handles failed logout', async () => {
  await mount();
  await press('Settings');
  const settings = app.root.findByType(SettingsScreen);
  const getSwitch = () =>
    settings
      .findAllByProps({ accessibilityLabel: 'Inspection Reminders' })
      .find(n => n.props.onValueChange)!;
  await act(async () => getSwitch().props.onValueChange(false));
  expect(getSwitch().props.value).toBe(false);
  const profile = settings.findAllByProps({
    accessibilityLabel: 'Profile, unavailable in prototype',
  });
  expect(
    profile.every(
      n => n.props.onPress === undefined && n.props.accessibilityState.disabled,
    ),
  ).toBe(true);
  jest
    .mocked(auth.logout)
    .mockRejectedValueOnce(new ApiError('Logout unavailable'));
  await press('Log out', settings);
  expect(json()).toContain('Logout unavailable');
  // Settings is a nested stack for landlords; its first screen is SettingsHome.
  expect(navigation.getCurrentRoute()?.name).toBe('SettingsHome');
  let resolve!: () => void;
  jest.mocked(auth.logout).mockImplementationOnce(
    () =>
      new Promise(accept => {
        resolve = accept;
      }),
  );
  await press('Log out', settings);
  expect(settings.findByType(Button).props.loading).toBe(true);
  await act(async () => resolve());
  expect(navigation.getCurrentRoute()?.name).toBe('Login');
  expect(navigation.canGoBack()).toBe(false);
});
it('shared Header back button returns from inspection results', async () => {
  await mount();
  await press('Review inspections');
  await press('Back', app.root.findByType(AIInspectionReviewScreen));
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
});
it('offers property management as a functional destination', async () => {
  await mount();
  await press('+ Add property');
  expect(navigation.getCurrentRoute()?.name).toBe('AddProperty');
});

describe('landlord numeric and calendar validation', () => {
  it.each(['-1', '1.5', 'NaN', '', '9007199254740992'])(
    'rejects invalid bedroom count %s',
    value => expect(bedroomCountError(value)).toBeDefined(),
  );
  it.each(['0', '2', ' 3 '])('accepts bedroom count %s', value =>
    expect(bedroomCountError(value)).toBeUndefined(),
  );
  it.each(['0', '0.5', '1', '1.0', '2.5'])(
    'accepts half-step bathrooms %s',
    value => expect(bathroomCountError(value)).toBeUndefined(),
  );
  it.each(['-0.5', '1.25', '', '1.1'])('rejects invalid bathrooms %s', value =>
    expect(bathroomCountError(value)).toBeDefined(),
  );
  it.each([
    '2027-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '10/18/2026',
    '2026-10-16',
  ])('rejects invalid or past date %s', value =>
    expect(inspectionDateError(value, new Date(2026, 9, 17))).toBeDefined(),
  );
  it.each(['2026-10-17', '2026-10-18', '2028-02-29'])(
    'accepts today/future date %s',
    value =>
      expect(inspectionDateError(value, new Date(2026, 9, 17))).toBeUndefined(),
  );
});

it.each([landlord, tenant])(
  'opens persisted Notifications from the $role bell',
  async user => {
    jest.mocked(guided.guidedNotifications).mockResolvedValue({
      notifications: [
        {
          id: 'notice',
          inspection_id: guidedFixture.id,
          message: 'An inspection is ready.',
          read: false,
          created_at: '2026-11-18T12:00:00Z',
        },
      ],
    });
    await mount(user);
    await act(async () =>
      app.root.findByType(NotificationBell).props.onPress(),
    );
    expect(navigation.getCurrentRoute()?.name).toBe('Notifications');
    const screen = app.root.findByType(NotificationsScreen);
    expect(json()).toContain('An inspection is ready.');
    await press('Mark read', screen);
    expect(guided.readNotification).toHaveBeenCalledWith('notice');
    await press('Back', screen);
    expect(navigation.getCurrentRoute()?.name).toBe(
      user.role === 'landlord' ? 'Dashboard' : 'Home',
    );
  },
);

it.each([landlord, tenant])(
  'shows notification errors without a false empty state for $role and recovers on refresh',
  async user => {
    jest
      .mocked(guided.guidedNotifications)
      .mockRejectedValue(new Error('Unable to load notifications.'));
    await mount(user);
    await act(async () =>
      app.root.findByType(NotificationBell).props.onPress(),
    );
    expect(json()).toContain('Unable to load notifications.');
    expect(json()).not.toContain("You're all caught up");
    jest
      .mocked(guided.guidedNotifications)
      .mockResolvedValue({ notifications: [] });
    await press(
      'Refresh notifications',
      app.root.findByType(NotificationsScreen),
    );
    expect(json()).not.toContain('Unable to load notifications.');
    expect(json()).toContain("You're all caught up");
  },
);

it('keeps an unread notification actionable when saving its read state fails', async () => {
  jest.mocked(guided.guidedNotifications).mockResolvedValue({
    notifications: [
      {
        id: 'notice',
        inspection_id: guidedFixture.id,
        message: 'Ready for review.',
        read: false,
        created_at: '2026-11-18T12:00:00Z',
      },
    ],
  });
  jest
    .mocked(guided.readNotification)
    .mockRejectedValueOnce(new Error('Read status was not saved.'));
  await mount();
  await act(async () => app.root.findByType(NotificationBell).props.onPress());
  await press('Mark read', app.root.findByType(NotificationsScreen));
  expect(json()).toContain('Read status was not saved.');
  expect(json()).toContain('Mark read');
  await press('Open inspection', app.root.findByType(NotificationsScreen));
  expect(navigation.getCurrentRoute()?.params).toEqual({
    inspectionId: guidedFixture.id,
  });
});

const baselineDraft: baselines.BaselineDraft = {
  id: 'd'.repeat(32),
  unit_id: guidedFixture.unit_id,
  status: 'draft',
  revision: 0,
  expected_active_id: '',
  template_id: 'template',
  template_version: 1,
  steps: guidedFixture.steps,
  progress: 0,
  required: 5,
  photos: [],
  uploads: [],
  history: [],
};
const baselineHistory: baselines.BaselineHistory = {
  active_id: '',
  status: 'missing',
  drafts: [],
  versions: [],
};
async function openBaseline() {
  jest.mocked(baselines.getBaselines).mockResolvedValue(baselineHistory);
  jest.mocked(baselines.createBaseline).mockResolvedValue(baselineDraft);
  await mount();
  await press('Create Move-In Baseline');
  await press('Verified property · 101');
}
it('creates a baseline from a real unit and accepts or discards camera/gallery photos', async () => {
  await openBaseline();
  expect(
    app.root
      .findByType(MoveInBaselineScreen)
      .findAllByType(Text)
      .some(
        t =>
          [t.props.children].flat(Infinity).join('') ===
          'Baseline status: missing',
      ),
  ).toBe(true);
  await press('Apartment · v1');
  expect(baselines.createBaseline).toHaveBeenCalledWith(
    guidedFixture.unit_id,
    'template',
  );
  jest.mocked(launchCamera).mockResolvedValue({
    assets: [{ uri: 'file:///camera.jpg', type: 'image/jpeg' }],
  });
  await press('Take photo');
  expect(app.root.findByType(PhotoReview).props.asset.uri).toBe(
    'file:///camera.jpg',
  );
  await act(async () => app.root.findByType(PhotoReview).props.onDiscard());
  expect(baselines.uploadBaseline).not.toHaveBeenCalled();
  jest.mocked(launchImageLibrary).mockResolvedValue({
    assets: [{ uri: 'file:///gallery.jpg', type: 'image/jpeg' }],
  });
  jest
    .mocked(baselines.uploadBaseline)
    .mockImplementation(async (_d, _s, _slot, _a, progress) => {
      progress(100);
      return {
        ...baselineDraft,
        revision: 2,
        progress: 1,
        photos: [{ id: 'photo', step_id: 'step-0', slot: 0, state: 'ready' }],
      };
    });
  await press('Choose from gallery');
  await act(async () => app.root.findByType(PhotoReview).props.onAccept());
  expect(baselines.uploadBaseline).toHaveBeenCalledWith(
    baselineDraft,
    'step-0',
    0,
    expect.objectContaining({ uri: 'file:///gallery.jpg' }),
    expect.any(Function),
  );
  expect(
    app.root
      .findByType(MoveInBaselineScreen)
      .findAllByType(Text)
      .some(t => [t.props.children].flat(Infinity).join('').includes('1/5')),
  ).toBe(true);
});
it('resumes a stored baseline and reviews every photo before approval', async () => {
  await openBaseline();
  const complete = {
    ...baselineDraft,
    revision: 10,
    progress: 5,
    photos: baselineDraft.steps.map(s => ({
      id: s.id,
      step_id: s.id,
      slot: 0,
      state: 'ready',
    })),
  };
  jest.mocked(baselines.getBaselines).mockResolvedValue({
    ...baselineHistory,
    status: 'draft',
    drafts: [complete],
  });
  jest.mocked(baselines.getBaselineDraft).mockResolvedValue(complete);
  await press('Verified property · 101 ✓');
  await press('Resume draft · 5/5');
  await press('Review full baseline');
  expect(
    app.root.findByType(MoveInBaselineScreen).findAllByType(Image),
  ).toHaveLength(5);
  jest.mocked(baselines.approveBaseline).mockResolvedValue({
    ...complete,
    status: 'reviewed',
    history: [{ action: 'baseline-approved', at: '2026-11-18' }],
  });
  await press('Approve and Save Baseline');
  expect(baselines.approveBaseline).toHaveBeenCalledWith(complete);
  expect(json()).toContain('reviewed');
});
it('requires explicit supersession confirmation and preserves history', async () => {
  await openBaseline();
  const draft = { ...baselineDraft, expected_active_id: 'old', progress: 5 };
  jest.mocked(baselines.createBaseline).mockResolvedValue(draft);
  await press('Apartment · v1');
  await press('Review full baseline');
  await press('Approve and Save Baseline');
  expect(alert).toHaveBeenCalledWith(
    'Supersede approved baseline?',
    expect.any(String),
    expect.any(Array),
  );
  expect(baselines.approveBaseline).not.toHaveBeenCalled();
});
it('shows network/session errors and clears a prior unit draft on a failed unit change', async () => {
  await openBaseline();
  await press('Apartment · v1');
  jest
    .mocked(baselines.getBaselines)
    .mockRejectedValue(new ApiError('Sign in again', 401));
  await press('Verified property · 101 ✓');
  expect(json()).toContain('Sign in again');
  expect(json()).not.toContain('Take photo');
});
it('keeps upload progress separate from secure storage confirmation and permits recovery', async () => {
  await openBaseline();
  await press('Apartment · v1');
  jest
    .mocked(launchImageLibrary)
    .mockResolvedValue({ assets: [{ uri: 'file:///gallery.jpg' }] });
  let reject!: (e: Error) => void;
  jest
    .mocked(baselines.uploadBaseline)
    .mockImplementation((_d, _s, _slot, _a, progress) => {
      progress(100);
      return new Promise((_resolve, fail) => {
        reject = fail;
      });
    });
  await press('Choose from gallery');
  await act(async () => {
    app.root.findByType(PhotoReview).props.onAccept();
  });
  expect(json()).toContain('Waiting for secure storage confirmation');
  expect(
    app.root
      .findByType(MoveInBaselineScreen)
      .findAllByType(Text)
      .some(t => [t.props.children].flat(Infinity).join('').includes('0/5')),
  ).toBe(true);
  await act(async () => reject(new ApiError('Storage interrupted')));
  expect(json()).toContain('Storage interrupted');
  expect(json()).toContain('Retry same photo');
});
it('opens an unverified high-severity notification in authorized inspection review', async () => {
  jest.mocked(guided.guidedNotifications).mockResolvedValue({
    notifications: [
      {
        id: 'alert',
        inspection_id: guidedFixture.id,
        message:
          'Unverified high-severity AI finding requires landlord review.',
        read: false,
        created_at: '2026-11-18',
      },
    ],
  });
  await mount();
  await act(async () => app.root.findByType(NotificationBell).props.onPress());
  await press('Open inspection', app.root.findByType(NotificationsScreen));
  expect(navigation.getCurrentRoute()?.name).toBe('AIInspectionReview');
  expect(guided.getGuided).toHaveBeenCalledWith(guidedFixture.id);
});
it('allows a confirmed finding to be resolved after final review', async () => {
  const record = {
    ...guidedFixture,
    status: 'reviewed',
    photos: [{ id: 'p', step_id: 'step-0', slot: 0, state: 'ready' }],
    comparisons: [
      {
        id: 'c',
        photo_id: 'p',
        status: 'completed',
        decision: 'confirmed',
        result: null,
      },
    ],
  };
  jest.mocked(guided.getGuided).mockResolvedValue(record);
  jest.mocked(guided.guidedAction).mockResolvedValue(record);
  await mount();
  await press('Open move-in inspection');
  await press('Mark resolved');
  expect(guided.guidedAction).toHaveBeenCalledWith(record, 'decision', {
    comparison_id: 'c',
    decision: 'resolved',
  });
});

it('records an individual finding decision using its saved result index', async () => {
  const record = {
    ...guidedFixture,
    status: 'submitted',
    photos: [{ id: 'p', step_id: 'step-0', slot: 0, state: 'ready' }],
    comparisons: [
      {
        id: 'c',
        photo_id: 'p',
        status: 'completed',
        decision: null,
        result: {
          summary: 'Two visible changes.',
          classification: 'damage',
          severity: 'medium',
          confidence: 'high',
          findings: [
            { description: 'Wall hole.', classification: 'damage' },
            { description: 'Small scuff.', classification: 'normal_wear' },
          ],
        },
      },
    ],
  };
  jest.mocked(guided.getGuided).mockResolvedValue(record);
  jest.mocked(guided.guidedAction).mockResolvedValue({
    ...record,
    comparisons: [
      { ...record.comparisons[0], finding_decisions: ['confirmed', null] },
    ],
  });
  await mount();
  await press('Open move-in inspection');
  await press('Finding 1: confirmed');
  expect(guided.guidedAction).toHaveBeenCalledWith(record, 'decision', {
    comparison_id: 'c',
    finding_index: 0,
    decision: 'confirmed',
  });
  expect(json()).toContain('Wall hole.');
  expect(json()).toContain('Small scuff.');
});

it('starts Jon’s move-in tour and resumes the canonical baseline workflow for that unit', async () => {
  jest.mocked(housing.landlordApi.state).mockResolvedValue({
    consented: true,
    activity: [],
    properties: [
      {
        id: 'a'.repeat(24),
        street: 'Verified property',
        city: 'NY',
        units: [
          {
            id: guidedFixture.unit_id,
            name: '101',
            bedrooms: '1',
            bathrooms: '1',
            revision: 0,
            areas: guidedFixture.steps.map(s => s.room),
          },
        ],
      },
    ],
  });
  jest.mocked(baselines.getBaselines).mockResolvedValue(baselineHistory);
  await mount();
  await press('Record move-in baseline');
  expect(navigation.getCurrentRoute()?.name).toBe('MoveInTour');
  await press('Start or resume baseline');
  expect(navigation.getCurrentRoute()?.name).toBe('MoveInBaseline');
  expect(navigation.getCurrentRoute()?.params).toEqual({
    unitId: guidedFixture.unit_id,
  });
  expect(baselines.getBaselines).toHaveBeenCalledWith(guidedFixture.unit_id);
});
