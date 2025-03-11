import http from 'http';

const port = parseInt(process.env.PORT || "5000", 10);

console.log('Starting test server...');
console.log('Environment configuration:');
console.log(`- PORT env var: ${process.env.PORT}`);
console.log(`- Computed port: ${port}`);
console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy' }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Test server is running' }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Test server running at http://127.0.0.1:${port}`);
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
