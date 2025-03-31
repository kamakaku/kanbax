import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { requireAuth } from "./middleware/auth";
import { insertMeetingProtocolSchema } from "@shared/schema";
import { notificationService } from "./notification-service";

export function registerProtocolRoutes(app: Express) {
  // Routen für Protokolle

  // GET /api/protocols/team/:teamId - Protokolle für ein Team abrufen
  app.get("/api/protocols/team/:teamId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId as number;
      const teamId = parseInt(req.params.teamId);
      
      const protocols = await storage.getMeetingProtocolsByTeam(userId, teamId);
      res.json(protocols);
    } catch (error: any) {
      console.error("Error fetching team protocols:", error);
      res.status(400).json({ message: error.message || "Fehler beim Abrufen der Protokolle" });
    }
  });

  // GET /api/protocols/project/:projectId - Protokolle für ein Projekt abrufen
  app.get("/api/protocols/project/:projectId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId as number;
      const projectId = parseInt(req.params.projectId);
      
      const protocols = await storage.getMeetingProtocolsByProject(userId, projectId);
      res.json(protocols);
    } catch (error: any) {
      console.error("Error fetching project protocols:", error);
      res.status(400).json({ message: error.message || "Fehler beim Abrufen der Protokolle" });
    }
  });

  // GET /api/protocols/objective/:objectiveId - Protokolle für ein Objective abrufen
  app.get("/api/protocols/objective/:objectiveId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId as number;
      const objectiveId = parseInt(req.params.objectiveId);
      
      const protocols = await storage.getMeetingProtocolsByObjective(userId, objectiveId);
      res.json(protocols);
    } catch (error: any) {
      console.error("Error fetching objective protocols:", error);
      res.status(400).json({ message: error.message || "Fehler beim Abrufen der Protokolle" });
    }
  });

  // GET /api/protocols/:id - Ein spezifisches Protokoll abrufen
  app.get("/api/protocols/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId as number;
      const protocolId = parseInt(req.params.id);
      
      const protocol = await storage.getMeetingProtocol(userId, protocolId);
      res.json(protocol);
    } catch (error: any) {
      console.error("Error fetching protocol:", error);
      res.status(400).json({ message: error.message || "Fehler beim Abrufen des Protokolls" });
    }
  });

  // POST /api/protocols - Neues Protokoll erstellen
  app.post("/api/protocols", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId as number;
      
      // Stellt sicher, dass die creatorId gesetzt ist (entweder aus dem Request oder vom aktuellen Benutzer)
      if (!req.body.creatorId) {
        req.body.creatorId = userId;
      }
      
      // Wenn date als String kommt, konvertieren wir es zu einem Date-Objekt
      if (req.body.date && typeof req.body.date === 'string') {
        req.body.date = new Date(req.body.date);
      }
      
      // Daten validieren
      const validationResult = insertMeetingProtocolSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Ungültige Protokolldaten", 
          errors: validationResult.error.format() 
        });
      }
      
      // Sicherstellen, dass entweder teamId, projectId oder objectiveId gesetzt ist
      if (!validationResult.data.teamId && !validationResult.data.projectId && !validationResult.data.objectiveId) {
        return res.status(400).json({ 
          message: "Entweder teamId, projectId oder objectiveId muss angegeben werden" 
        });
      }
      
      const newProtocol = await storage.createMeetingProtocol(userId, validationResult.data);
      
      // Aktivitätslog erstellen
      const activityLog = await storage.createActivityLog({
        action: "create",
        details: "Neues Protokoll erstellt",
        userId: userId,
        requiresNotification: true,
        notificationType: "protocol",
        teamId: validationResult.data.teamId,
        projectId: validationResult.data.projectId,
        objectiveId: validationResult.data.objectiveId
      });

      // Benachrichtigungen verarbeiten
      await notificationService.processActivityLog(activityLog.id);

      res.status(201).json(newProtocol);
    } catch (error: any) {
      console.error("Error creating protocol:", error);
      res.status(400).json({ message: error.message || "Fehler beim Erstellen des Protokolls" });
    }
  });

  // PATCH /api/protocols/:id - Protokoll aktualisieren
  app.patch("/api/protocols/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId as number;
      const protocolId = parseInt(req.params.id);
      
      // Stellt sicher, dass die creatorId gesetzt ist (entweder aus dem Request oder vom aktuellen Benutzer)
      if (!req.body.creatorId) {
        req.body.creatorId = userId;
      }
      
      // Wenn date als String kommt, konvertieren wir es zu einem Date-Objekt
      if (req.body.date && typeof req.body.date === 'string') {
        req.body.date = new Date(req.body.date);
      }
      
      // Nur erlaubte Felder aktualisieren
      const updateData = insertMeetingProtocolSchema.partial().safeParse(req.body);
      
      if (!updateData.success) {
        return res.status(400).json({ 
          message: "Ungültige Protokolldaten", 
          errors: updateData.error.format() 
        });
      }
      
      const updatedProtocol = await storage.updateMeetingProtocol(userId, protocolId, updateData.data);
      
      // Aktivitätslog für Update erstellen
      const activityLog = await storage.createActivityLog({
        action: "update",
        details: "Protokoll aktualisiert",
        userId: userId,
        requiresNotification: true,
        notificationType: "protocol_update",
        teamId: updateData.data.teamId,
        projectId: updateData.data.projectId,
        objectiveId: updateData.data.objectiveId
      });

      await notificationService.processActivityLog(activityLog.id);

      res.json(updatedProtocol);
    } catch (error: any) {
      console.error("Error updating protocol:", error);
      res.status(400).json({ message: error.message || "Fehler beim Aktualisieren des Protokolls" });
    }
  });

  // DELETE /api/protocols/:id - Protokoll löschen
  app.delete("/api/protocols/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId as number;
      const protocolId = parseInt(req.params.id);
      
      const protocol = await storage.getMeetingProtocol(userId, protocolId);
      await storage.deleteMeetingProtocol(userId, protocolId);

      // Aktivitätslog für Löschung erstellen
      const activityLog = await storage.createActivityLog({
        action: "delete",
        details: "Protokoll gelöscht",
        userId: userId,
        requiresNotification: true,
        notificationType: "protocol_delete",
        teamId: protocol.teamId,
        projectId: protocol.projectId,
        objectiveId: protocol.objectiveId
      });

      await notificationService.processActivityLog(activityLog.id);

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting protocol:", error);
      res.status(400).json({ message: error.message || "Fehler beim Löschen des Protokolls" });
    }
  });
}