// ═══════════════════════════════════════════════════════════════════
// WeildBuild Socket.IO Server
// ═══════════════════════════════════════════════════════════════════
//
// Real-time server for WeildBuild. Deploy this to Render (or any host
// that supports long-lived Node processes + WebSockets).
//
// Events handled:
//   • user:online       — client emits { username } on connect
//   • friend:request    — routed to a specific user by username
//   • friend:accepted   — routed to a specific user by username
//   • game:join         — client joins a game room, server broadcasts player list
//   • game:move         — client emits position/rotation, server broadcasts to room
//   • game:chat         — client emits a chat message, server broadcasts to room
//   • game:leave        — client leaves the game room
//
// The Next.js frontend (on Vercel) connects to this server via the URL
// you set in NEXT_PUBLIC_SOCKET_URL env var.
//
// Render deployment:
//   1. Push this folder to a GitHub repo (or the whole project)
//   2. Render → New → Web Service → connect repo
//   3. Root Directory: socket-server
//   4. Build Command: npm install
//   5. Start Command: npm start
//   6. Plan: Free (or Starter for always-on)
//   7. Environment Variables:
//        ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
//   8. Deploy — Render will give you a URL like https://weildbuild-socket.onrender.com
//
// Then on Vercel, set:
//   NEXT_PUBLIC_SOCKET_URL=https://weildbuild-socket.onrender.com

const { createServer } = require('http');
const { Server } = require('socket.io');

// ─── Configuration ───
const PORT = process.env.PORT || 3003;
// Comma-separated list of allowed origin URLs (your Vercel app + any preview URLs).
// Use "*" only for development — never in production.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ─── In-memory state ───
// username -> socket.id (for routing friend requests / direct messages)
const usernameToSocketId = new Map();
// socket.id -> username (for cleanup on disconnect)
const socketIdToUsername = new Map();
// gameId -> Map<socketId, { username, avatar, position, rotation }>
const gameRooms = new Map();

// ─── HTTP server with health check ───
const httpServer = createServer((req, res) => {
  // Render pings this endpoint to check if the service is alive
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'weildbuild-socket',
      connectedUsers: usernameToSocketId.size,
      activeGames: gameRooms.size,
      timestamp: new Date().toISOString(),
    }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

// ─── Socket.IO server ───
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS.length === 1 && ALLOWED_ORIGINS[0] === '*' ? '*' : ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Long ping intervals because Render's load balancer might otherwise
  // think the connection is dead and close it.
  pingTimeout: 60000,
  pingInterval: 25000,
  // Allow large payloads (avatar data can be chunky)
  maxHttpBufferSize: 1e6,
});

// ─── Helpers ───
function getPlayersInGame(gameId) {
  const room = gameRooms.get(gameId);
  if (!room) return [];
  return Array.from(room.values()).map(p => ({
    socketId: p.socketId,
    username: p.username,
    avatar: p.avatar,
    position: p.position,
    rotation: p.rotation,
  }));
}

function broadcastPlayerList(gameId) {
  const players = getPlayersInGame(gameId);
  io.to(`game:${gameId}`).emit('game:players', players);
}

