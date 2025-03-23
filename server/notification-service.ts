import { db } from "./db";
import { notifications, insertNotificationSchema, users, activityLogs } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

/**
 * Der Notification Service ist verantwortlich für die Erstellung und Verwaltung von Benachrichtigungen
 */
export class NotificationService {
  /**
   * Erstellt eine Benachrichtigung für einen Benutzer
   */
  async createNotification(userId: number, title: string, message: string, type: string, link: string): Promise<number> {
    try {
      // Validieren, dass der Typ ein gültiger Benachrichtigungstyp ist
      const validTypes = ["task", "board", "project", "team", "okr", "approval", "mention", "assignment", "general"];
      const validatedType = validTypes.includes(type) ? type : "general";
      
      const result = await db.insert(notifications)
        .values({
          userId,
          title,
          message,
          type: validatedType,
          link,
          read: false,
          createdAt: new Date()
        })
        .returning({ id: notifications.id });
      
      console.log(`Created notification ${result[0].id} for user ${userId} of type ${validatedType}`);
      return result[0].id;
    } catch (error) {
      console.error("Failed to create notification:", error);
      throw error;
    }
  }

  /**
   * Erstellt Benachrichtigungen basierend auf Aktivitätslogs
   */
  async processActivityLog(activityLogId: number): Promise<void> {
    try {
      // Holt den Aktivitätslog aus der Datenbank
      const [activityLog] = await db.select()
        .from(activityLogs)
        .where(eq(activityLogs.id, activityLogId));
      
      if (!activityLog || !activityLog.requiresNotification || activityLog.notificationSent) {
        return; // Keine Benachrichtigung erforderlich oder bereits gesendet
      }

      // Bestimme Empfänger basierend auf dem Typ der Aktivität
      const recipientUserIds: number[] = [];
      
      // Direkter Empfänger, falls vorhanden
      if (activityLog.targetUserId) {
        recipientUserIds.push(activityLog.targetUserId);
      }
      
      // Explizit definierte Benutzer
      if (activityLog.visibleToUsers && activityLog.visibleToUsers.length > 0) {
        recipientUserIds.push(...activityLog.visibleToUsers);
      }

      // Wenn keine Empfänger definiert sind, nichts tun
      if (recipientUserIds.length === 0) {
        return;
      }

      // Benachrichtigungstitel und Text basierend auf dem Aktivitätstyp erstellen
      let title = "Neue Benachrichtigung";
      let message = "Es gibt eine neue Aktivität für Sie.";
      let link = "/";
      let type = activityLog.notificationType || "general";
      
      // Wenn noch kein spezifischer Benachrichtigungstyp gesetzt ist, anhand der Aktivität bestimmen
      if (!type || type === "general") {
        switch (activityLog.action) {
          case "assign":
            type = "assignment";
            break;
          case "mention":
            type = "mention";
            break;
          case "approval":
            type = "approval";
            break;
        }
      }
      
      switch (activityLog.action) {
        case "create":
          title = "Neues Element erstellt";
          message = activityLog.details || "Ein neues Element wurde erstellt.";
          break;
        case "update":
          title = "Element aktualisiert";
          message = activityLog.details || "Ein Element wurde aktualisiert.";
          break;
        case "delete":
          title = "Element gelöscht";
          message = activityLog.details || "Ein Element wurde gelöscht.";
          break;
        case "assign":
          title = "Zuweisung";
          message = activityLog.details || "Ein Element wurde Ihnen zugewiesen.";
          break;
        case "mention":
          title = "Erwähnung";
          message = activityLog.details || "Sie wurden in einem Kommentar erwähnt.";
          break;
        case "comment":
          title = "Neuer Kommentar";
          message = activityLog.details || "Es gibt einen neuen Kommentar.";
          break;
        case "approval":
          title = "Freigabeanfrage";
          message = activityLog.details || "Eine Freigabe wird benötigt.";
          break;
      }
      
      // Link basierend auf dem betroffenen Element erstellen
      if (activityLog.taskId) {
        link = `/tasks/${activityLog.taskId}`;
        if (type === "general") type = "task";
      } else if (activityLog.boardId) {
        link = `/boards/${activityLog.boardId}`;
        if (type === "general") type = "board";
      } else if (activityLog.projectId) {
        link = `/projects/${activityLog.projectId}`;
        if (type === "general") type = "project";
      } else if (activityLog.objectiveId) {
        link = `/objectives/${activityLog.objectiveId}`;
        if (type === "general") type = "okr";
      } else if (activityLog.teamId) {
        link = `/teams/${activityLog.teamId}`;
        if (type === "general") type = "team";
      }
      
      // Benachrichtigungen für alle Empfänger erstellen
      const uniqueRecipientIds = [...new Set(recipientUserIds)];
      
      for (const recipientId of uniqueRecipientIds) {
        // Keine Benachrichtigung für den Ersteller der Aktivität
        if (recipientId === activityLog.userId) continue;
        
        await this.createNotification(recipientId, title, message, type, link);
      }
      
      // Aktivitätslog als verarbeitet markieren
      await db.update(activityLogs)
        .set({ notificationSent: true })
        .where(eq(activityLogs.id, activityLogId));
        
    } catch (error) {
      console.error("Failed to process activity log for notifications:", error);
    }
  }

  /**
   * Erstellt Benachrichtigungen für alle unverarbeiteten Aktivitätslogs
   */
  async processAllPendingActivityLogs(): Promise<void> {
    try {
      // Prüfen, ob die Spalten existieren
      const checkColumnsExist = async () => {
        try {
          await db.execute(sql`SELECT requires_notification, notification_sent FROM activity_logs LIMIT 1`);
          return true;
        } catch (error) {
          console.warn("Activity logs notification columns may not exist yet:", error);
          return false;
        }
      };
      
      // Nur fortfahren, wenn die Spalten existieren
      if (await checkColumnsExist()) {
        const pendingLogs = await db.select({ id: activityLogs.id })
          .from(activityLogs)
          .where(and(
            eq(activityLogs.requiresNotification, true),
            eq(activityLogs.notificationSent, false)
          ));
        
        for (const log of pendingLogs) {
          await this.processActivityLog(log.id);
        }
      } else {
        console.log("Skipping notification processing, columns not ready");
      }
    } catch (error) {
      console.error("Failed to process pending activity logs:", error);
    }
  }
}

export const notificationService = new NotificationService();