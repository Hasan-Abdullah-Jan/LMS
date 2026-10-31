import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import {
  configureAuthHandlers,
  getData,
  request,
  tokenStore,
  type SessionPayload,
} from '@/lib/api';
import type { Profile } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: Profile | null;
  login: (email: string, password: string) => Promise<Profile>;
  logout: () => Promise<void>;
  updateUser: (user: Profile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Single-flight so React StrictMode's double effect never spends the refresh token twice. */
let bootRefresh: Promise<SessionPayload<Profile> | null> | null = null;
const fetchSession = () =>
  getData<SessionPayload<Profile>>('/auth/refresh', { method: 'POST', skipRefresh: true }).catch(
    () => null,
  );

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<Profile | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refreshRef = useRef<() => Promise<boolean>>(async () => false);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    tokenStore.set(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  const apply = useCallback((session: SessionPayload<Profile>) => {
    tokenStore.set(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
    clearTimeout(timer.current);
    // Refresh one minute before the access token expires.
    const delay = Math.max(5_000, session.expiresAt * 1000 - Date.now() - 60_000);
    timer.current = setTimeout(() => void refreshRef.current(), delay);
  }, []);

  const refresh = useCallback(async () => {
    const session = await fetchSession();
    if (session) {
      apply(session);
      return true;
    }
    clear();
    return false;
  }, [apply, clear]);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    configureAuthHandlers({
      refresh: () => refreshRef.current(),
      onUnauthorized: (error) => {
        clear();
        if (error.code === 'ACCOUNT_DEACTIVATED') toast.error(error.message);
        else toast.info('Your session has ended. Please sign in again.');
      },
    });
    bootRefresh ??= fetchSession();
    void bootRefresh.then((session) => {
      bootRefresh = null;
      if (session) apply(session);
      else setStatus('anonymous');
    });
    return () => clearTimeout(timer.current);
  }, [apply, clear]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await getData<SessionPayload<Profile>>('/auth/login', {
        method: 'POST',
        body: { email, password },
        skipRefresh: true,
      });
      queryClient.clear();
      apply(session);
      return session.user;
    },
    [apply, queryClient],
  );

  const logout = useCallback(async () => {
    await request('/auth/logout', { method: 'POST', skipRefresh: true }).catch(() => undefined);
    clear();
  }, [clear]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, updateUser: setUser }),
    [status, user, login, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** The signed-in user (only call inside protected routes). */
export function useUser(): Profile {
  const { user } = useAuth();
  if (!user) throw new Error('useUser called without a signed-in user');
  return user;
}
