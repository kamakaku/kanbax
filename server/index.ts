import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite.js";
import path from "path";
import cors from "cors";
import { drizzle } from "drizzle-orm/node-postgres";
import knex from "knex";
import session from "express-session";
import MemoryStore from "memorystore";
import { createServer } from "http";
import { optionalAuth, requireAuth } from './middleware/auth';
import { storage } from './storage';
import { notificationService } from './notification-service';
import { registerProtocolRoutes } from './protocolRoutes';
import { registerSubscriptionRoutes, initializeSubscriptionPackages } from './subscriptionRoutes';
import { registerPaymentRoutes } from './paymentRoutes';
import setupAdminRoutes from './adminRoutes';
import { checkTaskLimitRoute } from './taskLimitMiddleware';
import setupLimitRoutes from './limitRoutes';
import { registerDataExportRoutes } from './dataExportRoutes';
import { registerSimpleAPIRoutes } from './simple-api-routes';

const app = express();

// CORS configuration - must be before session middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Entferne MIME-Type-Fix - lass Vite alles handhaben

// Session configuration
const MemoryStoreSession = MemoryStore(session);
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStoreSession({
    checkPeriod: 86400000 // Prüfe Ablauf jeden Tag
  }),
  cookie: {
    secure: false, // Set to true only in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 Stunden
    sameSite: 'lax'
  }
}));

// Initialize Knex with connection info from DATABASE_URL
const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Serve static public files
app.use(express.static(path.join(process.cwd(), 'public')));

// Special routes for payment processing - static fallbacks
// Diese Routes stellen sicher, dass selbst ohne React-Router der Benutzer
// erfolgreich durch den Bezahlprozess geführt werden kann
app.get("/payment/success", (req, res) => {
  // Forward the session_id parameter
  const sessionId = req.query.session_id;
  // Wenn keine Session-ID vorhanden ist, leiten wir zur Auth-Seite weiter
  if (!sessionId) {
    return res.redirect('/auth');
  }
  // Andernfalls zeigen wir die statische Erfolgsseite mit der Session-ID
  res.sendFile(path.join(process.cwd(), 'public', 'payment-success.html'));
});

// Auch die statische Erfolgsseite direkt ansprechen können
app.get("/payment-success.html", (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'payment-success.html'));
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

// Enhanced request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  console.log(`[${new Date().toISOString()}] Incoming ${req.method} request for ${req.url}`);
  if (req.session) {
    console.log(`Session data:`, {
      userId: req.session.userId,
      isNew: req.session && 'isNew' in req.session ? req.session.isNew : undefined
    });
  }

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") || path === "/health") {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("Starting server initialization...");
    // Create HTTP server
    const server = createServer(app);
    // Register routes
    await registerRoutes(app, db);
    log("Routes registered successfully");

    // Protokoll-Routen registrieren
    registerProtocolRoutes(app);
    log("Protocol routes registered successfully");

    // REST API-Routen registrieren (ALLERFRÜHESTE PRIORITÄT)
    registerSimpleAPIRoutes(app);
    log("REST API routes registered successfully");

    // Admin-Routen registrieren
    setupAdminRoutes(app, db);
    log("Admin routes registered successfully");

    // Subscription-Routen registrieren
    registerSubscriptionRoutes(app);
    log("Subscription routes registered successfully");

    // Payment-Routen registrieren
    registerPaymentRoutes(app);
    log("Payment routes registered successfully");

    // Standard-Abonnement-Pakete initialisieren
    await initializeSubscriptionPackages();
    log("Subscription packages initialized successfully");

    // Limit-Routen registrieren
    setupLimitRoutes(app);
    
    // Datenexport-Routen registrieren (DSGVO-konform)
    registerDataExportRoutes(app);
    log("Data export routes registered successfully");

    // Add this after routes are registered but before error handler
    app.get('/api/auth/current-user', optionalAuth, async (req, res) => {
      try {
        if (!req.userId) {
          return res.json(null);
        }

        const user = await storage.getUser(req.userId, req.userId);
        const { passwordHash: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } catch (error) {
        console.error("Error fetching current user:", error);
        res.status(500).json({ message: "Fehler beim Abrufen des aktuellen Benutzers" });
      }
    });

    app.get('*', (req, res, next) => {
      // Skip API routes
      if (req.url.startsWith('/api')) {
        next();
        return;
      }

      console.log(`[${new Date().toISOString()}] Serving client app for route: ${req.url}`);

      if (process.env.NODE_ENV === "development") {
        // In development, let Vite handle all non-API routes
        next();
      } else {
        // In production, serve the built index.html
        res.sendFile(path.join(process.cwd(), 'dist', 'client', 'index.html'));
      }
    });

    // Keep existing error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      console.error("Server error:", err);
    });

    // Production-Modus für Deployment
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = "production";
    }

    // Anstelle von Vite sofort den Server starten (für Port-Registrierung)
    log("🚀 SERVER STARTUP: Minimale Konfiguration für schnellen Start...");

    // Einfacher Server-Start für Production
    const port = process.env.PORT || 5000;
    const host = '0.0.0.0';
    
    server.listen(port, host, () => {
      log(`✅ SERVER gestartet auf ${host}:${port}`);
      console.log(`IMPORTANT: Server now running on port ${port}`);
    });

    // Direkte Vite-Initialisierung - keine Verzögerung mehr
    log("Server ist gestartet, initialisiere Vite direkt...");

    try {
      log("Vite wird jetzt initialisiert...");
      // Für Replit Deployments immer Development-Modus verwenden
      await setupVite(app, server);
      log("Vite-Setup abgeschlossen für Replit Deployment");

      // Benachrichtigungsdienst stark verzögern, um Serverstart nicht zu blockieren
      log("Benachrichtigungsdienst wird erst nach 30 Sekunden initialisiert, um den Server-Start zu beschleunigen");
      
      // Lange Verzögerung für Benachrichtigungen (30 Sekunden)
      setTimeout(() => {
        log("Delayed: Benachrichtigungsdienst wird jetzt initialisiert...");
        notificationService.processAllPendingActivityLogs()
          .then(() => log("Benachrichtigungsdienst Initialisierung abgeschlossen"))
          .catch(err => console.error("Fehler bei der Initialisierung des Benachrichtigungsdienstes:", err));

        // Regelmäßige Verarbeitung erst nach 1 Minute einrichten
        setTimeout(() => {
          setInterval(async () => {
            try {
              await notificationService.processAllPendingActivityLogs();
            } catch (error) {
              console.error("Fehler bei der Verarbeitung ausstehender Benachrichtigungen:", error);
            }
          }, 120000); // Überprüfe alle 2 Minuten statt jede Minute
        }, 60000);
      }, 30000); // Warte 30 Sekunden vor der ersten Initialisierung
      } catch (error) {
        console.error("Fehler beim Setup von Vite:", error);
      }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();

console.log("DEBUG: Checking Board Limit on server side...");