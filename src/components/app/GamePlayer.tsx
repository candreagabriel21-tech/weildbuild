'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import type { UserData, GameData } from "@/lib/store";
import {
  DEFAULT_AVATAR,
  moderateText, isTextClean, isTouchDevice, mobileInputRef,
  type RemotePlayerData,
} from "./shared";
import { ViewProfileModal } from "./FriendsView";
import { AvatarIcon } from "./AvatarComponents";
import { MobileControls } from "./GameWorld";
import { StudioPlayViewport } from "@/components/studio/StudioPlayViewport";
import { useStudioStore } from "@/lib/studio-store";
import {
  snapshotStudioState,
  restoreStudioState,
  findSpawnPosition,
  isValidStudioState,
  type StudioProjectState,
} from "@/lib/studio-project";
import { gameDataToStudioState } from "@/components/WeildCreateStudio";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Users, Settings, ArrowLeft, Heart, MessageCircle, Send,
  Eye, UserPlus, Menu, Smartphone, Keyboard
} from "lucide-react";


// ==================== GAME PLAYER ====================
export function GamePlayer({ game, user, socket, onExit, onUpdateGame, isTestPlay }: { game: GameData; user: UserData; socket: Socket | null; onExit: () => void; onUpdateGame: (id: string, updates: any) => void; isTestPlay?: boolean }) {
  // Chat state - each message gets a unique id for dedup
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; content: string; timestamp: number }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showPlayers, setShowPlayers] = useState(false);
  const [showInGameSettings, setShowInGameSettings] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [useArrowKeys, setUseArrowKeys] = useState(false);
  const [cameraZoom, setCameraZoom] = useState(12);
  const [viewingPlayerProfile, setViewingPlayerProfile] = useState<string | null>(null);
  const [gameVolume, setGameVolume] = useState(80);
  const [gameWorldHP, setGameWorldHP] = useState(100);
  const [gameWorldMaxHP, setGameWorldMaxHP] = useState(100);
  const gamePrimitives = game.primitives || [];
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const controlsEnabled = showControls;
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ═══════════════════════════════════════════════════════════════════
  // STUDIO ENGINE LIFECYCLE — the heart of the 1:1 editor↔game fix.
  //
  // On mount, we make the global studio store contain EXACTLY the scene
  // the user wants to play, then call startTestPlayMode(spawn). The
  // studio's PhysicsSimulation + PlayCharacter + WeildCode engine then
  // run identically to how they run inside the WeildCreate editor's
  // own Test Play button. Whatever the editor shows, the game shows.
  //
  // Two cases:
  //   • Test Play (launched from WeildCreate): the user's work-in-progress
  //     is ALREADY in the store. We just call startTestPlayMode.
  //   • Published game (launched from lobby): we save the current store
  //     state (so the user's editor work isn't lost), load the game's
  //     studioState into the store, then startTestPlayMode.
  //
  // On unmount, stopPlayMode restores the in-play snapshot, and if we
  // saved a pre-game editor state, we restore that too.
  // ═══════════════════════════════════════════════════════════════════
  const savedEditorStateRef = useRef<StudioProjectState | null>(null);
  const playStartedRef = useRef(false);

  useEffect(() => {
    // Reset refs on each (re)mount
    savedEditorStateRef.current = null;
    playStartedRef.current = false;

    // Always sync the user's avatar into the store so the right character
    // shows up in play mode (the studio's PlayCharacter reads from store.avatar).
    useStudioStore.getState().setAvatar(user.avatar);

    if (isTestPlay) {
      // ─── Test Play: state is already in the store from the editor ───
      // The WeildCreateStudio component left the user's WIP scene in the
      // store before calling onTestPlay. We just need to start play mode.
    } else if (game.studioState && isValidStudioState(game.studioState)) {
      // ─── Published game with full studio state ───
      // Save current editor state so we can restore it when the user exits.
      savedEditorStateRef.current = snapshotStudioState();
      // Load the published game's full state into the store. This replaces
      // objects, joints, worldSettings, terrain, WeildCode rules, etc.
      restoreStudioState(game.studioState);
    } else {
      // ─── Legacy game (saved before this fix) ───
      // Convert the downgraded primitives array back into studio parts.
      // We won't have WeildCode rules, terrain, sky settings, etc., but
      // at least the basic geometry will show up and be playable.
      savedEditorStateRef.current = snapshotStudioState();
      const studioObjects = gameDataToStudioState(game);
      useStudioStore.getState().loadProject({ objects: studioObjects });
    }

    // Find spawn position from the (now-loaded) studio state
    const currentState = snapshotStudioState();
    const spawn = findSpawnPosition(currentState);

    // Start test play mode — this snapshots the current state and sets
    // isPlaying=true, isTestPlay=true. The PhysicsSimulation component
    // (rendered by StudioPlayViewport) will pick this up and start the
    // physics world + WeildCode engine on the next frame.
    useStudioStore.getState().startTestPlayMode(spawn);
    playStartedRef.current = true;

    // Cleanup: runs on unmount
    return () => {
      // Stop play mode — restores the in-play snapshot taken by startTestPlayMode.
      // Safe to call even if startTestPlayMode failed.
      if (playStartedRef.current) {
        useStudioStore.getState().stopPlayMode();
        playStartedRef.current = false;
      }

      // If we saved the user's editor state before playing a published game,
      // restore it now so the user returns to their work-in-progress.
      if (savedEditorStateRef.current) {
        restoreStudioState(savedEditorStateRef.current);
        savedEditorStateRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, isTestPlay]);

  // Auto-detect touch device on mount and enable mobile controls
  useEffect(() => {
    if (isTouchDevice()) {
      setShowControls(true); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, []);

  // Multiplayer state - track remote players by socketId
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerData[]>([]);
  const remotePlayersRef = useRef<Map<string, RemotePlayerData>>(new Map());
  // Track online player usernames
  const [onlinePlayers, setOnlinePlayers] = useState<string[]>([user.username]);
  // Chat bubbles for players (socketId -> last message, auto-fade)
  const [chatBubbles, setChatBubbles] = useState<Record<string, string>>({});
  const chatBubbleTimers = useRef<Record<string, NodeJS.Timeout>>({});
  // Track our own sent messages to dedup server echoes
  const sentMessageIds = useRef<Set<string>>(new Set());

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendFriendRequest = async (to: string) => {
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", from: user.username, to }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Friend request sent to " + to + "!" });
        if (socket) socket.emit("friend:request", { from: user.username, to });
      }
    } catch {}
  };

  const handleInGameCancelRequest = async (to: string) => {
    try {
      await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", from: user.username, to }) });
      toast({ title: "Friend request cancelled" });
    } catch {}
  };

  const handleInGameRemoveFriend = async (friend: string) => {
    try {
      await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", from: user.username, friend }) });
      toast({ title: "Friend removed" });
    } catch {}
  };

  const handleInGameBlockUser = async (target: string) => {
    try {
      await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "block", from: user.username, target }) });
      toast({ title: "User blocked" });
    } catch {}
  };

  const showChatBubble = useCallback((socketId: string, message: string) => {
    setChatBubbles(prev => ({ ...prev, [socketId]: message }));
    // Clear previous timer
    if (chatBubbleTimers.current[socketId]) {
      clearTimeout(chatBubbleTimers.current[socketId]);
    }
    // Auto-remove bubble after 4 seconds
    chatBubbleTimers.current[socketId] = setTimeout(() => {
      setChatBubbles(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    }, 4000);
  }, []);

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const raw = chatInput.trim();
    if (!isTextClean(raw)) {
      setChatInput("");
      return;
    }
    const moderated = moderateText(raw);
    const msgId = `${user.username}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Optimistic local display - add immediately
    setChatMessages(prev => [...prev, { id: msgId, sender: user.username, content: moderated, timestamp: Date.now() }]);
    // Mark as sent for dedup
    sentMessageIds.current.add(msgId);
    // Send to server
    if (socket) {
      socket.emit("game:chat", { gameId: game.id, username: user.username, message: moderated });
    }
    setChatInput("");
  };

  // Position update callback - called from GameWorld's useFrame
  const handlePositionUpdate = useCallback((pos: [number, number, number], rot: number) => {
    if (socket) {
      socket.emit("game:move", { gameId: game.id, position: [pos[0], pos[1], pos[2]], rotation: [0, rot, 0] });
    }
  }, [socket, game.id]);

  // Socket event handlers for multiplayer + chat
  useEffect(() => {
    if (!socket) return;

    // Join the game room
    socket.emit("game:join", { gameId: game.id, username: user.username, avatar: user.avatar });

    // Receive current player list when joining
    const handlePlayers = (data: any[]) => {
      const players: string[] = [user.username];
      const newRemoteMap = new Map<string, RemotePlayerData>();
      for (const p of data) {
        if (p.username !== user.username) {
          players.push(p.username);
          newRemoteMap.set(p.socketId, {
            socketId: p.socketId,
            username: p.username,
            position: p.position || [0, 0, 0],
            rotation: p.rotation || [0, 0, 0],
            avatar: p.avatar || DEFAULT_AVATAR,
          });
        }
      }
      remotePlayersRef.current = newRemoteMap;
      setRemotePlayers(Array.from(newRemoteMap.values()));
      setOnlinePlayers(players);
    };

    // Another player joined
    const handlePlayerJoined = (data: any) => {
      if (data.username === user.username) return;
      const map = new Map(remotePlayersRef.current);
      map.set(data.socketId, {
        socketId: data.socketId,
        username: data.username,
        position: data.position || [0, 0, 0],
        rotation: data.rotation || [0, 0, 0],
        avatar: data.avatar || DEFAULT_AVATAR,
      });
      remotePlayersRef.current = map;
      setRemotePlayers(Array.from(map.values()));
      setOnlinePlayers(prev => prev.includes(data.username) ? prev : [...prev, data.username]);
    };

    // A player moved
    const handlePlayerMoved = (data: any) => {
      const map = new Map(remotePlayersRef.current);
      const existing = map.get(data.socketId);
      if (existing) {
        map.set(data.socketId, { ...existing, position: data.position, rotation: data.rotation });
        remotePlayersRef.current = map;
        setRemotePlayers(Array.from(map.values()));
      }
    };

    // A player left
    const handlePlayerLeft = (data: any) => {
      const map = new Map(remotePlayersRef.current);
      const leaving = map.get(data.socketId);
      map.delete(data.socketId);
      remotePlayersRef.current = map;
      setRemotePlayers(Array.from(map.values()));
      if (leaving) {
        setOnlinePlayers(prev => prev.filter(p => p !== leaving.username));
      }
    };

    // Chat message from server
    const handleChat = (msg: any) => {
      // Dedup: skip our own messages (we already added them optimistically)
      if (msg.username === user.username || msg.sender === user.username) return;

      const msgId = `server-${msg.username}-${msg.timestamp || Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const content = moderateText(msg.message || msg.content || "");
      setChatMessages(prev => [...prev, { id: msgId, sender: msg.username || msg.sender, content, timestamp: Date.now() }]);

      // Show chat bubble above the player who sent it
      const rp = remotePlayersRef.current;
      for (const [socketId, player] of rp) {
        if (player.username === (msg.username || msg.sender)) {
          showChatBubble(socketId, content);
          break;
        }
      }
    };

    // Socket reconnection - rejoin game room
    const handleReconnect = () => {
      socket.emit("game:join", { gameId: game.id, username: user.username, avatar: user.avatar });
    };

    socket.on("game:players", handlePlayers);
    socket.on("game:playerJoined", handlePlayerJoined);
    socket.on("game:playerMoved", handlePlayerMoved);
    socket.on("game:playerLeft", handlePlayerLeft);
    socket.on("game:chat", handleChat);
    socket.on("connect", handleReconnect);

    return () => {
      socket.emit("game:leave", { gameId: game.id, username: user.username });
      socket.off("game:players", handlePlayers);
      socket.off("game:playerJoined", handlePlayerJoined);
      socket.off("game:playerMoved", handlePlayerMoved);
      socket.off("game:playerLeft", handlePlayerLeft);
      socket.off("game:chat", handleChat);
      socket.off("connect", handleReconnect);
    };
  }, [socket, game.id, user.username, user.avatar, showChatBubble]);

  const topColor = game.sky_color_top ? `rgb(${Math.round(game.sky_color_top[0]*255)}, ${Math.round(game.sky_color_top[1]*255)}, ${Math.round(game.sky_color_top[2]*255)})` : "#6699cc";
  const bottomColor = game.sky_color_bottom ? `rgb(${Math.round(game.sky_color_bottom[0]*255)}, ${Math.round(game.sky_color_bottom[1]*255)}, ${Math.round(game.sky_color_bottom[2]*255)})` : "#aaccee";
  const bpColor = game.baseplate_color ? `rgb(${Math.round(game.baseplate_color[0]*255)}, ${Math.round(game.baseplate_color[1]*255)}, ${Math.round(game.baseplate_color[2]*255)})` : "#3d6666";

  // Generate a consistent color for each username
  const getUsernameColor = (username: string) => {
    const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6bb5", "#a78bfa", "#38bdf8", "#fb923c", "#34d399", "#f472b6"];
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="flex flex-col w-full overflow-hidden flex-1 min-h-0">
      {isTestPlay && (
        <div className="shrink-0 h-9 bg-amber-600/90 backdrop-blur-sm flex items-center px-3 gap-2 z-40 overflow-hidden whitespace-nowrap">
          <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">TEST PLAY</Badge>
          <span className="text-xs text-white font-medium truncate max-w-[140px]">{moderateText(game.name)}</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-6 text-[11px] px-2 shrink-0"
            onClick={onExit}>
            <ArrowLeft className="w-3 h-3 mr-1" /> Back
          </Button>
        </div>
      )}
      <div className="relative flex-1 min-h-0">
        {/* ═══════════════════════════════════════════════════════════════
            THE GAME ENGINE — StudioPlayViewport
            Renders the EXACT same scene the WeildCreate editor uses
            (PhysicsSimulation, WeildCode engine, SkySystem, TerrainMesh,
            PartMesh, etc.) for 1:1 compatibility — PLUS the old GameWorld
            character controller + orbital follow-cam that you loved.
            ═══════════════════════════════════════════════════════════════ */}
        <StudioPlayViewport
          remotePlayers={remotePlayers}
          chatBubbles={chatBubbles}
          onPositionUpdate={handlePositionUpdate}
          cameraZoomOverride={cameraZoom}
          onCameraZoomChange={(z) => setCameraZoom(z)}
          onHPChange={(hp, max) => { setGameWorldHP(hp); setGameWorldMaxHP(max); }}
          gameVolume={gameVolume}
          spawnPosition={[game.spawn_point?.[0] || 0, game.spawn_point?.[1] || 3, game.spawn_point?.[2] || 0]}
          animationsEnabled={animationsEnabled}
        />

      {/* HUD - Game info top-left */}
      <div className={`absolute left-3 right-3 flex justify-between items-start pointer-events-none z-30 ${isTestPlay ? 'top-1' : 'top-3'}`}>
        <div className="pointer-events-auto">
          <div className={`bg-slate-900/80 backdrop-blur-sm rounded-lg ${isTestPlay ? 'px-2 py-1' : 'px-3 py-2'}`}>
            {!isTestPlay && <h3 className="text-sm font-bold text-white">{moderateText(game.name)}</h3>}
            <p className={`text-slate-400 flex items-center gap-1 ${isTestPlay ? 'text-[10px]' : 'text-xs'}`}><Users className={`${isTestPlay ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} /> {onlinePlayers.length} playing</p>
            {/* HP Bar */}
            <div className={`${isTestPlay ? 'mt-0.5' : 'mt-1'} flex items-center gap-2`}>
              <Heart className={`${isTestPlay ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} text-red-400`} />
              <div className={`flex-1 bg-slate-700/80 rounded-full overflow-hidden ${isTestPlay ? 'h-1.5 min-w-[50px]' : 'h-2.5 min-w-[80px]'}`}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(0, Math.min(100, (gameWorldHP / gameWorldMaxHP) * 100))}%`,
                    background: gameWorldHP > 60 ? '#22c55e' : gameWorldHP > 30 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
              <span className={`text-slate-400 ${isTestPlay ? 'text-[8px] min-w-[24px]' : 'text-[10px] min-w-[36px]'}`}>{gameWorldHP}/{gameWorldMaxHP}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <button onClick={() => setShowPlayers(!showPlayers)} className={`bg-slate-900/80 backdrop-blur-sm rounded-lg text-slate-300 hover:text-white transition-colors ${isTestPlay ? 'px-2 py-1' : 'px-3 py-2'}`}>
            <Users className={`${isTestPlay ? 'w-3 h-3' : 'w-4 h-4'}`} />
          </button>
          <button onClick={() => setShowMenu(!showMenu)} className={`bg-slate-900/80 backdrop-blur-sm rounded-lg text-slate-300 hover:text-white transition-colors ${isTestPlay ? 'px-2 py-1' : 'px-3 py-2'}`}>
            <Menu className={`${isTestPlay ? 'w-3 h-3' : 'w-4 h-4'}`} />
          </button>
        </div>
      </div>

      {/* Mobile Controls (only visible when controls toggle is enabled) */}
      {controlsEnabled && <MobileControls />}

      {/* ==================== CONTROLS TOGGLE BUTTON ==================== */}
      {/* Keyboard icon = controls OFF (click to enable), Phone icon = controls ON (click to disable) */}
      <button
        onClick={() => setShowControls(!showControls)}
        className={`absolute right-3 pointer-events-auto z-30 group ${isTestPlay ? 'top-10' : 'top-14'}`}
        title={controlsEnabled ? "Disable mobile controls" : "Enable mobile controls"}
      >
        <div className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
          controlsEnabled
            ? "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30"
            : "bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 hover:border-slate-600/50"
        }`}>
          <AnimatePresence mode="wait">
            {controlsEnabled ? (
              <motion.div
                key="phone"
                initial={{ rotateY: 90, opacity: 0, scale: 0.5 }}
                animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                exit={{ rotateY: -90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.25 }}
              >
                <Smartphone className="w-5 h-5 text-white" />
              </motion.div>
            ) : (
              <motion.div
                key="keyboard"
                initial={{ rotateY: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                exit={{ rotateY: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.25 }}
              >
                <Keyboard className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Pulse ring when enabled */}
          {controlsEnabled && (
            <motion.div
              className="absolute inset-0 rounded-2xl border-2 border-indigo-400/50"
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>
      </button>

      {/* ==================== CONTROLS PANEL (slides in from bottom) ==================== */}
      <AnimatePresence>
        {controlsEnabled && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto z-30"
          >
            <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-indigo-500/20 px-5 py-3 flex items-center gap-5 shadow-xl shadow-black/30">
              {/* Arrow Keys toggle */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => setUseArrowKeys(!useArrowKeys)}
                  className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                    useArrowKeys
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/30"
                      : "bg-slate-700/80"
                  }`}
                >
                  <motion.div
                    className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md"
                    animate={{ left: useArrowKeys ? "30px" : "4px" }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                  {useArrowKeys ? "Arrows" : "WASD"}
                </span>
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-slate-700/50" />

              {/* Zoom slider */}
              <div className="flex flex-col items-center gap-1.5 min-w-[140px]">
                <div className="w-full relative">
                  <div className="absolute -top-1 left-0 right-0 flex justify-between text-[8px] text-slate-600 pointer-events-none">
                    <span>🔭</span><span>🔭</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={30}
                    step={0.5}
                    value={cameraZoom}
                    onChange={(e) => setCameraZoom(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer game-zoom-slider"
                    style={{
                      background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((cameraZoom - 4) / 26) * 100}%, #334155 ${((cameraZoom - 4) / 26) * 100}%, #334155 100%)`,
                    }}
                  />
                </div>
                <span className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wider">
                  Zoom {Math.round(cameraZoom)}
                </span>
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-slate-700/50" />

              {/* Jump button */}
              <button
                onClick={() => { mobileInputRef.jump = true; setTimeout(() => { mobileInputRef.jump = false; }, 100); }}
                className="group relative w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/20 active:scale-90 transition-transform"
                title="Jump"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
                </svg>
                {/* Ripple on click */}
                <span className="absolute inset-0 rounded-xl bg-white/20 scale-0 group-active:scale-100 transition-transform duration-200" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls hint (desktop only) */}
      <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-1.5 hidden md:block">
        <p className="text-[10px] text-slate-400">{controlsEnabled && useArrowKeys ? "Arrow Keys" : "WASD"}: Move &bull; Space: Jump &bull; Right-click drag: Camera &bull; Scroll: Zoom</p>
      </div>

      {/* ==================== CHAT ==================== */}
      {/* Chat toggle button */}
      <button onClick={() => setShowChat(!showChat)}
        className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 text-slate-300 hover:text-white transition-colors z-30 pointer-events-auto">
        <MessageCircle className="w-4 h-4" />
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="absolute bottom-12 right-3 w-80 z-30 pointer-events-auto"
          >
            <div className="bg-black/50 backdrop-blur-md rounded-t-2xl border border-white/10 border-b-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Chat</span>
                <div className="flex gap-1">
                  <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded font-medium">All</span>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-white/30 text-center py-4">No messages yet. Say hello!</p>
                )}
                {chatMessages.map((m) => {
                  const color = getUsernameColor(m.sender);
                  const isMe = m.sender === user.username;
                  return (
                    <div key={m.id} className="group">
                      <span className="text-xs font-bold" style={{ color }}>{m.sender}</span>
                      <span className="text-xs text-white/60">: </span>
                      <span className="text-xs text-white/90">{m.content}</span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            </div>
            {/* Chat input area */}
            <div className="bg-black/70 backdrop-blur-md rounded-b-2xl border border-white/10 border-t-0 p-2">
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Press Enter to chat..."
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
                    maxLength={200}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                  <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[9px] ${chatInput.length > 180 ? 'text-amber-400' : 'text-white/20'}`}>{chatInput.length}/200</span>
                </div>
                <button
                  onClick={sendMessage}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-3 py-1.5 transition-colors"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu overlay */}
      <AnimatePresence>
        {showMenu && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowMenu(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}>
              <Card className="bg-slate-900 border-indigo-500/30 w-[300px]">
                <CardHeader className="pb-2"><CardTitle className="text-lg text-white">Menu</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full border-slate-600 text-slate-300 justify-start" onClick={() => { setShowMenu(false); setShowPlayers(true); }}>
                    <Users className="w-4 h-4 mr-2" /> Players
                  </Button>
                  <Button variant="outline" className="w-full border-slate-600 text-slate-300 justify-start" onClick={() => { setShowMenu(false); setShowInGameSettings(true); }}>
                    <Settings className="w-4 h-4 mr-2" /> Settings
                  </Button>
                  <Separator className="bg-slate-700" />
                  <Button className="w-full bg-red-600 hover:bg-red-500 text-white" onClick={onExit}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Leave Game
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Players panel */}
      <AnimatePresence>
        {showPlayers && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className={`absolute right-3 w-56 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-indigo-500/20 p-3 z-30 ${isTestPlay ? 'top-10' : 'top-14'}`}>
            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400" /> Players ({onlinePlayers.length})</h4>
            <div className="space-y-1">
              {onlinePlayers.map((p) => {
                const isMe = p === user.username;
                const isFriend = user.friends?.includes(p);
                return (
                  <div key={p} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/50">
                    <AvatarIcon avatar={isMe ? user.avatar : (remotePlayers.find(rp => rp.username === p)?.avatar || DEFAULT_AVATAR)} size={20} />
                    <span className="text-xs text-slate-200 flex-1 cursor-pointer hover:text-indigo-300 transition-colors" onClick={() => setViewingPlayerProfile(p)}>{moderateText(p)}{isMe && " (You)"}</span>
                    {!isMe && (
                      <button onClick={() => setViewingPlayerProfile(p)} className="text-slate-400 hover:text-indigo-300" title="View profile">
                        <Eye className="w-3 h-3" />
                      </button>
                    )}
                    {!isMe && !isFriend && (
                      <button onClick={() => handleSendFriendRequest(p)} className="text-indigo-400 hover:text-indigo-300" title="Add friend">
                        <UserPlus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <Button variant="ghost" size="sm" className="w-full text-slate-400 mt-2 text-xs" onClick={() => setShowPlayers(false)}>Close</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-Game Settings Panel */}
      <AnimatePresence>
        {showInGameSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowInGameSettings(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()}>
              <Card className="bg-slate-900 border-indigo-500/30 w-[300px]">
                <CardHeader className="pb-2"><CardTitle className="text-lg text-white flex items-center gap-2"><Settings className="w-5 h-5 text-indigo-400" /> Game Settings</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1"><span className="text-sm text-slate-300">Volume</span><span className="text-xs text-slate-400">{gameVolume}%</span></div>
                    <input type="range" min={0} max={100} value={gameVolume} onChange={(e) => setGameVolume(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Animations</span>
                      <button
                        onClick={() => setAnimationsEnabled(!animationsEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-all duration-300 ${animationsEnabled ? "bg-gradient-to-r from-indigo-500 to-violet-500" : "bg-slate-700"}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${animationsEnabled ? "left-6" : "left-0.5"}`} />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Camera shake, squash &amp; stretch, FOV kick, head bob</p>
                  </div>
                  <Button variant="outline" className="w-full border-slate-600 text-slate-300" onClick={() => setShowInGameSettings(false)}>Close</Button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-Game View Profile Modal */}
      <AnimatePresence>
        {viewingPlayerProfile && (
          <ViewProfileModal
            targetUsername={viewingPlayerProfile}
            currentUser={user}
            onClose={() => setViewingPlayerProfile(null)}
            onSendRequest={handleSendFriendRequest}
            onCancelRequest={handleInGameCancelRequest}
            onRemoveFriend={handleInGameRemoveFriend}
            onBlockUser={handleInGameBlockUser}
            sentRequests={new Set()}
          />
        )}
      </AnimatePresence>
      </div>{/* end relative flex-1 min-h-0 wrapper */}
    </div>
  );
}
