'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ApiFailure,
  authRequest,
  refreshSingleFlight,
  type AccountUser,
  type SessionSummary,
} from '../lib/auth-client';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AccountUser };
type AuthContextValue = {
  state: AuthState;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
  sessions(): Promise<SessionSummary[]>;
  revokeSession(id: string, current: boolean): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const access = useRef<string | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  const clear = useCallback(() => {
    access.current = null;
    setState({ status: 'anonymous' });
  }, []);

  const restore = useCallback(async () => {
    const token = await refreshSingleFlight();
    const user = await authRequest<AccountUser>('/me', {}, token);
    access.current = token;
    setState({ status: 'authenticated', user });
  }, []);

  useEffect(() => {
    let active = true;
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('ekms-auth');
      channel.current.onmessage = (event: MessageEvent) => {
        if (event.data === 'logout') clear();
      };
    }
    void restore().catch(() => {
      if (active) clear();
    });
    return () => {
      active = false;
      channel.current?.close();
      channel.current = null;
    };
  }, [clear, restore]);

  const authorized = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      let token = access.current;
      if (!token) {
        try {
          token = await refreshSingleFlight();
          access.current = token;
        } catch {
          clear();
          throw new ApiFailure(401, 'AUTH_REQUIRED', 'Sign in again.');
        }
      }
      try {
        return await authRequest<T>(path, options, token);
      } catch (error) {
        if (!(error instanceof ApiFailure) || error.status !== 401) throw error;
        try {
          token = await refreshSingleFlight();
          access.current = token;
          return await authRequest<T>(path, options, token);
        } catch {
          clear();
          throw new ApiFailure(401, 'AUTH_REQUIRED', 'Sign in again.');
        }
      }
    },
    [clear],
  );

  const value: AuthContextValue = {
    state,
    async login(email, password) {
      const result = await authRequest<{
        accessToken: string;
        user: AccountUser;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      access.current = result.accessToken;
      setState({ status: 'authenticated', user: result.user });
    },
    async register(email, password) {
      await authRequest<AccountUser>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    async logout() {
      try {
        await authRequest(
          '/auth/logout',
          { method: 'POST' },
          access.current ?? undefined,
        );
      } finally {
        clear();
        channel.current?.postMessage('logout');
      }
    },
    async logoutAll() {
      try {
        await authorized('/auth/logout-all', { method: 'POST' });
      } finally {
        clear();
        channel.current?.postMessage('logout');
      }
    },
    sessions: () => authorized<SessionSummary[]>('/auth/sessions'),
    async revokeSession(id, current) {
      await authorized(`/auth/sessions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (current) {
        clear();
        channel.current?.postMessage('logout');
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
