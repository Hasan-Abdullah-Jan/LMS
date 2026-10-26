import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setAccessToken } from '../../lib/api';
import type { Profile, SessionData } from './auth.types';
import { setRealtimeToken } from '../../lib/supabase';

interface AuthValue {
  profile: Profile | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refreshProfile(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const applySession = useCallback((session: SessionData) => {
    setAccessToken(session.accessToken);
    setRealtimeToken(session.accessToken);
    setProfile(session.profile);
  }, []);
  const clear = useCallback(() => { setAccessToken(null); setRealtimeToken(null); setProfile(null); }, []);

  useEffect(() => {
    let live = true;
    api<{ data: SessionData }>('/auth/refresh', { method: 'POST' })
      .then((result) => { if (live) applySession(result.data); })
      .catch(() => { if (live) clear(); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [applySession, clear]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ data: SessionData }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    applySession(result.data);
  }, [applySession]);
  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } finally { clear(); }
  }, [clear]);
  const refreshProfile = useCallback(async () => {
    const result = await api<{ data: Profile }>('/auth/me');
    setProfile(result.data);
  }, []);
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    await refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(() => ({ profile, loading, login, logout, refreshProfile, changePassword }), [profile, loading, login, logout, refreshProfile, changePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

