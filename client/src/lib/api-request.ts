type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Einheitliche API Request Funktion
 * Schlägt bei Fehlern fehl und verarbeitet JSON automatisch
 */
export async function apiRequest<T = any>(
  method: HttpMethod,
  endpoint: string,
  data?: unknown
): Promise<T> {
  console.log(`API Request: ${method} ${endpoint}`, data ? 'mit Daten' : 'ohne Daten');
  
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Stellt sicher, dass Cookies mit den Anfragen gesendet werden
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(endpoint, options);
    
    // Fehlerbehandlung
    if (!response.ok) {
      // Verbesserte Fehlerbehandlung mit detaillierter Protokollierung
      console.error(`API Fehler: ${response.status} ${response.statusText} für ${endpoint}`);
      
      // Versuchen wir die Antwort zu erhalten, unabhängig vom Content-Type
      try {
        // Zuerst versuchen wir es als JSON zu lesen
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorText = await response.text();
            console.log("Erhaltene Fehlerantwort:", errorText);
            
            try {
              const errorData = JSON.parse(errorText);
              console.error("Geparste Fehlerdaten:", errorData);
              throw new Error(errorData.message || `${response.status}: ${response.statusText}`);
            } catch (jsonError) {
              console.error("Fehler beim Parsen der JSON-Antwort:", jsonError);
              // Wenn es kein gültiges JSON ist, verwenden wir den Text direkt
              throw new Error(`${response.status}: ${errorText || response.statusText}`);
            }
          } catch (textError) {
            console.error("Fehler beim Lesen der Fehlerantwort:", textError);
            throw new Error(`${response.status}: ${response.statusText}`);
          }
        } else {
          // Bei non-JSON Content-Type versuchen wir direkt die Textantwort zu lesen
          try {
            const text = await response.text();
            console.error(`API Fehler (${response.status}, ${contentType}):`, text);
            throw new Error(`${response.status}: ${text || response.statusText}`);
          } catch (textError) {
            console.error("Fehler beim Lesen der Text-Antwort:", textError);
            throw new Error(`${response.status}: ${response.statusText}`);
          }
        }
      } catch (e) {
        // Fallback für den Fall, dass alle Versuche fehlschlagen
        console.error("Kritischer Fehler beim Verarbeiten der API-Fehlerantwort:", e);
        throw new Error(`API-Anfrage fehlgeschlagen: ${response.status} ${response.statusText}`);
      }
    }

    // Bei leerer Antwort (204 No Content) oder DELETE-Anfragen, geben wir ein leeres Objekt zurück
    if (response.status === 204 || (method === 'DELETE' && response.status === 200)) {
      return {} as T;
    }

    try {
      // Versuche JSON zu parsen
      const result = await response.json();
      return result as T;
    } catch (e) {
      // Wenn die Antwort kein gültiges JSON ist, geben wir die leere Antwort zurück
      console.warn('API Antwort enthält kein gültiges JSON, gebe leeres Objekt zurück');
      return {} as T;
    }
  } catch (error) {
    console.error('API Request fehlgeschlagen:', error);
    throw error;
  }
}
