import { create } from "zustand";
import type { User } from "@shared/schema";
import React, { createContext, useContext, type ReactNode } from "react";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  setUser: (user) => set({ user }),
  clearError: () => set({ error: null }),
  login: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Anmeldung fehlgeschlagen");
      }

      const user = await res.json();
      set({ user, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Anmeldung fehlgeschlagen",
        loading: false 
      });
      throw error;
    }
  },
  register: async (username: string, email: string, password: string) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Registrierung fehlgeschlagen");
      }

      const user = await res.json();
      set({ user, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Registrierung fehlgeschlagen",
        loading: false 
      });
      throw error;
    }
  },
  logout: () => {
    set({ user: null, loading: false, error: null });
  },
}));

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useAuthStore();
  return React.createElement(AuthContext.Provider, { value: store }, children);
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}