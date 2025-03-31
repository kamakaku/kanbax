import type { Express, Request, Response } from "express";
import { db, pool } from "./db";
import { storage } from "./storage";
import { 
  objectives, keyResults, okrComments, okrCycles,
  insertObjectiveSchema, insertKeyResultSchema, insertOkrCommentSchema, insertOkrCycleSchema
} from "@shared/schema";
import { eq, and } from 'drizzle-orm';
import { requireAuth } from './middleware/auth';
import * as schema from '@shared/schema'; //Import schema explicitly


export function registerOkrRoutes(app: Express) {
  // Objective als Favorit markieren oder Favorit entfernen
  app.patch("/api/objectives/:id/favorite", requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Objective-ID" });
    }

    try {
      const userId = req.userId!;
      console.log(`Toggling favorite for objective ${id} by user ${userId}`);
      
      const objective = await storage.toggleObjectiveFavorite(userId, id);
      
      // Activity log erstellen
      await storage.createActivityLog({
        action: objective.isFavorite ? "favorite" : "unfavorite",
        details: objective.isFavorite ? "Objective als Favorit markiert" : "Objective aus Favoriten entfernt",
        userId: userId,
        objectiveId: id,
        taskId: null,
        boardId: null,
        projectId: null,
        teamId: null,
        targetUserId: null
      });
      
      res.json(objective);
    } catch (error) {
      console.error("Error toggling objective favorite:", error);
      res.status(500).json({ message: "Fehler beim Ändern des Favoriten-Status" });
    }
  });
  // Single Objective Endpoint
  app.get("/api/objectives/:id", requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Objective-ID" });
    }

    try {
      // Holen Sie die Benutzer-ID aus dem Authentifizierungskontext
      const userId = req.userId!;
      console.log(`Fetching objective with ID: ${id} for user: ${userId}`);

      // Prüfen Sie die Berechtigung des Benutzers für dieses Objective
      const hasAccess = await storage.permissionService.canAccessObjective(userId, id);
      if (!hasAccess) {
        console.log(`User ${userId} does not have permission to access objective ${id}`);
        return res.status(403).json({ message: "Keine Berechtigung für dieses Objective" });
      }

      // First get the objective
      const [objective] = await db.select()
        .from(objectives)
        .where(eq(objectives.id, id));

      if (!objective) {
        console.log(`No objective found with ID: ${id}`);
        return res.status(404).json({ message: "Objective nicht gefunden" });
      }

      // Prüfen, ob das Objective ein Favorit des aktuellen Benutzers ist
      const favorites = await db
        .select()
        .from(schema.userFavoriteObjectives)
        .where(and(
          eq(schema.userFavoriteObjectives.userId, userId),
          eq(schema.userFavoriteObjectives.objectiveId, objective.id)
        ));
      
      const isFavorite = favorites.length > 0;


      // Personalisierter Favoriten-Status hinzufügen
      const objectiveWithFavorite = {
        ...objective,
        isFavorite: isFavorite
      };

      // Then get the cycle if it exists
      let cycle = null;
      if (objective.cycleId) {
        [cycle] = await db.select()
          .from(okrCycles)
          .where(eq(okrCycles.id, objective.cycleId));
      }

      // Load key results for this objective
      const objectiveKeyResults = await db.select()
        .from(keyResults)
        .where(eq(keyResults.objectiveId, id));

      // Calculate progress based on key results
      let progress = 0;
      if (objectiveKeyResults.length > 0) {
        const totalProgress = objectiveKeyResults.reduce((acc, kr) => {
          const krProgress = ((kr.currentValue || 0) / (kr.targetValue || 100)) * 100;
          return acc + krProgress;
        }, 0);
        progress = Math.round(totalProgress / objectiveKeyResults.length);
      }

      const response = {
        ...objectiveWithFavorite,
        cycle,
        progress,
        keyResults: objectiveKeyResults
      };

      console.log(`Successfully fetched objective and calculated progress: ${progress}%`);
      res.json(response);
    } catch (error) {
      console.error("Error fetching objective:", error);
      res.status(500).json({ message: "Fehler beim Abrufen des Objectives" });
    }
  });

  // Objectives Endpoint
  app.get("/api/objectives", requireAuth, async (req: Request, res: Response) => {
    try {
      // Holen Sie die Benutzer-ID aus dem Authentifizierungskontext
      const userId = req.userId!;
      console.log(`Fetching objectives for user: ${userId}`);

      // Holen Sie alle Objectives aus der Datenbank
      const allObjectives = await db.select().from(objectives);

      // Filtern Sie die Objectives basierend auf Berechtigungen
      const accessibleObjectivesPromises = allObjectives.map(async (objective) => {
        const hasAccess = await storage.permissionService.canAccessObjective(userId, objective.id);
        return hasAccess ? objective : null;
      });

      const accessibleObjectives = (await Promise.all(accessibleObjectivesPromises))
        .filter((objective): objective is typeof objectives.$inferSelect => objective !== null);

      console.log(`User ${userId} has access to ${accessibleObjectives.length} of ${allObjectives.length} objectives`);

      // Bereite die Daten für jedes zugängliche Objective auf
      const objectivesWithData = await Promise.all(
        accessibleObjectives.map(async (objective) => {
          const objectiveKeyResults = await db.select()
            .from(keyResults)
            .where(eq(keyResults.objectiveId, objective.id));

          const cycle = objective.cycleId 
            ? await db.query.okrCycles.findFirst({
                where: (cycles, { eq }) => eq(cycles.id, objective.cycleId!)
              })
            : null;

          // Prüfen, ob das Objective ein Favorit des aktuellen Benutzers ist
          const favorites = await db
            .select()
            .from(schema.userFavoriteObjectives)
            .where(and(
              eq(schema.userFavoriteObjectives.userId, userId),
              eq(schema.userFavoriteObjectives.objectiveId, objective.id)
            ));
          
          const isFavorite = favorites.length > 0;

          let progress = 0;
          if (objectiveKeyResults.length > 0) {
            const totalProgress = objectiveKeyResults.reduce((acc, kr) => {
              return acc + ((kr.currentValue || 0) / (kr.targetValue || 100)) * 100;
            }, 0);
            progress = Math.round(totalProgress / objectiveKeyResults.length);
          }

          return {
            ...objective,
            cycle,
            progress,
            isFavorite,
            keyResults: objectiveKeyResults
          };
        })
      );

      res.json(objectivesWithData);
    } catch (error) {
      console.error("Error fetching objectives:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Objectives" });
    }
  });

  // OKR Cycles Endpoints
  app.get("/api/okr-cycles", requireAuth, async (req: Request, res: Response) => {
    try {
      const cycles = await db.query.okrCycles.findMany({
        orderBy: (cycles, { desc }) => [desc(cycles.startDate)]
      });
      res.json(cycles);
    } catch (error) {
      console.error("Fehler beim Abrufen der OKR-Zyklen:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der OKR-Zyklen" });
    }
  });

  app.post("/api/okr-cycles", requireAuth, async (req: Request, res: Response) => {
    console.log("Received cycle data:", req.body); // Debug log

    const result = insertOkrCycleSchema.safeParse(req.body);
    if (!result.success) {
      console.error("Validation error:", result.error);
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const data = {
        ...result.data,
        startDate: new Date(result.data.startDate),
        endDate: new Date(result.data.endDate)
      };

      console.log("Processed cycle data:", data); // Debug log

      const [cycle] = await db.insert(okrCycles)
        .values(data)
        .returning({
          id: okrCycles.id,
          title: okrCycles.title,
          startDate: okrCycles.startDate,
          endDate: okrCycles.endDate,
          status: okrCycles.status
        });

      console.log("Created cycle:", cycle); // Debug log

      if (!cycle || !cycle.id) {
        console.error("No cycle or cycle ID returned from database");
        return res.status(500).json({ message: "Fehler beim Erstellen des OKR-Zyklus: Keine ID zurückgegeben" });
      }

      res.status(201).json(cycle);
    } catch (error) {
      console.error("Fehler beim Erstellen des OKR-Zyklus:", error);
      res.status(500).json({ message: "Fehler beim Erstellen des OKR-Zyklus" });
    }
  });

  // Objectives Endpunkte
  app.post("/api/objectives", requireAuth, async (req: Request, res: Response) => {
    const result = insertObjectiveSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      // Stelle sicher, dass der Ersteller auch in den userIds enthalten ist
      const userId = req.userId!;
      const userData = { ...result.data };
      
      // Wenn userIds nicht existiert, erstelle einen neuen Array
      if (!userData.userIds) {
        userData.userIds = [];
      }
      
      // Wenn Ersteller nicht in userIds enthalten ist, füge ihn hinzu
      if (!userData.userIds.includes(userId)) {
        userData.userIds.push(userId);
      }
      
      // Speichere mit den aktualisierten Daten
      const [objective] = await db.insert(objectives)
        .values(userData)
        .returning();

      // Get key results to calculate progress
      const objectiveKeyResults = await db.select()
        .from(keyResults)
        .where(eq(keyResults.objectiveId, objective.id));

      // Get cycle data
      let cycle = null;
      if (objective.cycleId) {
        [cycle] = await db.select()
          .from(okrCycles)
          .where(eq(okrCycles.id, objective.cycleId));
      }

      // Calculate initial progress
      let progress = 0;
      if (objectiveKeyResults.length > 0) {
        const totalProgress = objectiveKeyResults.reduce((acc, kr) => {
          return acc + ((kr.currentValue || 0) / (kr.targetValue || 100)) * 100;
        }, 0);
        progress = Math.round(totalProgress / objectiveKeyResults.length);
      }

      const response = {
        ...objective,
        cycle,
        progress,
        keyResults: objectiveKeyResults
      };

      // Erstelle einen Aktivitätslog für die Objective-Erstellung mit Benachrichtigungsflag
      const activityLog = await storage.createActivityLog({
        action: "create",
        details: "Neues OKR erstellt",
        userId: objective.creatorId,
        objectiveId: objective.id,
        projectId: objective.projectId || null,
        boardId: null,
        taskId: null,
        requiresNotification: true,
        notificationType: "okr_create"
      });
      
      // Benachrichtigungen für zugewiesene Benutzer erstellen
      if (objective.userIds && Array.isArray(objective.userIds)) {
        for (const assignedUserId of objective.userIds) {
          // Nicht den Ersteller selbst benachrichtigen
          if (assignedUserId === objective.creatorId) continue;
          
          await storage.createActivityLog({
            action: "assign",
            details: `Sie wurden dem OKR "${objective.title}" zugewiesen`,
            userId: objective.creatorId,
            targetUserId: assignedUserId,
            objectiveId: objective.id,
            projectId: objective.projectId || null,
            requiresNotification: true,
            notificationType: "assignment"
          });
        }
      }

      // Wenn Benutzer dem Objective zugewiesen wurden, erstelle für jeden Benutzer eine Zuweisungsbenachrichtigung
      if (objective.userIds && Array.isArray(objective.userIds) && objective.userIds.length > 0) {
        try {
          // Hole den Titel des Objectives für bessere Benachrichtigungen
          const objectiveTitle = objective.title;
          
          // Erstelle für jeden zugewiesenen Benutzer eine Benachrichtigung
          for (const assignedUserId of objective.userIds) {
            // Überspringe den Ersteller (keine Selbst-Benachrichtigungen)
            if (assignedUserId === objective.creatorId) continue;
            
            await storage.createActivityLog({
              action: "assign",
              details: `Sie wurden dem OKR "${objectiveTitle}" zugewiesen`,
              userId: objective.creatorId, // Wer hat die Zuweisung vorgenommen
              targetUserId: assignedUserId, // Wer wurde zugewiesen
              objectiveId: objective.id,
              projectId: objective.projectId || null,
              requiresNotification: true,
              notificationType: "assignment"
            });
          }
        } catch (error) {
          console.error("Fehler beim Erstellen der Zuweisungsbenachrichtigungen:", error);
          // Wir lassen den Fehler nicht die Antwort beeinflussen, sondern loggen ihn nur
        }
      }

      res.status(201).json(response);
    } catch (error) {
      console.error("Fehler beim Erstellen des Objective:", error);
      res.status(500).json({ message: "Fehler beim Erstellen des Objective" });
    }
  });

  app.patch("/api/objectives/:id", requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Objective-ID" });
    }

    try {
      // Holen Sie die Benutzer-ID aus dem Authentifizierungskontext
      const userId = req.userId!;
      console.log(`Updating objective with ID: ${id} by user: ${userId}`);

      // Prüfen Sie die Berechtigung des Benutzers für dieses Objective
      const hasAccess = await storage.permissionService.canAccessObjective(userId, id);
      if (!hasAccess) {
        console.log(`User ${userId} does not have permission to update objective ${id}`);
        return res.status(403).json({ message: "Keine Berechtigung zum Aktualisieren dieses Objectives" });
      }

      // Holen Sie das vorherige Objective, um Änderungen zu vergleichen
      const prevObjective = await db.select().from(objectives).where(eq(objectives.id, id));
      
      // Führe das Update durch
      const updated = await db.update(objectives)
        .set(req.body)
        .where(eq(objectives.id, id))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ message: "Objective nicht gefunden" });
      }
      
      // Aktivitätsprotokoll für die Aktualisierung erstellen
      await storage.createActivityLog({
        action: "update",
        details: "OKR aktualisiert",
        userId: userId,
        objectiveId: id,
        requiresNotification: true,
        notificationType: "okr_update"
      });
      
      // Überprüfe auf neue Benutzerzuweisungen
      if (req.body.userIds && Array.isArray(req.body.userIds)) {
        // Bestimme vorherige zugewiesene Benutzer
        const prevUserIds = prevObjective[0]?.userIds || [];
        
        // Finde neu hinzugefügte Benutzer (in req.body.userIds aber nicht in prevUserIds)
        const newUserIds: number[] = [];
        for (const uid of req.body.userIds) {
          if (!prevUserIds.includes(uid) && uid !== userId) {
            newUserIds.push(uid);
          }
        }
        
        // Hole den Titel des Objectives für bessere Benachrichtigungen
        const objectiveTitle = updated[0].title;
        
        // Erstelle für jeden neuen zugewiesenen Benutzer eine Benachrichtigung
        for (const newUserId of newUserIds) {
          await storage.createActivityLog({
            action: "assign",
            details: `Sie wurden dem OKR "${objectiveTitle}" zugewiesen`,
            userId: userId, // Wer hat die Zuweisung vorgenommen
            targetUserId: newUserId, // Wer wurde zugewiesen
            objectiveId: id,
            projectId: updated[0].projectId || null,
            requiresNotification: true,
            notificationType: "assignment"
          });
        }
      }
      
      res.json(updated[0]);
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Objective:", error);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Objective" });
    }
  });

  app.delete("/api/objectives/:id", requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Objective-ID" });
    }

    try {
      // Holen Sie die Benutzer-ID aus dem Authentifizierungskontext
      const userId = req.userId!;
      console.log(`Deleting objective with ID: ${id} by user: ${userId}`);

      // Prüfen Sie die Berechtigung des Benutzers für dieses Objective
      const hasAccess = await storage.permissionService.canAccessObjective(userId, id);
      if (!hasAccess) {
        console.log(`User ${userId} does not have permission to delete objective ${id}`);
        return res.status(403).json({ message: "Keine Berechtigung zum Löschen dieses Objectives" });
      }

      // Hole das Objective, bevor es gelöscht wird, um die zugewiesenen Benutzer zu benachrichtigen
      const objective = await db.select().from(objectives).where(eq(objectives.id, id));
      
      if (objective.length > 0) {
        const objectiveTitle = objective[0].title;
        const userIds = objective[0].userIds || [];
        
        // Lösche das Objective
        await db.delete(objectives).where(eq(objectives.id, id));
        
        // Aktivitätsprotokoll für das Löschen des Objectives mit Benachrichtigungsflag
        await storage.createActivityLog({
          action: "delete",
          details: "Objective gelöscht",
          userId: userId,
          objectiveId: id,
          taskId: null,
          boardId: null,
          projectId: null,
          requiresNotification: true,
          notificationType: "okr_delete"
        });
        
        // Benachrichtige zugewiesene Benutzer über das Löschen
        for (const assignedUserId of userIds) {
          // Überspringe den Benutzer, der die Löschung durchführt
          if (assignedUserId === userId) continue;
          
          await storage.createActivityLog({
            action: "delete",
            details: `Das OKR "${objectiveTitle}" wurde gelöscht`,
            userId: userId,
            targetUserId: assignedUserId,
            requiresNotification: true,
            notificationType: "okr_delete"
          });
        }
      } else {
        // Falls das Objective nicht gefunden wurde, lösche es einfach
        await db.delete(objectives).where(eq(objectives.id, id));
      }

      res.status(204).send();
    } catch (error) {
      console.error("Fehler beim Löschen des Objective:", error);
      res.status(500).json({ message: "Fehler beim Löschen des Objective" });
    }
  });

  // Key Results Endpunkte
  app.get("/api/objectives/:objectiveId/key-results", requireAuth, async (req: Request, res: Response) => {
    const objectiveId = parseInt(req.params.objectiveId);
    if (isNaN(objectiveId)) {
      return res.status(400).json({ message: "Ungültige Objective-ID" });
    }

    try {
      // Holen Sie die Benutzer-ID aus dem Authentifizierungskontext
      const userId = req.userId!;
      console.log(`Fetching key results for objective: ${objectiveId} by user: ${userId}`);

      // Prüfen Sie die Berechtigung des Benutzers für dieses Objective
      const hasAccess = await storage.permissionService.canAccessObjective(userId, objectiveId);
      if (!hasAccess) {
        console.log(`User ${userId} does not have permission to access objective ${objectiveId}'s key results`);
        return res.status(403).json({ message: "Keine Berechtigung für diese Key Results" });
      }

      const krs = await db.select().from(keyResults).where(eq(keyResults.objectiveId, objectiveId));
      // Parse checklistItems from JSON strings back to objects
      const processedKrs = krs.map(kr => ({
        ...kr,
        checklistItems: kr.checklistItems ? kr.checklistItems.map((item: string) => JSON.parse(item)) : [],
      }));
      res.json(processedKrs);
    } catch (error) {
      console.error("Fehler beim Abrufen der Key Results:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Key Results" });
    }
  });

  app.post("/api/objectives/:objectiveId/key-results", requireAuth, async (req: Request, res: Response) => {
    const objectiveId = parseInt(req.params.objectiveId);
    if (isNaN(objectiveId)) {
      return res.status(400).json({ message: "Ungültige Objective-ID" });
    }

    const payload = { ...req.body, objectiveId };
    const result = insertKeyResultSchema.safeParse(payload);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      // Stringify checklistItems before saving to database
      const data = {
        ...result.data,
        checklistItems: result.data.checklistItems?.map(item => JSON.stringify(item)) || [],
      };

      const [keyResult] = await db.insert(keyResults).values(data).returning({
        id: keyResults.id,
        title: keyResults.title,
        description: keyResults.description,
        objectiveId: keyResults.objectiveId,
        currentValue: keyResults.currentValue,
        targetValue: keyResults.targetValue,
        checklistItems: keyResults.checklistItems,
        createdAt: keyResults.createdAt,
        type: keyResults.type,
        status: keyResults.status
      });

      // Create activity log for new key result
      await storage.createActivityLog({
        action: "create",
        details: "Neues Key Result erstellt",
        userId: req.body.creatorId || 1,
        objectiveId: keyResult.objectiveId,
        taskId: null,
        boardId: null,
        projectId: null
      });

      // Parse checklistItems back to objects for response
      const response = {
        ...keyResult,
        checklistItems: keyResult.checklistItems?.map((item: string) => JSON.parse(item)) || [],
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Fehler beim Erstellen des Key Result:", error);
      res.status(500).json({ message: "Fehler beim Erstellen des Key Result" });
    }
  });

  app.patch("/api/key-results/:id", requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Key Result-ID" });
    }

    try {
      console.log("Updating key result with ID:", id);
      console.log("Original request data:", req.body);
      
      // Holen Sie zuerst das bestehende Key Result, um die objectiveId zu bekommen
      const getResult = await pool.query(
        `SELECT * FROM key_results WHERE id = $1`,
        [id]
      );
      
      if (getResult.rows.length === 0) {
        return res.status(404).json({ message: "Key Result nicht gefunden" });
      }
      
      const existingKeyResult = getResult.rows[0];
      
      // Erstellen Sie die SET-Klausel für das Update
      let setClause = [];
      let params = [];
      let paramCount = 1;
      
      if (req.body.title !== undefined) {
        setClause.push(`title = $${paramCount}`);
        params.push(req.body.title);
        paramCount++;
      }
      
      if (req.body.description !== undefined) {
        setClause.push(`description = $${paramCount}`);
        params.push(req.body.description);
        paramCount++;
      }
      
      if (req.body.targetValue !== undefined) {
        setClause.push(`target_value = $${paramCount}`);
        params.push(req.body.targetValue);
        paramCount++;
      }
      
      if (req.body.currentValue !== undefined) {
        setClause.push(`current_value = $${paramCount}`);
        params.push(req.body.currentValue);
        paramCount++;
      }
      
      if (req.body.type !== undefined) {
        setClause.push(`type = $${paramCount}`);
        params.push(req.body.type);
        paramCount++;
      }
      
      if (req.body.status !== undefined) {
        setClause.push(`status = $${paramCount}`);
        params.push(req.body.status);
        paramCount++;
      }
      
      // ChecklistItems benötigen Verarbeitung
      if (req.body.checklistItems !== undefined) {
        const checklistItemsJson = req.body.checklistItems.map((item: any) => JSON.stringify(item));
        setClause.push(`checklist_items = $${paramCount}`);
        params.push(checklistItemsJson);
        paramCount++;
      }
      
      // Wenn keine zu aktualisierenden Felder vorhanden sind, geben Sie das bestehende Key Result zurück
      if (setClause.length === 0) {
        // Parse checklistItems back to objects for response
        const response = {
          ...existingKeyResult,
          checklistItems: existingKeyResult.checklist_items ? 
            existingKeyResult.checklist_items.map((item: string) => JSON.parse(item)) : []
        };
        return res.json(response);
      }
      
      console.log("Update SET clause:", setClause.join(", "));
      console.log("Update params:", params);
      
      // Führen Sie das Update aus
      params.push(id);
      const updateQuery = `
        UPDATE key_results 
        SET ${setClause.join(", ")} 
        WHERE id = $${paramCount}
        RETURNING *
      `;
      
      const updateResult = await pool.query(updateQuery, params);
      const updated = updateResult.rows[0];
      
      // Activity log erstellen mit Benachrichtigungsflag
      await storage.createActivityLog({
        action: "update",
        details: "Key Result aktualisiert",
        userId: req.userId!,
        objectiveId: updated.objective_id,
        taskId: null,
        boardId: null,
        projectId: null,
        teamId: null,
        targetUserId: null,
        requiresNotification: true,
        notificationType: "okr_update"
      });
      
      // Konvertiere snake_case in camelCase für die Antwort
      const response = {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        objectiveId: updated.objective_id,
        currentValue: updated.current_value,
        targetValue: updated.target_value,
        type: updated.type,
        status: updated.status,
        createdAt: updated.created_at,
        checklistItems: updated.checklist_items ? 
          updated.checklist_items.map((item: string) => JSON.parse(item)) : []
      };
      
      res.json(response);
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Key Result:", error);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Key Result" });
    }
  });

  app.delete("/api/key-results/:id", requireAuth, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Key Result-ID" });
    }

    try {
      // Get the key result before deletion to access objectiveId
      const getResult = await pool.query(
        `SELECT * FROM key_results WHERE id = $1`,
        [id]
      );
      
      const keyResult = getResult.rows[0];

      if (keyResult) {
        // Delete the key result
        await pool.query(
          `DELETE FROM key_results WHERE id = $1`,
          [id]
        );

        // Create activity log for deleted key result
        await storage.createActivityLog({
          action: "delete",
          details: "Key Result gelöscht",
          userId: req.userId || req.body.deletedBy || 1,
          objectiveId: keyResult.objective_id,
          taskId: null,
          boardId: null,
          projectId: null,
          teamId: null,
          targetUserId: null,
          requiresNotification: true,
          notificationType: "okr_delete"
        });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Fehler beim Löschen des Key Result:", error);
      res.status(500).json({ message: "Fehler beim Löschen des Key Result" });
    }
  });

  // Comments Endpunkte
  app.get("/api/okr-comments", requireAuth, async (req: Request, res: Response) => {
    const { objectiveId, keyResultId } = req.query;

    try {
      // Verwende pool.query für direkte SQL-Abfragen
      let result;
      
      if (objectiveId && keyResultId) {
        result = await pool.query(
          `SELECT * FROM okr_comments WHERE objective_id = $1 AND key_result_id = $2`,
          [Number(objectiveId), Number(keyResultId)]
        );
      } else if (objectiveId) {
        result = await pool.query(
          `SELECT * FROM okr_comments WHERE objective_id = $1`,
          [Number(objectiveId)]
        );
      } else if (keyResultId) {
        result = await pool.query(
          `SELECT * FROM okr_comments WHERE key_result_id = $1`,
          [Number(keyResultId)]
        );
      } else {
        result = await pool.query(`SELECT * FROM okr_comments`);
      }
      
      res.json(result.rows || []);
    } catch (error) {
      console.error("Fehler beim Abrufen der Kommentare:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Kommentare" });
    }
  });

  app.post("/api/okr-comments", requireAuth, async (req: Request, res: Response) => {
    const result = insertOkrCommentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      // Verwende SQL anstelle des Drizzle Query Builders
      const { authorId, objectiveId, keyResultId, content } = result.data;
      
      const query = `
        INSERT INTO okr_comments (author_id, objective_id, key_result_id, content, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      
      const commentResult = await pool.query(query, [
        authorId,
        objectiveId || null,
        keyResultId || null,
        content
      ]);
      
      const comment = commentResult.rows?.[0];
      
      if (!comment) {
        throw new Error('Kommentar konnte nicht erstellt werden');
      }
      
      // Erzeuge eine Aktivitätslog mit Benachrichtigungsflag für den Kommentar
      await storage.createActivityLog({
        action: "comment",
        details: "Neuer OKR-Kommentar hinzugefügt",
        userId: authorId,
        objectiveId: objectiveId || null,
        requiresNotification: true,
        notificationType: "okr_comment"
      });
      
      res.status(201).json(comment);
    } catch (error) {
      console.error("Fehler beim Erstellen des Kommentars:", error);
      res.status(500).json({ message: "Fehler beim Erstellen des Kommentars" });
    }
  });

  // New endpoint to get all key results
  app.get("/api/key-results", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId!;
      console.log(`Fetching all key results for user: ${userId}`);

      // Holen Sie alle Key Results aus der Datenbank mit direktem SQL
      const keyResultsQuery = await pool.query(`
        SELECT kr.*, o.creator_id, o.company_id 
        FROM key_results kr
        JOIN objectives o ON kr.objective_id = o.id
      `);
      
      const allKeyResults = keyResultsQuery.rows || [];
      console.log(`Found ${allKeyResults.length} total key results`);

      // Für jedes KeyResult prüfen, ob der Benutzer Zugriff auf das zugehörige Objective hat
      // Anmerkung: Diese Berechtigungsprüfung könnte später optimiert werden
      const accessibleKeyResultsPromises = allKeyResults.map(async (kr) => {
        const hasAccess = await storage.permissionService.canAccessObjective(userId, kr.objective_id);
        return hasAccess ? kr : null;
      });

      const accessibleKeyResults = (await Promise.all(accessibleKeyResultsPromises))
        .filter((kr) => kr !== null);

      console.log(`User ${userId} has access to ${accessibleKeyResults.length} of ${allKeyResults.length} key results`);

      // Parse checklistItems from JSON strings back to objects
      // und konvertiere snake_case Spaltennamen zu camelCase für die Client API
      const processedKrs = accessibleKeyResults.map(kr => ({
        id: kr.id,
        title: kr.title,
        description: kr.description,
        objectiveId: kr.objective_id,
        currentValue: kr.current_value,
        targetValue: kr.target_value,
        createdAt: kr.created_at,
        type: kr.type,
        status: kr.status,
        checklistItems: kr.checklist_items ? kr.checklist_items.map((item: string) => JSON.parse(item)) : [],
      }));

      res.json(processedKrs);
    } catch (error) {
      console.error("Fehler beim Abrufen der Key Results:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Key Results" });
    }
  });
}