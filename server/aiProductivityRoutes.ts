import { Express } from "express";
import { requireAuth } from "./middleware/auth";
import { storage } from "./storage";
import OpenAI from "openai";

export function registerAIProductivityRoutes(app: Express) {
  // Prüfen, ob der OpenAI API-Schlüssel vorhanden ist
  const openaiApiKey = process.env.OPENAI_API_KEY;
  let openai: OpenAI | null = null;
  
  if (openaiApiKey) {
    openai = new OpenAI({
      apiKey: openaiApiKey
    });
  }

  // Endpunkt für KI-generierte Produktivitätseinblicke
  app.get("/api/ai/productivity-insights/:userId", requireAuth, async (req, res) => {
    try {
      // OpenAI API-Schlüssel überprüfen
      if (!openai) {
        return res.status(503).json({ 
          message: "OpenAI-Dienst nicht verfügbar. API-Schlüssel fehlt.",
          needsApiKey: true 
        });
      }

      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Ungültige Benutzer-ID" });
      }

      // Produktivitätsmetriken abrufen (letzte 30 Tage für tiefere Analysen)
      const metrics = await storage.getUserProductivityMetrics(userId, 30);
      
      // Aufgabenstatistik abrufen
      const taskDistribution = await storage.getTaskDistribution(userId);
      
      // Projektaktivitäten abrufen
      const projectActivities = await storage.getProjectActivities(userId);
      
      // Kürzlich abgeschlossene Aufgaben abrufen
      const recentCompletedTasks = await storage.getUserRecentCompletedTasks(userId, 10);
      
      // Zugewiesene, aber nicht erledigte Aufgaben abrufen
      const pendingTasks = await storage.getUserPendingTasks(userId);

      // Daten für die KI-Analyse zusammenstellen
      const analysisData = {
        metrics,
        taskDistribution,
        projectActivities,
        recentCompletedTasks,
        pendingTasks
      };

      // Prompt für die KI erstellen
      const prompt = `
        Als KI-Produktivitätsassistent analysiere die folgenden Daten eines Nutzers und gib personalisierte Einblicke und Empfehlungen:
        
        PRODUKTIVITÄTSMETRIKEN DER LETZTEN 30 TAGE:
        ${JSON.stringify(metrics, null, 2)}
        
        AUFGABENVERTEILUNG NACH STATUS:
        ${JSON.stringify(taskDistribution, null, 2)}
        
        PROJEKTAKTIVITÄTEN:
        ${JSON.stringify(projectActivities, null, 2)}
        
        KÜRZLICH ABGESCHLOSSENE AUFGABEN:
        ${JSON.stringify(recentCompletedTasks, null, 2)}
        
        AUSSTEHENDE AUFGABEN:
        ${JSON.stringify(pendingTasks, null, 2)}
        
        Basierend auf diesen Daten, bitte erstelle:
        1. Eine kurze Zusammenfassung der Produktivitätstrends
        2. Drei spezifische positive Aspekte (mit konkreten Daten)
        3. Zwei Bereiche mit Verbesserungspotenzial (mit konkreten Daten)
        4. Drei spezifische, umsetzbare Empfehlungen für die nächste Woche
        5. Eine Motivationsnachricht
        
        Formatiere die Antwort in JSON mit folgenden Feldern:
        {
          "summary": "Text zur Zusammenfassung der Produktivitätstrends",
          "positiveAspects": ["Aspekt 1", "Aspekt 2", "Aspekt 3"],
          "improvementAreas": ["Bereich 1", "Bereich 2"],
          "recommendations": ["Empfehlung 1", "Empfehlung 2", "Empfehlung 3"],
          "motivationalMessage": "Motivierende Nachricht"
        }
        
        Alle Texte sollten auf Deutsch sein und einen ermutigenden, unterstützenden Ton haben.
        Gib nur das JSON ohne zusätzliche Erklärungen zurück.
      `;

      // OpenAI API aufrufen
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-1106",
        messages: [
          { role: "system", content: "Du bist ein hilfreicher KI-Assistent für Produktivitätsanalyse." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      // Antwort parsen
      const aiResponse = chatCompletion.choices[0].message.content;
      const insights = JSON.parse(aiResponse || "{}");

      res.json(insights);
    } catch (error) {
      console.error("Fehler beim Generieren der KI-Produktivitätseinblicke:", error);
      res.status(500).json({ 
        message: "Fehler beim Generieren der KI-Produktivitätseinblicke",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Endpoint für Prüfung des OpenAI API-Schlüssels
  app.get("/api/ai/status", requireAuth, async (req, res) => {
    res.json({ 
      available: !!openai,
      needsApiKey: !openai
    });
  });
}