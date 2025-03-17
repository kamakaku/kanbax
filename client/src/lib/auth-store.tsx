import { create } from "zustand";
import type { User } from "@shared/schema";
import { apiRequest } from "./api-request";
import { createContext, useContext, ReactNode, useEffect } from 'react';

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  testSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  login: async (email: string, password: string) => {
    try {
      console.log("Attempting login with:", { email });
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      const user = await res.json();
      console.log("Login successful:", user);
      set({ user });
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },
  register: async (username: string, email: string, password: string) => {
    try {
      console.log("Attempting registration with:", { username, email });
      const res = await apiRequest("POST", "/api/auth/register", { 
        username, 
        email, 
        password 
      });
      const user = await res.json();
      console.log("Registration successful:", user);
      set({ user });
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  },
  logout: async () => {
    try {
      console.log("Attempting logout");
      await apiRequest("POST", "/api/auth/logout");
      console.log("Logout successful");
      set({ user: null });
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  },
  checkAuth: async () => {
    try {
      console.log("Checking authentication status");
      const res = await apiRequest("GET", "/api/auth/me");
      const user = await res.json();
      console.log("Auth check result:", user);
      set({ user });
    } catch (error) {
      console.error("Auth check failed:", error);
      set({ user: null });
    }
  },
  testSession: async () => {
    try {
      console.log("Testing session functionality");
      const res = await apiRequest("GET", "/api/test-session");
      const data = await res.json();
      console.log("Session test result:", data);
    } catch (error) {
      console.error("Session test failed:", error);
      throw error;
    }
  }
}));

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useAuthStore();

  useEffect(() => {
    // Test session when component mounts
    store.testSession().catch(console.error);
    // Then check auth status
    store.checkAuth();
  }, []);

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