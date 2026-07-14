const { WebSocketServer } = require('ws');
const url = require('url');
const ChatSession = require('../models/ChatSession');
const { getSessionByToken } = require('./live-chat-session.service');

const agentSockets = new Map();
const visitorSockets = new Map();

function sessionKey(companyId, sessionToken) {
  return `${companyId}:${sessionToken}`;
}

function broadcastToSession(companyId, sessionToken, payload) {
  const key = sessionKey(companyId, sessionToken);
  const visitors = visitorSockets.get(key);
  if (visitors) {
    for (const ws of visitors) {
      if (ws.readyState === 1) ws.send(JSON.stringify(payload));
    }
  }
  const agents = agentSockets.get(key);
  if (agents) {
    for (const ws of agents) {
      if (ws.readyState === 1) ws.send(JSON.stringify(payload));
    }
  }
}

function attachWebSocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    if (pathname !== '/api/v1/widget/ws') {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws, request) => {
    const query = url.parse(request.url, true).query;
    const sessionToken = String(query.session || '');
    const role = String(query.role || 'visitor');

    if (!sessionToken) {
      ws.close(1008, 'session required');
      return;
    }

    const session = await getSessionByToken(sessionToken);
    if (!session) {
      ws.close(1008, 'invalid session');
      return;
    }

    const key = sessionKey(String(session.company), sessionToken);
    const map = role === 'agent' ? agentSockets : visitorSockets;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(ws);

    ws.send(
      JSON.stringify({
        type: 'connected',
        data: { sessionId: session._id, status: session.status },
      }),
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        if (msg.type === 'typing') {
          broadcastToSession(String(session.company), sessionToken, {
            type: 'typing',
            data: { role: msg.data?.role || role, active: Boolean(msg.data?.active) },
          });
        }
      } catch {
        // ignore malformed
      }
    });

    ws.on('close', () => {
      map.get(key)?.delete(ws);
      if (map.get(key)?.size === 0) map.delete(key);
    });
  });

  return {
    broadcastToSession,
    notifyAgentJoined(companyId, sessionToken, agent) {
      broadcastToSession(companyId, sessionToken, {
        type: 'system_event',
        data: {
          event: 'agent_joined',
          agentName: require('./ticket-system-events.service').agentDisplayName(agent),
        },
      });
    },
    notifyMessage(companyId, sessionToken, message) {
      broadcastToSession(companyId, sessionToken, {
        type: 'message',
        data: message,
      });
    },
    notifyStatus(companyId, sessionToken, status) {
      broadcastToSession(companyId, sessionToken, {
        type: 'status',
        data: { status },
      });
    },
  };
}

module.exports = {
  attachWebSocketServer,
  broadcastToSession,
};
