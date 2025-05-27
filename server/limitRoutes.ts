import { Request, Response } from "express";
import { subscriptionService } from "./subscription-service";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm/expressions";
import { subscriptionPackages, users, companyPaymentInfo } from "../shared/schema";
import { requireAuth } from "./middleware/auth";

/**
 * Richtet Routen für Limit-Prüfungen ein
 * Diese Routen werden verwendet, um client-seitig zu prüfen, ob bestimmte Limits erreicht wurden
 * @param app Express-App
 */
export default function setupLimitRoutes(app: any) {

  /**
   * GET /api/limits/task-creation
   * Prüft, ob der aktuelle Benutzer das Limit für Aufgaben erreicht hat
   */
  app.get('/api/limits/task-creation', requireAuth, async (req: Request, res: Response) => {
    try {
      // Benutzer-ID aus der Auth-Middleware
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          message: "Nicht autorisiert. Bitte melden Sie sich an."
        });
      }

      // Benutzerinformationen abrufen, um die Firmen-ID zu erhalten
      const user = await db.query.users.findFirst({
        where: (users) => eq(users.id, userId)
      });

      if (!user) {
        return res.status(404).json({
          message: "Benutzer nicht gefunden."
        });
      }

      // Abonnement-Informationen abrufen
      const paymentInfo = await db.query.companyPaymentInfo.findFirst({
        where: (cp) => eq(cp.companyId, user.companyId || -1)
      });

      // Subscription-Tier bestimmen
      const subscriptionTier = paymentInfo?.subscriptionTier || "free";

      // Paket-Limits für das Abonnement abrufen
      const packageLimits = await db.query.subscriptionPackages.findFirst({
        where: (sp) => eq(sp.name, subscriptionTier)
      });

      // Wenn keine Paketlimits gefunden wurden, verwenden wir Standardwerte
      const maxTasks = packageLimits?.maxTasks || 10; // Standard für "free" Paket (10 Tasks)

      // Anzahl der dem Benutzer zugewiesenen Aufgaben abrufen
      // Da wir keine creator_id in der tasks-Tabelle haben, prüfen wir die zugewiesenen Tasks
      const taskCountResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM tasks WHERE ${userId} = ANY(assigned_user_ids)`
      );
      const currentCount = parseInt(String(taskCountResult.rows[0]?.count) || "0");

      // Überprüfen, ob das Paket unbegrenzt viele Tasks ermöglicht
      let limitReached = false;
      
      // Wenn maxTasks 999999 oder größer ist, betrachten wir es als "unbegrenzt"
      if (maxTasks < 999999) {
        limitReached = currentCount >= maxTasks;
      }
      
      // Logging für Debugging-Zwecke
      console.log(`Sending task limit response for user ${userId}: `, {
        limitReached, 
        currentCount,
        maxCount: maxTasks,
        plan: subscriptionTier
      });

      // Antwort zurückgeben
      return res.json({
        limitReached,
        currentPlan: subscriptionTier,
        currentCount,
        maxCount: maxTasks,
        nextTier: limitReached ? getNextTier(subscriptionTier) : null
      });
    } catch (error) {
      console.error('Fehler bei der Limit-Prüfung für Aufgaben:', error);
      return res.status(500).json({
        message: "Bei der Prüfung des Limits ist ein Fehler aufgetreten."
      });
    }
  });
}

/**
 * Hilfsfunktion zur Ermittlung des nächsten Tiers
 */
function getNextTier(currentTier: string): string {
  switch (currentTier.toLowerCase()) {
    case 'free':
      return 'freelancer';
    case 'freelancer':
      return 'organisation';
    case 'organisation':
      return 'enterprise';
    default:
      return 'enterprise';
  }
}