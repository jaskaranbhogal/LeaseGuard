import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, TextInput, Alert } from 'react-native';
import {
  LandlordDemoProvider,
  useLandlordDemo,
} from '../src/context/LandlordDemoContext';
import {
  TenantDemoProvider,
  useTenantDemo,
} from '../src/context/TenantDemoContext';
import TenantInvitePromptScreen from '../src/screens/tenant/TenantInvitePromptScreen';
import ActionButton from '../src/components/ActionButton';
import { LandlordGate, TenantGate } from '../src/components/HousingGate';
import * as api from '../src/services/leaseService';
import type { LandlordState, TenantState } from '../src/services/leaseService';
jest.mock('../src/services/leaseService');
const empty: LandlordState = { consented: true, properties: [], activity: [] };
const property = {
  id: 'a'.repeat(24),
  street: 'Verified property',
  city: 'NY',
  units: [
    {
      id: 'b'.repeat(24),
      name: '101',
      bedrooms: '1',
      bathrooms: '1',
      areas: ['Entry', 'Living room', 'Kitchen', 'Bathroom', 'Bedroom'],
      revision: 0,
    },
  ],
};
const invite = {
  id: 'c'.repeat(32),
  email: 'tenant@example.com',
  landlordId: 'owner',
  landlordName: 'Owner',
  propertyId: property.id,
  unitId: property.units[0].id,
  street: property.street,
  city: 'NY',
  unit: '101',
  bedrooms: '1',
  bathrooms: '1',
  areaCount: 5,
};
const pending: TenantState = {
  consented: true,
  welcomed: true,
  baselineReviewed: false,
  movePhotos: {},
  unit: null,
  details: null,
  pendingInvite: invite,
};
let app: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(api.landlordApi.state).mockResolvedValue(empty);
  jest.mocked(api.tenantApi.state).mockResolvedValue(pending);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => {
  if (app) await act(async () => app.unmount());
  jest.restoreAllMocks();
});
async function mount(children: React.ReactNode) {
  await act(async () => {
    app = create(
      <SafeAreaProvider>
        <NavigationContainer>{children}</NavigationContainer>
      </SafeAreaProvider>,
    );
  });
}
function OwnerProbe() {
  const s = useLandlordDemo();
  return (
    <>
      <Text>{s.properties.map(p => p.street).join(',')}</Text>
      <Text>{s.toast?.title || ''}</Text>
      <ActionButton
        title="Save property"
        onPress={() =>
          s.addProperty(
            {
              address: 'Verified property, NY',
              unit: '101',
              bedrooms: '1',
              bathrooms: '1',
            },
            'stable_property_key',
          )
        }
      />
      <ActionButton
        title="Invite tenant"
        onPress={() =>
          s.sendInvite(property.id, property.units[0].id, 'tenant@example.com')
        }
      />
    </>
  );
}
function ResidentProbe() {
  const s = useTenantDemo();
  return s.pendingInvite ? (
    <TenantInvitePromptScreen />
  ) : (
    <Text>{s.unit ? `Joined ${s.unit.unit}` : 'No invitation'}</Text>
  );
}
function button(title: string) {
  return app.root
    .findAllByType(ActionButton)
    .find(b => b.props.title === title)!;
}
it('uses real API data and claims property persistence only after confirmation', async () => {
  let resolve!: (s: LandlordState) => void;
  jest.mocked(api.landlordApi.addProperty).mockReturnValue(
    new Promise(r => {
      resolve = r;
    }),
  );
  await mount(
    <LandlordDemoProvider>
      <OwnerProbe />
    </LandlordDemoProvider>,
  );
  await act(async () => {
    button('Save property').props.onPress();
  });
  expect(JSON.stringify(app.toJSON())).not.toContain('Property saved.');
  await act(async () => resolve({ ...empty, properties: [property] }));
  expect(JSON.stringify(app.toJSON())).toContain('Property saved.');
  expect(JSON.stringify(app.toJSON())).toContain('Verified property');
  expect(api.landlordApi.addProperty).toHaveBeenCalledWith(
    expect.objectContaining({ idempotency_key: 'stable_property_key' }),
  );
});
it('keeps failed changes out of dashboard state and does not claim success', async () => {
  jest
    .mocked(api.landlordApi.addProperty)
    .mockRejectedValue(new Error('Network unavailable'));
  await mount(
    <LandlordDemoProvider>
      <OwnerProbe />
    </LandlordDemoProvider>,
  );
  await act(async () => {
    button('Save property').props.onPress();
  });
  expect(JSON.stringify(app.toJSON())).not.toContain('Property saved.');
  expect(Alert.alert).toHaveBeenCalledWith(
    'Change not saved',
    'Network unavailable',
  );
});
it('does not invent successful email delivery', async () => {
  jest
    .mocked(api.landlordApi.invite)
    .mockResolvedValue({ ...empty, properties: [property] });
  await mount(
    <LandlordDemoProvider>
      <OwnerProbe />
    </LandlordDemoProvider>,
  );
  await act(async () => button('Invite tenant').props.onPress());
  expect(JSON.stringify(app.toJSON())).toContain(
    'Invitation created. Check delivery status.',
  );
  expect(JSON.stringify(app.toJSON())).not.toContain('Invite sent.');
});
it('requires the email invitation code and persists acceptance before showing a joined unit', async () => {
  jest
    .mocked(api.tenantApi.respond)
    .mockResolvedValue({ ...pending, pendingInvite: null, unit: invite });
  await mount(
    <TenantDemoProvider>
      <ResidentProbe />
    </TenantDemoProvider>,
  );
  expect(button('Accept invite').props.disabled).toBe(true);
  await act(async () =>
    app.root.findByType(TextInput).props.onChangeText('a'.repeat(43)),
  );
  await act(async () => button('Accept invite').props.onPress());
  expect(api.tenantApi.respond).toHaveBeenCalledWith('accept', 'a'.repeat(43));
  expect(JSON.stringify(app.toJSON())).toContain('Joined 101');
});
it('shows expired or wrong-account errors without a fake joined relationship', async () => {
  jest
    .mocked(api.tenantApi.respond)
    .mockRejectedValue(new Error('Invitation expired'));
  await mount(
    <TenantDemoProvider>
      <ResidentProbe />
    </TenantDemoProvider>,
  );
  await act(async () =>
    app.root.findByType(TextInput).props.onChangeText('b'.repeat(43)),
  );
  await act(async () => button('Accept invite').props.onPress());
  expect(JSON.stringify(app.toJSON())).toContain('Invitation expired');
  expect(JSON.stringify(app.toJSON())).not.toContain('Joined 101');
});
it('declines through the same authenticated token workflow', async () => {
  jest
    .mocked(api.tenantApi.respond)
    .mockResolvedValue({ ...pending, pendingInvite: null });
  function Decline() {
    const s = useTenantDemo();
    return (
      <ActionButton title="Decline now" onPress={s.declinePendingInvite} />
    );
  }
  await mount(
    <TenantDemoProvider>
      <Decline />
    </TenantDemoProvider>,
  );
  await act(async () => button('Decline now').props.onPress());
  expect(api.tenantApi.respond).toHaveBeenCalledWith('decline', '');
});
it('keeps consent gate closed until the server acknowledges the current policy', async () => {
  jest
    .mocked(api.landlordApi.state)
    .mockResolvedValue({ ...empty, consented: false });
  jest.mocked(api.consent).mockRejectedValue(new Error('Offline'));
  await mount(
    <LandlordDemoProvider>
      <LandlordGate>
        <Text>Private dashboard</Text>
      </LandlordGate>
    </LandlordDemoProvider>,
  );
  expect(JSON.stringify(app.toJSON())).not.toContain('Private dashboard');
  await act(async () => button('Accept and continue').props.onPress());
  expect(JSON.stringify(app.toJSON())).toContain('Offline');
  expect(JSON.stringify(app.toJSON())).not.toContain('Private dashboard');
});

