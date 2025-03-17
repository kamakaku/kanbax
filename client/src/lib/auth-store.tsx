import { create } from "zustand";
import type { User } from "@shared/schema";
import { apiRequest } from "./api-request";
import { createContext, useContext, ReactNode } from 'react';

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  login: async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const user = await res.json();
    set({ user });
  },
  register: async (username: string, email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { username, email, password });
    const user = await res.json();
    set({ user });
  },
  logout: async () => {
    await apiRequest("POST", "/api/auth/logout");
    set({ user: null });
  }
}));

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useAuthStore();
  return (
    <AuthContext.Provider value={store}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}