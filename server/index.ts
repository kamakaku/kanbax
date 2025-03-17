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

// API request logging middleware
apiRouter.use((req, res, next) => {
  const start = Date.now();
  console.log(`[API] ${req.method} ${req.originalUrl} - Request received`);

  const originalJson = res.json;
  res.json = function(body) {
    console.log(`[API] ${req.method} ${req.originalUrl} - Sending JSON response in ${Date.now() - start}ms`);
    return originalJson.call(this, body);
  };

  next();
});

// Initialize API routes first
registerRoutes(apiRouter).then((server) => {
  // Mount API router before any other middleware
  app.use("/api", apiRouter);

  // API error handling middleware.  This was moved here to be after the apiRouter.use
  apiRouter.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("[API Error]:", err);
    res.status(status).json({ message });
  });

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Health check endpoint (not under /api)
  app.get("/health", (_req, res) => {
    res.json({ status: "healthy" });
  });


  // Set development environment
  process.env.NODE_ENV = "development";
  log(`Current NODE_ENV: ${process.env.NODE_ENV}`);

  // Setup Vite after API routes
  if (process.env.NODE_ENV === "development") {
    log("Setting up Vite for development...");
    setupVite(app, server);
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

        // Force close previous listeners if they exist
        server.close();

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
              attempts++;
              resolve(); // Continue to next attempt
            } else {
              reject(e);
            }
          });
        });

        // If we get here, the server started successfully
        break;
      } catch (error) {
        console.error(`Failed to start server on port ${currentPort}:`, error);
        attempts++;
        if (attempts >= maxAttempts) {
          log('Failed to start server after maximum attempts');
          process.exit(1);
        }
        // Try next port
        currentPort++;
      }
    }
  };

  // Get initial port from environment or use 5000 as default
  const initialPort = parseInt(process.env.PORT || "5000", 10);
  log(`Starting server with initial port ${initialPort}`);
  startServer(initialPort);
}).catch(error => {
  console.error("Failed to register routes:", error);
  process.exit(1);
});