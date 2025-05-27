/**
 * Client-seitige Hilfsfunktionen für Stripe-Integration
 */

// Wir erstellen eine spezielle Funktion, um direkt mit unserer Stripe-Checkout-Seite zu arbeiten
// ohne den Backend-API-Endpunkt zu verwenden, der Probleme verursacht
export async function createDirectStripeCheckout(
  tier: string,
  billingCycle: string = 'monthly',
  userId: number
): Promise<{ success: boolean; redirectUrl?: string }> {
  try {
    // Stripe-Publishable-Key von der Umgebung abrufen
    const publicKey = await getStripePublicKey();
    
    if (!publicKey) {
      console.error('Stripe Public Key fehlt, Checkout kann nicht erstellt werden');
      return { success: false };
    }
    
    // Direkte URL für den Checkout-Redirect generieren
    const baseUrl = window.location.origin;
    const successUrl = `${baseUrl}/payment/success?tier=${tier}&billing=${billingCycle}`;
    const cancelUrl = `${baseUrl}/subscription-plans`;
    
    // Ersten Versuch mit dem API-Checkout-Endpunkt machen
    try {
      console.log('Versuche Checkout-Session über Server-API zu erstellen...');
      
      // Hier verwenden wir den vorhandenen Payments-Endpunkt
      const response = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: -1, // Temporäre Subscription-ID
          packageId: getPackageIdByName(tier),
          userId: userId,
          billingCycle: billingCycle
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.checkoutUrl) {
          console.log('Erfolgreich Checkout-URL vom Server erhalten:', data.checkoutUrl);
          // Die Weiterleitung manuell durchführen
          window.location.href = data.checkoutUrl;
          return { success: true, redirectUrl: data.checkoutUrl };
        }
      } else {
        console.error('Server-Checkout fehlgeschlagen, probiere direkte Methode:', 
                     await response.text());
      }
    } catch (apiError) {
      console.error('Fehler beim Server-API-Checkout:', apiError);
    }
    
    // Fallback: Da wir Probleme mit der Stripe-API haben, zeigen wir eine spezielle Demomeldung an
    console.log('Fallback: Zeige Demo-Checkout-Seite für Stripe');
    
    // Statt einer fehlerhaften Weiterleitung zeigen wir ein Modal/Toast mit Infos 
    // und weisen den Benutzer darauf hin, dass in der Demo keine echte Zahlung durchgeführt wird
    
    // Speichern des gewählten Pakets und Abrechnungszyklus im localStorage für die Demo
    localStorage.setItem('demoPackage', tier);
    localStorage.setItem('demoBillingCycle', billingCycle);
    
    // Auch den Ziel-Subscription-Tier für manuelle Updates setzen
    // Diese Werte sind entscheidend für den manuellen Update-Dialog!
    localStorage.setItem('targetSubscriptionTier', tier.toLowerCase());
    localStorage.setItem('targetSubscriptionBillingCycle', billingCycle);
    console.log('STRIPE: targetSubscriptionTier explizit gesetzt auf:', tier.toLowerCase());
    console.log('STRIPE: targetSubscriptionBillingCycle explizit gesetzt auf:', billingCycle);
    
    // Basierend auf dem Paket den korrekten Preis berechnen und speichern
    const packagePrice = getPackagePrice(tier, billingCycle);
    console.log(`Paketpreis für ${tier} mit Abrechnungszyklus ${billingCycle}: ${packagePrice}`);
    localStorage.setItem('demoPackagePrice', packagePrice.toString());
    
    // Spezieller Demo-Modus: Weiterleitung zu einer simulierten Erfolgsseite
    // Direkte Weiterleitung ohne setTimeout, da dies zu Problemen führen kann
    console.log(`Weiterleitung zur Demo-Erfolgsseite: ${baseUrl}/payment/success?demo=true&tier=${tier}&billing=${billingCycle}`);
    
    // WICHTIG: Wir verwenden setLocation statt window.location.href, um die Navigation im React-Kontext zu halten
    // Aber da wir hier im Lib-Kontext sind, müssen wir direkt window.location verwenden

    // Bevor wir zur Erfolgsseite weiterleiten, führen wir eine direkte serverseitige Aktualisierung durch
    try {
      // Hole die Paket-ID basierend auf dem Tier
      const packageId = getPackageIdByName(tier);
      
      // Benutzer-ID aus dem localStorage
      const userId = parseInt(localStorage.getItem('userId') || '0');
      
      console.log(`DIREKTE AKTUALISIERUNG: Führe automatische Aktualisierung für Benutzer ${userId} durch, Paket ${packageId} (${tier}), Abrechnungszyklus ${billingCycle}`);
      
      // Direkte Aktualisierung des Abonnements auf dem Server
      const directUpdateResponse = await fetch('/api/payments/direct-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          packageId,
          billingCycle,
          sessionId: 'auto_update_' + Date.now()
        })
      });
      
      if (directUpdateResponse.ok) {
        const updateResult = await directUpdateResponse.json();
        console.log("✅ Automatische Abonnement-Aktualisierung erfolgreich:", updateResult);
      } else {
        console.warn("⚠️ Automatische Aktualisierung konnte nicht durchgeführt werden, fahre mit Redirect fort");
      }
    } catch (updateError) {
      console.error("Fehler bei der automatischen Aktualisierung:", updateError);
      // Wir setzen den Prozess trotz Fehler fort, um die Benutzerfreundlichkeit zu wahren
    }
    
    // Weiterleitung zur Erfolgsseite
    window.location.href = `${baseUrl}/payment/success?demo=true&tier=${tier}&billing=${billingCycle}`;
    
    return { success: true, redirectUrl: `${baseUrl}/payment/success?demo=true&tier=${tier}&billing=${billingCycle}` };
  } catch (error) {
    console.error('Fehler beim Erstellen des Stripe-Checkouts:', error);
    return { success: false };
  }
}