it('requires confirmation to revoke a pending invitation before reissuing it', async () => {
  const EditUnitScreen =
    require('../src/screens/landlord/EditUnitScreen').default;
  const linked = {
    ...property,
    units: [
      {
        ...property.units[0],
        tenant: {
          email: 'tenant@example.com',
          status: 'pending' as const,
          invitedOn: '2026-11-22T12:00:00Z',
        },
      },
    ],
  };
  jest
    .mocked(api.landlordApi.state)
    .mockResolvedValue({ ...empty, properties: [linked] });
  jest
    .mocked(api.landlordApi.removeTenant)
    .mockResolvedValue({ ...empty, properties: [property] });
  jest
    .mocked(api.landlordApi.invite)
    .mockResolvedValue({ ...empty, properties: [linked] });
  await mount(
    <LandlordDemoProvider>
      <LandlordGate>
        <EditUnitScreen
          navigation={{ goBack: jest.fn() }}
          route={{
            params: { propertyId: property.id, unitId: property.units[0].id },
          }}
        />
      </LandlordGate>
    </LandlordDemoProvider>,
  );
  await act(async () => button('Resend invite').props.onPress());
  expect(api.landlordApi.removeTenant).not.toHaveBeenCalled();
  expect(api.landlordApi.invite).not.toHaveBeenCalled();
  const options = jest
    .mocked(Alert.alert)
    .mock.calls.find(c => c[0] === 'Replace pending invitation?')?.[2];
  await act(async () =>
    options?.find(o => o.text === 'Revoke and reissue')?.onPress?.(),
  );
  expect(api.landlordApi.removeTenant).toHaveBeenCalledWith(
    property.units[0].id,
    { action: 'revoke' },
  );
  expect(api.landlordApi.invite).toHaveBeenCalledWith(
    property.units[0].id,
    'tenant@example.com',
  );
  expect(
    jest.mocked(api.landlordApi.removeTenant).mock.invocationCallOrder[0],
  ).toBeLessThan(
    jest.mocked(api.landlordApi.invite).mock.invocationCallOrder[0],
  );
});

