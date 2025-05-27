import Stripe from "stripe";
import { db } from "./db";
import { companyPaymentInfo, users, subscriptionPackages, subscriptionAuditLogs, subscriptions } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

// Stripe initialisieren mit dem Secret Key
const secretKeyToUse = process.env.STRIPE_SECRET_KEY || "";
if (!secretKeyToUse) {
  console.error("WARNUNG: Kein Stripe Secret Key gefunden! Stelle sicher, dass STRIPE_SECRET_KEY als Umgebungsvariable verfügbar ist.");
} else {
  console.log("Stripe Secret Key aus Umgebungsvariable für Stripe-Service verwenden");
}

// Verwende den originalen API-Version-String, damit die Typen übereinstimmen
const stripe = new Stripe(secretKeyToUse, {
  apiVersion: "2025-02-24.acacia" as any, // Aktueller API-Version für die Stripe-Typelib, Type-Cast zum Umgehen der Typrüfung
});

/**
 * Der Stripe Service ist verantwortlich für die Interaktion mit Stripe
 * zur Verwaltung von Abonnements und Zahlungen
 */
export class StripeService {
  /**
   * Erstellt einen Checkout-Link für den Wechsel zu einem neuen Abonnement-Paket
   * 
   * @param userId Benutzer-ID
   * @param newTier Neue Abonnement-Stufe
   * @param billingCycle Abrechnungszyklus ('monthly' oder 'yearly')
   * @returns Objekt mit Erfolgs-Flag und optionalem Checkout-URL
   */
  async switchSubscription(userId: number, newTier: string, billingCycle: string = 'monthly'): Promise<{success: boolean, checkoutUrl?: string | null, requiresPayment?: boolean}> {
    try {
      console.log(`StripeService: Wechsel des Abonnements für Benutzer ${userId} auf Tier ${newTier} mit Zyklus ${billingCycle}`);
      console.log(`StripeService: DEBUG - Stripe-Konfiguration: API-Schlüssel vorhanden=${!!secretKeyToUse}, API-Key-Length=${secretKeyToUse.length}`);
      console.log(`StripeService: DEBUG - Stripe-Instance initialisiert: ${!!stripe}`);
      console.log(`StripeService: DEBUG - Aktion: switchSubscription wird ausgeführt`);
      
      // Prüfen, ob Stripe API-Schlüssel vorhanden ist
      if (!secretKeyToUse) {
        console.error("StripeService: Kein Stripe Secret Key vorhanden. Die Stripe-Integration wird übersprungen, aber die Datenbank wird aktualisiert.");
        // Wir fahren fort ohne Stripe-Integration, aktualisieren aber die Datenbank
        await this.updateDatabaseOnly(userId, newTier, billingCycle);
        return { success: true, checkoutUrl: null, requiresPayment: false };
      }
      
      // 1. Benutzer-Informationen abrufen
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        console.error(`StripeService: Benutzer ${userId} nicht gefunden`);
        return { success: false, requiresPayment: false };
      }

      // 2. Prüfen, ob der Benutzer bereits ein Abonnement hat
      const currentSubscription = await db.select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      // 3. Prüfen, ob das Paket in der Datenbank existiert
      const newPackage = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, newTier)
      });

      if (!newPackage) {
        console.error(`StripeService: Paket ${newTier} nicht gefunden`);
        return { success: false, requiresPayment: false };
      }

      // 4. Wenn der Benutzer ein bestehendes Abonnement hat, dieses bei Stripe kündigen
      if (currentSubscription.length > 0 && currentSubscription[0].stripeSubscriptionId) {
        try {
          console.log(`StripeService: Kündige bestehendes Abonnement ${currentSubscription[0].stripeSubscriptionId}`);
          
          // Sofortige Kündigung des Abonnements bei Stripe
          await stripe.subscriptions.cancel(currentSubscription[0].stripeSubscriptionId);
          
          // Abonnement in der Datenbank als inaktiv markieren
          await db.update(subscriptions)
            .set({
              status: "cancelled",
              updatedAt: new Date()
            })
            .where(eq(subscriptions.id, currentSubscription[0].id));
            
          console.log(`StripeService: Bestehendes Abonnement ${currentSubscription[0].id} wurde gekündigt`);
        } catch (stripeError) {
          console.error("StripeService: Fehler beim Kündigen des Abonnements bei Stripe:", stripeError);
          // Wir machen trotzdem weiter, um das neue Abonnement zu erstellen
        }
      } else {
        console.log(`StripeService: Kein bestehendes Abonnement mit Stripe-ID für Benutzer ${userId} gefunden`);
      }

      // 5. Temporäres Abonnement erstellen für die Checkout-Session
      const tempSubscription = await db.insert(subscriptions)
        .values({
          userId: userId,
          packageId: newPackage.id,
          status: "pending", // Status auf "pending" setzen
          billingCycle: billingCycle,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
        
      if (!tempSubscription || tempSubscription.length === 0) {
        console.error("StripeService: Konnte keine temporäre Subscription erstellen");
        return { success: false, requiresPayment: false };
      }
      
      const subscriptionId = tempSubscription[0].id;
      
      try {
        // Basis-URL für die Weiterleitung
        const baseUrl = process.env.REQUEST_URL || "https://0fe82899-989d-49e3-8509-b9664bfb91a4.id.replit.app";
        
        // Den Abrechnungszeitraum für Stripe formatieren
        const interval = billingCycle === 'yearly' ? 'year' : 'month';
        
        // Stripe Checkout Session erstellen
        console.log(`StripeService: Erstelle Checkout-Session mit Basis-URL: ${baseUrl}`);
        console.log(`StripeService: Package Daten: name=${newPackage.name}, price=${newPackage.price}, interval=${interval}`);
        
        try {
          // Stripe Checkout Session erstellen
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
              {
                price_data: {
                  currency: "eur",
                  product_data: {
                    name: newPackage.displayName || newPackage.name,
                    description: `Abonnement-Paket: ${newPackage.name}`,
                  },
                  unit_amount: newPackage.price,
                  recurring: {
                    interval: interval as Stripe.PriceCreateParams.Recurring.Interval,
                  },
                },
                quantity: 1,
              },
            ],
            mode: "subscription",
            success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&subscription_id=${subscriptionId}`,
            cancel_url: `${baseUrl}/subscription-plans`,
            customer_email: user.email,
            client_reference_id: subscriptionId.toString(),
            metadata: {
              subscriptionId: subscriptionId.toString(),
              packageId: newPackage.id.toString(),
              packageName: newPackage.name,
              userId: userId.toString(),
              billingCycle: billingCycle
            },
            // Zahlungsmethode für zukünftige Abrechnungen speichern
            payment_method_collection: 'always',
            payment_intent_data: {
              setup_future_usage: 'off_session',
            },
          });
          
          if (!session.url) {
            throw new Error("Keine Checkout-URL von Stripe erhalten");
          }
          
          console.log(`StripeService: Checkout-Session erfolgreich erstellt, URL: ${session.url}`);
          
          // Audit-Log erstellen für den Checkout-Prozess
          await db.insert(subscriptionAuditLogs).values({
            userId: userId,
            companyId: user.companyId,
            action: "checkout_started",
            oldTier: currentSubscription.length > 0 ? currentSubscription[0].packageId.toString() : "none",
            newTier: newTier,
            details: `Checkout-Prozess für Abonnement ${newTier} gestartet mit ${billingCycle} Abrechnungszyklus`
          });
          
          // Aufgabe als erledigt melden mit der Checkout-URL
          return { 
            success: true, 
            checkoutUrl: session.url,
            requiresPayment: true
          };
        } catch (stripeSessionError) {
          console.error(`StripeService: Fehler beim Erstellen der Checkout-Session:`, stripeSessionError);
          throw stripeSessionError; // Weiterwerfen für die äußere try-catch-Block
        }
      } catch (stripeError) {
        // Fehler bei Stripe, aber trotzdem die Datenbank aktualisieren
        console.error("StripeService: Fehler bei der Stripe-Integration:", stripeError);
        console.log("StripeService: Setze die Datenbankaktualisierung fort ohne Stripe-Integration...");
        
        // Aktualisiere die Datenbank ohne Stripe-Integration
        const result = await this.updateDatabaseOnly(userId, newTier, billingCycle);
        return result;
      }
    } catch (error) {
      console.error("StripeService: Fehler beim Wechseln des Abonnements:", error);
      return { success: false, requiresPayment: false };
    }
  }
  
  /**
   * Aktualisiert nur die Datenbank ohne Stripe-Integration
   * Diese Methode wird verwendet, wenn die Stripe-Integration fehlschlägt oder nicht verfügbar ist
   */
  private async updateDatabaseOnly(userId: number, newTier: string, billingCycle: string): Promise<{success: boolean, checkoutUrl?: string | null, requiresPayment?: boolean}> {
    try {
      console.log(`StripeService: Aktualisiere nur die Datenbank für Benutzer ${userId} auf Tier ${newTier}`);
      
      // Benutzer-Informationen abrufen
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        console.error(`StripeService: Benutzer ${userId} nicht gefunden`);
        return { success: false, requiresPayment: false };
      }
      
      // Aktuelles Abonnement holen für Audit-Log
      const currentSubscription = await db.select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);
      
      // Paket-ID holen
      const newPackage = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, newTier)
      });
      
      if (!newPackage) {
        console.error(`StripeService: Paket ${newTier} nicht gefunden`);
        return { success: false, requiresPayment: false };
      }
      
      // Neues Abonnement in der Datenbank speichern ohne Stripe-IDs
      const newSubscription = await db.insert(subscriptions)
        .values({
          userId: userId,
          packageId: newPackage.id,
          status: "active", // Einfach als aktiv markieren ohne Stripe
          billingCycle: billingCycle,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      // Benutzer-Abonnement aktualisieren
      await db.update(users)
        .set({
          subscriptionTier: newTier,
          subscriptionBillingCycle: billingCycle,
          subscriptionExpiresAt: billingCycle === 'yearly' 
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)  // 1 Jahr
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),  // 30 Tage
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      // Audit-Log erstellen
      await db.insert(subscriptionAuditLogs).values({
        userId: userId,
        companyId: user.companyId,
        action: "subscription_switch_db_only",
        oldTier: currentSubscription.length > 0 ? currentSubscription[0].packageId.toString() : "none",
        newTier: newTier,
        details: `Abonnement nur in Datenbank gewechselt von ${currentSubscription.length > 0 ? currentSubscription[0].packageId : "keinem"} zu ${newTier} (Stripe-Integration fehlgeschlagen oder deaktiviert)`
      });

      // Für Firmenadmins die Firma aktualisieren
      if (user.companyId && user.isCompanyAdmin) {
        const existingPaymentInfo = await db.query.companyPaymentInfo.findFirst({
          where: eq(companyPaymentInfo.companyId, user.companyId)
        });
        
        if (existingPaymentInfo) {
          await db.update(companyPaymentInfo)
            .set({
              subscriptionTier: newTier,
              billingCycle: billingCycle,
              subscriptionStatus: "active",
              updatedAt: new Date()
            })
            .where(eq(companyPaymentInfo.companyId, user.companyId));
        }
      }
      
      console.log(`StripeService: Datenbankaktualisierung abgeschlossen für Benutzer ${userId}`);
      return { success: true, checkoutUrl: null, requiresPayment: false };
    } catch (dbError) {
      console.error("StripeService: Fehler bei der Datenbankaktualisierung:", dbError);
      return { success: false, requiresPayment: false };
    }
  }

  /**
   * Erstellt ein Zahlungslink für ein Abonnement
   * 
   * @param userId Benutzer-ID
   * @param packageId Paket-ID
   * @param billingCycle Abrechnungszyklus ('monthly' oder 'yearly') 
   * @returns URL zum Zahlungslink oder null bei Fehler
   */
  async createCheckoutLink(userId: number, packageId: number, billingCycle: string = 'monthly'): Promise<string | null> {
    try {
      console.log(`StripeService: Erstelle Checkout-Link für Benutzer ${userId}, Paket ${packageId}, Zyklus ${billingCycle}`);
      
      // Prüfen, ob Stripe API-Schlüssel vorhanden ist
      if (!secretKeyToUse) {
        console.error("StripeService: Kein Stripe Secret Key vorhanden. Die Stripe-Integration wird übersprungen.");
        // Ohne Stripe-Key können wir keinen Checkout-Link erstellen
        return null;
      }
      
      // Benutzer-Informationen abrufen
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!user) {
        console.error(`StripeService: Benutzer ${userId} nicht gefunden`);
        return null;
      }
      
      // Paket-Informationen abrufen
      const packageInfo = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.id, packageId)
      });
      
      if (!packageInfo) {
        console.error(`StripeService: Paket ${packageId} nicht gefunden`);
        return null;
      }
      
      // Erstelle ein temporäres Subscription-Objekt für die Rückverweisung
      const tempSubscription = await db.insert(subscriptions)
        .values({
          userId: userId,
          packageId: packageId,
          status: "pending",
          billingCycle: billingCycle,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
        
      if (!tempSubscription || tempSubscription.length === 0) {
        console.error("StripeService: Konnte keine temporäre Subscription erstellen");
        return null;
      }
      
      const subscriptionId = tempSubscription[0].id;
      
      try {
        // Basis-URL für die Weiterleitung (sollte aus einer Umgebungsvariable kommen)
        const baseUrl = process.env.REQUEST_URL || "https://0fe82899-989d-49e3-8509-b9664bfb91a4.id.replit.app";
        
        // Den Abrechnungszeitraum für Stripe formatieren
        const interval = billingCycle === 'yearly' ? 'year' : 'month';
        
        // Preisberechnung für Logs
        let unitAmount = billingCycle === 'yearly' ? 
          Math.round(packageInfo.price * 12 * 0.9) : 
          packageInfo.price;
          
        console.log(`StripeService: Preisberechnung für ${packageInfo.name} (${billingCycle}): 
          Basispreis: ${packageInfo.price} Cent
          Berechneter Preis: ${unitAmount} Cent
          Verwendeter Intervall: ${interval}`);
          
        // Stripe Checkout Session erstellen
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "eur",
                product_data: {
                  name: packageInfo.displayName || packageInfo.name,
                  description: `Abonnement-Paket: ${packageInfo.name}`,
                },
                unit_amount: billingCycle === 'yearly' ? Math.round(packageInfo.price * 12 * 0.9) : packageInfo.price,
                // Detaillierte Logging für Preisinformationen
                ...(billingCycle === 'yearly' ? {
                  description: `Jährlich: ${packageInfo.price} × 12 × 0.9 = ${Math.round(packageInfo.price * 12 * 0.9)} Cent (Ersparnis von 10%)`,
                } : {}),
                recurring: {
                  interval: interval as Stripe.PriceCreateParams.Recurring.Interval,
                },
              },
              quantity: 1,
            },
          ],
          mode: "subscription",
          success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/subscription-plans`,
          customer_email: user.email,
          client_reference_id: subscriptionId.toString(),
          metadata: {
            subscriptionId: subscriptionId.toString(),
            packageId: packageId.toString(),
            userId: userId.toString(),
            billingCycle: billingCycle
          },
        });
        
        console.log(`StripeService: Checkout-Session erstellt: ${session.id}`);
        return session.url;
      } catch (stripeError) {
        console.error("StripeService: Fehler beim Erstellen der Stripe-Checkout-Session:", stripeError);
        
        // Abonnement auf "fehlgeschlagen" setzen, da keine Checkout-Session erstellt werden konnte
        await db.update(subscriptions)
          .set({
            status: "failed",
            updatedAt: new Date()
          })
          .where(eq(subscriptions.id, tempSubscription[0].id));
          
        console.log(`StripeService: Temporäres Abonnement ${tempSubscription[0].id} auf 'failed' gesetzt`);
        
        // Audit-Log für fehlgeschlagenen Checkout erstellen
        await db.insert(subscriptionAuditLogs).values({
          userId: userId,
          companyId: user.companyId,
          action: "checkout_failed",
          oldTier: "none",
          newTier: packageInfo.name,
          details: `Stripe-Checkout konnte nicht erstellt werden für Paket ${packageInfo.name} (${billingCycle})`
        });
        
        return null;
      }
    } catch (error) {
      console.error("StripeService: Fehler beim Erstellen des Checkout-Links:", error);
      return null;
    }
  }
}

export const stripeService = new StripeService();