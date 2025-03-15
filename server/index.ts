import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log } from "./vite.js";
import { db } from "./db";
import { sql } from "drizzle-orm";
import cors from "cors";

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  log("Health check endpoint called");
  res.json({ status: "healthy" });
});

// Basic error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

(async () => {
  try {
    log("Starting simplified server initialization...");

    // Test database connection
    try {
      log("Testing database connection...");
      await db.select({ test: sql`1` });
      log("Database connection successful");
    } catch (error) {
      console.error("Database connection failed:", error);
      process.exit(1);
    }

    // Create HTTP server and register routes first
    const server = await registerRoutes(app);
    log("Basic routes registered");

    // Start server
    const port = 5000;
    const host = '0.0.0.0';

    log(`Attempting to start server on ${host}:${port}...`);

    server.listen(port, host, () => {
      log(`Server started successfully on ${host}:${port}`);
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
        log("Please ensure no other server is running on port 5000");
        process.exit(1);
      } else {
        console.error('Server startup error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error("Fatal server error:", error);
    process.exit(1);
  }
})();