import { useStripe } from "./stripe-provider";

/**
 * Erstellt eine Checkout-Session für Stripe und leitet zur Zahlungsseite weiter
 * Nutzt den StripeProvider um die Konfiguration zu erhalten
 */
export const createCheckoutSession = async (
  subscriptionId: number, 
  packageId: number, 
  userId: number,
  billingCycle: 'monthly' | 'yearly' = 'monthly' // Neuer Parameter für Abrechnungszyklus
): Promise<{ checkoutUrl: string } | undefined> => {
  try {
    const stripeData = {
      subscriptionId,
      packageId,
      userId,
      billingCycle // Abrechnungszyklus für die Anfrage hinzufügen
    };
    
    console.log("Sende Checkout-Anfrage mit:", stripeData);
    
    // Debug: Zeige mehr Details zur Anfrage
    console.log("Checkout-URL:", window.location.origin + "/api/payments/create-checkout");
    
    const checkoutRes = await fetch("/api/payments/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stripeData),
      credentials: "include"
    });
    
    console.log("Checkout Response Status:", checkoutRes.status, checkoutRes.statusText);
    
    if (!checkoutRes.ok) {
      let errorData;
      try {
        errorData = await checkoutRes.json();
        console.error("Checkout-Anfrage fehlgeschlagen:", errorData);
      } catch (parseError) {
        console.error("Fehler beim Parsen der Fehlerantwort:", parseError);
        console.error("Rohe Fehlerantwort:", await checkoutRes.text());
      }
      throw new Error(errorData?.message || "Fehler beim Erstellen der Zahlungssession");
    }
    
    const checkoutResult = await checkoutRes.json();
    console.log("Checkout-Session erstellt:", checkoutResult);
    
    if (checkoutResult.checkoutUrl) {
      return checkoutResult;
    } else {
      console.error("Keine Checkout-URL erhalten:", checkoutResult);
      throw new Error("Fehler beim Zahlungsvorgang: Keine Weiterleitungs-URL erhalten");
    }
  } catch (error) {
    console.error("Fehler im Checkout-Prozess:", error);
    throw error;
  }
};

/**
 * Hook zum Aufrufen der Stripe-Konfiguration
 * Gibt den publishable key zurück
 */
export function useStripeConfig() {
  return useStripe();
}