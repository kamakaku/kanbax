import type { Express, Request, Response } from "express";
import { db } from "./db";
import { 
  okrCycles, objectives, keyResults, okrComments,
  insertOkrCycleSchema, insertObjectiveSchema, 
  insertKeyResultSchema, insertOkrCommentSchema 
} from "@shared/schema";

export function registerOkrRoutes(app: Express) {
  // OKR-Zyklen Endpunkte
  app.get("/api/projects/:projectId/okr-cycles", async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Ungültige Projekt-ID" });
    }

    try {
      const cycles = await db.query.okrCycles.findMany({
        where: (okrCycles, { eq }) => eq(okrCycles.projectId, projectId)
      });
      res.json(cycles);
    } catch (error) {
      console.error("Fehler beim Abrufen der OKR-Zyklen:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der OKR-Zyklen" });
    }
  });

  app.post("/api/projects/:projectId/okr-cycles", async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Ungültige Projekt-ID" });
    }

    const result = insertOkrCycleSchema.safeParse({ ...req.body, projectId });
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      // Konvertiere die Datums-Strings in Date-Objekte
      const data = {
        ...result.data,
        startDate: new Date(result.data.startDate),
        endDate: new Date(result.data.endDate)
      };

      const [cycle] = await db.insert(okrCycles).values(data).returning();
      res.status(201).json(cycle);
    } catch (error) {
      console.error("Fehler beim Erstellen des OKR-Zyklus:", error);
      res.status(500).json({ message: "Fehler beim Erstellen des OKR-Zyklus" });
    }
  });

  // Objectives Endpunkte
  app.get("/api/okr-cycles/:cycleId/objectives", async (req: Request, res: Response) => {
    const cycleId = parseInt(req.params.cycleId);
    if (isNaN(cycleId)) {
      return res.status(400).json({ message: "Ungültige Zyklus-ID" });
    }

    try {
      const objectives = await db.select().from(objectives)
        .where(objectives.cycleId.eq(cycleId));
      res.json(objectives);
    } catch (error) {
      console.error("Fehler beim Abrufen der Objectives:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Objectives" });
    }
  });

  app.post("/api/okr-cycles/:cycleId/objectives", async (req: Request, res: Response) => {
    const cycleId = parseInt(req.params.cycleId);
    if (isNaN(cycleId)) {
      return res.status(400).json({ message: "Ungültige Zyklus-ID" });
    }

    const result = insertObjectiveSchema.safeParse({ ...req.body, cycleId });
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

  // Key Results Endpunkte
  app.get("/api/objectives/:objectiveId/key-results", async (req: Request, res: Response) => {
    const objectiveId = parseInt(req.params.objectiveId);
    if (isNaN(objectiveId)) {
      return res.status(400).json({ message: "Ungültige Objective-ID" });
    }

    try {
      const keyResults = await db.select().from(keyResults)
        .where(keyResults.objectiveId.eq(objectiveId));
      res.json(keyResults);
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

    const result = insertKeyResultSchema.safeParse({ ...req.body, objectiveId });
    if (!result.success) {
      return res.status(400).json({ message: result.error.message });
    }

    try {
      const [keyResult] = await db.insert(keyResults).values(result.data).returning();
      res.status(201).json(keyResult);
    } catch (error) {
      console.error("Fehler beim Erstellen des Key Result:", error);
      res.status(500).json({ message: "Fehler beim Erstellen des Key Result" });
    }
  });

  // Kommentare Endpunkte
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

  app.get("/api/okr-comments", async (req: Request, res: Response) => {
    const { objectiveId, keyResultId } = req.query;
    
    try {
      let query = db.select().from(okrComments);
      
      if (objectiveId) {
        query = query.where(okrComments.objectiveId.eq(Number(objectiveId)));
      }
      if (keyResultId) {
        query = query.where(okrComments.keyResultId.eq(Number(keyResultId)));
      }
      
      const comments = await query;
      res.json(comments);
    } catch (error) {
      console.error("Fehler beim Abrufen der Kommentare:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Kommentare" });
    }
  });
}