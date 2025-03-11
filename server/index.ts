import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Verbesserte Logging-Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
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
  log("Starting server initialization...");
  const server = await registerRoutes(app);
  log("Routes registered successfully");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error("Server error:", err);
  });

  if (app.get("env") === "development") {
    log("Setting up Vite for development...");
    await setupVite(app, server);
    log("Vite setup completed");
  } else {
    log("Setting up static serving for production...");
    serveStatic(app);
  }

  // Verbesserte Port-Handling-Logik mit Timeouts und Retries
  const tryListen = async (port: number, maxRetries = 10, retryDelay = 1000) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        log(`Attempting to start server on port ${port} (attempt ${attempt + 1}/${maxRetries})`);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Timeout while trying to bind to port ${port}`));
          }, 5000);

          server.listen({
            port,
            host: "0.0.0.0",
            reusePort: true,
          }, () => {
            clearTimeout(timeout);
            log(`Server successfully started on port ${port}`);
            resolve();
          }).on('error', (error: NodeJS.ErrnoException) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        return; // Successfully started
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE') {
          log(`Port ${port} is in use, waiting ${retryDelay}ms before trying port ${port + 1}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          port++;
        } else {
          console.error("Unexpected error while starting server:", error);
          throw error;
        }
      }
    }

    throw new Error(`Could not find an available port after ${maxRetries} attempts`);
  };

  try {
    await tryListen(5000);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();