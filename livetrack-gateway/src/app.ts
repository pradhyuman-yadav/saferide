/**
 * app.ts — HTTP server + WebSocket upgrade handler.
 *
 * Exported separately from index.ts so integration tests can import it
 * without triggering Firebase initialization or port binding.
 *
 * WebSocket auth flow:
 *   1. Client sends HTTP upgrade request with Authorization header or ?token= param.
 *   2. We verify the Firebase ID token and load the user profile.
 *   3. On success → complete the WebSocket handshake and hand off to LiveTrackGateway.
 *   4. On failure → write HTTP 401 and destroy the socket (no WS frame sent).
 */
import http from 'http';
import { parse } from 'url';
import { WebSocketServer } from 'ws';
import { logger } from '@saferide/logger';
import { verifyToken, extractToken } from './auth';
import { LiveTrackGateway } from './gateway';
import { config } from './config';

// ── HTTP server (health check + WebSocket upgrade) ────────────────────────────

export const httpServer = http.createServer((_req, res) => {
  // Plain HTTP only serves /health — everything else is a WebSocket connection
  if (_req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { service: 'livetrack-gateway', status: 'ok' } }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// ── WebSocket server — noServer: true means we control the upgrade ────────────

const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  void (async () => {
    try {
      const { query } = parse(request.url ?? '', true);

      const token = extractToken(
        request.headers as Record<string, string | string[] | undefined>,
        query           as Record<string, string | string[] | undefined>,
      );

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n');
        socket.destroy();
        return;
      }

      const user = await verifyToken(token);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n');
        socket.destroy();
        return;
      }

      // Handshake OK — promote to WebSocket
      wss.handleUpgrade(request, socket, head, (ws) => {
        const gateway = new LiveTrackGateway(
          ws,
          user,
          config.WS_PING_INTERVAL_MS,
          config.WS_PONG_TIMEOUT_MS,
        );
        gateway.start();
        logger.info({ uid: user.uid, tenantId: user.tenantId }, 'WebSocket connection established');
      });
    } catch (err) {
      logger.error({ err }, 'Unexpected error during WebSocket upgrade');
      socket.write('HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
    }
  })();
});
