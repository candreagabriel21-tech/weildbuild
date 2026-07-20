# WeildBuild Socket.IO Server

Real-time websocket server for WeildBuild — handles friend requests, multiplayer game positions, and in-game chat. Deploy this to Render (or any host that supports long-lived Node processes + WebSockets).

## Why this exists

The Next.js app runs on Vercel (serverless HTTP), which **cannot** host a long-lived socket.io server. So real-time features live here, on a separate host. The Vercel frontend connects to this server over WebSockets.

## Deploy to Render (5 minutes)

### Option A: Blueprint (fastest)

1. Push this whole project to GitHub
2. Go to https://dashboard.render.com/blueprints
3. New Blueprint → select your repo → Render detects `socket-server/render.yaml`
4. Set `ALLOWED_ORIGINS` to your Vercel URL (e.g. `https://weildbuild.vercel.app`)
5. Apply — Render builds + deploys automatically

### Option B: Manual

1. Push this whole project to GitHub
2. Render Dashboard → **New +** → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Name:** `weildbuild-socket`
   - **Root Directory:** `socket-server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (or Starter for always-on — see note below)
5. Environment Variables:
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app` (comma-separated for multiple URLs)
6. **Create Web Service**
7. Wait ~1 minute for the build → you'll get a URL like `https://weildbuild-socket.onrender.com`

### Verify it's running

Visit `https://weildbuild-socket.onrender.com/health` in your browser — you should see:
```json
{"status":"ok","service":"weildbuild-socket","connectedUsers":0,"activeGames":0,"timestamp":"..."}
```

## ⚠️ Free tier sleep

Render's **free** web services spin down after 15 minutes of inactivity. When a user connects, the service wakes up (takes ~30 seconds for the first connection). To keep it always-on:

- **Option 1:** Upgrade Render plan to **Starter** ($7/mo) — never sleeps
- **Option 2:** Ping the service every 10 minutes with a free cron service:
  - Go to https://cron-job.org (free)
  - Create a job: URL = `https://weildbuild-socket.onrender.com/health`, every 10 minutes
  - This keeps the free service awake

## Wire up the Vercel frontend

After deploying, set this env var on Vercel (Project → Settings → Environment Variables):

```
NEXT_PUBLIC_SOCKET_URL = https://weildbuild-socket.onrender.com
```

Then redeploy the Vercel app. The frontend will now connect to your Render socket server instead of trying to connect to itself (which was the bug that caused the lag).

## Events handled

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `user:online` | client → server | `{ username }` | Register the user as online (enables friend-request routing) |
| `friend:request` | client → server → client | `{ from, to }` | Routes a friend request to the target user |
| `friend:accepted` | client → server → client | `{ username, friend }` | Routes an accepted-request notification |
| `game:join` | client → server | `{ gameId, username, avatar }` | Join a multiplayer game room |
| `game:move` | client → server → room | `{ gameId, position, rotation }` | Broadcast player movement to the room |
| `game:chat` | client → server → room | `{ gameId, username, message }` | Broadcast chat to the room |
| `game:leave` | client → server | `{ gameId }` | Leave the game room |
| `game:players` | server → client | `Array<{ socketId, username, avatar, position, rotation }>` | Full player list (sent on join + whenever it changes) |
| `game:playerJoined` | server → room | `{ socketId, username, avatar }` | A new player joined |
| `game:playerMoved` | server → room | `{ socketId, username, position, rotation }` | A player moved |
| `game:playerLeft` | server → room | `{ socketId, username }` | A player left |

## Local development

```bash
cd socket-server
npm install
npm start
```

Server runs on `http://localhost:3003`. For local frontend testing, set `NEXT_PUBLIC_SOCKET_URL=http://localhost:3003` in your `.env`.
