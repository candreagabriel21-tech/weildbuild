// ═══════════════════════════════════════════════════════════
// WeildBuild Socket.io Server
// Handles real-time: multiplayer positions, chat, friend status
// Also serves a landing page when visited in a browser
// ═══════════════════════════════════════════════════════════

import { createServer } from "http";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));

const httpServer = createServer((req, res) => {
  // Serve the landing page at /
  if (req.url === "/" || req.url === "/index.html") {
    try {
      const html = readFileSync(join(__dirname, "public", "index.html"), "utf-8");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
      return;
    } catch {
      // Fallback if file not found
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html><body style="background:#0a0a1a;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h1>WeildBuild Socket Server</h1><p>Real-time multiplayer server is running.</p><p>Visit <a href="https://weildbuild.vercel.app" style="color:#8f3dff">weildbuild.vercel.app</a> to play!</p></div></body></html>`);
      return;
    }
  }

  // Serve logo images
  if (req.url?.startsWith("/logos/")) {
    try {
      const filePath = join(__dirname, "public", req.url);
      const data = readFileSync(filePath);
      const ext = req.url.endsWith(".png") ? "image/png" : "application/octet-stream";
      res.writeHead(200, { "Content-Type": ext });
      res.end(data);
      return;
    } catch {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
  }

  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", online: onlineUsers.size }));
    return;
  }

  // Default: let Socket.io handle it
  res.writeHead(404);
  res.end("Not found");
});

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
    if (targetSocket) io.to(targetSocket).emit("friend:request", { from });
  });

  socket.on("friend:accepted", ({ to, from }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) io.to(targetSocket).emit("friend:accepted", { from });
  });

  // ─── Chat messages ───
  socket.on("chat:message", ({ gameId, sender, content, timestamp }) => {
    io.emit(`game:${gameId}:chat`, { sender, content, timestamp });
  });

  // ─── Multiplayer: game join/leave ───
  socket.on("game:join", ({ gameId, username, avatar }) => {
    socket.join(`game:${gameId}`);
    socket.data.gameId = gameId;
    socket.data.username = username;
    socket.data.avatar = avatar;
    io.to(`game:${gameId}`).emit("game:player:join", {
      username, avatar, position: { x: 0, y: 3, z: 0 },
    });
    // Tell the new player about existing players
    const players: any[] = [];
    for (const [id, sock] of io.sockets.sockets) {
      if (sock.id !== socket.id && sock.data.gameId === gameId && sock.data.username) {
        players.push({ username: sock.data.username, avatar: sock.data.avatar, position: { x: 0, y: 3, z: 0 } });
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
    socket.to(`game:${gameId}`).emit("game:player:move", { username, position, rotation });
  });

  // ─── Notifications ───
  socket.on("notification:send", ({ to, type, message, from }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) io.to(targetSocket).emit("notification", { type, message, from });
  });
});

httpServer.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║  WeildBuild Socket.io Server         ║`);
  console.log(`║  Running on port ${PORT}               ║`);
  console.log(`║  Path: /socket.io/                   ║`);
  console.log(`║  Landing: / (browser)                ║`);
  console.log(`╚══════════════════════════════════════╝`);
});
