import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setAccessToken } from '../shared/api';
import { demoAvailable, isDemoSession, setDemoSession } from '../shared/demoMode';
import type { AuthResult, User } from '../shared/types';

interface AuthContextValue {
  user: User | null; loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<void>;
  signOut(): Promise<void>;
  enterDemo(): void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'cullpilot.auth.v1';
const demoUser: User = { id: 'local-demo-user', email: 'demo@localhost', displayName: '本地演示用户', status: 'active', createdAt: '2026-01-01T00:00:00Z' };
function restore(): { token: string; expiresAt: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { token: string; expiresAt: string };
    if (Date.parse(value.expiresAt) <= Date.now()) { sessionStorage.removeItem(STORAGE_KEY); return null; }
    return value;
  } catch { return null; }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const expired = () => { setAccessToken(null); sessionStorage.removeItem(STORAGE_KEY); queryClient.clear(); setUser(null); };
    window.addEventListener('cullpilot:session-expired', expired);
    return () => window.removeEventListener('cullpilot:session-expired', expired);
  }, [queryClient]);
  useEffect(() => {
    if (isDemoSession()) { setUser(demoUser); setLoading(false); return; }
    const saved = restore();
    if (!saved) { setLoading(false); return; }
    setAccessToken(saved.token);
    api.me().then(setUser).catch(() => { setAccessToken(null); sessionStorage.removeItem(STORAGE_KEY); }).finally(() => setLoading(false));
  }, []);
  function accept(result: AuthResult) {
    setAccessToken(result.accessToken);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: result.accessToken, expiresAt: result.expiresAt }));
    setUser(result.user);
  }
  return <AuthContext.Provider value={{ user, loading,
    async signIn(email, password) { setDemoSession(false); queryClient.clear(); accept(await api.login(email, password)); },
    async signUp(email, password, name) { setDemoSession(false); queryClient.clear(); accept(await api.register(email, password, name)); },
    async signOut() {
      try { if (!isDemoSession()) await api.logout(); } finally { setDemoSession(false); setAccessToken(null); sessionStorage.removeItem(STORAGE_KEY); queryClient.clear(); setUser(null); }
    },
    enterDemo() {
      if (!demoAvailable) return;
      queryClient.clear();
      setAccessToken(null);
      sessionStorage.removeItem(STORAGE_KEY);
      setDemoSession(true);
      setUser(demoUser);
    },
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is required'); return value; }
