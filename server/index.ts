import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite.js";
import path from "path";
import cors from "cors";
import { createServer } from "http";

const app = express();
const apiRouter = express.Router();
const server = createServer(app);

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Debug logging for all requests
app.use((req, res, next) => {
  log(`[DEBUG] Incoming request: ${req.method} ${req.originalUrl}`);
  next();
});

// API Router setup
apiRouter.use((req, res, next) => {
  log(`[API] Router handling request: ${req.method} ${req.originalUrl}`);
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Register API routes
(async () => {
  try {
    // Initialize routes on the API router
    await registerRoutes(apiRouter);
    log("[API] Routes registered successfully");

    // Mount API router first
    app.use("/api", apiRouter);

    // API error handling middleware
    app.use("/api", (err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log("[API Error]", err);
      res.status(status).json({ message });
    });

    // Health check endpoint (not under /api)
    app.get("/health", (_req, res) => {
      res.json({ status: "healthy" });
    });

    // Set development environment
    process.env.NODE_ENV = "development";
    log(`Current NODE_ENV: ${process.env.NODE_ENV}`);

    // Setup Vite last, after API routes are mounted
    if (process.env.NODE_ENV === "development") {
      log("Setting up Vite for development...");
      app.use((req, res, next) => {
        if (req.originalUrl.startsWith('/api')) {
          log(`[DEBUG] Skipping Vite for API route: ${req.originalUrl}`);
          return next();
        }
        log(`[DEBUG] Handling with Vite: ${req.originalUrl}`);
        setupVite(app, server)(req, res, next);
      });
      log("Vite setup completed");
    } else {
      log("Setting up static serving for production...");
      serveStatic(app);
    }

    // Start server
    server.listen(5000, '0.0.0.0', () => {
      log(`Server running on http://0.0.0.0:5000`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();