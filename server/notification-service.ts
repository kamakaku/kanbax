import { db, pool } from "./db";
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
      const validTypes = [
        "task", "board", "project", "team", "okr", "approval", "mention", "assignment", "general",
        "comment", "okr_update", "okr_delete", "okr_comment", "task_update", "task_delete"
      ];
      const validatedType = validTypes.includes(type) ? type : "general";
      
      // Benachrichtigung mit Raw-SQL erstellen
      const result = await pool.query(
        `INSERT INTO notifications 
        (user_id, title, message, type, link, read, created_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id`,
        [userId, title, message, validatedType, link, false, new Date()]
      );
      
      const notificationId = result.rows[0].id;
      console.log(`Created notification ${notificationId} for user ${userId} of type ${validatedType}`);
      return notificationId;
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
      // Aktivitätslog mit Raw-SQL abfragen
      const activityLogResult = await pool.query(
        `SELECT * FROM activity_logs WHERE id = $1`,
        [activityLogId]
      );
      
      if (activityLogResult.rows.length === 0) {
        console.log(`Kein Aktivitätslog mit ID ${activityLogId} gefunden.`);
        return;
      }
      
      const activityLog = activityLogResult.rows[0];
      
      // Konvertiere Spalten von snake_case zu camelCase - mit korrekter Prüfung auf fehlende Spalten
      const activity = {
        id: activityLog.id,
        userId: activityLog.user_id,
        action: activityLog.action,
        details: activityLog.details,
        boardId: activityLog.board_id,
        projectId: activityLog.project_id,
        objectiveId: activityLog.objective_id,
        taskId: activityLog.task_id,
        // Diese Spalten existieren nicht in der Datenbank, daher setzen wir Default-Werte
        teamId: 0,
        targetUserId: 0,
        requiresNotification: activityLog.requires_notification,
        notificationSent: activityLog.notification_sent,
        notificationType: activityLog.notification_type,
        visibleToUsers: activityLog.visible_to_users || []
      };
      
      if (!activity.requiresNotification || activity.notificationSent) {
        return; // Keine Benachrichtigung erforderlich oder bereits gesendet
      }

      // Bestimme Empfänger basierend auf dem Typ der Aktivität
      const recipientUserIds: number[] = [];
      
      // Explizit definierte Benutzer (falls vorhanden)
      if (activity.visibleToUsers && activity.visibleToUsers.length > 0) {
        recipientUserIds.push(...activity.visibleToUsers);
      }

      // Wenn keine Empfänger definiert sind, finden wir Benutzer, die an diesem Board/Projekt/OKR arbeiten
      if (recipientUserIds.length === 0) {
        // Wenn es ein Board betrifft, holen wir uns die zugewiesenen Benutzer
        if (activity.boardId) {
          const boardUsersResult = await pool.query(
            `SELECT user_id FROM board_members WHERE board_id = $1`,
            [activity.boardId]
          );
          recipientUserIds.push(...boardUsersResult.rows.map(r => r.user_id));
        }
        // Wenn es ein Projekt betrifft, holen wir uns Team-Mitglieder
        else if (activity.projectId) {
          const projectTeamsResult = await pool.query(
            `SELECT team_id FROM project_teams WHERE project_id = $1`,
            [activity.projectId]
          );
          const teamIds = projectTeamsResult.rows.map(r => r.team_id);
          
          if (teamIds.length > 0) {
            const teamMembersResult = await pool.query(
              `SELECT user_id FROM team_members WHERE team_id = ANY($1)`,
              [teamIds]
            );
            recipientUserIds.push(...teamMembersResult.rows.map(r => r.user_id));
          }
        }
        // Wenn es ein OKR (Objective) betrifft, holen wir die zugewiesenen Benutzer
        else if (activity.objectiveId) {
          try {
            // Zuerst prüfen, ob die Tabelle "objective_members" existiert
            const tableExistsResult = await pool.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'objective_members'
              )
            `);
            
            if (tableExistsResult.rows[0].exists) {
              // Benutzer mit direkter Zuweisung zum Objective holen
              const objectiveMembersResult = await pool.query(
                `SELECT user_id FROM objective_members WHERE objective_id = $1`,
                [activity.objectiveId]
              );
              recipientUserIds.push(...objectiveMembersResult.rows.map(r => r.user_id));
              
              // Auch den Ersteller des Objectives hinzufügen, der immer benachrichtigt werden sollte
              const objectiveCreatorResult = await pool.query(
                `SELECT creator_id FROM objectives WHERE id = $1`,
                [activity.objectiveId]
              );
              
              if (objectiveCreatorResult.rows.length > 0 && objectiveCreatorResult.rows[0].creator_id) {
                recipientUserIds.push(objectiveCreatorResult.rows[0].creator_id);
              }
            }
          } catch (error) {
            console.warn("Fehler beim Abrufen der Objective-Mitglieder:", error);
          }
        }
      }

      // Wenn immer noch keine Empfänger definiert sind, nehmen wir nur den Ersteller
      if (recipientUserIds.length === 0) {
        // Nur Benachrichtigung für den Ersteller, wenn er sich selbst explizit benachrichtigen will
        if (activity.action === "create" || activity.action === "update") {
          return;
        }
      }

      // Benachrichtigungstitel und Text basierend auf dem Aktivitätstyp erstellen
      let title = "Neue Benachrichtigung";
      let message = "Es gibt eine neue Aktivität für Sie.";
      let link = "/";
      let type = activity.notificationType || "general";
      
      // Wenn noch kein spezifischer Benachrichtigungstyp gesetzt ist, anhand der Aktivität bestimmen
      if (!type || type === "general") {
        switch (activity.action) {
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
      
      // Benachrichtigungsnachrichten basierend auf dem spezifischen Benachrichtigungstyp anpassen
      if (activity.notificationType) {
        switch (activity.notificationType) {
          case "task":
            title = "Aufgabenaktualisierung";
            message = activity.details || "Eine Aufgabe wurde aktualisiert.";
            break;
          case "task_update":
            title = "Aufgabenaktualisierung";
            message = activity.details || "Eine Aufgabe wurde aktualisiert.";
            break;
          case "task_delete":
            title = "Aufgabe gelöscht";
            message = activity.details || "Eine Aufgabe wurde gelöscht.";
            break;
          case "comment":
            title = "Neuer Kommentar";
            message = activity.details || "Es gibt einen neuen Kommentar zu einer Aufgabe.";
            break;
          case "okr_update":
            title = "OKR aktualisiert";
            message = activity.details || "Ein Key Result wurde aktualisiert.";
            break;
          case "okr_delete":
            title = "OKR gelöscht";
            message = activity.details || "Ein Key Result wurde gelöscht.";
            break;
          case "okr_comment":
            title = "Neuer OKR-Kommentar";
            message = activity.details || "Es gibt einen neuen Kommentar zu einem OKR.";
            break;
          case "assignment":
            title = "Neue Zuweisung";
            message = activity.details || "Ihnen wurde ein Element zugewiesen.";
            break;
          case "mention":
            title = "Erwähnung";
            message = activity.details || "Sie wurden in einem Kommentar erwähnt.";
            break;
          case "approval":
            title = "Freigabeanfrage";
            message = activity.details || "Eine Freigabe wird benötigt.";
            break;
          default:
            // Fallback auf die action-basierte Logik, wenn kein spezifischer Typ erkannt wird
            switch (activity.action) {
              case "create":
                title = "Neues Element erstellt";
                message = activity.details || "Ein neues Element wurde erstellt.";
                break;
              case "update":
                title = "Element aktualisiert";
                message = activity.details || "Ein Element wurde aktualisiert.";
                break;
              case "delete":
                title = "Element gelöscht";
                message = activity.details || "Ein Element wurde gelöscht.";
                break;
              case "assign":
                title = "Zuweisung";
                message = activity.details || "Ein Element wurde Ihnen zugewiesen.";
                break;
              case "mention":
                title = "Erwähnung";
                message = activity.details || "Sie wurden in einem Kommentar erwähnt.";
                break;
              case "comment":
                title = "Neuer Kommentar";
                message = activity.details || "Es gibt einen neuen Kommentar.";
                break;
              case "approval":
                title = "Freigabeanfrage";
                message = activity.details || "Eine Freigabe wird benötigt.";
                break;
            }
        }
      } else {
        // Fallback auf action-basierte Benachrichtigungen, wenn kein notificationType vorhanden ist
        switch (activity.action) {
          case "create":
            title = "Neues Element erstellt";
            message = activity.details || "Ein neues Element wurde erstellt.";
            break;
          case "update":
            title = "Element aktualisiert";
            message = activity.details || "Ein Element wurde aktualisiert.";
            break;
          case "delete":
            title = "Element gelöscht";
            message = activity.details || "Ein Element wurde gelöscht.";
            break;
          case "assign":
            title = "Zuweisung";
            message = activity.details || "Ein Element wurde Ihnen zugewiesen.";
            break;
          case "mention":
            title = "Erwähnung";
            message = activity.details || "Sie wurden in einem Kommentar erwähnt.";
            break;
          case "comment":
            title = "Neuer Kommentar";
            message = activity.details || "Es gibt einen neuen Kommentar.";
            break;
          case "approval":
            title = "Freigabeanfrage";
            message = activity.details || "Eine Freigabe wird benötigt.";
            break;
        }
      }
      
      // Link basierend auf dem betroffenen Element erstellen
      if (activity.taskId) {
        link = `/tasks/${activity.taskId}`;
        if (type === "general") type = "task";
      } else if (activity.boardId) {
        link = `/boards/${activity.boardId}`;
        if (type === "general") type = "board";
      } else if (activity.projectId) {
        link = `/projects/${activity.projectId}`;
        if (type === "general") type = "project";
      } else if (activity.objectiveId) {
        link = `/objectives/${activity.objectiveId}`;
        if (type === "general") type = "okr";
      } else {
        // Kein gültiger Link vorhanden, verwenden wir die Startseite
        link = "/";
      }
      
      // Benachrichtigungen für alle Empfänger erstellen
      // Array in Set umwandeln und wieder zurück, um Duplikate zu entfernen
      const uniqueRecipientIds = Array.from(new Set(recipientUserIds));
      
      for (const recipientId of uniqueRecipientIds) {
        // Keine Benachrichtigung für den Ersteller der Aktivität
        if (recipientId === activity.userId) continue;
        
        await this.createNotification(recipientId, title, message, type, link);
      }
      
      // Aktivitätslog als verarbeitet markieren
      await pool.query(
        `UPDATE activity_logs SET notification_sent = true WHERE id = $1`,
        [activityLogId]
      );
        
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
          const result = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'activity_logs' 
            AND column_name IN ('requires_notification', 'notification_sent')
          `);
          return result.rows.length === 2;
        } catch (error) {
          console.warn("Activity logs notification columns may not exist yet:", error);
          return false;
        }
      };
      
      // Nur fortfahren, wenn die Spalten existieren
      if (await checkColumnsExist()) {
        const pendingLogsResult = await pool.query(`
          SELECT id FROM activity_logs 
          WHERE requires_notification = true AND notification_sent = false
        `);
        
        for (const log of pendingLogsResult.rows) {
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