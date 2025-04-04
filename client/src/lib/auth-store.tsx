import { create } from "zustand";
import type { User } from "@shared/schema";
import React, { createContext, useContext, type ReactNode } from "react";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, inviteCode: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  checkActivationStatus: (userId: number) => Promise<boolean>;
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
      console.log("Versuche Login mit:", { email });
      
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include"
      });

      // Prüfen ob die Antwort JSON ist
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Server antwortete nicht mit JSON:", contentType);
        throw new Error("Server antwortete in einem ungültigen Format");
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Anmeldung fehlgeschlagen");
      }

      const user = await res.json();
      console.log("Login erfolgreich, User:", user);
      set({ user, loading: false });
      
      // Sofort die aktuelle Benutzer-Session validieren
      try {
        await fetch('/api/auth/current-user', { credentials: 'include' });
      } catch (e) {
        console.warn("Validierung der Benutzer-Session fehlgeschlagen:", e);
      }
    } catch (error) {
      console.error("Login-Fehler:", error);
      set({ 
        error: error instanceof Error ? error.message : "Anmeldung fehlgeschlagen",
        loading: false 
      });
      throw error;
    }
  },
  register: async (username: string, email: string, password: string, inviteCode: string) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, inviteCode }),
        credentials: "include"
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
  checkActivationStatus: async (userId: number) => {
    try {
      set({ loading: true, error: null });
      const res = await fetch(`/api/users/${userId}/activation-status`, {
        credentials: "include"
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Fehler beim Abrufen des Aktivierungsstatus");
      }
      
      const { isActive } = await res.json();
      set({ loading: false });
      return isActive;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Fehler beim Abrufen des Aktivierungsstatus",
        loading: false
      });
      return false;
    }
  },
  logout: async () => {
    try {
      // Call logout endpoint to clear server-side session
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear client-side state regardless of server response
    set({ user: null, loading: false, error: null });
  },
}));

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useAuthStore();
  
  // Fetch current user on page load
  React.useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch('/api/auth/current-user', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const userData = await response.json();
          if (userData) {
            store.setUser(userData);
          }
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    }
    
    fetchCurrentUser();
  }, []);
  
  return React.createElement(AuthContext.Provider, { value: store }, children);
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}