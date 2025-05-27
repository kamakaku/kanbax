import { Request, Response, Express } from "express";
import { requireAuth } from "./middleware/auth";
import Stripe from "stripe";
import { db } from "./db";
import { subscriptionPackages, subscriptions, users } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

// Stripe initialisieren mit dem Secret Key aus Umgebungsvariable
const secretKeyToUse = process.env.STRIPE_SECRET_KEY;
if (!secretKeyToUse) {
  throw new Error("STRIPE_SECRET_KEY Umgebungsvariable ist erforderlich");
}
console.log("Stripe Secret Key aus Umgebungsvariable verwenden");

const stripe = new Stripe(secretKeyToUse, {
  apiVersion: "2025-02-24.acacia", // Aktualisierte API-Version von Stripe
});

// Basis-URL für die Weiterleitung nach erfolgreicher oder fehlgeschlagener Zahlung
// In Replit können sich URLs ändern, aber für Stripe müssen wir vollständige URLs verwenden
// Wir verwenden die REQUEST_URL Umgebungsvariable oder definieren einen Fallback
const BASE_URL = process.env.REQUEST_URL || "https://0fe82899-989d-49e3-8509-b9664bfb91a4.id.replit.app";

// Funktion, um dynamisch die aktuelle Replit-Domain zu erhalten
function getDynamicBaseUrl(req: Request): string {
  // Prüfe, ob X-Forwarded-Host oder Host-Header vorhanden ist
  const host = req.get('X-Forwarded-Host') || req.get('Host');
  if (host) {
    const protocol = req.protocol || 'https';
    return `${protocol}://${host}`;
  }
  return BASE_URL; // Fallback auf statische BASE_URL
}

/**
 * Payment-Routen für die Verarbeitung von Stripe-Zahlungen
 * @param app Express-App
 */
// Hilfsfunktion zur Bestimmung des "Rangs" eines Subscription-Tiers
function getTierRank(tier: string): number {
  switch(tier.toLowerCase()) {
    case 'free': return 0;
    case 'freelancer': return 1;
    case 'organisation': return 2;
    case 'enterprise': return 3;
    case 'kanbax': return 4;
    default: return -1;
  }
}

