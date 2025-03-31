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
import { optionalAuth } from './middleware/auth';
import { storage } from './storage';
import { notificationService } from './notification-service';
import { registerProtocolRoutes } from './protocolRoutes';

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
      // Skip API routes and static files
      if (req.url.startsWith('/api') || req.url.startsWith('/assets')) {
        next();
        return;
      }

      console.log(`[${new Date().toISOString()}] Serving client app for route: ${req.url}`);

      if (process.env.NODE_ENV === "development") {
        next(); // Let Vite handle it in development
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

    // Always set NODE_ENV to development in Replit environment
    process.env.NODE_ENV = "development";
    log(`Current NODE_ENV: ${process.env.NODE_ENV}`);

    // In development, use Vite's development server
    if (process.env.NODE_ENV === "development") {
      log("Setting up Vite for development...");
      await setupVite(app, server);
      log("Vite setup completed");
    } else {
      log("Setting up static serving for production...");
      serveStatic(app);
    }

    // Modified server start function with port retry logic
    const startServer = async (initialPort: number = 5000, maxRetries = 3) => {
      const host = '0.0.0.0';
      let currentPort = initialPort;
      let retryCount = 0;

      while (retryCount < maxRetries) {
        try {
          // Force close previous listeners if they exist
          await new Promise<void>((resolve) => {
            if (server.listening) {
              server.close(() => resolve());
            } else {
              resolve();
            }
          });

          await new Promise<void>((resolve, reject) => {
            server.listen(currentPort, host, () => {
              log(`Server successfully started on ${host}:${currentPort}`);
              log(`Visit the app at: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
              resolve();
            });

            server.once('error', (e: any) => {
              if (e.code === 'EADDRINUSE') {
                log(`Port ${currentPort} is in use, trying next port...`);
                currentPort++;
                retryCount++;
                server.close();
                log(`Attempting to start on port ${currentPort}`);
                if (retryCount < maxRetries) {
                  resolve();
                } else {
                  reject(new Error(`Failed to find available port after ${maxRetries} attempts`));
                }
              } else {
                reject(e);
              }
            });
          });

          // If we get here, the server started successfully
          break;
        } catch (error) {
          if (retryCount >= maxRetries) {
            throw error;
          }
        }
      }
    };

    // Start at port 5000 to match Replit's expectations
    const port = parseInt(process.env.PORT || "5000", 10);
    log(`Starting server on port ${port}`);
    await startServer(port);
    
    // Starte den Benachrichtigungsdienst für ausstehende Aktivitätslogs
    log("Initialisiere Benachrichtigungsdienst...");
    await notificationService.processAllPendingActivityLogs();
    
    // Richte einen regelmäßigen Job ein, um Benachrichtigungen zu verarbeiten
    setInterval(async () => {
      try {
        await notificationService.processAllPendingActivityLogs();
      } catch (error) {
        console.error("Fehler bei der Verarbeitung ausstehender Benachrichtigungen:", error);
      }
    }, 60000); // Überprüfe jede Minute
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();