// ─── Connection handler ───
io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ─── User presence ───
  socket.on('user:online', ({ username }) => {
    if (!username) return;
    console.log(`[user:online] ${username} (${socket.id})`);
    socketIdToUsername.set(socket.id, username);
    usernameToSocketId.set(username, socket.id);
  });

  // ─── Friend request routing ───
  // Client emits: socket.emit('friend:request', { from, to })
  // Server routes to the target user's socket by username.
  socket.on('friend:request', ({ from, to }) => {
    if (!from || !to) return;
    const targetSocketId = usernameToSocketId.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend:request', { from, to });
      console.log(`[friend:request] ${from} → ${to}`);
    } else {
      // Target user is offline — they'll see the request on next login
      // (the HTTP API persists it to Supabase)
      console.log(`[friend:request] ${from} → ${to} (offline, not relayed)`);
    }
  });

  socket.on('friend:accepted', ({ username, friend }) => {
    // 'username' accepted 'friend's request — notify 'friend'
    if (!username || !friend) return;
    const targetSocketId = usernameToSocketId.get(friend);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend:accepted', { username, friend });
      console.log(`[friend:accepted] ${username} accepted ${friend}'s request`);
    }
  });

  // ─── Multiplayer game events ───
  socket.on('game:join', ({ gameId, username, avatar }) => {
    if (!gameId || !username) return;
    console.log(`[game:join] ${username} → game ${gameId}`);

    // Leave any previous game room
    for (const [gid, room] of gameRooms.entries()) {
      if (room.has(socket.id)) {
        room.delete(socket.id);
        socket.leave(`game:${gid}`);
        io.to(`game:${gid}`).emit('game:playerLeft', { socketId: socket.id, username: room.get(socket.id)?.username });
        broadcastPlayerList(gid);
        if (room.size === 0) gameRooms.delete(gid);
      }
    }

    // Join the new game room
    socket.join(`game:${gameId}`);
    if (!gameRooms.has(gameId)) gameRooms.set(gameId, new Map());
    gameRooms.get(gameId).set(socket.id, {
      socketId: socket.id,
      username,
      avatar: avatar || null,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
    });

    // Send current player list to the joining user
    socket.emit('game:players', getPlayersInGame(gameId));
    // Notify everyone else in the room
    socket.to(`game:${gameId}`).emit('game:playerJoined', {
      socketId: socket.id,
      username,
      avatar: avatar || null,
    });
    broadcastPlayerList(gameId);
  });

  socket.on('game:move', ({ gameId, position, rotation }) => {
    if (!gameId) return;
    const room = gameRooms.get(gameId);
    if (!room || !room.has(socket.id)) return;
    const player = room.get(socket.id);
    player.position = position;
    player.rotation = rotation;
    // Broadcast to everyone else in the room (not the sender — they already moved locally)
    socket.to(`game:${gameId}`).emit('game:playerMoved', {
      socketId: socket.id,
      username: player.username,
      position,
      rotation,
    });
  });

  socket.on('game:chat', ({ gameId, username, message }) => {
    if (!gameId || !username || !message) return;
    // Broadcast chat to everyone in the room (including sender for echo confirmation)
    io.to(`game:${gameId}`).emit('game:chat', {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      username,
      message,
      timestamp: Date.now(),
    });
  });

  socket.on('game:leave', ({ gameId }) => {
    if (!gameId) return;
    const room = gameRooms.get(gameId);
    if (!room || !room.has(socket.id)) return;
    const player = room.get(socket.id);
    room.delete(socket.id);
    socket.leave(`game:${gameId}`);
    io.to(`game:${gameId}`).emit('game:playerLeft', {
      socketId: socket.id,
      username: player.username,
    });
    broadcastPlayerList(gameId);
    if (room.size === 0) gameRooms.delete(gameId);
    console.log(`[game:leave] ${player.username} left game ${gameId}`);
  });

  // ─── Disconnect cleanup ───
  socket.on('disconnect', () => {
    const username = socketIdToUsername.get(socket.id);
    console.log(`[disconnect] ${username || socket.id}`);

    // Remove from username index
    if (username) {
      // Only delete if this socket.id is the current one for the username
      // (prevents a stale reconnect from wiping a fresh connection)
      if (usernameToSocketId.get(username) === socket.id) {
        usernameToSocketId.delete(username);
      }
      socketIdToUsername.delete(socket.id);
    }

    // Remove from all game rooms
    for (const [gameId, room] of gameRooms.entries()) {
      if (room.has(socket.id)) {
        const player = room.get(socket.id);
        room.delete(socket.id);
        socket.leave(`game:${gameId}`);
        io.to(`game:${gameId}`).emit('game:playerLeft', {
          socketId: socket.id,
          username: player.username,
        });
        broadcastPlayerList(gameId);
        if (room.size === 0) gameRooms.delete(gameId);
      }
    }
  });

  socket.on('error', (err) => {
    console.error(`[error] ${socket.id}:`, err);
  });
});

// ─── Start ───
httpServer.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════════════════════╗`);
  console.log(`║  WeildBuild Socket.IO Server listening on port ${PORT}    ║`);
  console.log(`║  Allowed origins: ${JSON.stringify(ALLOWED_ORIGINS).padEnd(34)}║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
});

// ─── Graceful shutdown ───
process.on('SIGTERM', () => {
  console.log('Received SIGTERM — shutting down...');
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT — shutting down...');
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
});
