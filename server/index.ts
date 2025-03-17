import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite.js";
import path from "path";
import cors from "cors";
import session from "express-session";
import createMemoryStore from "memorystore";
import { setupAuth } from "./auth";

// Add global error handlers
process.on('uncaughtException', (err) => {
  console.error("Uncaught Exception:", err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

const app = express();
const MemoryStore = createMemoryStore(session);

console.log("Initializing server with basic middleware...");

// Basic middleware setup
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

console.log("Setting up session middleware...");

// Session configuration - must come before auth setup
app.use(session({
  secret: process.env.SESSION_SECRET || "your-secret-key",
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  name: "sid"
}));

console.log("Setting up authentication...");
// Set up authentication after session
setupAuth(app);

// Test endpoint for session verification
app.get("/api/test-session", (req, res) => {
  console.log("Test session request received");
  console.log("Current session:", req.session);

  if (!req.session.testValue) {
    req.session.testValue = "Hello, session!";
    console.log("Setting new test value");
  }

  res.json({
    sessionID: req.sessionID,
    testValue: req.session.testValue,
    cookies: req.headers.cookie
  });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Session ID:", req.sessionID);
  console.log("Session:", req.session);
  console.log("Cookies:", req.headers.cookie);
  console.log("Is Authenticated:", req.isAuthenticated());
  if (req.user) {
    console.log("User:", req.user);
  }
  next();
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

(async () => {
  try {
    console.log("Starting server initialization...");
    const server = await registerRoutes(app);
    console.log("Routes registered successfully");

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error("Server error:", err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    console.log("Setting up Vite configuration...");
    process.env.NODE_ENV = "development";
    log(`Current NODE_ENV: ${process.env.NODE_ENV}`);

    if (process.env.NODE_ENV === "development") {
      log("Setting up Vite for development...");
      await setupVite(app, server);
      log("Vite setup completed");
    } else {
      log("Setting up static serving for production...");
      serveStatic(app);
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen(port, '0.0.0.0', () => {
      log(`Server successfully started on port ${port}`);
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();