import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, LoginInput, RegisterInput, UserDto } from '@learnloop/shared';
import { api, onSessionExpired, refreshSession, setSession } from './api';

interface AuthState {
  user: UserDto | null;
  /** True until the first silent refresh on page load has finished. */
  loading: boolean;
  login(input: LoginInput): Promise<UserDto>;
  register(input: RegisterInput): Promise<UserDto>;
  logout(): Promise<void>;
  setUser(user: UserDto | null): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Restore the session from the refresh cookie after a reload.
    refreshSession()
      .then((s) => setUser(s?.user ?? null))
      .finally(() => setLoading(false));
    onSessionExpired(() => {
      setSession(null);
      setUser(null);
      queryClient.clear();
    });
  }, [queryClient]);

  const start = useCallback((res: AuthResponse) => {
    setSession(res);
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (input) => start(await api.post<AuthResponse>('/auth/login', input)),
      register: async (input) => start(await api.post<AuthResponse>('/auth/register', input)),
      logout: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          setSession(null);
          setUser(null);
          queryClient.clear();
        }
      },
      setUser,
    }),
    [user, loading, start, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Same as useAuth, for components that only render when signed in. */
export function useUser(): UserDto {
  const { user } = useAuth();
  if (!user) throw new Error('useUser requires a signed-in user');
  return user;
}

export const homeFor = (role: UserDto['role']) =>
  role === 'student' ? '/student' : role === 'teacher' ? '/teacher' : '/admin/users';
