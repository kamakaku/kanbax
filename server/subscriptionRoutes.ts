import { Express, Request, Response } from "express";
import { db } from "./db";
import * as schema from "../shared/schema";
import { companyPaymentInfo, subscriptionPackages, subscriptionAuditLogs, users, projects, boards, teams } from "../shared/schema";
import { requireAuth, requireCompanyAdmin, requireHyperAdmin } from "./middleware/auth";
import { subscriptionService } from "./subscription-service";
import { stripeService } from "./stripe-service";
import { eq, and, count, sql } from "drizzle-orm";
import { permissionService } from "./permissions";
import { guaranteedSubscriptionUpdate as automatedUpdateService } from "./automated-subscription-service";

/**
 * Registriert alle Routen für die Abo-Verwaltung
 */
export function registerSubscriptionRoutes(app: Express) {
  /**
   * Öffentlicher Endpunkt: Gibt alle öffentlich verfügbaren Abonnement-Pakete zurück
   */
  app.get("/api/public/subscription-packages", async (req: Request, res: Response) => {
    try {
      // Alle öffentlich verfügbaren, aktiven Pakete abrufen für die Anzeige in der Paketübersicht
      // kanbax ist ein internes Paket, das nur vom Hyper-Admin vergeben werden kann
      const packages = await db.query.subscriptionPackages.findMany({
        where: and(
          eq(subscriptionPackages.isActive, true),
          sql`(${subscriptionPackages.name} != 'kanbax')`
        )
      });
      
      // Einige Felder entfernen, die nicht an den Client gesendet werden sollen
      const safePackages = packages.map(pkg => {
        const { stripeProductId, stripePriceId, ...safePackage } = pkg;
        return safePackage;
      });
      
      res.json(safePackages);
    } catch (error) {
      console.error("Fehler beim Abrufen der öffentlichen Abonnement-Pakete:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Abonnement-Pakete" });
    }
  });
  
  /**
   * Admin-Route: Aktualisiert das Abonnement-Tier eines Benutzers
   */
  app.patch("/api/admin/users/:id/subscription", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const adminUserId = req.session.userId!;
      const { tier } = req.body;
      
      if (!tier) {
        return res.status(400).json({ message: "Keine Abo-Stufe angegeben" });
      }
      
      // Prüfen, ob der Benutzer existiert
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!user) {
        return res.status(404).json({ message: "Benutzer nicht gefunden" });
      }
      
      // Abonnement aktualisieren
      const success = await subscriptionService.updateUserSubscriptionTier(userId, tier, adminUserId);
      
      if (!success) {
        return res.status(500).json({ message: "Fehler beim Aktualisieren des Abonnements" });
      }
      
      res.json({ message: "Benutzer-Abonnement erfolgreich aktualisiert" });
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Benutzer-Abonnements:", error);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Benutzer-Abonnements" });
    }
  });
  /**
   * Gibt alle verfügbaren Abonnement-Pakete zurück
   */
  app.get("/api/subscription/packages", requireAuth, async (req: Request, res: Response) => {
    try {
      const packages = await db.query.subscriptionPackages.findMany({
        where: eq(subscriptionPackages.isActive, true)
      });
      
      // Einige Felder entfernen, die nicht an den Client gesendet werden sollen
      const safePackages = packages.map(pkg => {
        const { stripeProductId, stripePriceId, ...safePackage } = pkg;
        return safePackage;
      });
      
      res.json(safePackages);
    } catch (error) {
      console.error("Fehler beim Abrufen der Abonnement-Pakete:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Abonnement-Pakete" });
    }
  });

  /**
   * Gibt das aktuelle Abonnement des Unternehmens zurück
   */
  app.get("/api/subscription/current", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      // Force fresh data from database - no caching
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1).then(rows => rows[0]);
      
      // Default für Benutzer ohne Unternehmen: Persönliches Abonnement des Benutzers oder Free-Package
      if (!user?.companyId) {
        // Prüfen, ob der Benutzer ein persönliches Abonnement hat
        const userSubscriptionTier = user?.subscriptionTier || "free";
        
        // Paket-Informationen für das Abonnement abrufen
        const packageInfo = await db.query.subscriptionPackages.findFirst({
          where: eq(subscriptionPackages.name, userSubscriptionTier)
        });
        
        if (!packageInfo) {
          return res.status(500).json({ message: `Paket ${userSubscriptionTier} nicht gefunden` });
        }
        
        // Raw SQL-Abfrage für garantiert korrektes subscriptionBillingCycle
        const result = await db.execute(sql`
          SELECT subscription_billing_cycle 
          FROM users 
          WHERE id = ${user.id}
        `);
        const actualBillingCycle = result.rows[0]?.subscription_billing_cycle || 'monthly';
        
        // Benutzerabonnement zurückgeben
        const response = {
          companyId: null,
          subscriptionTier: userSubscriptionTier,
          subscriptionBillingCycle: actualBillingCycle,
          subscriptionStatus: "active",
          subscriptionStartDate: new Date().toISOString(),
          subscriptionEndDate: user?.subscriptionExpiresAt || null,
          packageInfo: {
            displayName: packageInfo.displayName,
            description: packageInfo.description,
            price: packageInfo.price,
            features: {
              maxProjects: packageInfo.maxProjects,
              maxBoards: packageInfo.maxBoards,
              maxTeams: packageInfo.maxTeams,
              maxUsersPerCompany: packageInfo.maxUsersPerCompany,
              hasGanttView: packageInfo.hasGanttView,
              hasAdvancedReporting: packageInfo.hasAdvancedReporting,
              hasApiAccess: packageInfo.hasApiAccess,
              hasCustomBranding: packageInfo.hasCustomBranding,
              hasPrioritySupport: packageInfo.hasPrioritySupport
            }
          }
        };
        
        console.log("[SUBSCRIPTION DEBUG] Final response:", JSON.stringify(response, null, 2));
        return res.json(response);
      }

      // Prüfen, ob Benutzer Zugriff auf das Unternehmen hat
      const hasAccess = await permissionService.canAccessCompany(userId, user.companyId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Keine Berechtigung für den Zugriff auf diese Firma" });
      }

      // Unternehmensinformationen abrufen
      const company = await db.query.companies.findFirst({
        where: eq(schema.companies.id, user.companyId)
      });

      if (!company) {
        return res.status(404).json({ message: "Unternehmen nicht gefunden" });
      }

      // Abonnement-Informationen abrufen
      const subscription = await db.query.companyPaymentInfo.findFirst({
        where: eq(companyPaymentInfo.companyId, user.companyId)
      });

      // Standard-Tier, falls keine Zahlungsinformationen vorhanden sind
      const subscriptionTier = subscription?.subscriptionTier || "organisation";
      
      // Paket-Informationen abrufen
      const packageInfo = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, subscriptionTier)
      });

      // Antwort zusammenbauen mit Fallback-Werten wenn keine Subscription existiert
      const response = {
        companyId: user.companyId,
        subscriptionTier: subscriptionTier,
        subscriptionStatus: subscription?.subscriptionStatus || "active",
        subscriptionStartDate: subscription?.subscriptionStartDate || new Date(),
        subscriptionEndDate: subscription?.subscriptionEndDate || null,
        subscriptionBillingCycle: user.subscriptionBillingCycle || "monthly",
        packageInfo: packageInfo ? {
          displayName: packageInfo.displayName,
          description: packageInfo.description,
          price: packageInfo.price,
          features: {
            maxProjects: packageInfo.maxProjects,
            maxBoards: packageInfo.maxBoards,
            maxTeams: packageInfo.maxTeams,
            maxUsersPerCompany: packageInfo.maxUsersPerCompany,
            hasGanttView: packageInfo.hasGanttView,
            hasAdvancedReporting: packageInfo.hasAdvancedReporting,
            hasApiAccess: packageInfo.hasApiAccess,
            hasCustomBranding: packageInfo.hasCustomBranding,
            hasPrioritySupport: packageInfo.hasPrioritySupport
          }
        } : null
      };

      res.json(response);
    } catch (error) {
      console.error("Fehler beim Abrufen der Abonnement-Informationen:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Abonnement-Informationen" });
    }
  });

  /**
   * INTERNER UPDATE-ENDPUNKT:
   * Direkter Endpunkt für Updates ohne Authentifizierung - nur für interne System-zu-System-Kommunikation!
   * ACHTUNG: DIESER ENDPUNKT HAT KEINE AUTHENTICATION!
   */
  app.post("/api/internal/update-subscription", async (req: Request, res: Response) => {
    try {
      const { userId, tier, billingCycle = 'monthly', apiKey } = req.body;
      
      // Einfache API-Key-Validierung für minimale Sicherheit
      const validApiKey = process.env.INTERNAL_API_KEY || 'local_development_key';
      if (apiKey !== validApiKey) {
        return res.status(403).json({ 
          success: false, 
          message: "Ungültiger API-Key" 
        });
      }
      
      if (!userId || !tier) {
        return res.status(400).json({ 
          success: false, 
          message: "Fehlende erforderliche Parameter (userId und tier werden benötigt)" 
        });
      }
      
      console.log(`[INTERNAL UPDATE] Starte interne Aktualisierung für Benutzer ${userId}, Tier: ${tier}, Zyklus: ${billingCycle}`);
      
      // Direkten garantierten Update-Service aufrufen
      console.log(`[INTERNAL UPDATE] Explicit billingCycle=${billingCycle} - ensuring correct cycle is passed to update service`);
      const result = await automatedUpdateService(userId, tier, billingCycle);
      
      if (result.success) {
        console.log(`[INTERNAL UPDATE] ✅ Interne Aktualisierung erfolgreich für ${userId}`);
        return res.json({
          success: true, 
          message: "Abonnement erfolgreich aktualisiert via internen Endpunkt",
          data: result.data
        });
      } else {
        console.error(`[INTERNAL UPDATE] ❌ Fehler bei interner Aktualisierung:`, result.error);
        return res.status(500).json({
          success: false,
          message: "Fehler bei interner Aktualisierung", 
          error: result.message
        });
      }
    } catch (error) {
      console.error(`[INTERNAL UPDATE] ❌ Unerwarteter Fehler:`, error);
      return res.status(500).json({
        success: false,
        message: "Unerwarteter Fehler bei interner Aktualisierung",
        error: String(error)
      });
    }
  });
  
  /**
   * AUTO-GARANTIERTE AKTUALISIERUNG:
   * Endpunkt für die garantierte Aktualisierung des Abonnements durch den automatisierten Service
   * Dies umgeht alle normalen Abläufe und führt ein direktes Update in der Datenbank durch
   */
  app.post("/api/subscription/guaranteed-update", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { tier, billingCycle = 'monthly' } = req.body;
      
      console.log(`[GUARANTEED UPDATE] Starte garantierte Aktualisierung für Benutzer ${userId}, Tier: ${tier}, Zyklus: ${billingCycle}`);
      
      if (!tier) {
        return res.status(400).json({ message: "Keine Abonnement-Stufe angegeben" });
      }
      
      // Den garantierten Update-Service aufrufen
      console.log(`[GUARANTEED UPDATE] Explicit billingCycle=${billingCycle} - ensuring correct cycle is passed to update service`);
      const result = await automatedUpdateService(userId, tier, billingCycle);
      
      if (result.success) {
        console.log(`[GUARANTEED UPDATE] ✅ Garantierte Aktualisierung erfolgreich abgeschlossen für ${userId}`);
        return res.json({
          success: true,
          message: "Abonnement garantiert aktualisiert",
          data: result.data
        });
      } else {
        console.error(`[GUARANTEED UPDATE] ❌ Garantierte Aktualisierung fehlgeschlagen:`, result.error);
        return res.status(500).json({
          success: false,
          message: "Fehler bei garantierter Aktualisierung",
          error: result.message
        });
      }
    } catch (error) {
      console.error(`[GUARANTEED UPDATE] ❌ Unerwarteter Fehler:`, error);
      return res.status(500).json({ 
        success: false,
        message: "Unerwarteter Fehler bei der Aktualisierung",
        error: String(error)
      });
    }
  });
  
  /**
   * Benutzerendpunkt: Aktualisiert das persönliche Abonnement des eingeloggten Benutzers
   * Bei einem Abonnementwechsel wird das alte Abonnement bei Stripe gekündigt
   * und ein neues direkt erstellt und abgerechnet.
   */
  app.post("/api/subscription/update-user", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { tier, billingCycle = 'monthly', forceDowngrade = false } = req.body;
      
      console.log(`[SUBSCRIPTION DEBUG] Abonnementänderung angefordert für Benutzer ${userId}, Tier: ${tier}, Zyklus: ${billingCycle}, forceDowngrade=${forceDowngrade}`);
      
      // AUTOMATISCHES UPDATE: Wenn forceDowngrade=true, wird der direkte API-Endpunkt verwendet
      if (forceDowngrade === true) {
        console.log(`[SUBSCRIPTION AUTO] Automatisches Update mit forceDowngrade=true wird durchgeführt`);
        try {
          // Paket-ID für das direkte Update bestimmen
          const getPackageId = (tierName: string): number => {
            switch(tierName.toLowerCase()) {
              case 'free': return 1;
              case 'freelancer': return 2;
              case 'organisation': return 3;
              case 'enterprise': return 4;
              case 'kanbax': return 5;
              default: return 2; // Fallback zu Freelancer
            }
          };
          
          // Direktes API-Update durchführen
          const directUpdateResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/payments/direct-update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: userId,
              packageId: getPackageId(tier),
              billingCycle: billingCycle,
              sessionId: `auto_update_${Date.now()}`,
              forceDowngrade: true
            })
          });
          
          if (directUpdateResponse.ok) {
            const updateResult = await directUpdateResponse.json();
            console.log(`[SUBSCRIPTION AUTO] ✅ Direktes Update erfolgreich:`, updateResult);
            return res.status(200).json({
              success: true,
              message: "Abonnement erfolgreich aktualisiert über direktes Update",
              tier: tier,
              billingCycle: billingCycle,
              ...updateResult
            });
          } else {
            console.error(`[SUBSCRIPTION AUTO] ❌ Direktes Update fehlgeschlagen, Status:`, directUpdateResponse.status);
            // Bei Fehler weiter mit normalem Prozess
          }
        } catch (directError) {
          console.error(`[SUBSCRIPTION AUTO] ❌ Fehler beim direkten Update:`, directError);
          // Bei Fehler weiter mit normalem Prozess
        }
      }
      
      if (!tier) {
        return res.status(400).json({ message: "Keine Abonnement-Stufe angegeben" });
      }

      // Prüfen, ob die Abonnement-Stufe gültig ist
      const packageExists = await db.query.subscriptionPackages.findFirst({
        where: and(
          eq(subscriptionPackages.name, tier),
          eq(subscriptionPackages.isActive, true)
        )
      });

      if (!packageExists) {
        return res.status(400).json({ message: "Ungültige Abonnement-Stufe" });
      }

      // Benutzer-Informationen abrufen
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) {
        return res.status(404).json({ message: "Benutzer nicht gefunden" });
      }

      // Erstelle einen Checkout-Link für den Abonnementwechsel
      // Diese Funktion kündigt das alte Abonnement und erstellt ein neues mit Checkout-URL
      const result = await stripeService.switchSubscription(userId, tier, billingCycle);

      if (!result.success) {
        console.error(`Fehler beim Erstellen des Checkout-Links für Benutzer ${userId}`);
        return res.status(500).json({ 
          message: "Fehler beim Erstellen des Zahlungslinks für das Abonnement",
          error: "Stripe-Integration fehlgeschlagen" 
        });
      }
      
      console.log(`Checkout-Prozess initiiert für Benutzer ${userId}`);
      
      // Wenn wir einen Checkout-Link haben, geben wir diesen zurück
      if (result.checkoutUrl) {
        console.log(`Checkout-URL erstellt für Benutzer ${userId}: ${result.checkoutUrl}`);
        
        return res.json({
          success: true,
          message: "Bitte schließen Sie den Zahlungsvorgang bei Stripe ab",
          checkoutUrl: result.checkoutUrl,
          requiresPayment: true
        });
      } 
      // Wenn kein Checkout-Link erstellt wurde, aber es trotzdem erfolgreich war, 
      // dann wurde nur die Datenbank aktualisiert (Fallback ohne Stripe)
      else {
        console.log(`Nur Datenbank für Benutzer ${userId} aktualisiert, ohne Stripe-Integration`);
        
        // Direktes Update des Benutzers, falls kein Stripe-Checkout benötigt wird
        try {
          // Abrechnungszyklus normalisieren
          const normalizedBillingCycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
          
          // Angepasste Ablaufzeit basierend auf dem Abrechnungszyklus
          const expirationPeriod = normalizedBillingCycle === 'yearly' 
            ? 365 * 24 * 60 * 60 * 1000  // 1 Jahr in Millisekunden
            : 30 * 24 * 60 * 60 * 1000;  // 30 Tage in Millisekunden
          
          // Ablaufdatum und Tier normalisieren
          const expirationDate = tier.toLowerCase() === 'free' 
            ? null 
            : new Date(Date.now() + expirationPeriod);
          
          console.log(`[DIRECT-USER-UPDATE] Aktualisiere Benutzer ${userId} auf Tier ${tier.toLowerCase()} mit Ablaufdatum: ${expirationDate}`);
          
          // Benutzer in der Datenbank aktualisieren
          await db.update(users)
            .set({
              subscriptionTier: tier.toLowerCase(),
              subscriptionBillingCycle: normalizedBillingCycle,
              subscriptionExpiresAt: expirationDate,
              updatedAt: new Date()
            })
            .where(eq(users.id, userId));
          
          console.log(`[DIRECT-USER-UPDATE] Benutzer ${userId} erfolgreich aktualisiert`);
        } catch (userUpdateError) {
          console.error(`[DIRECT-USER-UPDATE] Fehler beim Aktualisieren des Benutzers ${userId}:`, userUpdateError);
          // Trotz Fehler fortfahren, um das Firmenabonnement zu aktualisieren
        }
        
        // Wenn der Benutzer zu einer Firma gehört und Firmenadmin ist, aktualisiere das Firmen-Abonnement
        if (user.companyId && user.isCompanyAdmin) {
          // Übergebe den Billing-Zyklus direkt an die Service-Funktion
          const success = await subscriptionService.updateSubscription(user.companyId, tier, userId, billingCycle);
          
          if (!success) {
            return res.status(500).json({ message: "Fehler beim Aktualisieren des Firmen-Abonnements" });
          }
          
          // Explicit Logging
          console.log(`✓ [BILLING_CYCLE] Update für Firma ${user.companyId}: Zyklus gesetzt auf ${billingCycle}`);
          
          return res.json({ 
            success: true,
            message: "Firmen-Abonnement erfolgreich aktualisiert", 
            requiresPayment: false
          });
        } 
        // Ansonsten aktualisiere das persönliche Abonnement des Benutzers
        else {
          // Billingzyklus direkt an die Service-Funktion übergeben
          const success = await subscriptionService.updateUserSubscriptionTier(userId, tier, userId, billingCycle);
          
          if (!success) {
            return res.status(500).json({ message: "Fehler beim Aktualisieren des Benutzer-Abonnements" });
          }
          
          // Explicit Logging
          console.log(`✓ [BILLING_CYCLE] Update für Benutzer ${userId}: Zyklus gesetzt auf ${billingCycle}`);
          
          return res.json({ 
            success: true,
            message: "Benutzer-Abonnement erfolgreich aktualisiert",
            requiresPayment: false
          });
        }
      }
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Abonnements:", error);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Abonnements" });
    }
  });

  /**
   * Aktualisiert das Abonnement des Unternehmens (nur für Admins)
   */
  app.post("/api/subscription/update", requireCompanyAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      
      if (!user?.companyId) {
        return res.status(400).json({ message: "Benutzer ist keinem Unternehmen zugeordnet" });
      }

      const { tier } = req.body;
      if (!tier) {
        return res.status(400).json({ message: "Keine Abo-Stufe angegeben" });
      }

      // Prüfen, ob die Abo-Stufe gültig ist
      const packageExists = await db.query.subscriptionPackages.findFirst({
        where: and(
          eq(subscriptionPackages.name, tier),
          eq(subscriptionPackages.isActive, true)
        )
      });

      if (!packageExists) {
        return res.status(400).json({ message: "Ungültige Abo-Stufe" });
      }

      // Billingzyklus bekommen (falls vorhanden)
      const billingCycle = req.body.billingCycle || 'monthly';
      
      // Abonnement aktualisieren mit billing cycle
      const success = await subscriptionService.updateSubscription(user.companyId, tier, userId, billingCycle);

      if (!success) {
        return res.status(500).json({ message: "Fehler beim Aktualisieren des Abonnements" });
      }

      res.json({ message: "Abonnement erfolgreich aktualisiert" });
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Abonnements:", error);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Abonnements" });
    }
  });

  /**
   * Prüft ob eine Nutzungsbeschränkung erreicht wurde
   */
  app.get("/api/subscription/check-limit/:limitType", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      
      console.log(`DEBUG Limit-Check: Benutzer ${userId} prüft Limit für ${req.params.limitType}`);
      console.log(`DEBUG Limit-Check: Benutzer Daten:`, user);
      
      let hasReachedLimit = false;
      const limitType = req.params.limitType;

      if (user?.companyId) {
        // Mit Firma: Company-basierte Limitprüfung
        switch (limitType) {
          case "projects":
            hasReachedLimit = await subscriptionService.hasReachedProjectLimit(user.companyId);
            break;
          case "boards":
            hasReachedLimit = await subscriptionService.hasReachedBoardLimit(user.companyId);
            break;
          case "teams":
            hasReachedLimit = await subscriptionService.hasReachedTeamLimit(user.companyId);
            break;
          case "users":
            hasReachedLimit = await subscriptionService.hasReachedUserLimit(user.companyId);
            break;
          default:
            return res.status(400).json({ message: "Ungültiger Limit-Typ" });
        }
      } else {
        // Ohne Firma: Direkte Zählung für einzelne Benutzer
        const subscriptionTier = user?.subscriptionTier || "free";
        
        // Paketinformationen aus der Datenbank laden
        const packageInfo = await db.query.subscriptionPackages.findFirst({
          where: eq(subscriptionPackages.name, subscriptionTier)
        });
        
        if (!packageInfo) {
          return res.status(500).json({ message: "Fehler: Paketinformationen nicht gefunden" });
        }
        
        console.log(`DEBUG Limit-Check: Benutzer ${userId} hat Paket ${subscriptionTier} mit folgenden Limits:`, {
          maxProjects: packageInfo.maxProjects,
          maxBoards: packageInfo.maxBoards,
          maxTeams: packageInfo.maxTeams,
          maxTasks: packageInfo.maxTasks
        });
        
        if (limitType === "boards") {
          const boardCountResult = await db.execute(
            sql`SELECT COUNT(*) as count FROM boards WHERE creator_id = ${userId} AND archived = false`
          );
          const boardCount = parseInt(String(boardCountResult.rows[0]?.count) || "0");
          console.log(`DEBUG Limit-Check: Benutzer ${userId} hat ${boardCount} persönliche Boards`);
          
          // Limits aus Paketdefinition verwenden
          const maxBoards = packageInfo.maxBoards || 0;
          
          hasReachedLimit = boardCount >= maxBoards;
          console.log(`DEBUG Limit-Check: Limit erreicht? ${hasReachedLimit} (${boardCount}/${maxBoards})`);
        } 
        else if (limitType === "projects") {
          const projectCountResult = await db.execute(
            sql`SELECT COUNT(*) as count FROM projects WHERE creator_id = ${userId} AND archived = false`
          );
          const projectCount = parseInt(String(projectCountResult.rows[0]?.count) || "0");
          console.log(`DEBUG Limit-Check: Benutzer ${userId} hat ${projectCount} persönliche Projekte`);
          
          // Limits aus Paketdefinition verwenden
          const maxProjects = packageInfo.maxProjects || 0;
          
          hasReachedLimit = projectCount >= maxProjects;
          console.log(`DEBUG Limit-Check: Projekt-Limit erreicht? ${hasReachedLimit} (${projectCount}/${maxProjects})`);
        }
        else if (limitType === "tasks") {
          const taskCountResult = await db.execute(
            sql`SELECT COUNT(*) as count FROM tasks WHERE assigned_user_ids && ARRAY[${userId}]`
          );
          const taskCount = parseInt(String(taskCountResult.rows[0]?.count) || "0");
          console.log(`DEBUG Limit-Check: Benutzer ${userId} hat ${taskCount} persönliche Aufgaben`);
          
          // Limits aus Paketdefinition verwenden
          const maxTasks = packageInfo.maxTasks || 0;
          
          hasReachedLimit = taskCount >= maxTasks;
          console.log(`DEBUG Limit-Check: Aufgaben-Limit erreicht? ${hasReachedLimit} (${taskCount}/${maxTasks})`);
        }
        else {
          console.log(`DEBUG Limit-Check: Für Einzelnutzer ohne Firma nicht relevant: ${limitType}`);
        }
      }

      console.log(`DEBUG Limit-Check: Antwort -> hasReachedLimit = ${hasReachedLimit}`);
      res.json({ hasReachedLimit });
    } catch (error) {
      console.error(`Fehler beim Prüfen des Limits (${req.params.limitType}):`, error);
      res.status(500).json({ message: "Fehler beim Prüfen des Limits" });
    }
  });

  /**
   * Prüft ob ein Feature verfügbar ist
   */
  app.get("/api/subscription/check-feature/:featureName", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      
      if (!user?.companyId) {
        // Für Benutzer ohne Unternehmen: Prüfen des Abonnements des Benutzers
        const userSubscriptionTier = user?.subscriptionTier || "free";
        
        // Paketinformationen aus der Datenbank laden
        const packageInfo = await db.query.subscriptionPackages.findFirst({
          where: eq(subscriptionPackages.name, userSubscriptionTier)
        });
        
        if (!packageInfo) {
          return res.status(500).json({ message: "Fehler: Paketinformationen nicht gefunden" });
        }
        
        const featureName = req.params.featureName;
        let hasAccess = false;
        
        // Prüfen, welches Feature angefragt wird
        switch (featureName) {
          case "gantt_view":
            hasAccess = packageInfo.hasGanttView ?? false;
            break;
          case "advanced_reporting":
            hasAccess = packageInfo.hasAdvancedReporting ?? false;
            break;
          case "api_access":
            hasAccess = packageInfo.hasApiAccess ?? false;
            break;
          case "custom_branding":
            hasAccess = packageInfo.hasCustomBranding ?? false;
            break;
          case "priority_support":
            hasAccess = packageInfo.hasPrioritySupport ?? false;
            break;
          default:
            return res.status(400).json({ message: "Ungültiger Feature-Typ" });
        }
        
        return res.json({ hasAccess });
      }

      const featureName = req.params.featureName;
      const hasAccess = await subscriptionService.hasFeatureAccess(user.companyId, featureName);

      res.json({ hasAccess });
    } catch (error) {
      console.error(`Fehler beim Prüfen des Features (${req.params.featureName}):`, error);
      res.status(500).json({ message: "Fehler beim Prüfen des Features" });
    }
  });
  
  /**
   * Gibt die aktuelle Ressourcennutzung für ein Unternehmen zurück
   */
  app.get("/api/subscription/usage", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      
      // Für Benutzer ohne Unternehmen: Persönliche Nutzung zählen
      if (!user?.companyId) {
        // Persönliche Boards des Benutzers zählen
        const boardCountResult = await db.execute(
          sql`SELECT COUNT(*) as count FROM boards 
              WHERE creator_id = ${userId} 
              AND archived = false`
        );
        const boardCount = parseInt(String(boardCountResult.rows[0]?.count) || "0");
        
        // Persönliche Projekte des Benutzers zählen
        const projectCountResult = await db.execute(
          sql`SELECT COUNT(*) as count FROM projects 
              WHERE creator_id = ${userId} 
              AND archived = false`
        );
        const projectCount = parseInt(String(projectCountResult.rows[0]?.count) || "0");
        
        // Persönliche Teams - nicht möglich ohne Firma
        const teamCount = 0;
        
        // Persönliche Benutzer - nur der Benutzer selbst
        const userCount = 1;
        
        return res.json({
          projectCount,
          boardCount,
          teamCount,
          userCount
        });
      }

      // Anzahl der Projekte abrufen
      const projectCountResult = await db
        .select({ count: count() })
        .from(projects)
        .where(eq(projects.companyId, user.companyId));
      const projectCount = projectCountResult[0]?.count || 0;

      // Boards abrufen (über die Benutzer des Unternehmens)
      const companyUsers = await db.query.users.findMany({
        where: eq(users.companyId, user.companyId)
      });
      const userIds = companyUsers.map(u => u.id);

      let boardCount = 0;
      if (userIds.length > 0) {
        const userIdsStr = userIds.join(',');
        const boardCountResult = await db.execute(
          sql`SELECT COUNT(*) as count FROM boards 
              WHERE creator_id IN (${sql.raw(userIdsStr)}) 
              AND archived = false`
        );
        boardCount = parseInt(String(boardCountResult.rows[0]?.count) || "0");
      }

      // Teams abrufen
      const teamCountResult = await db
        .select({ count: count() })
        .from(teams)
        .where(eq(teams.companyId, user.companyId));
      const teamCount = teamCountResult[0]?.count || 0;

      // Aktive Benutzer abrufen
      const userCountResult = await db
        .select({ count: count() })
        .from(users)
        .where(and(
          eq(users.companyId, user.companyId),
          eq(users.isActive, true)
        ));
      const userCount = userCountResult[0]?.count || 0;

      res.json({
        projectCount,
        boardCount,
        teamCount,
        userCount
      });
    } catch (error) {
      console.error("Fehler beim Abrufen der Nutzungsdaten:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Nutzungsdaten" });
    }
  });

  /**
   * Admin-Route: Gibt alle Abonnements zurück
   */
  app.get("/api/admin/subscriptions", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      // Suche alle Abonnements mit Firmeninformationen
      const subscriptions = await db.query.companyPaymentInfo.findMany();
      
      // Firmeninformationen für jedes Abonnement abrufen
      const enrichedSubscriptions = await Promise.all(
        subscriptions.map(async (subscription) => {
          if (subscription.companyId) {
            const company = await db.query.companies.findFirst({
              where: eq(schema.companies.id, subscription.companyId)
            });
            
            return {
              ...subscription,
              companyName: company?.name || "Unbekannte Firma"
            };
          }
          
          return {
            ...subscription,
            companyName: "Unbekannte Firma"
          };
        })
      );
      
      res.json(enrichedSubscriptions);
    } catch (error) {
      console.error("Fehler beim Abrufen der Abonnements:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Abonnements" });
    }
  });

  /**
   * Admin-Route: Gibt alle Abonnement-Pakete zurück und ermöglicht Bearbeitung
   */
  app.get("/api/admin/subscription-packages", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const packages = await db.query.subscriptionPackages.findMany();
      res.json(packages);
    } catch (error) {
      console.error("Fehler beim Abrufen der Abonnement-Pakete:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Abonnement-Pakete" });
    }
  });

  /**
   * Admin-Route: Aktualisiert ein Abonnement-Paket
   */
  app.patch("/api/admin/subscription-packages/:id", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const packageId = parseInt(req.params.id);
      const packageData = req.body;
      
      // Einige Felder dürfen nicht geändert werden
      const { name, createdAt, updatedAt, ...updateData } = packageData;

      await db.update(subscriptionPackages)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(subscriptionPackages.id, packageId));
      
      res.json({ message: "Abonnement-Paket erfolgreich aktualisiert" });
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Abonnement-Pakets:", error);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Abonnement-Pakets" });
    }
  });

  /**
   * Admin-Route: Setzt das Abonnement eines Unternehmens manuell
   */
  app.patch("/api/admin/company-subscription/:companyId", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const userId = req.session.userId!;
      const { tier } = req.body;
      
      if (!tier) {
        return res.status(400).json({ message: "Keine Abo-Stufe angegeben" });
      }

      // Prüfen, ob die Abo-Stufe gültig ist
      const packageExists = await db.query.subscriptionPackages.findFirst({
        where: eq(subscriptionPackages.name, tier)
      });

      if (!packageExists) {
        return res.status(400).json({ message: "Ungültige Abo-Stufe" });
      }

      // Abonnement aktualisieren
      const success = await subscriptionService.updateSubscription(companyId, tier, userId);

      if (!success) {
        return res.status(500).json({ message: "Fehler beim Aktualisieren des Abonnements" });
      }

      // Audit-Log hinzufügen
      await db.insert(subscriptionAuditLogs).values({
        companyId,
        userId,
        action: "admin_change",
        newTier: tier,
        details: "Abonnement manuell vom Admin geändert"
      });

      res.json({ message: "Abonnement erfolgreich aktualisiert" });
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Abonnements:", error);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Abonnements" });
    }
  });

  /**
   * Admin-Route: Gibt das Audit-Log eines Unternehmens zurück
   */
  app.get("/api/admin/subscription-audit/:companyId", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      // Nutzen wir ein SQL-Query ohne 'amount' Spalte
      const auditLogs = await db.select({
        id: subscriptionAuditLogs.id,
        companyId: subscriptionAuditLogs.companyId,
        userId: subscriptionAuditLogs.userId,
        changedByUserId: subscriptionAuditLogs.changedByUserId,
        action: subscriptionAuditLogs.action,
        oldTier: subscriptionAuditLogs.oldTier,
        newTier: subscriptionAuditLogs.newTier,
        details: subscriptionAuditLogs.details,
        stripeEventId: subscriptionAuditLogs.stripeEventId,
        createdAt: subscriptionAuditLogs.createdAt
      }).from(subscriptionAuditLogs)
        .where(eq(subscriptionAuditLogs.companyId, companyId))
        .orderBy(sql`${subscriptionAuditLogs.createdAt} DESC`);
      
      res.json(auditLogs);
    } catch (error) {
      console.error("Fehler beim Abrufen des Audit-Logs:", error);
      res.status(500).json({ message: "Fehler beim Abrufen des Audit-Logs" });
    }
  });
}

// Helfer zur Initialisierung der Standard-Abonnement-Pakete
export async function initializeSubscriptionPackages() {
  try {
    // Prüfen, ob bereits Pakete existieren
    const existingPackages = await db.query.subscriptionPackages.findMany();
    
    if (existingPackages.length === 0) {
      console.log("Initialisiere Standard-Abonnement-Pakete...");
      const defaultPackages = subscriptionService.getDefaultPackagesForDb();
      
      for (const pkg of defaultPackages) {
        await db.insert(subscriptionPackages).values({
          ...pkg,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      console.log("Standard-Abonnement-Pakete erfolgreich initialisiert.");
    }
  } catch (error) {
    console.error("Fehler bei der Initialisierung der Standard-Abonnement-Pakete:", error);
  }
}