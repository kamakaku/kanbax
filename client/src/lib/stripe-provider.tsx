import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface StripeContextType {
  stripePublishableKey: string | null;
  isLoading: boolean;
  error: string | null;
}

const defaultStripeContext: StripeContextType = {
  stripePublishableKey: null,
  isLoading: true,
  error: null
};

const StripeContext = createContext<StripeContextType>(defaultStripeContext);

export const useStripe = () => useContext(StripeContext);

interface StripeProviderProps {
  children: ReactNode;
}

export function StripeProvider({ children }: StripeProviderProps) {
  const [stripePublishableKey, setStripePublishableKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStripeConfig() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/payments/config');
        
        if (!response.ok) {
          throw new Error('Fehler beim Abrufen der Stripe-Konfiguration');
        }
        
        const data = await response.json();
        console.log("Stripe-Konfiguration geladen:", { publishableKey: data.publishableKey?.substr(0, 8) + '...' });
        
        if (data.publishableKey) {
          setStripePublishableKey(data.publishableKey);
        } else {
          throw new Error('Kein Stripe Publishable Key in der Antwort gefunden');
        }
      } catch (error) {
        console.error('Fehler beim Laden der Stripe-Konfiguration:', error);
        setError(error instanceof Error ? error.message : 'Unbekannter Fehler');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStripeConfig();
  }, []);

  return (
    <StripeContext.Provider value={{ stripePublishableKey, isLoading, error }}>
      {children}
    </StripeContext.Provider>
  );
}