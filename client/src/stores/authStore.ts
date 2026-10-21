import { create } from 'zustand';
import { IUser } from '../types/ide.js';
import { api } from '../services/api.js';
import { initSocket, disconnectSocket } from '../services/socket.js';

interface AuthState {
  user: IUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, username: string, pass: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  loadMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('nexus_token'),
  isAuthenticated: false,
  isLoading: true,
  error: null,

  loadMe: async () => {
    const token = localStorage.getItem('nexus_token');
    if (!token) {
      await get().loginAsGuest();
      return;
    }

    try {
      set({ isLoading: true, error: null });
      const { user } = await api.auth.me();
      initSocket(token);
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('nexus_token');
      disconnectSocket();
      await get().loginAsGuest();
    }
  },

  loginAsGuest: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.auth.guest();
      localStorage.setItem('nexus_token', res.token);
      initSocket(res.token);
      set({ user: res.user, token: res.token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: err.message });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.auth.login({ email, password });
      localStorage.setItem('nexus_token', res.token);
      initSocket(res.token);
      set({ user: res.user, token: res.token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  signup: async (email, username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.auth.signup({ email, username, password });
      localStorage.setItem('nexus_token', res.token);
      initSocket(res.token);
      set({ user: res.user, token: res.token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('nexus_token');
    disconnectSocket();
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
