const http = require('http');
const fs = require('fs');
const path = require('path');
let WsLib;
try {
  WsLib = require('ws');
} catch (error) {
  WsLib = require('../FreeSWITCHIntegration/node_modules/ws');
}
const WebSocketServer = WsLib.WebSocketServer || WsLib.Server;

let config = { port: 5190, pushToken: '' };
try {
  const configPath = path.join(__dirname, 'ws-config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === 'object') {
    config = Object.assign(config, parsed);
  }
} catch (error) {}

const PORT = Number(config.port || 5190);
const PUSH_TOKEN = String(config.pushToken || '');

const socketsByExtension = new Map();

function getExtensionFromUrl(urlPath) {
  try {
    const parsed = new URL(urlPath, 'http://localhost');
    return String(parsed.searchParams.get('extension') || '').trim();
  } catch (error) {
    return '';
  }
}

function addSocket(extension, ws) {
  if (!socketsByExtension.has(extension)) {
    socketsByExtension.set(extension, new Set());
  }
  socketsByExtension.get(extension).add(ws);
}

function removeSocket(extension, ws) {
  if (!socketsByExtension.has(extension)) {
    return;
  }
  const bucket = socketsByExtension.get(extension);
  bucket.delete(ws);
  if (bucket.size === 0) {
    socketsByExtension.delete(extension);
  }
}

function broadcastToExtension(extension, payload) {
  const bucket = socketsByExtension.get(extension);
  if (!bucket || bucket.size === 0) {
    return 0;
  }

  const message = JSON.stringify(payload);
  let sent = 0;
  for (const ws of bucket) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
      sent += 1;
    }
  }
  return sent;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clients: Array.from(socketsByExtension.keys()).length }));
    return;
  }

  if (req.method === 'POST' && req.url === '/push') {
    if (!PUSH_TOKEN) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Push token not configured' }));
      return;
    }

    const auth = String(req.headers.authorization || '');
    if (PUSH_TOKEN && auth !== `Bearer ${PUSH_TOKEN}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1024 * 256) {
        req.socket.destroy();
      }
    });
    req.on('end', () => {
      let payload = {};
      try {
        payload = JSON.parse(body || '{}');
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        return;
      }

      const extension = String(payload.extension || '').trim();
      if (!extension) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing extension' }));
        return;
      }

      const sent = broadcastToExtension(extension, payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sent }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not Found' }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const extension = getExtensionFromUrl(req.url || '');
  if (!extension) {
    ws.close(1008, 'Missing extension');
    return;
  }

  addSocket(extension, ws);
  ws.send(JSON.stringify({ type: 'connected', extension, ts: Date.now() }));

  ws.on('close', () => removeSocket(extension, ws));
  ws.on('error', () => removeSocket(extension, ws));
});

server.listen(PORT, () => {
  console.log(`[YeastarWS] listening on ${PORT}`);
});
