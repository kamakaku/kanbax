/**
 * automated-subscription-service.ts
 * Ein vereinfachter Service für vollautomatische Subscription-Updates
 * ohne Abhängigkeiten von anderen Diensten
 */

import { eq, sql, and } from 'drizzle-orm';
import { db } from './db';
import { 
  users, 
  subscriptions, 
  subscriptionPackages, 
  companyPaymentInfo
} from '@shared/schema';

/**
 * Führt ein garantiertes Update des Benutzerabonnements durch.
 * Diese Funktion umgeht alle anderen Services und führt ein direktes Update in der Datenbank durch.
 * 
 * @param userId - Benutzer-ID, die aktualisiert werden soll
 * @param tierName - Name des neuen Abonnementpakets (z.B. 'freelancer', 'organisation')
 * @param billingCycle - Abrechnungszyklus ('monthly' oder 'yearly')
 * @returns Promise mit Erfolg-Status und Informationen
 */
export async function guaranteedSubscriptionUpdate(
  userId: number, 
  tierName: string, 
  billingCycle: string
): Promise<{ success: boolean; message: string; data?: any; error?: any }> {
  // Normalisieren des Billing-Zyklus für die Protokollierung
  const logBillingCycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  console.log(`🔄 [AUTOMATED-UPDATE] Garantiertes Update für Benutzer ${userId}, Tier ${tierName}, Zyklus ${logBillingCycle}`);
  
  // Explizite Debug-Ausgabe zur Verfolgung des billingCycle-Parameters
  console.log(`⚙️ [AUTOMATED-UPDATE] Erhaltener billingCycle=${billingCycle}, Typ=${typeof billingCycle}`);
  
  try {
    // 1. Prüfen, ob der Benutzer existiert
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    
    if (!user) {
      return { success: false, message: "Benutzer nicht gefunden", error: "USER_NOT_FOUND" };
    }
    
    console.log(`👤 [AUTOMATED-UPDATE] Benutzer gefunden: ${user.email}`);
    
    // 2. Prüfen, ob das Paket existiert
    const packageInfo = await db.query.subscriptionPackages.findFirst({
      where: eq(subscriptionPackages.name, tierName.toLowerCase())
    });
    
    if (!packageInfo) {
      return { success: false, message: "Paket nicht gefunden", error: "PACKAGE_NOT_FOUND" };
    }
    
    const packageId = packageInfo.id;
    console.log(`📦 [AUTOMATED-UPDATE] Paket gefunden: ${packageInfo.name} (ID: ${packageId})`);
    
    // 3. Billingzyklus normalisieren und sicherstellen, dass er korrekt ist
    const normalizedBillingCycle = (billingCycle && billingCycle.toLowerCase() === 'yearly') ? 'yearly' : 'monthly';
    console.log(`🔄 [AUTOMATED-UPDATE] Normalisierter Billing-Zyklus: ${normalizedBillingCycle} (Original: ${billingCycle})`);
    
    // 4. Laufzeit des Abonnements berechnen
    const expirationPeriod = normalizedBillingCycle === 'yearly'
      ? 365 * 24 * 60 * 60 * 1000  // 1 Jahr in Millisekunden
      : 30 * 24 * 60 * 60 * 1000;  // 30 Tage in Millisekunden
      
    console.log(`⏱️ [AUTOMATED-UPDATE] Expiration basierend auf Zyklus ${normalizedBillingCycle} berechnet: ${expirationPeriod}ms`);
    
    // Ablaufdatum bestimmen (null für Free-Tier)
    const expirationDate = tierName.toLowerCase() === 'free'
      ? null
      : new Date(Date.now() + expirationPeriod);
    
    console.log(`📅 [AUTOMATED-UPDATE] Ablaufdatum berechnet: ${expirationDate}`);
    
    // 5. Benutzer in der Datenbank aktualisieren
    const userUpdateResult = await db.update(users)
      .set({
        subscriptionTier: tierName.toLowerCase(),
        subscriptionBillingCycle: normalizedBillingCycle,
        subscriptionExpiresAt: expirationDate,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    console.log(`✅ [AUTOMATED-UPDATE] Benutzer aktualisiert:`, userUpdateResult);
    
    // 6. Subscription-Eintrag erstellen oder aktualisieren
    const existingSubscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId)
    });
    
    let subscriptionUpdateResult;
    
    if (existingSubscription) {
      // Vorhandenes Abonnement aktualisieren
      subscriptionUpdateResult = await db.update(subscriptions)
        .set({
          packageId,
          status: "active",
          billingCycle: normalizedBillingCycle,
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, existingSubscription.id))
        .returning();
      
      console.log(`✅ [AUTOMATED-UPDATE] Vorhandenes Abonnement aktualisiert:`, subscriptionUpdateResult);
    } else {
      // Neues Abonnement erstellen
      subscriptionUpdateResult = await db.insert(subscriptions)
        .values({
          userId,
          packageId,
          status: "active",
          billingCycle: normalizedBillingCycle,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      console.log(`✅ [AUTOMATED-UPDATE] Neues Abonnement erstellt:`, subscriptionUpdateResult);
    }
    
    // 7. Wenn der Benutzer zu einer Firma gehört und Firmenadmin ist, aktualisiere die Firma
    if (user.companyId && user.isCompanyAdmin) {
      try {
        console.log(`🏢 [AUTOMATED-UPDATE] Benutzer ist Admin der Firma ${user.companyId}, aktualisiere Firmen-Abonnement`);
        
        // Firmen-Abonnement aktualisieren
        await db.update(companyPaymentInfo)
          .set({
            subscriptionTier: tierName.toLowerCase(),
            subscriptionStatus: "active",
            subscriptionStartDate: new Date(),
            subscriptionEndDate: expirationDate,
            billingCycle: normalizedBillingCycle,
            updatedAt: new Date()
          })
          .where(eq(companyPaymentInfo.companyId, user.companyId));
        
        console.log(`✅ [AUTOMATED-UPDATE] Firmen-Abonnement aktualisiert für Firma ${user.companyId}`);
      } catch (companyError) {
        console.error(`❌ [AUTOMATED-UPDATE] Fehler beim Aktualisieren des Firmen-Abonnements:`, companyError);
        // Wir brechen hier nicht ab, da die Hauptaktion (Benutzerupdate) bereits abgeschlossen ist
      }
    }
    
    return {
      success: true,
      message: "Abonnement erfolgreich aktualisiert",
      data: {
        user: userUpdateResult[0],
        subscription: subscriptionUpdateResult[0]
      }
    };
  } catch (error) {
    console.error(`❌ [AUTOMATED-UPDATE] Fehler bei garantiertem Update:`, error);
    return {
      success: false,
      message: "Fehler beim Aktualisieren des Abonnements",
      error
    };
  }
}

/**
 * Die vereinfachte Tier-Rang-Funktion für einfachen Vergleich
 */
export function getTierRank(tier: string): number {
  switch (tier.toLowerCase()) {
    case 'free': return 0;
    case 'freelancer': return 1;
    case 'organisation': return 2;
    case 'enterprise': return 3;
    case 'kanbax': return 4;
    default: return -1;
  }
}