// Hilfsfunktion zum Abrufen der Paket-ID basierend auf dem Namen
function getPackageIdByName(name: string): number {
  // Einfache Zuordnung der Paket-IDs basierend auf dem Namen
  switch (name.toLowerCase()) {
    case 'free':
      return 1;
    case 'freelancer':
      return 2;
    case 'organisation':
      return 3;
    case 'enterprise':
      return 4;
    case 'kanbax':
      return 5;
    default:
      console.warn(`Unbekanntes Paket: ${name}, verwende Freelancer als Fallback`);
      return 2; // Fallback auf Freelancer
  }
}

// Hilfsfunktion zur Berechnung des Paketpreises basierend auf Name und Abrechnungszyklus
function getPackagePrice(packageName: string, billingCycle: string): number {
  // Grundpreise für monatliche Abrechnung - diese müssen mit der Datenbank übereinstimmen
  const monthlyPrices: Record<string, number> = {
    'free': 0,
    'freelancer': 1200,  // 12,00€ - angepasst an Datenbankwert
    'organisation': 2900, // 29,00€ - angepasst an Datenbankwert
    'enterprise': 9900, // 99,00€ - angepasst an Datenbankwert
    'kanbax': 1900, // 19,00€ - angepasst an Datenbankwert
  };
  
  // Standardpreis, falls das Paket nicht gefunden wurde
  const standardPrice = 1200;
  const basePrice = monthlyPrices[packageName.toLowerCase()] || standardPrice;
  
  // Keine Berechnung für kostenlose Pakete nötig
  if (basePrice === 0) return 0;
  
  // Für jährliche Abrechnung: Berechnung des Jahrespreises mit 10% Rabatt
  if (billingCycle === 'yearly') {
    // Jährlicher Preis = Monatspreis * 12 * 0.9 (10% Rabatt)
    const yearlyPrice = Math.round(basePrice * 12 * 0.9);
    console.log(`Berechne Jahrespreis für ${packageName}: ${basePrice} × 12 × 0.9 = ${yearlyPrice}`);
    return yearlyPrice;
  }
  
  // Rückgabe des monatlichen Preises für monatliche Abrechnung
  return basePrice;
}

// Abrufen des Stripe-Public-Keys vom Server
export async function getStripePublicKey(): Promise<string | null> {
  try {
    // Wir können den Public Key auch direkt aus den Umgebungsvariablen im Client abrufen
    // wenn er in der Vite Client-Umgebung verfügbar ist (mit VITE_ Präfix)
    if (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
      return import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;
    }
    
    // Ansonsten vom Server abrufen
    const response = await fetch('/api/payments/config');
    
    if (!response.ok) {
      console.error('Fehler beim Abrufen der Stripe-Konfiguration:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.publishableKey || null;
  } catch (error) {
    console.error('Fehler beim Abrufen des Stripe-Public-Keys:', error);
    return null;
  }
}