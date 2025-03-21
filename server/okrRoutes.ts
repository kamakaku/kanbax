import type { Express, Request, Response } from "express";
import { db } from "./db";
import { storage } from "./storage";
import { 
  objectives, keyResults, okrComments, okrCycles,
  insertObjectiveSchema, insertKeyResultSchema, insertOkrCommentSchema, insertOkrCycleSchema
} from "@shared/schema";
import { eq } from 'drizzle-orm';

export function registerOkrRoutes(app: Express) {
  // Single Objective Endpoint
  app.get("/api/objectives/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Objective-ID" });
    }

    try {
      console.log(`Fetching objective with ID: ${id}`);

      // First get the objective
      const [objective] = await db.select()
        .from(objectives)
        .where(eq(objectives.id, id));

      if (!objective) {
        console.log(`No objective found with ID: ${id}`);
        return res.status(404).json({ message: "Objective nicht gefunden" });
      }

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
        ...objective,
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
  app.get("/api/objectives", async (_req: Request, res: Response) => {
    try {
      const allObjectives = await db.select().from(objectives);

      const objectivesWithData = await Promise.all(
        allObjectives.map(async (objective) => {
          const objectiveKeyResults = await db.select()
            .from(keyResults)
            .where(eq(keyResults.objectiveId, objective.id));

          const cycle = objective.cycleId 
            ? await db.query.okrCycles.findFirst({
                where: (cycles, { eq }) => eq(cycles.id, objective.cycleId!)
              })
            : null;

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
  app.get("/api/okr-cycles", async (_req: Request, res: Response) => {
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

  app.post("/api/okr-cycles", async (req: Request, res: Response) => {
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
  app.post("/api/objectives", async (req: Request, res: Response) => {
    const result = insertObjectiveSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const [objective] = await db.insert(objectives)
        .values(result.data)
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

      const activityLog = await storage.createActivityLog({
        action: "create",
        details: "Neues OKR erstellt",
        userId: objective.creatorId,
        objectiveId: objective.id,
        projectId: objective.projectId || null,
        boardId: null,
        taskId: null
      });

      res.status(201).json(response);
    } catch (error) {
      console.error("Fehler beim Erstellen des Objective:", error);
      res.status(500).json({ message: "Fehler beim Erstellen des Objective" });
    }
  });

  app.patch("/api/objectives/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Objective-ID" });
    }

    try {
      const updated = await db.update(objectives)
        .set(req.body)
        .where(eq(objectives.id, id))
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ message: "Objective nicht gefunden" });
      }
      res.json(updated[0]);
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Objective:", error);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Objective" });
    }
  });

  app.delete("/api/objectives/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Objective-ID" });
    }

    try {
      await db.delete(objectives).where(eq(objectives.id, id));
      res.status(204).send();
    } catch (error) {
      console.error("Fehler beim Löschen des Objective:", error);
      res.status(500).json({ message: "Fehler beim Löschen des Objective" });
    }
  });

  // Key Results Endpunkte
  app.get("/api/objectives/:objectiveId/key-results", async (req: Request, res: Response) => {
    const objectiveId = parseInt(req.params.objectiveId);
    if (isNaN(objectiveId)) {
      return res.status(400).json({ message: "Ungültige Objective-ID" });
    }

    try {
      const krs = await db.select().from(keyResults).where(eq(keyResults.objectiveId, objectiveId));
      // Parse checklistItems from JSON strings back to objects
      const processedKrs = krs.map(kr => ({
        ...kr,
        checklistItems: kr.checklistItems ? kr.checklistItems.map(item => JSON.parse(item)) : [],
      }));
      res.json(processedKrs);
    } catch (error) {
      console.error("Fehler beim Abrufen der Key Results:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Key Results" });
    }
  });

  app.post("/api/objectives/:objectiveId/key-results", async (req: Request, res: Response) => {
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

      const [keyResult] = await db.insert(keyResults).values(data).returning();

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
        checklistItems: keyResult.checklistItems?.map(item => JSON.parse(item)) || [],
      };

      res.status(201).json(response);
    } catch (error) {
      console.error("Fehler beim Erstellen des Key Result:", error);
      res.status(500).json({ message: "Fehler beim Erstellen des Key Result" });
    }
  });

  app.patch("/api/key-results/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Key Result-ID" });
    }

    try {
      // If checklistItems is included in the update, stringify them
      const updateData = {
        ...req.body,
        checklistItems: req.body.checklistItems?.map(item => JSON.stringify(item)) || undefined,
      };

      const updated = await db.update(keyResults)
        .set(updateData)
        .where(eq(keyResults.id, id))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ message: "Key Result nicht gefunden" });
      }

      // Parse checklistItems back to objects for response
      // Create activity log for updated key result
      await storage.createActivityLog({
        action: "update",
        details: "Key Result aktualisiert",
        userId: req.body.updatedBy || 1,
        objectiveId: updated[0].objectiveId,
        taskId: null,
        boardId: null,
        projectId: null
      });

      const response = {
        ...updated[0],
        checklistItems: updated[0].checklistItems?.map(item => JSON.parse(item)) || [],
      };

      res.json(response);
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Key Result:", error);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Key Result" });
    }
  });

  app.delete("/api/key-results/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Ungültige Key Result-ID" });
    }

    try {
      // Get the key result before deletion to access objectiveId
      const [keyResult] = await db.select().from(keyResults).where(eq(keyResults.id, id));
      
      if (keyResult) {
        await db.delete(keyResults).where(eq(keyResults.id, id));
        
        // Create activity log for deleted key result
        await storage.createActivityLog({
          action: "delete",
          details: "Key Result gelöscht",
          userId: req.body.deletedBy || 1,
          objectiveId: keyResult.objectiveId,
          taskId: null,
          boardId: null,
          projectId: null
        });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Fehler beim Löschen des Key Result:", error);
      res.status(500).json({ message: "Fehler beim Löschen des Key Result" });
    }
  });

  // Comments Endpunkte
  app.get("/api/okr-comments", async (req: Request, res: Response) => {
    const { objectiveId, keyResultId } = req.query;

    try {
      let query = db.select().from(okrComments);
      if (objectiveId) {
        query = query.where(eq(okrComments.objectiveId, Number(objectiveId)));
      }
      if (keyResultId) {
        query = query.where(eq(okrComments.keyResultId, Number(keyResultId)));
      }
      const comments = await query;
      res.json(comments);
    } catch (error) {
      console.error("Fehler beim Abrufen der Kommentare:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Kommentare" });
    }
  });

  app.post("/api/okr-comments", async (req: Request, res: Response) => {
    const result = insertOkrCommentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const [comment] = await db.insert(okrComments).values(result.data).returning();
      res.status(201).json(comment);
    } catch (error) {
      console.error("Fehler beim Erstellen des Kommentars:", error);
      res.status(500).json({ message: "Fehler beim Erstellen des Kommentars" });
    }
  });

  // New endpoint to get all key results
  app.get("/api/key-results", async (_req: Request, res: Response) => {
    try {
      const krs = await db.select().from(keyResults);
      // Parse checklistItems from JSON strings back to objects
      const processedKrs = krs.map(kr => ({
        ...kr,
        checklistItems: kr.checklistItems ? kr.checklistItems.map(item => JSON.parse(item)) : [],
      }));
      res.json(processedKrs);
    } catch (error) {
      console.error("Fehler beim Abrufen der Key Results:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Key Results" });
    }
  });
}