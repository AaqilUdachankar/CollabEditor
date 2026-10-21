import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';
import { config } from './config/index.js';
import { initDatabase } from './db/connection.js';
import apiRouter from './routes/index.js';
import { setupSocketIO } from './sockets/index.js';
import { setupYjsWebSocket } from './sockets/yjsHandler.js';
import { setupTerminalWebSocket } from './sockets/terminalHandler.js';

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend client
app.use(cors({
  origin: (origin, callback) => {
    // Allow local development and same-host origins
    callback(null, true);
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Request logging in development
if (config.nodeEnv !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (!req.url.startsWith('/api/health')) {
        console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'CollabIDE Backend',
  });
});

// Mount API routes
app.use('/api', apiRouter);

// 404 handler for API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Setup Socket.IO for collaboration presence and file tree events
setupSocketIO(server);

// Setup WebSocket server for Yjs sync and Terminal streaming
const wss = new WebSocketServer({ noServer: true });

setupYjsWebSocket(wss);
setupTerminalWebSocket(wss);

// Dispatch upgrade requests to WebSocket server
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';

  if (pathname.startsWith('/yjs') || pathname.startsWith('/term')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (!pathname.startsWith('/socket.io')) {
    socket.destroy();
  }
});

// Start server
async function startServer() {
  await initDatabase();

  server.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 CollabIDE Backend running on http://localhost:${config.port}`);
    console.log(`📡 WebSocket Yjs endpoint: ws://localhost:${config.port}/yjs`);
    console.log(`💻 Terminal WebSocket endpoint: ws://localhost:${config.port}/term`);
    console.log(`⚡ Socket.IO path: http://localhost:${config.port}/socket.io`);
    console.log(`=======================================================`);
  });
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection at]:', promise, 'reason:', reason);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

startServer();

export { app, server };