it('does not issue another invitation if revoking the pending one fails', async () => {
  const EditUnitScreen =
    require('../src/screens/landlord/EditUnitScreen').default;
  const linked = {
    ...property,
    units: [
      {
        ...property.units[0],
        tenant: {
          email: 'tenant@example.com',
          status: 'pending' as const,
          invitedOn: '2026-11-22T12:00:00Z',
        },
      },
    ],
  };
  jest
    .mocked(api.landlordApi.state)
    .mockResolvedValue({ ...empty, properties: [linked] });
  jest
    .mocked(api.landlordApi.removeTenant)
    .mockRejectedValue(new Error('Revoke failed.'));
  await mount(
    <LandlordDemoProvider>
      <LandlordGate>
        <EditUnitScreen
          navigation={{ goBack: jest.fn() }}
          route={{
            params: { propertyId: property.id, unitId: property.units[0].id },
          }}
        />
      </LandlordGate>
    </LandlordDemoProvider>,
  );
  await act(async () => button('Resend invite').props.onPress());
  const options = jest
    .mocked(Alert.alert)
    .mock.calls.find(c => c[0] === 'Replace pending invitation?')?.[2];
  await act(async () =>
    options?.find(o => o.text === 'Revoke and reissue')?.onPress?.(),
  );
  expect(api.landlordApi.invite).not.toHaveBeenCalled();
  expect(JSON.stringify(app.toJSON())).toContain('Revoke failed.');
});

it.each(['landlord', 'tenant'] as const)(
  'shows a recoverable %s account-load error instead of falsely requesting consent',
  async role => {
    const Provider =
      role === 'landlord' ? LandlordDemoProvider : TenantDemoProvider;
    const Gate = role === 'landlord' ? LandlordGate : TenantGate;
    if (role === 'landlord')
      jest
        .mocked(api.landlordApi.state)
        .mockRejectedValueOnce(new Error('Wait a minute and retry.'));
    else
      jest
        .mocked(api.tenantApi.state)
        .mockRejectedValueOnce(new Error('Wait a minute and retry.'));
    await mount(
      <Provider>
        <Gate>
          <Text>Protected account screen</Text>
        </Gate>
      </Provider>,
    );
    expect(JSON.stringify(app.toJSON())).toContain('Unable to load account');
    expect(JSON.stringify(app.toJSON())).not.toContain('Before you start');
    expect(JSON.stringify(app.toJSON())).not.toContain(
      'Protected account screen',
    );
    jest.mocked(api.landlordApi.state).mockResolvedValue(empty);
    jest
      .mocked(api.tenantApi.state)
      .mockResolvedValue({ ...pending, pendingInvite: null });
    await act(async () => button('Retry loading account').props.onPress());
    expect(JSON.stringify(app.toJSON())).toContain('Protected account screen');
    expect(api.consent).not.toHaveBeenCalled();
  },
);
