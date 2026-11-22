// Presentation state only. Never substitutes sample records for a failed API request.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { consent, tenantApi, type TenantState } from '../services/leaseService';
function useHousing() {
  const [state, setState] = useState<TenantState>({
    consented: false,
    welcomed: true,
    baselineReviewed: false,
    movePhotos: {},
    unit: null,
    details: null,
    pendingInvite: null,
  });
  const [justJoined, setJustJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const refresh = useCallback(async () => {
    try {
      const result = await tenantApi.state();
      setState(result);
      setError('');
      return !!result.pendingInvite;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const respond = async (decision: 'accept' | 'decline') => {
    if (busy) return;
    setBusy(true);
    try {
      setState(await tenantApi.respond(decision, token.trim()));
      if (decision === 'accept') setJustJoined(true);
      setToken('');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return {
    ...state,
    justJoined,
    finishWelcome: () => setJustJoined(false),
    loading,
    error,
    busy,
    token,
    setToken,
    refresh,
    isNewTenant: true,
    stage: loading
      ? ('loading' as const)
      : !state.consented
      ? ('consent' as const)
      : state.pendingInvite
      ? ('invite' as const)
      : ('ready' as const),
    acceptPendingInvite: () => respond('accept'),
    declinePendingInvite: () => respond('decline'),
    checkForInvite: refresh,
    acceptConsent: async () => {
      try {
        await consent();
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    },
  };
}
const Context = createContext<ReturnType<typeof useHousing> | null>(null);
export function TenantDemoProvider({ children }: PropsWithChildren) {
  const value = useHousing();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTenantDemo() {
  const value = useContext(Context);
  if (!value) throw new Error('Housing provider required');
  return value;
}
