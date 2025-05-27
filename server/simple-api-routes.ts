import type { Express, Request, Response } from "express";
import crypto from "crypto";

interface APIKey {
  id: string;
  name: string;
  key: string;
  userId: number;
  permissions: string[];
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

// In-Memory-Speicher für API-Schlüssel
const apiKeys = new Map<string, APIKey>();

function generateAPIKey(): string {
  return `sk_${crypto.randomBytes(32).toString('hex')}`;
}

export function registerSimpleAPIRoutes(app: Express) {
  
  // API Key erstellen
  app.post("/api/keys", async (req: Request, res: Response) => {
    try {
      const { name, permissions = ['read'] } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Key name is required' });
      }

      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const apiKey: APIKey = {
        id: crypto.randomUUID(),
        name,
        key: generateAPIKey(),
        userId: userId,
        permissions,
        createdAt: new Date(),
        isActive: true
      };

      apiKeys.set(apiKey.key, apiKey);

      res.json({
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key,
        permissions: apiKey.permissions,
        createdAt: apiKey.createdAt.toISOString(),
        isActive: apiKey.isActive
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API Keys auflisten
  app.get("/api/keys", async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const userKeys: any[] = [];
      for (const key of apiKeys.values()) {
        if (key.userId === userId) {
          userKeys.push(key);
        }
      }
      
      const result = userKeys
        .map(key => ({
          id: key.id,
          name: key.name,
          permissions: key.permissions,
          createdAt: key.createdAt.toISOString(),
          lastUsed: key.lastUsed?.toISOString(),
          isActive: key.isActive
        }));

      res.json(userKeys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API Key löschen
  app.delete("/api/keys/:keyId", async (req: Request, res: Response) => {
    try {
      const { keyId } = req.params;
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Finde den Schlüssel
      let keyToDelete: APIKey | undefined;
      let keyToken: string | undefined;
      
      for (const [token, key] of apiKeys.entries()) {
        if (key.id === keyId && key.userId === userId) {
          keyToDelete = key;
          keyToken = token;
          break;
        }
      }

      if (!keyToDelete || !keyToken) {
        return res.status(404).json({ error: 'API key not found' });
      }

      apiKeys.delete(keyToken);
      res.json({ message: 'API key deleted successfully' });
    } catch (error) {
      console.error('Error deleting API key:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API-Dokumentation
  app.get("/api/docs", (req: Request, res: Response) => {
    const docs = {
      title: "SuperOrga REST API",
      version: "1.0.0",
      description: "REST API für Drittanbieter-Integrationen",
      baseUrl: `${req.protocol}://${req.get('host')}/api/v1`,
      authentication: {
        type: "Bearer Token",
        header: "Authorization: Bearer YOUR_API_KEY"
      },
      endpoints: {
        "GET /user": "Aktuelle Benutzerinformationen abrufen",
        "GET /projects": "Alle zugänglichen Projekte auflisten",
        "POST /projects": "Neues Projekt erstellen",
        "GET /boards": "Alle zugänglichen Boards auflisten", 
        "POST /boards": "Neues Board erstellen",
        "GET /tasks": "Alle zugänglichen Aufgaben auflisten",
        "POST /tasks": "Neue Aufgabe erstellen"
      },
      examples: {
        "Benutzer abrufen": `curl -H "Authorization: Bearer YOUR_API_KEY" ${req.protocol}://${req.get('host')}/api/v1/user`,
        "Projekt erstellen": `curl -X POST -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" -d '{"title":"Mein Projekt","description":"Beschreibung"}' ${req.protocol}://${req.get('host')}/api/v1/projects`
      }
    };

    res.json(docs);
  });
}