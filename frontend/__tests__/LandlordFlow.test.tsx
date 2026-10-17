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
import Header from '../src/components/Header';
import BackButton from '../src/components/BackButton';
import NotificationBell from '../src/components/NotificationBell';
import BottomNavigation from '../src/components/BottomNavigation';
import UnitChip from '../src/components/UnitChip';
import LoginScreen from '../src/screens/auth/LoginScreen';
import LandlordDashboardScreen from '../src/screens/landlord/LandlordDashboardScreen';
import AddPropertyScreen from '../src/screens/landlord/AddPropertyScreen';
import ScheduleInspectionScreen from '../src/screens/landlord/ScheduleInspectionScreen';
import AIInspectionReviewScreen from '../src/screens/landlord/AIInspectionReviewScreen';
import ConditionHistoryScreen from '../src/screens/landlord/ConditionHistoryScreen';
import NotificationsScreen from '../src/screens/shared/NotificationsScreen';
import SettingsScreen from '../src/screens/shared/SettingsScreen';
import {
  bedroomCountError,
  bathroomCountError,
  inspectionDateError,
  formatLocalDate,
} from '../src/utils/landlordValidation';

jest.mock('../src/services/authService');
const landlord: User = {
  id: 2,
  name: 'Alex Owner',
  email: 'owner@example.com',
  role: 'landlord',
};
const tenant: User = {
  id: 1,
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
  jest.useFakeTimers();
  jest.clearAllMocks();
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
  await act(async () => { target!.props.onPress(); });
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

it('logs a landlord in, shows the authenticated name, and labels sample records', async () => {
  await mount(null);
  jest.mocked(auth.login).mockResolvedValueOnce(landlord);
  const login = app.root.findByType(LoginScreen);
  await fill(login, { Email: landlord.email, Password: 'fixture-password' });
  await act(async () => login.findByType(Button).props.onPress());
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
  expect(json()).toContain('Alex Owner');
  expect(json()).not.toContain('Marcus');
  expect(json()).toContain('Sample records and dates');
  expect(navigation.canGoBack()).toBe(false);
  expect(
    app.root
      .findByType(LandlordDashboardScreen)
      .findByType(Header)
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
        : ['Home', 'Inspections', 'History', 'Settings'],
    );
    expect(bar.props.state.index).toBe(0);
    await press('Settings');
    expect(app.root.findByType(BottomNavigation).props.state.index).toBe(
      user.role === 'landlord' ? 2 : 3,
    );
    const settings = app.root.findByType(SettingsScreen);
    expect(settings.findByType(Header).props.onBack).toBeUndefined();
    expect(settings.findAllByType(BackButton)).toHaveLength(0);
  },
);
it('validates property fields and reports a demo without creating or assigning a record', async () => {
  await mount();
  await press('+ Add property');
  const form = app.root.findByType(AddPropertyScreen);
  await press('Preview demo property', form);
  expect(json()).toContain('Enter the property address');
  expect(json()).toContain('Enter a unit name');
  await fill(form, {
    'Property address': '18 Example St',
    Unit: '1A',
    Bedrooms: '1.5',
    Bathrooms: '1.25',
    'Tenant email': 'invalid',
  });
  await press('Preview demo property', form);
  expect(json()).toContain('nonnegative whole number');
  expect(json()).toContain('half increments');
  expect(alert).not.toHaveBeenCalled();
  await fill(form, { Bedrooms: '0', Bathrooms: '1.5' });
  await act(async () =>
    form
      .findAllByProps({ accessibilityLabel: 'Assign tenant to this unit' })
      .find(n => n.props.onValueChange)!
      .props.onValueChange(false),
  );
  await press('Preview demo property', form);
  expect(alert).toHaveBeenLastCalledWith(
    'Demo property preview',
    expect.stringContaining('No property or unit was saved'),
  );
  expect(navigation.getCurrentRoute()?.name).toBe('AddProperty');
  await press('Cancel', form);
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
});
it('requires a valid tenant email only when assignment is enabled', async () => {
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
  await press('Preview demo property', form);
  expect(alert).not.toHaveBeenCalled();
  await fill(form, { 'Tenant email': 'sample@example.com' });
  await press('Preview demo property', form);
  expect(alert).toHaveBeenCalledWith(
    'Demo property preview',
    expect.stringContaining('no tenant was assigned'),
  );
});
it('validates dates, remote areas, and distinct in-person demo behavior', async () => {
  await mount();
  await press('Schedule inspection');
  const form = app.root.findByType(ScheduleInspectionScreen);
  await fill(form, { 'Due date (YYYY-MM-DD)': '2027-02-30' });
  await press('Preview demo inspection', form);
  expect(json()).toContain('valid calendar date');
  await fill(form, { 'Due date (YYYY-MM-DD)': '2000-01-01' });
  await press('Preview demo inspection', form);
  expect(json()).toContain('today or a future date');
  const future = new Date();
  future.setDate(future.getDate() + 7);
  await fill(form, { 'Due date (YYYY-MM-DD)': formatLocalDate(future) });
  const areas = form.findAll(
    n =>
      n.props.accessibilityRole === 'checkbox' &&
      typeof n.props.onPress === 'function',
  );
  // Composite/host duplicates share handlers; invoke each area only once.
  const handlers = [...new Set(areas.map(n => n.props.onPress))];
  await act(async () => handlers.forEach(fn => fn()));
  await press('Preview demo inspection', form);
  expect(json()).toContain('Pick at least one area');
  expect(alert).not.toHaveBeenCalled();
  await press('In person', form);
  await press('Preview demo inspection', form);
  expect(alert).toHaveBeenLastCalledWith(
    'Demo inspection preview',
    expect.stringContaining('no tenant was notified'),
  );
  expect(navigation.getCurrentRoute()?.name).toBe('ScheduleInspection');
  await press('Back', form);
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
});
it('gives distinct AI demo decisions, opens History, and returns through the nested stack', async () => {
  await mount();
  await press('2 items need review');
  const screen = app.root.findByType(AIInspectionReviewScreen);
  expect(json()).toContain('PLACEHOLDER');
  expect(json()).toContain('sample findings');
  for (const [label, feedback] of [
    ['Confirm damage', 'Damage confirmation preview'],
    ['Dismiss', 'Dismissal preview'],
    ['Resolved', 'Resolution preview'],
  ]) {
    await press(label, screen);
    expect(alert).toHaveBeenLastCalledWith(
      feedback,
      expect.stringContaining('No decision was saved'),
    );
    expect(navigation.getCurrentRoute()?.name).toBe('AIInspectionReview');
  }
  await press('Open unit history', screen);
  expect(navigation.getCurrentRoute()?.name).toBe('History');
  const history = app.root.findByType(ConditionHistoryScreen);
  expect(
    history
      .findAllByType(UnitChip)
      .every(
        chip =>
          chip.findAll(n => typeof n.props.onPress === 'function').length === 0,
      ),
  ).toBe(true);
  await press('Back to dashboard', history);
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
});
it.each([landlord, tenant])(
  'opens shared Notifications from the $role bell and returns correctly',
  async user => {
    await mount(user);
    const bell = app.root.findByType(NotificationBell);
    if (user.role === 'tenant')
      expect(bell.props.unreadCount).toBeGreaterThan(0);
    await act(async () => bell.props.onPress());
    expect(navigation.getCurrentRoute()?.name).toBe('Notifications');
    const screen = app.root.findByType(NotificationsScreen);
    expect(
      screen
        .findAll(n => n.props.testID === 'notification-1')
        .some(n => n.props.accessibilityValue?.text === 'Unread'),
    ).toBe(true);
    expect(
      screen
        .findAll(n => n.props.testID === 'notification-1')
        .every(n => n.props.onPress === undefined),
    ).toBe(true);
    await press('Mark all as read', screen);
    for (const id of ['1', '2', '3', '4'])
      expect(
        screen
          .findAll(n => n.props.testID === `notification-${id}`)
          .every(n => n.props.accessibilityValue.text === 'Read'),
      ).toBe(true);
    await press('Go back', screen);
    expect(navigation.getCurrentRoute()?.name).toBe(
      user.role === 'landlord' ? 'Dashboard' : 'Home',
    );
  },
);
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
  expect(navigation.getCurrentRoute()?.name).toBe('Settings');
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
  await press('2 items need review');
  await press('Go back', app.root.findByType(AIInspectionReviewScreen));
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
});
it('disables Manage Unit Details instead of advertising a working destination', async () => {
  await mount();
  const action = app.root
    .findAllByType(Button)
    .find(n => n.props.title === 'Manage unit details');
  expect(action?.props.disabled).toBe(true);
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
