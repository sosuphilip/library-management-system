import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearTokens, getAccessToken, setTokens, setSessionExpiredHandler } from '../lib/api';
import type { Tokens, User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  /** True until the initial session bootstrap finishes. */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const clearSession = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const fetchMe = useCallback(async (): Promise<User> => {
    const res = await api<{ user: User }>('/auth/me');
    setUser(res.user);
    return res.user;
  }, []);

  // Bootstrap: restore an existing session from stored tokens (api() refreshes
  // an expired access token automatically; if even that fails, log out).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const u = await fetchMe();
        if (!cancelled) setUser(u);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMe, clearSession]);

  // Global 401 handler: a stale session anywhere in the app logs the user out.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession();
      navigate('/login');
    });
    return () => setSessionExpiredHandler(null);
  }, [clearSession, navigate]);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      const res = await api<{ user: User; tokens: Tokens }>('/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      setTokens(res.tokens);
      setUser(res.user);
      return res.user;
    },
    []
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }): Promise<User> => {
      const res = await api<{ user: User; tokens: Tokens }>('/auth/register', {
        method: 'POST',
        body: input
      });
      setTokens(res.tokens);
      setUser(res.user);
      return res.user;
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = localStorage.getItem('library.refreshToken');
    try {
      if (refreshToken) {
        await api('/auth/logout', { method: 'POST', body: { refreshToken } });
      }
    } catch {
      // Best-effort: even if the server call fails we drop local session.
    }
    clearSession();
    navigate('/login');
  }, [clearSession, navigate]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Context modules legitimately export a hook + provider; disable fast-refresh rule.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
