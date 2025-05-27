import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { requireHyperAdmin } from "./middleware/auth";
import { companies, users } from "@shared/schema";
import { db } from "./db";

/**
 * Administrations-Routen für die Plattform
 * @param app Express-App
 * @param dbInstance Datenbank-Instanz (wird nicht verwendet, da wir db aus dem Modul importieren)
 */
export default function setupAdminRoutes(app: any, dbInstance: any) {
  
  /**
   * Admin-Route: Gibt alle Unternehmen zurück
   */
  app.get("/api/admin/companies", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const allCompanies = await db.query.companies.findMany({
        orderBy: (companies, { desc }) => [desc(companies.id)],
      });
      
      res.json(allCompanies);
    } catch (error) {
      console.error("Fehler beim Abrufen der Unternehmen:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Unternehmen" });
    }
  });

  /**
   * Admin-Route: Erstellt ein neues Unternehmen
   */
  app.post("/api/admin/companies", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const { name, description, inviteCode } = req.body;

      // Validierung
      if (!name || !inviteCode) {
        return res.status(400).json({ message: "Name und Einladungscode sind erforderlich" });
      }

      // Prüfen, ob der Einladungscode bereits verwendet wird
      const existingCompany = await db.query.companies.findFirst({
        where: eq(companies.inviteCode, inviteCode),
      });

      if (existingCompany) {
        return res.status(400).json({ message: "Dieser Einladungscode wird bereits verwendet" });
      }

      // Neues Unternehmen erstellen
      const newCompany = await db.insert(companies).values({
        name,
        description,
        inviteCode,
        createdAt: new Date(),
        updatedAt: new Date(),
        is_paused: false,
      }).returning();

      res.status(201).json(newCompany[0]);
    } catch (error) {
      console.error("Fehler beim Erstellen des Unternehmens:", error);
      res.status(500).json({ message: "Fehler beim Erstellen des Unternehmens" });
    }
  });

  /**
   * Admin-Route: Aktualisiert ein Unternehmen
   */
  app.patch("/api/admin/companies/:id", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const { name, description, inviteCode } = req.body;

      // Validierung
      if (!name || !inviteCode) {
        return res.status(400).json({ message: "Name und Einladungscode sind erforderlich" });
      }

      // Prüfen, ob das Unternehmen existiert
      const existingCompany = await db.query.companies.findFirst({
        where: eq(companies.id, companyId),
      });

      if (!existingCompany) {
        return res.status(404).json({ message: "Unternehmen nicht gefunden" });
      }

      // Wenn der Einladungscode geändert wurde, prüfen, ob er bereits verwendet wird
      if (inviteCode !== existingCompany.inviteCode) {
        const codeExists = await db.query.companies.findFirst({
          where: eq(companies.inviteCode, inviteCode),
        });

        if (codeExists) {
          return res.status(400).json({ message: "Dieser Einladungscode wird bereits verwendet" });
        }
      }

      // Unternehmen aktualisieren
      const updatedCompany = await db.update(companies)
        .set({
          name,
          description,
          inviteCode,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId))
        .returning();

      res.json(updatedCompany[0]);
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Unternehmens:", error);
      res.status(500).json({ message: "Fehler beim Aktualisieren des Unternehmens" });
    }
  });

  /**
   * Admin-Route: Pausiert ein Unternehmen
   */
  app.post("/api/admin/companies/:id/pause", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const { pauseReason } = req.body;

      console.log("Pausierungsanfrage für Unternehmen:", companyId, "mit Begründung:", pauseReason);

      if (!pauseReason) {
        return res.status(400).json({ message: "Eine Begründung für die Pausierung ist erforderlich" });
      }

      // Prüfen, ob das Unternehmen existiert
      const existingCompany = await db.query.companies.findFirst({
        where: eq(companies.id, companyId),
      });

      if (!existingCompany) {
        return res.status(404).json({ message: "Unternehmen nicht gefunden" });
      }

      // Unternehmen pausieren
      const pausedCompany = await db.update(companies)
        .set({
          isPaused: true,
          pauseReason: pauseReason,
          pausedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId))
        .returning();

      // Alle Benutzer des Unternehmens pausieren
      await db.update(users)
        .set({
          isPaused: true,
          pauseReason: `Unternehmen pausiert: ${pauseReason}`,
          pausedAt: new Date(),
        })
        .where(eq(users.companyId, companyId));

      // Sicherstellen, dass wir JSON zurücksenden
      res.json(pausedCompany[0]);
    } catch (error) {
      console.error("Fehler beim Pausieren des Unternehmens:", error);
      res.status(500).json({ message: "Fehler beim Pausieren des Unternehmens" });
    }
  });

  /**
   * Admin-Route: Setzt ein pausiertes Unternehmen fort
   */
  app.post("/api/admin/companies/:id/resume", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      
      console.log("Fortsetzungsanfrage für Unternehmen:", companyId);

      // Prüfen, ob das Unternehmen existiert
      const existingCompany = await db.query.companies.findFirst({
        where: eq(companies.id, companyId),
      });

      if (!existingCompany) {
        return res.status(404).json({ message: "Unternehmen nicht gefunden" });
      }

      // Unternehmen fortsetzen
      const resumedCompany = await db.update(companies)
        .set({
          isPaused: false,
          pauseReason: null,
          pausedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId))
        .returning();

      // Alle Benutzer des Unternehmens fortsetzen
      await db.update(users)
        .set({
          isPaused: false,
          pauseReason: null,
          pausedAt: null,
        })
        .where(eq(users.companyId, companyId));

      // Sicherstellen, dass wir JSON zurücksenden
      res.json(resumedCompany[0]);
    } catch (error) {
      console.error("Fehler beim Fortsetzen des Unternehmens:", error);
      res.status(500).json({ message: "Fehler beim Fortsetzen des Unternehmens" });
    }
  });

  /**
   * Admin-Route: Gibt alle Benutzer zurück
   */
  app.get("/api/admin/users", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      // Benutzer ohne die company-Relation abrufen
      const allUsers = await db.query.users.findMany({
        orderBy: (users, { desc }) => [desc(users.id)],
      });
      
      // Unternehmensinformationen separat abrufen
      const userCompanyMap = new Map();
      const userIds = allUsers.map(user => user.companyId).filter(id => id !== null);
      
      if (userIds.length > 0) {
        const companies = await db.query.companies.findMany();
        const companyMap = new Map(companies.map(company => [company.id, company]));
        
        // Manuelles Zuordnen der Unternehmensinformationen zu den Benutzern
        const usersWithCompanies = allUsers.map(user => {
          const company = user.companyId ? companyMap.get(user.companyId) : null;
          return {
            ...user,
            company
          };
        });
        
        res.json(usersWithCompanies);
      } else {
        res.json(allUsers);
      }
    } catch (error) {
      console.error("Fehler beim Abrufen der Benutzer:", error);
      res.status(500).json({ message: "Fehler beim Abrufen der Benutzer" });
    }
  });

  /**
   * Admin-Route: Pausiert einen Benutzer
   */
  app.post("/api/admin/users/:id/pause", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { pauseReason } = req.body;

      console.log("Pausierungsanfrage für Benutzer:", userId, "mit Begründung:", pauseReason);
      
      if (!pauseReason) {
        return res.status(400).json({ message: "Eine Begründung für die Pausierung ist erforderlich" });
      }

      // Prüfen, ob der Benutzer existiert
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!existingUser) {
        return res.status(404).json({ message: "Benutzer nicht gefunden" });
      }

      // Benutzer pausieren
      const pausedUser = await db.update(users)
        .set({
          isPaused: true,
          pauseReason: pauseReason,
          pausedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      // Sicherstellen, dass wir JSON zurücksenden
      res.json(pausedUser[0]);
    } catch (error) {
      console.error("Fehler beim Pausieren des Benutzers:", error);
      res.status(500).json({ message: "Fehler beim Pausieren des Benutzers" });
    }
  });

  /**
   * Admin-Route: Setzt einen pausiertes Benutzer fort
   */
  app.post("/api/admin/users/:id/resume", requireHyperAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      console.log("Fortsetzungsanfrage für Benutzer:", userId);

      // Prüfen, ob der Benutzer existiert
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!existingUser) {
        return res.status(404).json({ message: "Benutzer nicht gefunden" });
      }

      // Benutzer fortsetzen
      const resumedUser = await db.update(users)
        .set({
          isPaused: false,
          pauseReason: null,
          pausedAt: null,
        })
        .where(eq(users.id, userId))
        .returning();

      // Sicherstellen, dass wir JSON zurücksenden
      res.json(resumedUser[0]);
    } catch (error) {
      console.error("Fehler beim Fortsetzen des Benutzers:", error);
      res.status(500).json({ message: "Fehler beim Fortsetzen des Benutzers" });
    }
  });
}