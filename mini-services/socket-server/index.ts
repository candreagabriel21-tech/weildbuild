// ═══════════════════════════════════════════════════════════
// WeildBuild Socket.io Server
// Handles real-time: multiplayer positions, chat, friend status
// ═══════════════════════════════════════════════════════════

import { createServer } from "http";
import { Server } from "socket.io";

const PORT = 3001;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",  // Allow all origins (configure for production)
    methods: ["GET", "POST"],
  },
  path: "/socket.io/",
});

// Track online users: username → socketId
const onlineUsers = new Map<string, string>();

io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // User came online
  socket.on("user:online", ({ username }) => {
    if (!username) return;
    onlineUsers.set(username, socket.id);
    socket.data.username = username;
    console.log(`[Socket] User online: ${username}`);
    // Broadcast to everyone that this user is online
    io.emit("user:status", { username, online: true });
  });

  // User went offline (disconnect)
  socket.on("disconnect", () => {
    const username = socket.data.username;
    if (username) {
      onlineUsers.delete(username);
      console.log(`[Socket] User offline: ${username}`);
      io.emit("user:status", { username, online: false });
    }
  });

  // ─── Friend requests ───
  socket.on("friend:request", ({ to, from }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("friend:request", { from });
    }
  });

  socket.on("friend:accepted", ({ to, from }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("friend:accepted", { from });
    }
  });

  // ─── Chat messages ───
  socket.on("chat:message", ({ gameId, sender, content, timestamp }) => {
    // Broadcast to all users in the game
    io.emit(`game:${gameId}:chat`, { sender, content, timestamp });
  });

  // ─── Multiplayer: game join/leave ───
  socket.on("game:join", ({ gameId, username, avatar }) => {
    socket.join(`game:${gameId}`);
    socket.data.gameId = gameId;
    socket.data.username = username;
    socket.data.avatar = avatar;
    // Tell everyone in the game about the new player
    io.to(`game:${gameId}`).emit("game:player:join", {
      username,
      avatar,
      position: { x: 0, y: 3, z: 0 },
    });
    // Tell the new player about existing players
    const players: any[] = [];
    for (const [id, sock] of io.sockets.sockets) {
      if (sock.id !== socket.id && sock.data.gameId === gameId && sock.data.username) {
        players.push({
          username: sock.data.username,
          avatar: sock.data.avatar,
          position: { x: 0, y: 3, z: 0 },
        });
      }
    }
    socket.emit("game:players", { players });
  });

  socket.on("game:leave", ({ gameId, username }) => {
    socket.leave(`game:${gameId}`);
    io.to(`game:${gameId}`).emit("game:player:leave", { username });
    socket.data.gameId = null;
  });

  // ─── Multiplayer: player movement ───
  socket.on("game:move", ({ gameId, username, position, rotation }) => {
    socket.to(`game:${gameId}`).emit("game:player:move", {
      username,
      position,
      rotation,
    });
  });

  // ─── Notifications ───
  socket.on("notification:send", ({ to, type, message, from }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("notification", { type, message, from });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║  WeildBuild Socket.io Server         ║`);
  console.log(`║  Running on port ${PORT}               ║`);
  console.log(`║  Path: /socket.io/                   ║`);
  console.log(`╚══════════════════════════════════════╝`);
});
