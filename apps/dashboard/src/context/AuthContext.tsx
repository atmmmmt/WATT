import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiRequest } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role:
    | 'super_admin'
    | 'tenant_admin'
    | 'hr_manager'
    | 'recruiter'
    | 'admin'
    | 'supervisor'
    | 'agent';
  phone: string;
  permissions: string[];
  tenantId: string | null;
  status: string;
  lastLoginAt?: string | null;
  enabledProducts?: string[];
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'vayro-token';

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    apiRequest<AuthUser>('/auth/me', {}, token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isLoading,
      async login(email: string, password: string) {
        const result = await apiRequest<{ accessToken: string; user: AuthUser }>(
          '/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          },
        );

        localStorage.setItem(TOKEN_KEY, result.accessToken);
        setToken(result.accessToken);
        setUser(result.user);
      },
      logout() {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      },
    }),
    [token, user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
