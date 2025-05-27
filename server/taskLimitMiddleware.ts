import { Request, Response, NextFunction } from "express";
import { subscriptionService } from "./subscription-service";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Middleware zur Überprüfung des Task-Limits, bevor ein neuer Task erstellt werden kann
 */
export async function checkTaskLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;
    const user = await storage.getUser(userId, userId);

    if (!user.companyId) {
      // Bei Nutzern ohne Firma ein Limit von 10 Tasks anwenden (Free Plan)
      // Tasks haben keine creator_id - verwende assigned_user_ids stattdessen
      const taskCountResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM tasks WHERE assigned_user_ids && ARRAY[${userId}]`
      );
      const taskCount = parseInt(String(taskCountResult.rows[0]?.count) || "0");
      
      if (taskCount >= 10) { // 10 Tasks für kostenlose Nutzer
        return res.status(403).json({ 
          message: "Aufgaben-Limit erreicht", 
          details: "Das Aufgaben-Limit (10) für Ihr kostenloses Abonnement wurde erreicht. Bitte upgraden Sie Ihr Abonnement, um weitere Aufgaben zu erstellen.",
          limitReached: true,
          currentPlan: "free"
        });
      }
    } else {
      // Firmenbezogene Prüfung
      const hasReachedLimit = await subscriptionService.hasReachedTaskLimit(user.companyId);
      
      if (hasReachedLimit) {
        const plan = await subscriptionService.getCurrentSubscriptionName(user.companyId);
        return res.status(403).json({ 
          message: "Aufgaben-Limit erreicht", 
          details: "Das Aufgaben-Limit für Ihr Abonnement wurde erreicht. Bitte upgraden Sie Ihr Abonnement, um weitere Aufgaben zu erstellen.",
          limitReached: true,
          currentPlan: plan || "free"
        });
      }
    }
    
    // Wenn das Limit nicht erreicht wurde, fahre mit dem nächsten Middleware fort
    next();
  } catch (error) {
    console.error("Error checking task limit:", error);
    // Bei Fehlern erlauben wir die Task-Erstellung
    next();
  }
}

/**
 * Route zum Prüfen des Task-Limits ohne einen Task zu erstellen
 */
export async function checkTaskLimitRoute(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const user = await storage.getUser(userId, userId);

    if (!user.companyId) {
      // Bei Nutzern ohne Firma ein Limit von 10 Tasks anwenden (Free Plan)
      // Tasks haben keine creator_id - verwende assigned_user_ids stattdessen
      const taskCountResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM tasks WHERE assigned_user_ids && ARRAY[${userId}]`
      );
      const taskCount = parseInt(String(taskCountResult.rows[0]?.count) || "0");
      const limitReached = taskCount >= 10; // 10 Tasks für kostenlose Nutzer
      return res.json({ limitReached, currentPlan: "free" });
    }

    const hasReachedLimit = await subscriptionService.hasReachedTaskLimit(user.companyId);
    const plan = await subscriptionService.getCurrentSubscriptionName(user.companyId);

    res.json({ limitReached: hasReachedLimit, currentPlan: plan || "free" });
  } catch (error) {
    console.error("Error checking task limit:", error);
    res.status(500).json({ message: "Fehler bei der Überprüfung des Aufgaben-Limits" });
  }
}