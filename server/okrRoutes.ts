import type { Express, Request, Response } from "express";
import { db } from "./db";
import { 
  objectives, keyResults, okrComments, okrCycles,
  insertObjectiveSchema, insertKeyResultSchema, insertOkrCommentSchema, insertOkrCycleSchema
} from "@shared/schema";
import { eq } from 'drizzle-orm';

export function registerOkrRoutes(app: Express) {
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
  app.get("/api/objectives", async (_req: Request, res: Response) => {
    try {
      const objectives = await db.query.objectives.findMany();
      res.json(objectives);
    } catch (error) {
      console.error("Fehler beim Abrufen der Objectives:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Objectives" });
    }
  });

  app.post("/api/objectives", async (req: Request, res: Response) => {
    const result = insertObjectiveSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const [objective] = await db.insert(objectives).values(result.data).returning();
      res.status(201).json(objective);
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
      await db.delete(keyResults).where(eq(keyResults.id, id));
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
}