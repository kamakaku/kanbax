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
        // Aufgaben
        "task", "task_update", "task_delete", "task_comment",
        // Protokolle
        "protocol", "protocol_update", "protocol_delete", "protocol_comment",
        // Boards
        "board", "board_update", 
        // Projekte
        "project", "project_update",
        // Teams 
        "team", "team_update",
        // OKRs
        "okr", "okr_update", "okr_delete", "okr_comment",
        // Allgemein
        "approval", "mention", "assignment", "comment", "general"
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
        `SELECT a.*, 
                b.title as board_title, 
                p.title as project_title,
                o.title as objective_title,
                t.title as task_title,
                tm.name as team_title,
                u.username, 
                u.company_id
         FROM activity_logs a
         LEFT JOIN boards b ON a.board_id = b.id
         LEFT JOIN projects p ON a.project_id = p.id
         LEFT JOIN objectives o ON a.objective_id = o.id
         LEFT JOIN tasks t ON a.task_id = t.id
         LEFT JOIN teams tm ON a.team_id = tm.id
         LEFT JOIN users u ON a.user_id = u.id
         WHERE a.id = $1`,
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
        teamId: activityLog.team_id,
        targetUserId: activityLog.target_user_id,
        commentId: activityLog.comment_id,
        keyResultId: activityLog.key_result_id,
        requiresNotification: activityLog.requires_notification,
        notificationSent: activityLog.notification_sent,
        notificationType: activityLog.notification_type,
        visibleToUsers: activityLog.visible_to_users || [],
        // Zusätzliche Informationen für bessere Benachrichtigungen
        boardTitle: activityLog.board_title,
        projectTitle: activityLog.project_title,
        objectiveTitle: activityLog.objective_title,
        taskTitle: activityLog.task_title,
        teamTitle: activityLog.team_title,
        username: activityLog.username,
        companyId: activityLog.company_id
      };

      if (activity.notificationSent) {
        return; // Nur prüfen ob bereits gesendet
      }

      // Bestimme Empfänger basierend auf dem Typ der Aktivität
      // Wir verwenden ein Set, um Duplikate zu vermeiden
      const recipientUserIds: Set<number> = new Set();

      // 1. Ziel-Benutzer hinzufügen (falls vorhanden)
      if (activity.targetUserId) {
        recipientUserIds.add(activity.targetUserId);
      }

      // 2. Explizit definierte Benutzer (falls vorhanden)
      if (activity.visibleToUsers && activity.visibleToUsers.length > 0) {
        activity.visibleToUsers.forEach((userId: number) => recipientUserIds.add(userId));
      }

      // 3. Relevante Benutzer basierend auf dem Aktivitätstyp hinzufügen
      try {
        // Fallback für fehlende Firmen-IDs: Wir markieren die Aktivität als verarbeitet 
        // und überspringen die Benachrichtigung, anstatt eine Warnung zu generieren
        const companyId = activity.companyId || 0;
        if (companyId <= 0) {
          // Aktivität als verarbeitet markieren und ohne Warnung beenden
          await pool.query(
            `UPDATE activity_logs SET notification_sent = true WHERE id = $1`,
            [activity.id]
          );
          return;
        }

        // Spezifische Abfragen basierend auf der Art der Aktivität

        // 3.1 Bei Tasks: Zugewiesene Benutzer und Board-Mitglieder benachrichtigen
        if (activity.taskId) {
          // Zugewiesene Benutzer (in Array-Form)
          const taskUsersResult = await pool.query(`
            SELECT assigned_user_ids FROM tasks 
            WHERE id = $1
          `, [activity.taskId]);

          // Verarbeite die Array-Spalte assigned_user_ids
          if (taskUsersResult.rows.length > 0 && taskUsersResult.rows[0].assigned_user_ids) {
            const assignedUserIds = taskUsersResult.rows[0].assigned_user_ids;
            assignedUserIds.forEach(userId => {
              if (userId) recipientUserIds.add(userId);
            });
          }

          // Wenn der Task mit einem Board verbunden ist, die Board-Mitglieder informieren
          if (activity.boardId) {
            const boardMembersResult = await pool.query(`
              SELECT user_id FROM board_members WHERE board_id = $1
            `, [activity.boardId]);

            boardMembersResult.rows.forEach(row => {
              recipientUserIds.add(row.user_id);
            });
          }
        }

        // 3.2 Bei Boards: Board-Mitglieder und Projekt-Team-Mitglieder benachrichtigen
        else if (activity.boardId) {
          // Board-Mitglieder
          const boardMembersResult = await pool.query(`
            SELECT bm.user_id
            FROM board_members bm
            JOIN users u ON bm.user_id = u.id
            WHERE bm.board_id = $1 AND u.company_id = $2
          `, [activity.boardId, companyId]);

          boardMembersResult.rows.forEach(row => {
            recipientUserIds.add(row.user_id);
          });

          // Board-Ersteller
          const boardCreatorResult = await pool.query(`
            SELECT creator_id FROM boards WHERE id = $1
          `, [activity.boardId]);

          if (boardCreatorResult.rows.length > 0 && boardCreatorResult.rows[0].creator_id) {
            recipientUserIds.add(boardCreatorResult.rows[0].creator_id);
          }

          // Wenn das Board mit einem Projekt verbunden ist, die Projekt-Team-Mitglieder informieren
          const boardProjectResult = await pool.query(`
            SELECT project_id FROM boards WHERE id = $1 AND project_id IS NOT NULL
          `, [activity.boardId]);

          if (boardProjectResult.rows.length > 0 && boardProjectResult.rows[0].project_id) {
            const projectId = boardProjectResult.rows[0].project_id;

            // Projekt-Team-Mitglieder
            const projectTeamMembersResult = await pool.query(`
              SELECT tm.user_id
              FROM project_teams pt
              JOIN team_members tm ON pt.team_id = tm.team_id
              JOIN users u ON tm.user_id = u.id
              WHERE pt.project_id = $1 AND u.company_id = $2
            `, [projectId, companyId]);

            projectTeamMembersResult.rows.forEach(row => {
              recipientUserIds.add(row.user_id);
            });
          }
        }

        // 3.3 Bei Projekten: Team-Mitglieder und Projektbeteiligte benachrichtigen
        else if (activity.projectId) {
          // Projekt-Team-Mitglieder
          const projectTeamMembersResult = await pool.query(`
            SELECT tm.user_id
            FROM project_teams pt
            JOIN team_members tm ON pt.team_id = tm.team_id
            JOIN users u ON tm.user_id = u.id
            WHERE pt.project_id = $1 AND u.company_id = $2
          `, [activity.projectId, companyId]);

          projectTeamMembersResult.rows.forEach(row => {
            recipientUserIds.add(row.user_id);
          });

          // Projekt-Ersteller
          const projectCreatorResult = await pool.query(`
            SELECT creator_id FROM projects WHERE id = $1
          `, [activity.projectId]);

          if (projectCreatorResult.rows.length > 0 && projectCreatorResult.rows[0].creator_id) {
            recipientUserIds.add(projectCreatorResult.rows[0].creator_id);
          }
        }

        // 3.4 Bei Objectives (OKRs): OKR-Mitglieder und OKR-Beteiligte benachrichtigen
        else if (activity.objectiveId) {
          // OKR-Mitglieder
          const objectiveMembersResult = await pool.query(`
            SELECT om.user_id
            FROM objective_members om
            JOIN users u ON om.user_id = u.id
            WHERE om.objective_id = $1 AND u.company_id = $2
          `, [activity.objectiveId, companyId]);

          objectiveMembersResult.rows.forEach(row => {
            recipientUserIds.add(row.user_id);
          });

          // OKR-Ersteller
          const objectiveCreatorResult = await pool.query(`
            SELECT creator_id FROM objectives WHERE id = $1
          `, [activity.objectiveId]);

          if (objectiveCreatorResult.rows.length > 0 && objectiveCreatorResult.rows[0].creator_id) {
            recipientUserIds.add(objectiveCreatorResult.rows[0].creator_id);
          }
        }

        // 3.5 Bei Protokollen: Protokoll-Teilnehmer benachrichtigen
        else if (activity.protocolId) {
          // Protokoll-Teilnehmer
          const protocolParticipantsResult = await pool.query(`
            SELECT participant_ids, team_participant_ids
            FROM meeting_protocols 
            WHERE id = $1
          `, [activity.protocolId]);

          if (protocolParticipantsResult.rows.length > 0) {
            const participantIds = protocolParticipantsResult.rows[0].participant_ids || [];
            participantIds.forEach(userId => {
              if (userId) recipientUserIds.add(userId);
            });

            // Team-Teilnehmer
            const teamIds = protocolParticipantsResult.rows[0].team_participant_ids || [];
            if (teamIds.length > 0) {
              const teamMembersResult = await pool.query(`
                SELECT DISTINCT tm.user_id
                FROM team_members tm
                WHERE tm.team_id = ANY($1)
              `, [teamIds]);

              teamMembersResult.rows.forEach(row => {
                recipientUserIds.add(row.user_id);
              });
            }
          }
        }
        
        // 3.6 Bei Teams: Team-Mitglieder benachrichtigen
        else if (activity.teamId) {
          // Team-Mitglieder
          const teamMembersResult = await pool.query(`
            SELECT tm.user_id
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = $1 AND u.company_id = $2
          `, [activity.teamId, companyId]);

          teamMembersResult.rows.forEach(row => {
            recipientUserIds.add(row.user_id);
          });
        }

        // Wenn der Aktivitätstyp ein Kommentar ist, auch den Ersteller des kommentierten Elements informieren
        if (activity.action === "comment" && activity.commentId) {
          // Bei Task-Kommentaren - Da die Tasks-Tabelle keine creator_id hat,
          // benachrichtigen wir hier alle zugewiesenen Benutzer
          if (activity.taskId) {
            const taskResult = await pool.query(`
              SELECT assigned_user_ids, board_id FROM tasks WHERE id = $1
            `, [activity.taskId]);

            if (taskResult.rows.length > 0) {
              // Die boardId speichern, damit wir später zum Board verlinken können
              if (taskResult.rows[0].board_id) {
                activity.boardId = taskResult.rows[0].board_id;
              }

              // Alle zugewiesenen Benutzer benachrichtigen
              if (taskResult.rows[0].assigned_user_ids) {
                const assignedUserIds = taskResult.rows[0].assigned_user_ids;
                assignedUserIds.forEach(userId => {
                  if (userId) recipientUserIds.add(userId);
                });
              }
            }
          }

          // Bei OKR-Kommentaren
          else if (activity.objectiveId) {
            const objectiveCreatorResult = await pool.query(`
              SELECT creator_id FROM objectives WHERE id = $1
            `, [activity.objectiveId]);

            if (objectiveCreatorResult.rows.length > 0 && objectiveCreatorResult.rows[0].creator_id) {
              recipientUserIds.add(objectiveCreatorResult.rows[0].creator_id);
            }
          }
        }

      } catch (error) {
        console.error("Fehler beim Ermitteln der Benachrichtigungsempfänger:", error);
      }

      // 4. Selbst-Benachrichtigungen vermeiden (Benutzer sollten nicht über ihre eigenen Aktionen benachrichtigt werden)
      if (activity.userId && recipientUserIds.has(activity.userId)) {
        recipientUserIds.delete(activity.userId);
      }

      // Wenn keine Empfänger gefunden wurden, beenden wir hier
      if (recipientUserIds.size === 0) {
        console.log(`Keine Empfänger für Aktivität ${activity.id} gefunden.`);

        // Markiere trotzdem als verarbeitet
        await pool.query(
          `UPDATE activity_logs SET notification_sent = true WHERE id = $1`,
          [activity.id]
        );

        return;
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
          // Aufgaben-Benachrichtigungen
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
          case "task_comment":
            title = "Neuer Kommentar zur Aufgabe";
            message = activity.details || "Es gibt einen neuen Kommentar zu einer Aufgabe.";
            break;

          // Board-Benachrichtigungen
          case "board":
            title = "Board-Aktualisierung";
            message = activity.details || "Ein Board wurde aktualisiert.";
            break;
          case "board_update":
            title = "Board-Update";
            message = activity.details || "Ein Board wurde aktualisiert.";
            break;

          // Protokoll-Benachrichtigungen
          case "protocol":
            title = "Neues Protokoll";
            message = activity.details || "Ein neues Protokoll wurde erstellt.";
            break;
          case "protocol_update":
            title = "Protokoll aktualisiert";
            message = activity.details || "Ein Protokoll wurde aktualisiert.";
            break;
          case "protocol_delete":
            title = "Protokoll gelöscht";
            message = activity.details || "Ein Protokoll wurde gelöscht.";
            break;
          case "protocol_comment":
            title = "Neuer Protokoll-Kommentar";
            message = activity.details || "Es gibt einen neuen Kommentar zu einem Protokoll.";
            break;

          // Projekt-Benachrichtigungen
          case "project":
            title = "Projekt-Aktualisierung";
            message = activity.details || "Ein Projekt wurde aktualisiert.";
            break;
          case "project_update":
            title = "Projekt-Update";
            message = activity.details || "Ein Projekt wurde aktualisiert.";
            break;

          // Team-Benachrichtigungen
          case "team":
            title = "Team-Aktualisierung";
            message = activity.details || "Ein Team wurde aktualisiert.";
            break;
          case "team_update":
            title = "Team-Update";
            message = activity.details || "Ein Team wurde aktualisiert.";
            break;

          // OKR-Benachrichtigungen
          case "okr":
            title = "OKR-Aktualisierung";
            message = activity.details || "Ein OKR wurde aktualisiert.";
            break;
          case "okr_update":
            title = "OKR-Update";
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

          // Allgemeine Benachrichtigungen
          case "comment":
            title = "Neuer Kommentar";
            message = activity.details || "Es gibt einen neuen Kommentar.";
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
      // Für Tasks verwenden wir immer den Link zum übergeordneten Board, um 404-Fehler zu vermeiden
      if (activity.taskId) {
        // Wenn nur taskId vorhanden ist, aber keine boardId, müssen wir die boardId erst aus der Datenbank ermitteln
        if (!activity.boardId) {
          try {
            const boardResult = await pool.query(
              'SELECT board_id FROM tasks WHERE id = $1',
              [activity.taskId]
            );
            
            if (boardResult.rows.length > 0 && boardResult.rows[0].board_id) {
              // Setze die boardId in der Aktivität, damit sie auch in späteren Abfragen verfügbar ist
              activity.boardId = boardResult.rows[0].board_id;
            }
          } catch (error) {
            console.error(`Failed to get board_id for task ${activity.taskId}:`, error);
          }
        }
        
        // Wenn wir jetzt eine boardId haben (entweder bereits vorher oder gerade abgefragt),
        // dann verlinken wir zum Board
        if (activity.boardId) {
          link = `/boards/${activity.boardId}`;
          if (type === "general") type = "task";
        } else {
          // Notfall-Fallback zur Startseite, falls keine boardId gefunden wurde
          link = "/";
          console.warn(`Warning: No board_id found for task ${activity.taskId}, using home page as fallback link`);
        }
      } else if (activity.boardId) {
        link = `/boards/${activity.boardId}`;
        if (type === "general") type = "board";
      } else if (activity.projectId) {
        link = `/projects/${activity.projectId}`;
        if (type === "general") type = "project";
      } else if (activity.objectiveId) {
        link = `/all-okrs/${activity.objectiveId}`;
        if (type === "general") type = "okr";
      } else if (activity.protocolId) {
        if (activity.projectId) {
          link = `/projects/${activity.projectId}/protocols/${activity.protocolId}`;
        } else if (activity.teamId) {
          link = `/teams/${activity.teamId}/protocols/${activity.protocolId}`;
        } else {
          link = `/protocols/${activity.protocolId}`;
        }
        if (type === "general") type = "protocol";
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
   * Optimiert für Serverstart: Verzögert die Verarbeitung und begrenzt die Anzahl 
   */
  async processAllPendingActivityLogs(): Promise<void> {
    try {
      console.log("Notification processing optimiert: Server startet schneller");
      
      // Verarbeite alte Benachrichtigungen verzögert im Hintergrund
      setTimeout(async () => {
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
            // Limitiere die Anzahl der zu verarbeitenden Logs für bessere Performance
            // Verarbeite nur die neuesten 20 Logs
            const pendingLogsResult = await pool.query(`
              SELECT id FROM activity_logs 
              WHERE requires_notification = true AND notification_sent = false
              ORDER BY id DESC LIMIT 20
            `);
            
            console.log(`Verarbeite ${pendingLogsResult.rows.length} neueste unverarbeitete Benachrichtigungen`);
    
            // Markiere alle älteren Logs als verarbeitet, ohne sie zu verarbeiten
            await pool.query(`
              UPDATE activity_logs 
              SET notification_sent = true 
              WHERE requires_notification = true 
              AND notification_sent = false 
              AND id NOT IN (
                SELECT id FROM activity_logs 
                WHERE requires_notification = true AND notification_sent = false
                ORDER BY id DESC LIMIT 20
              )
            `);
    
            // Verarbeite nur die neuesten 20 Logs
            for (const log of pendingLogsResult.rows) {
              await this.processActivityLog(log.id);
            }
          } else {
            console.log("Skipping notification processing, columns not ready");
          }
        } catch (error) {
          console.error("Failed to process pending activity logs in background:", error);
        }
      }, 10000); // Verzögert die Verarbeitung um 10 Sekunden nach Serverstart
      
      console.log("Benachrichtigungsverarbeitung wird verzögert für schnelleren Serverstart");
      
    } catch (error) {
      console.error("Failed to setup delayed notification processing:", error);
    }
  }
}

export const notificationService = new NotificationService();