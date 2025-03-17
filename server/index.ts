import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite.js";
import path from "path";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create a separate router for API routes
const apiRouter = express.Router();

// Health check endpoint on the API router
apiRouter.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

// Mount the API router under /api
app.use("/api", apiRouter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Enhanced request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  console.log(`[${new Date().toISOString()}] Incoming ${req.method} request for ${req.url}`);

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

    // Register API routes first
    log("Registering API routes...");
    const server = await registerRoutes(apiRouter); // Pass apiRouter instead of app
    log("API routes registered successfully");

    // Error handling middleware
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
    await startServer(initialPort);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();