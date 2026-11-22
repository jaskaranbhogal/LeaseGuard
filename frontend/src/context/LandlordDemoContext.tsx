// Jon's presentation adapter; all records and persistence come from canonical APIs.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  consent,
  landlordApi,
  type LandlordState,
} from '../services/leaseService';
import type { Unit, TenantLink } from '../types/housing';
export type { Activity, Property, TenantLink, Unit } from '../types/housing';
export const MIN_AREAS = 5;
export const MAX_AREAS = 20;
export const DEFAULT_AREAS = [
  'Entry',
  'Living room',
  'Kitchen',
  'Bathroom',
  'Bedroom',
];
export type NewProperty = {
  address: string;
  unit: string;
  bedrooms: string;
  bathrooms: string;
  tenantEmail?: string;
};
export type UnitChanges = Pick<
  Unit,
  'name' | 'bedrooms' | 'bathrooms' | 'areas'
>;
export type ToastMessage = { title: string; detail?: string };
function useHousing() {
  const [state, setState] = useState<LandlordState>({
    consented: false,
    properties: [],
    activity: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const refresh = useCallback(async () => {
    try {
      setState(await landlordApi.state());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const persist = async (work: () => Promise<LandlordState>, title: string) => {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      setState(await work());
      setToast({ title });
      return true;
    } catch (e) {
      setError((e as Error).message);
      Alert.alert('Change not saved', (e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const findUnit = (propertyId: string, unitId: string) => {
    const property = state.properties.find(p => p.id === propertyId);
    const unit = property?.units.find(u => u.id === unitId);
    return property && unit ? { property, unit } : undefined;
  };
  return {
    ...state,
    loading,
    error,
    busy,
    toast,
    refresh,
    findUnit,
    dismissToast: () => setToast(null),
    acceptConsent: async () => {
      try {
        await consent();
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    addProperty: async (input: NewProperty, key: string) => {
      const [street, ...rest] = input.address.split(',');
      let createdUnitId: string | undefined;
      const ok = await persist(async () => {
        const result = await landlordApi.addProperty({
          street: street.trim(),
          city: rest.join(',').trim(),
          unit: input.unit,
          bedrooms: input.bedrooms,
          bathrooms: input.bathrooms,
          areas: DEFAULT_AREAS,
          idempotency_key: key,
        });
        createdUnitId = result.created_unit_id;
        return result;
      }, 'Property saved.');
      // Invitation is separate: never claim delivery just because the property saved.
      if (ok && input.tenantEmail?.trim() && createdUnitId)
        await persist(
          () => landlordApi.invite(createdUnitId!, input.tenantEmail!.trim()),
          'Invitation created. Check delivery status.',
        );
      return ok;
    },
    addUnit: (propertyId: string, input: NewProperty, key: string) =>
      persist(
        () =>
          landlordApi.addUnit(propertyId, {
            name: input.unit,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            areas: DEFAULT_AREAS,
            idempotency_key: key,
          }),
        'Unit saved.',
      ),
    updateUnit: (p: string, u: string, changes: UnitChanges) =>
      persist(
        () =>
          landlordApi.updateUnit(u, {
            ...changes,
            revision: findUnit(p, u)?.unit.revision,
          }),
        'Unit saved. Future area configuration updated; historical evidence unchanged.',
      ),
    sendInvite: (_p: string, u: string, email: string) =>
      persist(
        () => landlordApi.invite(u, email),
        'Invitation created. Check delivery status.',
      ),
    cancelInvite: (_p: string, u: string) =>
      persist(
        () => landlordApi.removeTenant(u, { action: 'revoke' }),
        'Invitation revoked.',
      ),
    removeTenant: (p: string, u: string) =>
      persist(
        () =>
          landlordApi.removeTenant(u, {
            action: 'end-assignment',
            assignment_id: findUnit(p, u)?.unit.assignmentId,
          }),
        'Assignment ended. Historical evidence retained.',
      ),
  };
}
const Context = createContext<ReturnType<typeof useHousing> | null>(null);
export function LandlordDemoProvider({ children }: PropsWithChildren) {
  const value = useHousing();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLandlordDemo() {
  const value = useContext(Context);
  if (!value) throw new Error('Housing provider required');
  return value;
}
export function useRefreshProperties() {
  const { refresh } = useLandlordDemo();
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
}
export function firstName(tenant?: TenantLink) {
  return (tenant?.name || tenant?.email || 'your tenant').split(' ')[0];
}
