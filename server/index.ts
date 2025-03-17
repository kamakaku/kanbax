import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite.js";
import path from "path";
import cors from "cors";
import session from "express-session";
import { setupAuth } from "./auth";
import { storage } from "./storage";

const app = express();

// Basic middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration must come before auth setup
app.use(session({
  secret: process.env.SESSION_SECRET || "your-secret-key",
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  name: "sid"
}));

// Set up authentication after session
setupAuth(app);

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

// Debug middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Session ID:", req.sessionID);
  console.log("Is Authenticated:", req.isAuthenticated());
  if (req.user) {
    console.log("User:", { id: req.user.id, username: req.user.username });
  }
  next();
});

(async () => {
  try {
    log("Starting server initialization...");
    const server = await registerRoutes(app);
    log("Routes registered successfully");

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error("Server error:", err);
    });

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