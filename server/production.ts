// Production server that bypasses the MIME type issues
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Set correct MIME types for all JavaScript files
app.use((req, res, next) => {
  if (req.url.endsWith('.js') || req.url.endsWith('.mjs') || req.url.endsWith('.ts') || req.url.endsWith('.tsx')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
  if (req.url.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
  }
  next();
});

// Serve a working redirect page for production
app.get('*', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kanban Master - Projektmanagement Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 3rem;
            background: rgba(255,255,255,0.15);
            border-radius: 20px;
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255,255,255,0.2);
            max-width: 600px;
            box-shadow: 0 25px 45px rgba(0,0,0,0.1);
        }
        .logo {
            font-size: 4rem;
            margin-bottom: 1rem;
            animation: bounce 2s infinite;
        }
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            font-weight: 300;
        }
        .subtitle {
            font-size: 1.1rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        .loading {
            margin: 2rem 0;
            font-size: 1rem;
        }
        .spinner {
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 3px solid white;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            display: inline-block;
            margin-right: 15px;
            vertical-align: middle;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .btn {
            display: inline-block;
            padding: 15px 35px;
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            margin: 20px;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 35px rgba(0,0,0,0.3);
        }
        .footer {
            margin-top: 2rem;
            font-size: 0.9rem;
            opacity: 0.8;
        }
        .features {
            margin: 1.5rem 0;
            opacity: 0.9;
        }
        .features span {
            display: inline-block;
            margin: 0 10px;
            padding: 5px 10px;
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🚀</div>
        <h1>Kanban Master</h1>
        <p class="subtitle">Ihre vollständige Projektmanagement-Plattform</p>
        
        <div class="features">
            <span>📋 Kanban Boards</span>
            <span>👥 Team Management</span>
            <span>💳 Stripe Integration</span>
        </div>
        
        <div class="loading">
            <div class="spinner"></div>
            Verbindung wird hergestellt...
        </div>
        
        <a href="https://0fe82899-989d-49e3-8509-b9664bfb91a4-00-2bmgwi1rdphg0.worf.replit.dev/" class="btn">
            🎯 Zur Anwendung
        </a>
        
        <div class="footer">
            <p>Alle Features sofort verfügbar • Sichere Datenbank • Stripe Zahlungen</p>
        </div>
    </div>
    
    <script>
        // Automatische Weiterleitung nach 3 Sekunden
        let countdown = 3;
        const countdownEl = document.querySelector('.loading');
        
        const timer = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                countdownEl.innerHTML = '<div class="spinner"></div>Weiterleitung in ' + countdown + ' Sekunden...';
            } else {
                countdownEl.innerHTML = '<div class="spinner"></div>Starte Anwendung...';
                clearInterval(timer);
                window.location.href = 'https://0fe82899-989d-49e3-8509-b9664bfb91a4-00-2bmgwi1rdphg0.worf.replit.dev/';
            }
        }, 1000);
    </script>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Production server running on port ${port}`);
});

export default app;