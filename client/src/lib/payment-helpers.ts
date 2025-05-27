/**
 * Payment Helper Funktionen für die Interaktion mit der Payment-API
 */

/**
 * Erstellt eine Checkout-Session über die API
 * @param subscriptionId Die ID der Subscription
 * @param packageId Die ID des Subscription-Pakets
 * @param userId Die ID des Benutzers
 * @param billingCycle Der Abrechnungszyklus (monthly oder yearly)
 * @returns Die Checkout-URL oder null
 */
export async function createCheckoutSession(
  subscriptionId: number,
  packageId: number,
  userId: number,
  billingCycle: 'monthly' | 'yearly' = 'monthly'
): Promise<{ checkoutUrl: string } | null> {
  try {
    // Speichere den Abrechnungszyklus im lokalen Speicher für spätere Verwendung
    localStorage.setItem('billingCycle', billingCycle);
    
    console.log('Erstelle Checkout-Session mit:', {
      subscriptionId,
      packageId,
      userId,
      billingCycle
    });
    
    const response = await fetch('/api/payments/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId,
        packageId,
        userId,
        billingCycle // Übergebe den Abrechnungszyklus an die API
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Fehler beim Erstellen der Checkout-Session:', errorData);
      throw new Error(errorData.message || 'Fehler beim Erstellen der Checkout-Session');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fehler beim Erstellen der Checkout-Session:', error);
    throw error;
  }
}