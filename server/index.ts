import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite.js";
import path from "path";
import cors from "cors";

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create API router
const apiRouter = express.Router();

// Force JSON Content-Type for API responses
apiRouter.use((req, res, next) => {
  res.contentType('application/json');
  next();
});

// API request logging middleware
apiRouter.use((req, res, next) => {
  const start = Date.now();
  log(`[API] ${req.method} ${req.originalUrl}`);
  const originalJson = res.json;
  res.json = function(body) {
    log(`[API] Response sent for ${req.method} ${req.originalUrl} in ${Date.now() - start}ms`);
    return originalJson.call(this, body);
  };
  next();
});

// Initialize API routes
registerRoutes(apiRouter).then((server) => {
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Mount the API router at the absolute path
  app.use("/api", (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    apiRouter(req, res, next);
  });

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

  // Setup Vite last after all API routes are mounted
  if (process.env.NODE_ENV === "development") {
    log("Setting up Vite for development...");
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        log(`[Debug] API request intercepted before Vite: ${req.method} ${req.path}`);
        return next();
      }
      setupVite(app, server);
      next();
    });
    log("Vite setup completed");
  } else {
    log("Setting up static serving for production...");
    serveStatic(app);
  }

  const startServer = async (initialPort: number = 5000, maxAttempts = 3) => {
    const host = '0.0.0.0';
    let currentPort = initialPort;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        log(`Attempting to start server on port ${currentPort} (attempt ${attempts + 1}/${maxAttempts})`);
        server.close();

        await new Promise<void>((resolve, reject) => {
          server.listen(currentPort, host, () => {
            log(`Server successfully started on ${host}:${currentPort}`);
            resolve();
          });

          server.once('error', (e: any) => {
            if (e.code === 'EADDRINUSE') {
              log(`Port ${currentPort} is in use, trying next port...`);
              currentPort++;
              attempts++;
              resolve();
            } else {
              reject(e);
            }
          });
        });

        break;
      } catch (error) {
        console.error(`Failed to start server on port ${currentPort}:`, error);
        attempts++;
        if (attempts >= maxAttempts) {
          log('Failed to start server after maximum attempts');
          process.exit(1);
        }
        currentPort++;
      }
    }
  };

  const initialPort = parseInt(process.env.PORT || "5000", 10);
  log(`Starting server with initial port ${initialPort}`);
  startServer(initialPort);
}).catch(error => {
  console.error("Failed to register routes:", error);
  process.exit(1);
});