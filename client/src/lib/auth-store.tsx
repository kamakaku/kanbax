import { create } from "zustand";
import type { User } from "@shared/schema";
import React, { createContext, useContext, type ReactNode } from "react";
import { createCheckoutSession } from "./payment-helpers";

interface CompanyData {
  name: string;
  address: string;
  city: string;
  zip: string;
  country: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string, 
    email: string, 
    password: string, 
    inviteCode: string, 
    subscriptionPackageId?: number, 
    companyData?: CompanyData
  ) => Promise<void>;
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
        
        // Spezielle Behandlung für pausierte Benutzer und Unternehmen
        if (error.isPaused) {
          throw new Error(error.message || "Ihr Konto wurde pausiert.");
        } else if (error.isCompanyPaused) {
          throw new Error(error.message || "Ihr Unternehmen wurde pausiert.");
        } else {
          throw new Error(error.message || "Anmeldung fehlgeschlagen");
        }
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
  register: async (
    username: string, 
    email: string, 
    password: string, 
    inviteCode: string, 
    subscriptionPackageId?: number, 
    companyData?: CompanyData
  ) => {
    try {
      set({ loading: true, error: null });
      
      // Bereite Request-Body basierend auf den übergebenen Parametern vor
      const requestData: any = { 
        username, 
        email, 
        password, 
        inviteCode, 
        subscriptionPackageId 
      };
      
      // Füge Unternehmensdaten hinzu, wenn vorhanden
      if (companyData) {
        requestData.company = companyData;
      }
      
      console.log("Sende Registrierungsdaten:", { 
        ...requestData, 
        password: "[HIDDEN]" 
      });
      
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
        credentials: "include"
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Registrierung fehlgeschlagen");
      }

      const user = await res.json();
      set({ user, loading: false });
      
      console.log("Registrierung erfolgreich:", { 
        userId: user.id,
        username: user.username,
        subscriptionId: user.subscriptionId,
        needsPayment: user.needsPayment
      });
      
      // Kostenpflichtiges Paket erkennung und Weiterleitung
      console.log("Prüfe Checkout-Bedingungen:", { 
        subscriptionPackageId, 
        needsPayment: user.needsPayment, 
        subscriptionId: user.subscriptionId 
      });
      
      // 1. Prüfe ob ein Paket gewählt wurde
      if (!subscriptionPackageId) {
        console.log("Kein Paket gewählt, kein Checkout nötig");
        return user;
      }
      
      // 2. Wenn das Paket kostenpflichtig ist (vom Server über needsPayment-Flag signalisiert)
      // FREELANCER-PAKET-OVERRIDE: Prüft explizit auf Paket-ID 2
      const isFreelancerPackage = subscriptionPackageId === 2;
      if (isFreelancerPackage) {
        console.log("FREELANCER-PAKET ERKANNT! Immer als zahlungspflichtig behandeln!");
        user.needsPayment = true; // Override für Frontend-Logik
      }
        
      if (user.needsPayment === true) {
        console.log("Kostenpflichtiges Paket erkannt, initiiere Checkout", {
          needsPayment: user.needsPayment,
          subscriptionId: user.subscriptionId,
          userId: user.id,
          isFreelancerPackage,
          packageId: subscriptionPackageId
        });
        
        // 3. Prüfe, ob eine Abonnement-ID zurückgegeben wurde
        // Für Freelancer akzeptieren wir auch temporäre IDs (-1)
        if (!user.subscriptionId && user.subscriptionId !== -1) {
          console.error("Keine Abonnement-ID vom Server erhalten, obwohl Zahlung erforderlich ist");
          throw new Error("Fehler beim Registrierungsprozess: Keine Abonnement-ID erhalten");
        }
        // Für Freelancer mit temporärer ID setzen wir einen Hinweis in die Konsole
        if (user.subscriptionId === -1) {
          console.log("Temporäre Subscription-ID (-1) für Freelancer akzeptiert.");
        }
        
        try {
          // Billingzyklus aus localStorage holen (wenn vorhanden)
          const billingCycle = localStorage.getItem('billingCycle') as 'monthly' | 'yearly' || 'monthly';
          console.log("Verwendeter Abrechnungszyklus:", billingCycle);
          
          // Verwende den Helper zum Erstellen einer Checkout-Session
          const checkoutResult = await createCheckoutSession(
            user.subscriptionId, 
            subscriptionPackageId, 
            user.id,
            billingCycle // Abrechnungszyklus übergeben
          );
          
          if (checkoutResult?.checkoutUrl) {
            console.log("Leite weiter zu Stripe:", checkoutResult.checkoutUrl);
            
            // Debug: Überprüfe, ob dies ausgeführt wird
            console.log("Weiterleitung wird jetzt ausgeführt...");
            
            // Verwende setTimeout, um sicherzustellen, dass der Konsolenlog vor der Weiterleitung erscheint
            setTimeout(() => {
              console.log("Tatsächliche Weiterleitung zu:", checkoutResult.checkoutUrl);
              window.location.href = checkoutResult.checkoutUrl;
            }, 500);
            
            return user; // Return aber die Ausführung wird durch die Weiterleitung unterbrochen
          } else {
            console.error("Keine Checkout-URL erhalten:", checkoutResult);
            throw new Error("Fehler beim Zahlungsvorgang: Keine Weiterleitungs-URL erhalten");
          }
        } catch (error) {
          console.error("Fehler im Checkout-Prozess:", error);
          throw error;
        }
      } else {
        console.log("Kein kostenpflichtiges Paket oder keine Zahlung erforderlich");
      }
      
      return user;
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

// Funktion zum erneuten Laden der Benutzerdaten
export async function reloadUserData() {
  try {
    const response = await fetch('/api/auth/current-user', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const userData = await response.json();
      if (userData) {
        // Update im Auth-Store
        useAuthStore.getState().setUser(userData);
        return userData;
      }
    }
    return null;
  } catch (error) {
    console.error('Error reloading user data:', error);
    return null;
  }
}

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
            
            // Speichere wichtige Benutzerdaten auch im localStorage für einfacheren Zugriff
            // zwischen verschiedenen Routen (besonders wichtig nach Zahlungen)
            localStorage.setItem('userId', userData.id.toString());
            localStorage.setItem('userSubscriptionTier', userData.subscriptionTier || 'free');
            localStorage.setItem('userSubscriptionBillingCycle', userData.subscriptionBillingCycle || 'monthly');
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