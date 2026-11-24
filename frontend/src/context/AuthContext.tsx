import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { getSession, logout } from '../services/authService';
import { ApiError } from '../services/api';
import {
  currentFirebaseUser,
  signOutFirebase,
  subscribeToFirebaseAuth,
} from '../services/firebaseAuthService';
import type { User } from '../types/user';

type AuthState = {
  user: User | null;
  checking: boolean;
  sessionError: string;
  completeSignIn: (user: User, firebaseUid?: string) => void;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  showLogin: () => void;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const currentUser = useRef<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const signingOut = useRef(false);
  const authInitialized = useRef(false);
  const firebaseUid = useRef<string | null | undefined>(undefined);
  const authGeneration = useRef(0);
  const logoutPending = useRef(false);
  const logoutInFlight = useRef(false);
  const pendingLogoutFirebaseUid = useRef<string | null>(null);
  const localSignOut = useRef(false);

  const cancelCheck = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
  }, []);

  const updateUser = useCallback((nextUser: User | null) => {
    currentUser.current = nextUser;
    setUser(nextUser);
  }, []);

  const invalidateBackendSession = useCallback(async () => {
    if (logoutInFlight.current) return false;
    logoutInFlight.current = true;
    try {
      await logout(undefined, pendingLogoutFirebaseUid.current ?? undefined);
      logoutPending.current = false;
      pendingLogoutFirebaseUid.current = null;
      if (!currentFirebaseUser()) setSessionError('');
      return true;
    } catch {
      // The local account stays cleared. Django also gives Firebase sessions
      // a short server-side expiry so a network failure cannot leave access
      // valid indefinitely; retry when the app returns to the foreground.
      logoutPending.current = true;
      setSessionError(
        'LeaseGuard could not confirm sign-out. Reconnect to finish signing out.',
      );
      return false;
    } finally {
      logoutInFlight.current = false;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (signingOut.current || localSignOut.current) return;
    if (logoutPending.current && !currentFirebaseUser()) {
      setChecking(true);
      await invalidateBackendSession();
      setChecking(false);
      return;
    }
    // Do not abort an in-flight token exchange: its HTTP response may still
    // rotate the session cookie. Auth changes wait behind it in the service
    // mutation queue, and its generation check prevents stale UI updates.
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const generation = authGeneration.current;
    const expectedUid = currentFirebaseUser()?.uid ?? null;
    setChecking(true);
    setSessionError('');
    try {
      const sessionUser = await getSession(controller.signal);
      if (
        !controller.signal.aborted &&
        generation === authGeneration.current &&
        (currentFirebaseUser()?.uid ?? null) === expectedUid
      ) {
        if (expectedUid) {
          logoutPending.current = false;
          pendingLogoutFirebaseUid.current = null;
        }
        updateUser(sessionUser);
      }
    } catch (error) {
      if (
        !controller.signal.aborted &&
        generation === authGeneration.current &&
        (currentFirebaseUser()?.uid ?? null) === expectedUid
      ) {
        if (error instanceof ApiError && error.code === 'account_link_required') {
          updateUser(null);
          setSessionError('');
        } else if (
          expectedUid &&
          currentUser.current &&
          error instanceof ApiError &&
          (error.status === undefined || error.status >= 500 || error.status === 429)
        ) {
          // Keep the authenticated navigator mounted during temporary backend
          // outages. The overlay blocks protected UI actions while preserving
          // in-progress screen state until Firebase can renew the Django
          // session on retry or app resume.
          setSessionError(error.message);
        } else if (expectedUid) {
          updateUser(null);
          // A Firebase identity that Django can no longer verify must not keep
          // the old Django cookie session available to the next screen.
          if (!logoutPending.current) {
            pendingLogoutFirebaseUid.current = expectedUid;
          }
          await invalidateBackendSession();
          if (generation === authGeneration.current) {
            setSessionError('Your sign-in could not be verified. Please sign in again.');
          }
        } else {
          updateUser(null);
          setSessionError(
            error instanceof ApiError
              ? error.message
              : 'Unable to check your session. Please try again.',
          );
        }
      }
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted && generation === authGeneration.current) {
        setChecking(false);
      }
    }
  }, [invalidateBackendSession, updateUser]);

  useEffect(() => {
    const generationRef = authGeneration;
    const unsubscribe = subscribeToFirebaseAuth(firebaseUser => {
      const nextUid = firebaseUser?.uid ?? null;
      if (localSignOut.current) {
        firebaseUid.current = nextUid;
        updateUser(null);
        setChecking(false);
        return;
      }
      if (!authInitialized.current) {
        authInitialized.current = true;
        firebaseUid.current = nextUid;
        // Restore the selected Firebase identity, or a legacy Django session
        // when there is no Firebase user yet.
        refreshSession().catch(() => undefined);
        return;
      }
      if (firebaseUid.current === nextUid) return;

      const previousUid = firebaseUid.current;
      firebaseUid.current = nextUid;
      const generation = ++authGeneration.current;
      updateUser(null); // Hide the previous account before any network request.
      setSessionError('');
      setChecking(Boolean(firebaseUser));

      if (signingOut.current) return;
      if (!firebaseUser) {
        setChecking(false);
        if (previousUid) {
          pendingLogoutFirebaseUid.current = previousUid;
          invalidateBackendSession().catch(() => false);
        }
        return;
      }

      // Clear a previous Firebase or legacy Django cookie before switching
      // identities. The auth service serializes this with token exchanges.
      (async () => {
        if (previousUid !== undefined) {
          pendingLogoutFirebaseUid.current = previousUid;
          await invalidateBackendSession();
        }
        if (
          generation === authGeneration.current &&
          currentFirebaseUser()?.uid === nextUid
        ) {
          await refreshSession();
        }
      })().catch(() => undefined);
    });
    return () => {
      unsubscribe();
      ++generationRef.current;
      cancelCheck();
    };
  }, [cancelCheck, invalidateBackendSession, refreshSession, updateUser]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        if (logoutPending.current && !currentFirebaseUser()) {
          invalidateBackendSession().catch(() => false);
        }
        else refreshSession().catch(() => undefined);
      }
    });
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      if (logoutPending.current && !currentFirebaseUser()) {
        invalidateBackendSession().catch(() => false);
      }
      else if (currentFirebaseUser() && !pending.current) {
        refreshSession().catch(() => undefined);
      }
    }, 60000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [invalidateBackendSession, refreshSession]);

  const completeSignIn = (authenticated: User, expectedUid?: string) => {
    if (expectedUid && currentFirebaseUser()?.uid !== expectedUid) return;
    localSignOut.current = false;
    logoutPending.current = false;
    pendingLogoutFirebaseUid.current = null;
    setSessionError('');
    setChecking(false);
    updateUser(authenticated);
  };
  const showLogin = () => {
    updateUser(null);
    setChecking(false);
    if (!logoutPending.current) setSessionError('');
  };
  const signOut = async () => {
    const expectedUid = currentFirebaseUser()?.uid ?? firebaseUid.current ?? null;
    pendingLogoutFirebaseUid.current = expectedUid;
    localSignOut.current = true;
    ++authGeneration.current;
    updateUser(null);
    setChecking(false);
    signingOut.current = true;
    try {
      try {
        // Do not bind this request to the Settings screen's AbortSignal. We
        // clear the local user immediately, which unmounts Settings; aborting
        // its controller there can cancel the Django logout after the server
        // has already processed it and incorrectly show the recovery screen.
        await logout(undefined, expectedUid ?? undefined);
        logoutPending.current = false;
        pendingLogoutFirebaseUid.current = null;
        setSessionError('');
      } catch {
        logoutPending.current = true;
        setSessionError(
          'LeaseGuard could not confirm sign-out. Reconnect to finish signing out.',
        );
      }
      try {
        await signOutFirebase();
        localSignOut.current = false;
      } catch {
        setSessionError('LeaseGuard could not finish signing out. Please retry.');
      }
    } finally {
      signingOut.current = false;
      firebaseUid.current = null;
      updateUser(null);
      setChecking(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        checking,
        sessionError,
        completeSignIn,
        refreshSession,
        signOut,
        showLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