export function registerPaymentRoutes(app: Express) {
  /**
   * Gibt den öffentlichen Stripe-Schlüssel zurück
   * Diese Route ist öffentlich zugänglich
   */
  app.get("/api/payments/config", (req: Request, res: Response) => {
    // Wir verwenden die Umgebungsvariable oder einen Platzhalter für Entwicklungszwecke
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "pk_test_placeholder_for_development";
    return res.json({ publishableKey });
  });
  /**
   * Erstellt eine Stripe Checkout Session für eine Subscription
   * Diese Route kann auch von nicht authentifizierten Benutzern aufgerufen werden,
   * wenn sie sich gerade registrieren.
   */
  app.post("/api/payments/create-checkout", async (req: Request, res: Response) => {
    try {
      const { subscriptionId, packageId, userId, billingCycle } = req.body;
      
      // Standard-Abrechnungszyklus ist monatlich, wenn nichts angegeben wurde
      const interval = billingCycle === 'yearly' ? 'year' : 'month';
      
      console.log(`Erzeugen eines Stripe Checkout für Paket mit Abrechnungszyklus ${billingCycle} (Interval: ${interval})`);
      
      if (!packageId || !userId) {
        return res.status(400).json({ message: "Fehlende Paket-ID oder Benutzer-ID für die Checkout-Session" });
      }
      
      // Spezialfall für Freelancer-Pakete: Temporäre Subscription-ID (-1) akzeptieren
      const isTemporarySubscription = subscriptionId === -1;
      
      if (isTemporarySubscription) {
        console.log("Temporäre Subscription-ID (-1) erkannt. Fortfahren mit temporärer ID für Freelancer.");
      } else if (!subscriptionId) {
        return res.status(400).json({ message: "Fehlende Subscription-ID für die Checkout-Session" });
      }

      console.log("Checkout-Anfrage erhalten:", { subscriptionId, packageId, userId });
      
      // Holen der dynamischen Basis-URL basierend auf dem aktuellen Request
      const dynamicBaseUrl = getDynamicBaseUrl(req);
      console.log("Verwendete Basis-URL für Stripe:", dynamicBaseUrl);
      
      // Hole Subscription-Paket-Informationen
      const packageInfo = await db.select().from(subscriptionPackages).where(eq(subscriptionPackages.id, packageId)).limit(1);
      
      if (!packageInfo || packageInfo.length === 0) {
        console.error("Abonnement-Paket nicht gefunden:", packageId);
        return res.status(404).json({ message: "Abonnement-Paket nicht gefunden" });
      }
      
      console.log("Paket gefunden:", packageInfo[0]);
      
      // Hole Benutzerinformationen
      const userInfo = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!userInfo || userInfo.length === 0) {
        console.error("Benutzer nicht gefunden:", userId);
        return res.status(404).json({ message: "Benutzer nicht gefunden" });
      }
      
      console.log("Benutzer gefunden:", { id: userInfo[0].id, email: userInfo[0].email });
      
      // Berechne den korrekten Preis basierend auf dem Abrechnungszyklus
      let calculatedPrice = packageInfo[0].price;
      if (interval === 'year') {
        calculatedPrice = Math.round(packageInfo[0].price * 12 * 0.9); // Jahrespreis mit 10% Rabatt
        console.log(`Preisberechnung für jährliches Abonnement: ${packageInfo[0].price} × 12 × 0.9 = ${calculatedPrice} Cent`);
      }
      
      // Erstelle Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: packageInfo[0].displayName || packageInfo[0].name,
                description: `Abonnement-Paket: ${packageInfo[0].name}`,
              },
              unit_amount: interval === 'year' ? 
                Math.round(packageInfo[0].price * 12 * 0.9) : // Jahrespreis mit 10% Rabatt
                packageInfo[0].price, // Monatlicher Preis bleibt unverändert
              recurring: {
                // Verwende den vom Client angegebenen Abrechnungszeitraum
                interval: interval, // Kann 'month' oder 'year' sein
              },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        // Für die success_url verwenden wir die dynamisch ermittelte Basis-URL
        success_url: `${dynamicBaseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${dynamicBaseUrl}/auth`,
        customer_email: userInfo[0].email,
        client_reference_id: subscriptionId.toString(),
        metadata: {
          subscriptionId,
          packageId,
          userId,
          billingCycle // Speichere auch den Abrechnungszyklus in den Metadaten
        },
      });
      
      // Sende die Checkout-URL zurück
      return res.status(200).json({ checkoutUrl: session.url });
    } catch (error) {
      console.error("Fehler bei der Erstellung der Checkout-Session:", error);
      return res.status(500).json({ message: "Fehler bei der Erstellung der Checkout-Session" });
    }
  });

  /**
   * Webhook für Stripe-Events
   */
  app.post("/api/payments/webhook", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    
    if (!sig) {
      console.error("❌ Webhook: Keine Stripe-Signatur in den Headers gefunden");
      return res.status(400).json({ message: "Keine Stripe-Signatur gefunden" });
    }
    
    // Wir verwenden einen Platzhalter als Webhook-Secret für Entwicklungszwecke
    // In der Produktion sollte dies eine sichere Zeichenfolge sein
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder_for_development";
    
    let event: Stripe.Event;
    
    try {
      console.log(`📨 Webhook: Rohdaten empfangen, Länge: ${req.body?.length || 'keine Daten'}`);
      
      // Verifiziere Webhook-Signatur
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        stripeWebhookSecret
      );
      
      console.log(`✅ Webhook: Signatur erfolgreich verifiziert für Event ${event.id}`);
    } catch (err) {
      console.error("❌ Webhook: Fehler bei der Signaturprüfung:", err);
      return res.status(400).json({ message: "Ungültige Signatur" });
    }
    
    // Log für alle eingehenden Events
    console.log(`⚡ STRIPE WEBHOOK: Event-Typ ${event.type} empfangen (ID: ${event.id})`);
    
    // Verarbeite verschiedene Stripe-Ereignisse
    switch (event.type) {
      case "checkout.session.completed": {
        // Checkout wurde erfolgreich abgeschlossen
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Log für Debug-Zwecke - vollständige Session
        console.log(`💰 CHECKOUT COMPLETED - Session: ${JSON.stringify(session, null, 2)}`);
        
        // Extrahiere Metadaten
        const subscriptionId = session.metadata?.subscriptionId;
        const packageId = session.metadata?.packageId;
        const userId = session.metadata?.userId;
        // Normalisierung des Billing-Zyklus für konsistente DB-Speicherung
        const rawBillingCycle = session.metadata?.billingCycle || 'monthly';
        const billingCycle = rawBillingCycle && rawBillingCycle.toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
        console.log(`🔄 Normalisierter Billing-Zyklus: ${billingCycle} (Original: ${rawBillingCycle})`);
        
        if (!packageId || !userId) {
          console.error("Fehlende Package-ID oder User-ID in der Session:", session);
          return res.status(400).json({ message: "Fehlende Paket- oder Benutzer-Metadaten in der Session" });
        }
        
        // Spezialbehandlung für temporäre Subscription-ID
        const isTemporarySubscription = subscriptionId === "-1";
        let finalSubscriptionId = subscriptionId; // Neue Variable für die ID
        
        if (isTemporarySubscription) {
          console.log("Temporäre Subscription-ID (-1) im Webhook erkannt. Erstelle neue Subscription für den Benutzer.");
          
          try {
            // Erstelle einen echten Subscription-Eintrag für diesen Benutzer, da die Zahlung erfolgreich war
            const newSubscriptionResult = await db.insert(subscriptions)
              .values({
                userId: parseInt(userId),
                packageId: parseInt(packageId),
                status: "active",
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                billingCycle, // Abrechnungszyklus wurde bereits normalisiert
                createdAt: new Date(),
                updatedAt: new Date()
              })
              .returning();
              
            if (newSubscriptionResult && newSubscriptionResult.length > 0) {
              // Speichere die neue ID in der Hilfsvariable
              finalSubscriptionId = newSubscriptionResult[0].id.toString();
              console.log("Neue Subscription erstellt mit ID:", finalSubscriptionId);
            } else {
              console.error("Subscription konnte nicht erstellt werden.");
              // Wir machen trotzdem weiter, um den Benutzer zu aktivieren
            }
          } catch (dbError) {
            console.error("Fehler beim Erstellen der Subscription:", dbError);
            // Wir machen trotzdem weiter, um den Benutzer zu aktivieren
          }
        } else if (!finalSubscriptionId) {
          console.error("Keine Subscription-ID in der Session:", session);
          return res.status(400).json({ message: "Fehlende Subscription-ID in der Session" });
        }

        // Setze die Ablaufzeit basierend auf dem gewählten Abrechnungszeitraum
        let expirationPeriod = 30 * 24 * 60 * 60 * 1000; // Standard: 30 Tage (monatlich)
        
        // Wenn der Nutzer eine jährliche Abrechnung gewählt hat, setze die Ablaufzeit auf 365 Tage
        if (billingCycle === 'yearly') {
          console.log("Jährliches Abonnement erkannt, setze Ablaufzeit auf 365 Tage");
          expirationPeriod = 365 * 24 * 60 * 60 * 1000; // 365 Tage (jährlich)
        } else {
          console.log("Monatliches Abonnement erkannt, setze Ablaufzeit auf 30 Tage");
        }

        // Hole das Paket, um die Tier-Information zu bekommen
        const packageDetails = await db.select()
          .from(subscriptionPackages)
          .where(eq(subscriptionPackages.id, parseInt(packageId)))
          .limit(1);
        
        if (!packageDetails || packageDetails.length === 0) {
          console.error("Paket nicht gefunden für ID:", packageId);
          return res.status(404).json({ message: "Paket nicht gefunden" });
        }
        
        const packageTier = packageDetails[0].name.toLowerCase(); // z.B. "freelancer", "organisation"
        console.log(`⚡ Setze Subscription-Tier des Benutzers #${userId} auf: ${packageTier}`);
        
        // Prüfe vorher den aktuellen Status des Benutzers
        const userBefore = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1);
        if (userBefore && userBefore.length > 0) {
          console.log(`👤 Aktueller Benutzer-Status vor Update:`, {
            id: userBefore[0].id,
            email: userBefore[0].email,
            subscriptionTier: userBefore[0].subscriptionTier,
            subscriptionBillingCycle: userBefore[0].subscriptionBillingCycle,
            subscriptionExpiresAt: userBefore[0].subscriptionExpiresAt
          });
        }
          
        // Aktiviere den Benutzer nach erfolgreicher Zahlung und aktualisiere sein Subscription-Tier
        const userUpdateResult = await db.update(users)
          .set({ 
            isActive: true,
            subscriptionTier: packageTier, // Hier setzen wir den Tier-Wert des Benutzers
            subscriptionBillingCycle: billingCycle, // Bereits normalisiert
            subscriptionExpiresAt: new Date(Date.now() + expirationPeriod)
          })
          .where(eq(users.id, parseInt(userId)))
          .returning();
        
        console.log(`✅ Benutzer ${userId} aktualisiert:`, userUpdateResult);
        
        // Prüfe nach dem Update den Status des Benutzers
        const userAfter = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1);
        if (userAfter && userAfter.length > 0) {
          console.log(`👑 Benutzer-Status nach Update:`, {
            id: userAfter[0].id,
            email: userAfter[0].email,
            subscriptionTier: userAfter[0].subscriptionTier,
            subscriptionBillingCycle: userAfter[0].subscriptionBillingCycle,
            subscriptionExpiresAt: userAfter[0].subscriptionExpiresAt
          });
        }
        
        try {
          // Aktualisiere die Subscription in der Datenbank
          // Speichere auch den Abrechnungszyklus in der Datenbank
          await db.update(subscriptions)
            .set({
              status: "active",
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              billingCycle, // Abrechnungszyklus wurde bereits normalisiert
              updatedAt: new Date()
            })
            .where(eq(subscriptions.id, parseInt(finalSubscriptionId || "0")));
          
          console.log(`Subscription ${finalSubscriptionId} wurde aktiviert für Benutzer ${userId}`);
        } catch (dbError) {
          console.error("Fehler bei der Aktualisierung der Subscription:", dbError);
        }
        
        break;
      }
      
      case "customer.subscription.deleted": {
        // Subscription wurde gekündigt oder ist abgelaufen
        const subscription = event.data.object as Stripe.Subscription;
        
        // Finde Subscription in der Datenbank anhand der Stripe Subscription ID
        try {
          const subscriptionInDb = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
            .limit(1);
          
          if (subscriptionInDb.length > 0) {
            // Setze Subscription auf inaktiv
            await db.update(subscriptions)
              .set({
                status: "inactive",
                updatedAt: new Date()
              })
              .where(eq(subscriptions.id, subscriptionInDb[0].id));
            
            console.log(`Subscription ${subscriptionInDb[0].id} wurde deaktiviert`);
          }
        } catch (dbError) {
          console.error("Fehler bei der Aktualisierung der Subscription:", dbError);
        }
        
        break;
      }
      
      // Weitere Event-Typen können hier hinzugefügt werden
      
      default:
        console.log(`Unbehandeltes Stripe-Event: ${event.type}`);
    }
    
    // Bestätige den Empfang des Events
    return res.status(200).json({ received: true });
  });

  /**
   * Erfolgsseite nach abgeschlossenem Checkout
   * Diese Route ist absichtlich ohne AUTH-Check, damit Benutzer nach dem Bezahlvorgang
   * ihre Zahlungsdaten sehen können, bevor sie eingeloggt sind.
   */
  app.get("/api/payments/success", async (req: Request, res: Response) => {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ message: "Keine Session-ID gefunden" });
    }
    
    try {
      // Holen der dynamischen Basis-URL basierend auf dem aktuellen Request
      const dynamicBaseUrl = getDynamicBaseUrl(req);
      console.log(`Payment success API aufgerufen mit session_id: ${session_id}, Base URL: ${dynamicBaseUrl}`);
      
      // Hole Session-Informationen von Stripe
      const session = await stripe.checkout.sessions.retrieve(session_id as string);
      
      // Prüfe, ob die Session ein Stripe-Kunden-ID und eine Stripe-Subscription-ID hat
      const stripeCustomerId = session.customer as string;
      const stripeSubscriptionId = session.subscription as string;
      
      console.log(`Stripe Customer ID: ${stripeCustomerId}, Stripe Subscription ID: ${stripeSubscriptionId}`);
      
      let subscriptionInfo;
      
      // Falls wir eine Stripe-Subscription-ID haben, versuche zuerst damit zu suchen
      if (stripeSubscriptionId) {
        subscriptionInfo = await db.select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
          .limit(1);
      }
      
      // Wenn keine Subscription gefunden wurde, versuche mit der Client-Referenz-ID
      if (!subscriptionInfo || subscriptionInfo.length === 0) {
        const clientRefId = session.client_reference_id;
        
        if (clientRefId) {
          console.log(`Suche nach Subscription mit Client Reference ID: ${clientRefId}`);
          
          subscriptionInfo = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.id, parseInt(clientRefId)))
            .limit(1);
        }
      }
      
      // Wenn immer noch keine Subscription gefunden, versuche mit Metadaten
      if (!subscriptionInfo || subscriptionInfo.length === 0) {
        const subscriptionId = session.metadata?.subscriptionId;
        
        if (subscriptionId) {
          console.log(`Suche nach Subscription mit Metadata ID: ${subscriptionId}`);
          
          subscriptionInfo = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.id, parseInt(subscriptionId)))
            .limit(1);
        }
      }
      
      // Wenn alle Versuche fehlgeschlagen sind, prüfe, ob wir eine userId in den Metadaten haben
      if (!subscriptionInfo || subscriptionInfo.length === 0) {
        const userId = session.metadata?.userId;
        
        if (userId) {
          console.log(`Suche nach Subscription für User: ${userId}`);
          
          subscriptionInfo = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, parseInt(userId)))
            .orderBy(desc(subscriptions.createdAt))
            .limit(1);
        }
      }
      
      // Wenn immer noch keine Subscription gefunden wurde, gib eine informativere Fehlermeldung zurück
      if (!subscriptionInfo || subscriptionInfo.length === 0) {
        console.error("Keine passende Subscription in der Datenbank gefunden für Session:", session);
        return res.status(404).json({ 
          message: "Subscription nicht gefunden",
          sessionInfo: {
            id: session.id,
            clientReferenceId: session.client_reference_id,
            metadata: session.metadata,
            customerId: stripeCustomerId,
            subscriptionId: stripeSubscriptionId
          }
        });
      }
      
      // Wenn die Subscription gefunden wurde, aber die Stripe-IDs fehlen, aktualisiere sie
      const subscription = subscriptionInfo[0];
      console.log("Gefundene Subscription:", subscription);
      
      if (subscription && stripeCustomerId && stripeSubscriptionId && 
          (!subscription.stripeCustomerId || !subscription.stripeSubscriptionId)) {
        console.log("Aktualisiere Stripe-IDs in der Subscription");
        
        try {
          await db.update(subscriptions)
            .set({
              status: "active",
              stripeCustomerId,
              stripeSubscriptionId,
              updatedAt: new Date()
            })
            .where(eq(subscriptions.id, subscription.id));
            
          // Hole aktualisierte Daten
          const updatedSubscription = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.id, subscription.id))
            .limit(1);
            
          if (updatedSubscription.length > 0) {
            subscription.status = updatedSubscription[0].status;
            subscription.stripeCustomerId = updatedSubscription[0].stripeCustomerId;
            subscription.stripeSubscriptionId = updatedSubscription[0].stripeSubscriptionId;
          }
        } catch (updateError) {
          console.error("Fehler bei der Aktualisierung der Subscription:", updateError);
        }
      }
      
      // Sende erfolgreiche Zahlung zurück
      return res.status(200).json({
        success: true,
        message: "Zahlung erfolgreich",
        subscription
      });
    } catch (error) {
      console.error("Fehler beim Abrufen der Session-Informationen:", error);
      return res.status(500).json({ 
        message: "Fehler beim Verarbeiten der erfolgreichen Zahlung",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * Abbruchseite nach abgebrochenem Checkout
   */
  app.get("/api/payments/cancel", (req: Request, res: Response) => {
    return res.status(200).json({
      success: false,
      message: "Zahlung abgebrochen"
    });
  });

  /**
   * Direkter Endpunkt für die Aktualisierung des Benutzerabonnements
   * Dies ist ein Workaround für den Fall, dass Webhooks nicht funktionieren
   * HINWEIS: Diese Route ist absichtlich NICHT durch requireAuth geschützt,
   * damit sie von jedem beliebigen Frontend-Code aufgerufen werden kann
   */
  app.post("/api/payments/direct-update", async (req: Request, res: Response) => {
    try {
      const { userId, packageId, billingCycle = 'monthly', sessionId, forceDowngrade = false } = req.body;

      // Normalisiere den Abrechnungszyklus zu einem eindeutigen Wert
      const normalizedBillingCycle = (billingCycle && String(billingCycle).toLowerCase() === 'yearly') ? 'yearly' : 'monthly';
      
      console.log(`🔄 DIREKTE AKTUALISIERUNG: Benutzer ${userId}, Paket ${packageId}, `);
      console.log(`   Original Zyklus=${billingCycle} (Typ: ${typeof billingCycle}), Normalisiert=${normalizedBillingCycle}, forceDowngrade=${forceDowngrade}`);

      if (!userId || !packageId) {
        return res.status(400).json({ success: false, message: "Fehlende Benutzer- oder Paket-ID" });
      }

      // Prüfe vorher den aktuellen Status des Benutzers
      const userBefore = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!userBefore || userBefore.length === 0) {
        return res.status(404).json({ success: false, message: "Benutzer nicht gefunden" });
      }
      
      console.log(`👤 Aktueller Benutzer-Status vor Update:`, {
        id: userBefore[0].id,
        email: userBefore[0].email,
        subscriptionTier: userBefore[0].subscriptionTier,
        subscriptionBillingCycle: userBefore[0].subscriptionBillingCycle,
        subscriptionExpiresAt: userBefore[0].subscriptionExpiresAt
      });

      // Hole das Paket, um die Tier-Information zu bekommen
      const packageInfo = await db.select().from(subscriptionPackages).where(eq(subscriptionPackages.id, packageId)).limit(1);
      
      if (!packageInfo || packageInfo.length === 0) {
        return res.status(404).json({ success: false, message: "Paket nicht gefunden" });
      }
      
      const packageTier = packageInfo[0].name.toLowerCase(); // z.B. "freelancer", "organisation"
      console.log(`🔼 Setze Subscription-Tier des Benutzers ${userId} auf: ${packageTier} mit Billing-Zyklus: ${normalizedBillingCycle}`);
      
      // WICHTIG: Prüfe, ob ein Downgrade durchgeführt wird und ob dies explizit erlaubt ist
      const currentTier = userBefore[0].subscriptionTier?.toLowerCase() || 'free';
      const currentTierRank = getTierRank(currentTier);
      const newTierRank = getTierRank(packageTier);
      
      const isDowngrade = newTierRank < currentTierRank;
      
      console.log(`Tier-Vergleich: ${currentTier}(${currentTierRank}) -> ${packageTier}(${newTierRank}), isDowngrade=${isDowngrade}, forceDowngrade=${forceDowngrade}`);
      console.log(`Billing-Zyklus: ${userBefore[0].subscriptionBillingCycle || 'nicht gesetzt'} -> ${normalizedBillingCycle}`);
      
      // Wenn es ein Downgrade ist, aber forceDowngrade nicht explizit auf true gesetzt ist, breche ab
      if (isDowngrade && !forceDowngrade) {
        console.log(`⚠️ WARNUNG: Downgrade von ${currentTier} auf ${packageTier} ohne forceDowngrade-Flag abgelehnt`);
        return res.status(403).json({ 
          success: false, 
          message: "Downgrade nicht erlaubt ohne forceDowngrade=true"
        });
      }
      
      // Bestimme die Laufzeit für das Abonnement
      const expirationPeriod = normalizedBillingCycle === 'yearly' 
        ? 365 * 24 * 60 * 60 * 1000  // 1 Jahr in Millisekunden
        : 30 * 24 * 60 * 60 * 1000;  // 30 Tage in Millisekunden
        
      console.log(`⚡ WICHTIG: Setze subscriptionBillingCycle auf: "${normalizedBillingCycle}" für User ${userId}`);
        
      // Aktiviere den Benutzer und aktualisiere sein Subscription-Tier
      const userUpdateResult = await db.update(users)
        .set({ 
          isActive: true,
          subscriptionTier: packageTier,
          subscriptionBillingCycle: normalizedBillingCycle, // Verwende den normalisierten Wert!
          subscriptionExpiresAt: new Date(Date.now() + expirationPeriod),
          updatedAt: new Date() // Stelle sicher, dass updatedAt auch aktualisiert wird
        })
        .where(eq(users.id, userId))
        .returning();
      
      console.log(`✅ Benutzer ${userId} aktualisiert:`, userUpdateResult);
      
      // Prüfe nach dem Update den Status des Benutzers
      const userAfter = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      // Erstelle oder aktualisiere auch den Subscription-Eintrag
      let subscriptionEntry;
      
      // Zuerst prüfen, ob bereits eine Subscription existiert
      const existingSubscription = await db.select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);
      
      console.log(`Subscription für User ${userId} überprüfen...`);
      
      if (existingSubscription && existingSubscription.length > 0) {
        // Zeige den aktuellen Zustand an
        console.log(`Bestehende Subscription gefunden: ID=${existingSubscription[0].id}, billingCycle=${existingSubscription[0].billingCycle}`);

        // Aktualisiere die bestehende Subscription mit dem NORMALISIERTEN Wert
        subscriptionEntry = await db.update(subscriptions)
          .set({
            packageId,
            status: "active",
            billingCycle: normalizedBillingCycle, // Verwende den normalisierten Wert!
            updatedAt: new Date()
          })
          .where(eq(subscriptions.id, existingSubscription[0].id))
          .returning();
          
        console.log(`✅ Bestehende Subscription ${existingSubscription[0].id} aktualisiert mit billingCycle=${normalizedBillingCycle}`);
      } else {
        console.log(`Keine bestehende Subscription für User ${userId} gefunden, erstelle neu`);
        
        // Erstelle eine neue Subscription mit dem NORMALISIERTEN Wert
        subscriptionEntry = await db.insert(subscriptions)
          .values({
            userId,
            packageId,
            status: "active",
            billingCycle: normalizedBillingCycle, // Verwende den normalisierten Wert!
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
          
        console.log(`✅ Neue Subscription erstellt für Benutzer ${userId} mit billingCycle=${normalizedBillingCycle}`);
      }
      
      // Überprüfen, ob die Subscription korrekt aktualisiert wurde
      const updatedSubscription = await db.select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);
        
      // Zeige den finalen Status explizit an
      console.log(`🔍 FINAL CHECK - Subscription nach Update:`, {
        id: updatedSubscription[0]?.id,
        userId: updatedSubscription[0]?.userId,
        packageId: updatedSubscription[0]?.packageId,
        billingCycle: updatedSubscription[0]?.billingCycle,
        status: updatedSubscription[0]?.status
      });
      
      console.log(`🔍 FINAL CHECK - User nach Update:`, {
        id: userAfter[0]?.id,
        subscriptionTier: userAfter[0]?.subscriptionTier,
        subscriptionBillingCycle: userAfter[0]?.subscriptionBillingCycle
      });
      
      return res.status(200).json({
        success: true,
        message: "Benutzerabonnement erfolgreich aktualisiert",
        updatedUser: userAfter.length > 0 ? {
          id: userAfter[0].id,
          email: userAfter[0].email,
          subscriptionTier: userAfter[0].subscriptionTier,
          subscriptionBillingCycle: userAfter[0].subscriptionBillingCycle,
          subscriptionExpiresAt: userAfter[0].subscriptionExpiresAt
        } : null,
        subscriptionEntry: updatedSubscription[0] || subscriptionEntry,
        billingCycle: normalizedBillingCycle // Explizit auch im Response zurückgeben
      });
    } catch (error) {
      console.error("❌ Fehler bei der direkten Aktualisierung:", error);
      return res.status(500).json({
        success: false,
        message: "Fehler bei der Aktualisierung des Benutzerabonnements",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}