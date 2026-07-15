'use client';

import { create } from 'zustand';

export interface AuthUser {
  username: string;
  webuy: number;
  adminRole: string;
  avatar: string;
  description: string;
  profileVisible: boolean;
  created: string;
  lastLogin: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isLoggedIn: false,

  login: async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          isLoggedIn: true,
          user: {
            username: data.username,
            webuy: 100,
            adminRole: '',
            avatar: '{}',
            description: '',
            profileVisible: true,
            created: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
          },
          isLoading: false,
        });
        return { success: true };
      }
      return { success: false, error: data.error || 'Login failed' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  },

  register: async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', username, password }),
      });
      const data = await res.json();
      if (data.success) {
        set({
          isLoggedIn: true,
          user: {
            username: data.username,
            webuy: 100,
            adminRole: '',
            avatar: '{}',
            description: '',
            profileVisible: true,
            created: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
          },
          isLoading: false,
        });
        return { success: true };
      }
      return { success: false, error: data.error || 'Registration failed' };
    } catch {
      return { success: false, error: 'Network error' };
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {
      // ignore
    }
    set({ user: null, isLoggedIn: false, isLoading: false });
  },

  checkSession: async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      if (data.valid && data.user) {
        set({
          isLoggedIn: true,
          user: data.user,
          isLoading: false,
        });
      } else {
        set({ isLoggedIn: false, user: null, isLoading: false });
      }
    } catch {
      set({ isLoggedIn: false, user: null, isLoading: false });
    }
  },
}));
