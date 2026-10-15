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
import type { User } from '../types/user';

type AuthState = {
  user: User | null;
  checking: boolean;
  sessionError: string;
  completeSignIn: (user: User) => void;
  refreshSession: () => Promise<void>;
  signOut: (signal?: AbortSignal) => Promise<void>;
  showLogin: () => void;
};
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const signingOut = useRef(false);

  const cancelCheck = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
  }, []);

  const refreshSession = useCallback(async () => {
    if (signingOut.current) {
      return;
    }
    cancelCheck();
    const controller = new AbortController();
    pending.current = controller;
    setChecking(true);
    setSessionError('');
    try {
      const sessionUser = await getSession(controller.signal);
      if (!controller.signal.aborted) {
        setUser(sessionUser);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setSessionError(
          error instanceof ApiError
            ? error.message
            : 'Unable to check your session. Please try again.',
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setChecking(false);
      }
    }
  }, [cancelCheck]);

  useEffect(() => {
    refreshSession();
    return cancelCheck;
  }, [refreshSession, cancelCheck]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshSession();
      }
    });
    // Revalidate even while the prototype has no protected data requests.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' && !pending.current) {
        refreshSession();
      }
    }, 60000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [user, refreshSession]);

  const completeSignIn = (authenticated: User) => {
    cancelCheck();
    setSessionError('');
    setChecking(false);
    setUser(authenticated);
  };
  const showLogin = () => {
    cancelCheck();
    setUser(null);
    setChecking(false);
    setSessionError('');
  };
  const signOut = async (signal?: AbortSignal) => {
    cancelCheck();
    setChecking(false);
    // Keep the error visible if Django could not invalidate the cookie session.
    signingOut.current = true;
    try {
      await logout(signal);
      showLogin();
    } finally {
      signingOut.current = false;
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
