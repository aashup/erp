import { create } from 'zustand';
import type { User } from '@/types';
import { clearLocalData } from '@/lib/sync';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isImpersonating: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  beginImpersonation: (targetUser: User, targetToken: string) => void;
  endImpersonation: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const storedUser = localStorage.getItem('user');
  const storedToken = localStorage.getItem('token');
  const isImpersonating = !!localStorage.getItem('impersonation_original_token');

  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken,
    isAuthenticated: !!storedToken,
    isImpersonating,

    setAuth: (user, token) => {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
      set({ user, token, isAuthenticated: true });
    },

    logout: () => {
      // Wipe all local IndexedDB data so the next user starts clean
      clearLocalData();
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('selectedFY');
      localStorage.removeItem('selectedDate');
      localStorage.removeItem('impersonation_original_token');
      localStorage.removeItem('impersonation_original_user');
      set({ user: null, token: null, isAuthenticated: false, isImpersonating: false });
    },

    updateUser: (user) => {
      localStorage.setItem('user', JSON.stringify(user));
      set({ user });
    },

    beginImpersonation: (targetUser, targetToken) => {
      // Save the real admin session before swapping
      const currentUser = localStorage.getItem('user');
      const currentToken = localStorage.getItem('token');
      if (currentUser) localStorage.setItem('impersonation_original_user', currentUser);
      if (currentToken) localStorage.setItem('impersonation_original_token', currentToken);

      localStorage.setItem('user', JSON.stringify(targetUser));
      localStorage.setItem('token', targetToken);
      set({ user: targetUser, token: targetToken, isAuthenticated: true, isImpersonating: true });
    },

    endImpersonation: () => {
      const originalUser = localStorage.getItem('impersonation_original_user');
      const originalToken = localStorage.getItem('impersonation_original_token');

      if (originalUser) localStorage.setItem('user', originalUser);
      if (originalToken) localStorage.setItem('token', originalToken);
      localStorage.removeItem('impersonation_original_user');
      localStorage.removeItem('impersonation_original_token');

      set({
        user: originalUser ? JSON.parse(originalUser) : null,
        token: originalToken,
        isAuthenticated: !!originalToken,
        isImpersonating: false,
      });
    },
  };
});
