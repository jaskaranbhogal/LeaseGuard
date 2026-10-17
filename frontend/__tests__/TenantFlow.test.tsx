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
import ReviewInspectionPhotoScreen from '../src/screens/tenant/ReviewInspectionPhotoScreen';
import InspectionSubmittedScreen from '../src/screens/tenant/InspectionSubmittedScreen';
import MaintenanceDetailScreen from '../src/screens/tenant/MaintenanceDetailScreen';
import InspectionAvailabilityScreen from '../src/screens/tenant/InspectionAvailabilityScreen';
import ReportMaintenanceScreen from '../src/screens/tenant/ReportMaintenanceScreen';
import UnitHistoryScreen from '../src/screens/tenant/UnitHistoryScreen';
import LoginScreen from '../src/screens/auth/LoginScreen';
import Button from '../src/components/Button';
import * as auth from '../src/services/authService';
import { ApiError } from '../src/services/api';
import type { User } from '../src/types/user';
import type { MaintenanceRequestId } from '../src/types/maintenance';

jest.mock('../src/services/authService');
const tenant: User = {
  id: 1,
  name: 'Test Tenant',
  email: 'tenant@example.com',
  role: 'tenant',
};
const landlord: User = {
  id: 2,
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
it('routes repeated logins, clears logout history, and does not leak demo progress', async () => {
  await mount(null);
  expect(app.root.findAllByType(TenantDashboardScreen)).toHaveLength(0);
  await signIn(tenant);
  await press('Start inspection demo');
  await press(
    'Review placeholder photo',
    app.root.findByType(GuidedInspectionScreen),
  );
  await press(
    'Use placeholder and continue',
    app.root.findByType(ReviewInspectionPhotoScreen),
  );
  await act(async () => navigation.dispatch(StackActions.popTo('TenantTabs')));
  await press('Settings');
  await press('Log out');
  expect(auth.logout).toHaveBeenCalledTimes(1);
  expect(app.root.findAllByType(TenantDashboardScreen)).toHaveLength(0);
  expect(navigation.getCurrentRoute()?.name).toBe('Login');
  expect(navigation.canGoBack()).toBe(false);
  await signIn(landlord);
  expect(navigation.getCurrentRoute()?.name).toBe('Dashboard');
  await press('Settings');
  await press('Log out');
  await signIn(tenant);
  expect(navigation.getCurrentRoute()?.name).toBe('Home');
  await press('Start inspection demo');
  await press(
    'Review placeholder photo',
    app.root.findByType(GuidedInspectionScreen),
  );
  expect(navigation.getCurrentRoute()?.params).toEqual({ stepIndex: 0 });
});
it('shows logout failures and permits a retry', async () => {
  await mount(landlord);
  jest
    .mocked(auth.logout)
    .mockRejectedValueOnce(new ApiError('Unable to reach LeaseGuard.'));
  await press('Settings');
  await press('Log out');
  expect(navigation.getCurrentRoute()?.name).toBe('Settings');
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
it('progresses through four steps, supports retake/back, and clears review history on completion', async () => {
  await mount();
  await press('Inspections');
  await press('Continue inspection demo');
  for (let index = 0; index < 4; index++) {
    await press(
      'Review placeholder photo',
      app.root.findByType(GuidedInspectionScreen),
    );
    expect(navigation.getCurrentRoute()?.params).toEqual({ stepIndex: index });
    await press(
      'Retake demo photo',
      app.root.findByType(ReviewInspectionPhotoScreen),
    );
    expect(navigation.getCurrentRoute()?.name).toBe('GuidedInspection');
    await press(
      'Review placeholder photo',
      app.root.findByType(GuidedInspectionScreen),
    );
    await press(
      index === 3 ? 'Complete demo' : 'Use placeholder and continue',
      app.root.findByType(ReviewInspectionPhotoScreen),
    );
    if (index === 0) {
      await act(async () => navigation.goBack());
      await press('Home');
      await press('Resume inspection demo');
    }
  }
  expect(navigation.getCurrentRoute()?.name).toBe('InspectionSubmitted');
  expect(app.root.findAllByType(ReviewInspectionPhotoScreen)).toHaveLength(0);
  expect(JSON.stringify(app.toJSON())).toContain('Inspection demo complete');
  expect(JSON.stringify(app.toJSON())).toContain('No photos were captured');
  await press(
    'Back to dashboard',
    app.root.findByType(InspectionSubmittedScreen),
  );
  expect(navigation.getCurrentRoute()?.name).toBe('Home');
  expect(navigation.canGoBack()).toBe(false);
});
it('selects maintenance IDs from dashboard/history with correct back behavior', async () => {
  await mount();
  await press('Kitchen sink leak', app.root.findByType(TenantDashboardScreen));
  expect(navigation.getCurrentRoute()?.params).toEqual({
    requestId: 'maintenance-1',
  });
  expect(
    app.root
      .findByType(MaintenanceDetailScreen)
      .findAllByType(Text)
      .some(t => t.props.children === 'Water leaking under sink cabinet'),
  ).toBe(true);
  await press(
    'Back to my requests',
    app.root.findByType(MaintenanceDetailScreen),
  );
  expect(navigation.getCurrentRoute()?.name).toBe('Home');
  await press('History');
  await press('Bedroom window latch', app.root.findByType(UnitHistoryScreen));
  expect(navigation.getCurrentRoute()?.params).toEqual({
    requestId: 'maintenance-2',
  });
  expect(
    app.root
      .findByType(MaintenanceDetailScreen)
      .findAllByType(Text)
      .some(t => t.props.children === 'Window latch sticks when closing'),
  ).toBe(true);
  await press(
    'Back to my requests',
    app.root.findByType(MaintenanceDetailScreen),
  );
  expect(navigation.getCurrentRoute()?.name).toBe('History');
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
    expect(JSON.stringify(app.toJSON())).toContain('Sample request not found');
    await press('Back to my requests');
    expect(navigation.getCurrentRoute()?.name).toBe('Home');
  },
);
it('preserves maintenance validation and reports only a demo preview', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  await press('Report issue');
  const form = app.root.findByType(ReportMaintenanceScreen);
  await press('Preview demo request', form);
  expect(alert).toHaveBeenLastCalledWith('Area required', expect.any(String));
  await act(async () =>
    form.findAllByType(TextInput)[0].props.onChangeText('Kitchen'),
  );
  await press('Preview demo request', form);
  expect(alert).toHaveBeenLastCalledWith(
    'Description required',
    expect.any(String),
  );
  await act(async () =>
    form.findAllByType(TextInput)[1].props.onChangeText('Leak'),
  );
  await press('Preview demo request', form);
  expect(alert).toHaveBeenLastCalledWith(
    'Demo form complete',
    expect.stringContaining('Nothing has been submitted'),
    expect.any(Array),
  );
});
it('validates availability and retains checked slots after preview', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  await press('Availability');
  const screen = app.root.findByType(InspectionAvailabilityScreen);
  await press('Preview demo availability', screen);
  expect(alert).toHaveBeenLastCalledWith('Select a time', expect.any(String));
  const slots = () =>
    screen
      .findAll(node => typeof node.props.onPress === 'function')
      .filter(p => p.props.accessibilityRole === 'checkbox');
  await act(async () => slots()[0].props.onPress());
  await press('Preview demo availability', screen);
  expect(slots()[0].props.accessibilityState.checked).toBe(true);
  expect(alert).toHaveBeenLastCalledWith(
    'Demo availability selected',
    expect.stringContaining('not been saved or sent'),
    expect.any(Array),
  );
  await act(async () => slots()[0].props.onPress());
  expect(slots()[0].props.accessibilityState.checked).toBe(false);
});

it('keeps inspection progress during session revalidation', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  await mount();
  await press('Start inspection demo');
  await press(
    'Review placeholder photo',
    app.root.findByType(GuidedInspectionScreen),
  );
  await press(
    'Use placeholder and continue',
    app.root.findByType(ReviewInspectionPhotoScreen),
  );
  let resolve!: (user: User | null) => void;
  jest.mocked(auth.getSession).mockImplementationOnce(
    () =>
      new Promise(accept => {
        resolve = accept;
      }),
  );
  await act(async () =>
    listener.mock.calls[listener.mock.calls.length - 1][1]('active'),
  );
  expect(JSON.stringify(app.toJSON())).toContain('Checking your session');
  await act(async () => resolve(tenant));
  await press(
    'Review placeholder photo',
    app.root.findByType(GuidedInspectionScreen),
  );
  expect(navigation.getCurrentRoute()?.params).toEqual({ stepIndex: 1 });
  await act(async () => navigation.dispatch(StackActions.popTo('TenantTabs')));
  await press('Settings');
  await press('Log out');
  expect(navigation.getCurrentRoute()?.name).toBe('Login');
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
