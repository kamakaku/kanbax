import express from "express";
import cors from "cors";

// Initialize express app
const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
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
  res.json({ status: "healthy" });
});

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Server error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

// Start server
const port = parseInt(process.env.PORT || "5000", 10);
console.log(`Starting server on port ${port}...`);

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Server started successfully on http://0.0.0.0:${port}`);
  console.log("Available routes:");
  console.log("- GET /");
  console.log("- GET /health");
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