import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite.js";
import path from "path";
import cors from "cors";
import { createServer } from "http";

// Create separate app instances for API and frontend
const apiApp = express();
const frontendApp = express();

// Set up servers
const apiServer = createServer(apiApp);
const frontendServer = createServer(frontendApp);

// Basic middleware for API
apiApp.use(cors({
  origin: 'http://localhost:5000',
  credentials: true
}));
apiApp.use(express.json());
apiApp.use(express.urlencoded({ extended: false }));

// API request logging
apiApp.use((req, res, next) => {
  log(`[API] ${req.method} ${req.originalUrl}`);
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Setup frontend
frontendApp.use(cors());

// Set development environment
process.env.NODE_ENV = "development";
log(`Current NODE_ENV: ${process.env.NODE_ENV}`);

// Initialize API routes
(async () => {
  try {
    // Register API routes
    const apiRouter = await registerRoutes(express.Router());
    apiApp.use(apiRouter);

    // Serve uploaded files
    apiApp.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

    // API error handling
    apiApp.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log("[API Error]", err);
      res.status(status).json({ message });
    });

    // Start API server
    apiServer.listen(3001, '0.0.0.0', () => {
      log(`API server running on http://0.0.0.0:3001`);
    });

    // Setup frontend server
    if (process.env.NODE_ENV === "development") {
      log("Setting up Vite for development...");
      setupVite(frontendApp, frontendServer);
      log("Vite setup completed");
    } else {
      log("Setting up static serving for production...");
      serveStatic(frontendApp);
    }

    // Health check endpoint
    frontendApp.get("/health", (_req, res) => {
      res.json({ status: "healthy" });
    });

    // Start frontend server
    frontendServer.listen(5000, '0.0.0.0', () => {
      log(`Frontend server running on http://0.0.0.0:5000`);
    });
  } catch (error) {
    console.error("Failed to start servers:", error);
    process.exit(1);
  }
})();