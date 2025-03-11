import express from "express";
import cors from "cors";

// Initialize express app
const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Add response logging
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get("content-length"),
      contentType: res.get("content-type"),
      body: req.method !== "GET" ? req.body : undefined,
      query: Object.keys(req.query).length > 0 ? req.query : undefined
    };
    console.log("Request completed:", JSON.stringify(logEntry, null, 2));
  });

  next();
});

// Test route
app.get("/", (_req, res) => {
  console.log("Root endpoint called");
  res.json({ message: "Server is running" });
});

// Health check endpoint
app.get("/health", (_req, res) => {
  console.log("Health check endpoint called");
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT
    }
  });
});

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Server error:", err);
  const errorResponse = {
    message: "Internal Server Error",
    timestamp: new Date().toISOString(),
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  };
  res.status(500).json(errorResponse);
});

// Start server
const port = parseInt(process.env.PORT || "5000", 10);
console.log(`Starting server on port ${port}...`);

const server = app.listen(port, "0.0.0.0", () => {
  const serverInfo = {
    timestamp: new Date().toISOString(),
    port: port,
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: process.memoryUsage(),
    endpoints: [
      { method: "GET", path: "/" },
      { method: "GET", path: "/health" }
    ]
  };
  console.log("Server started successfully:", JSON.stringify(serverInfo, null, 2));
}).on('error', (error: any) => {
  console.error('Server error occurred:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
  }
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});