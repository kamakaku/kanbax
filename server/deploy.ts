// Deployment-optimierter Server Entry Point
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

// Session configuration
const MemoryStoreSession = MemoryStore(session);
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStoreSession({
    checkPeriod: 86400000
  }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// DEPLOYMENT: Force development mode for Replit
process.env.NODE_ENV = "development";

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: any = undefined;

  console.log(`[${new Date().toISOString()}] Incoming ${req.method} request for ${req.url}`);
  
  if (req.session) {
    console.log("Session data:", { 
      userId: req.session.userId || undefined, 
      isNew: req.session.isNew || undefined 
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
    log("DEPLOYMENT: Starting optimized server...");
    const server = createServer(app);
    
    // Register all routes
    await registerRoutes(app, db);
    registerProtocolRoutes(app);
    registerSimpleAPIRoutes(app);
    setupAdminRoutes(app, db);
    registerSubscriptionRoutes(app);
    registerPaymentRoutes(app);
    await initializeSubscriptionPackages();
    setupLimitRoutes(app);
    registerDataExportRoutes(app);

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

    const startServer = async () => {
      const port = process.env.PORT || 5000;
      const host = '0.0.0.0';
      
      log(`DEPLOYMENT: Starting on ${host}:${port}`);
      
      server.listen(port, host, async () => {
        log(`✅ DEPLOYMENT: Server running on ${host}:${port}`);
        
        // Setup Vite AFTER server is running
        try {
          log("DEPLOYMENT: Setting up Vite...");
          await setupVite(app, server);
          log("DEPLOYMENT: Vite setup complete");
          
          // Add catch-all route AFTER Vite setup
          app.get('*', (req, res, next) => {
            if (req.url.startsWith('/api')) {
              next();
              return;
            }
            console.log(`[${new Date().toISOString()}] Serving client app for route: ${req.url}`);
            next();
          });
          
        } catch (error) {
          console.error("DEPLOYMENT: Vite setup failed:", error);
        }
      });
    };

    await startServer();
    
  } catch (error) {
    console.error("DEPLOYMENT: Failed to start server:", error);
    process.exit(1);
  }
})();

console.log("DEPLOYMENT: Entry point loaded");

// Database setup
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pg = knex({
  client: "pg",
  connection: {
    connectionString,
    ssl: { rejectUnauthorized: false },
  },
});

const db = drizzle(pg as any);