import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) =>
        set({ user, token, isAuthenticated: true }),

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'vegam-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Role-based access helpers
export const useHasRole = (...roles: UserRole[]) => {
  const user = useAuthStore((s) => s.user);
  return user ? roles.includes(user.role) : false;
};

export const useIsFinanceAdmin = () => useHasRole('finance_admin');
export const useIsManagement = () => useHasRole('management', 'finance_admin');
export const useCanEditCommercial = () => useHasRole('finance_admin', 'am_pm', 'account_manager', 'project_manager');
export const useCanViewCashflow = () => useHasRole('finance_admin', 'management');
export const useIsForecastUser = () => useHasRole('finance_admin', 'account_manager', 'project_manager', 'am_pm');
export const useCurrentUser = () => useAuthStore((s) => s.user);
