"use client";

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import NextImage from "next/image";
import type { UserData, ItemData, GameData, AvatarData, PrimitiveData, NotificationData } from "@/lib/store";
import type { View } from "@/lib/store";
import { useAuth, useItems, useGames, useFriends, useNotifications, apiFetch, saveSessionToken } from "@/lib/store";
import WeildCreateStudio from "@/components/WeildCreateStudio";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Gamepad2, ShoppingBag, User, LogOut, Plus, Users, Play, Coins,
  Palette, Home, MessageCircle, Star, ChevronRight, Sparkles, Globe,
  Heart, Send, Eye, MousePointer2, Trash2, Box, Cylinder, Triangle,
  Move, RotateCcw, Settings, Bell, Search, UserPlus, UserMinus,
  Shield, Moon, Sun, Info, X, Check, RotateCw, Ban, Menu, Code,
  ArrowLeft, Volume2, VolumeX, Camera, Grid3X3, Wrench, Hammer,
  CircleDot, Diamond, Hexagon, Zap, Pencil,
  Copy, Lock, Unlock, EyeOff, Layers, Scissors, Maximize2, FlipHorizontal, Square,
  Skull, Flag, TrendingUp, DoorOpen, Flame, Waves, Clock, Hand, Keyboard, Wifi, GitBranch,
  Snowflake, CloudRain, CloudFog, Swords, Package, MapPin, Smartphone, ChevronDown
} from "lucide-react";

// ==================== EXTRACTED COMPONENTS ====================
import { AvatarIcon } from "@/components/app/AvatarComponents";
import { AuthScreen } from "@/components/app/AuthScreen";
import LandingPage from "@/components/landing/LandingPage";
import { DiscordIconButton } from "@/components/landing/DiscordWidget";
import { WebuyDisplay } from "@/components/app/WebuyDisplay";
import { ProfileView } from "@/components/app/ProfileView";
import { LobbyView } from "@/components/app/LobbyView";
import { AvatarView } from "@/components/app/AvatarView";
import { NotificationsView } from "@/components/app/NotificationsView";
import { FriendsView } from "@/components/app/FriendsView";
import { ShopView } from "@/components/app/ShopView";
import { InventoryView } from "@/components/app/InventoryView";
import { SettingsView } from "@/components/app/SettingsView";
import { GamePlayer } from "@/components/app/GamePlayer";

// ==================== MAIN APP ====================
export default function WeildBuildApp() {
  const { user, isLoggedIn, login, register, logout, refreshUser, updateUser } = useAuth();
  const { items, fetchItems, buyItem } = useItems();
  const { games, fetchGames, fetchGame, createGame, updateGame } = useGames();
  const { fetchNotifications, markRead, notifications, unreadCount } = useNotifications();
  const [view, setView] = useState<View>("lobby");
  const [loading, setLoading] = useState(true);
  const [playingGame, setPlayingGame] = useState<GameData | null>(null);
  const [isTestPlay, setIsTestPlay] = useState(false);
  const [testPlayEditorState, setTestPlayEditorState] = useState<any>(null);
  const [testPlayKey, setTestPlayKey] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toast } = useToast();
  const socketInstanceRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => { refreshUser().finally(() => setLoading(false)); }, []);

  // Apply dark/light theme and animation settings to HTML element
  useEffect(() => {
    if (typeof window === "undefined") return;
    const darkMode = user?.visual_settings?.dark_mode !== false;
    const animations = user?.visual_settings?.animations !== false;
    const reduceMotion = user?.visual_settings?.reduce_motion === true;
    if (!darkMode) {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    if (!animations || reduceMotion) {
      document.documentElement.setAttribute("data-animations", "false");
    } else {
      document.documentElement.removeAttribute("data-animations");
    }
  }, [user?.visual_settings?.dark_mode, user?.visual_settings?.animations, user?.visual_settings?.reduce_motion]);

  // Fetch games & items only after login
  useEffect(() => {
    if (isLoggedIn) {
      fetchGames();
      fetchItems();
    }
  }, [isLoggedIn]);

  // Lock body scroll when playing a game, allow scroll otherwise
  useEffect(() => {
    if (playingGame) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [playingGame]);

  useEffect(() => {
    if (isLoggedIn && user) fetchNotifications(user.username);
  }, [isLoggedIn, user?.username]);

  useEffect(() => {
    if (isLoggedIn && !socketInstanceRef.current) {
      // ─── Connect to the Render-hosted socket.io server ───
      // The URL is set via NEXT_PUBLIC_SOCKET_URL env var on Vercel.
      // Falls back to localhost:3003 for local dev (where you'd run
      // the socket-server package separately).
      //
      // Previously this tried to connect to the SAME origin as the Next.js
      // app (/socket.io/) — but Vercel is serverless and can't host a
      // long-lived socket.io server. The connection silently failed and
      // retried forever, eating CPU and making the app feel laggy.
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3003";
      // Skip connection entirely if the URL is empty or clearly broken —
      // prevents infinite reconnect loops when misconfigured.
      if (!socketUrl || socketUrl === "https://placeholder.supabase.co") return;
      const s = io(socketUrl, {
        transports: ["websocket", "polling"],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });
      socketInstanceRef.current = s;
      queueMicrotask(() => setSocket(s));
      if (user?.username) s.emit("user:online", { username: user.username });
      // Re-emit user:online on reconnect
      s.on("connect", () => {
        if (user?.username) s.emit("user:online", { username: user.username });
      });
      // Log connection errors so misconfigurations are visible in the console
      s.on("connect_error", (err) => {
        console.warn("[socket.io] connection error:", err.message);
      });
    }
    return () => {
      if (socketInstanceRef.current) { socketInstanceRef.current.disconnect(); socketInstanceRef.current = null; }
      setSocket(null);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!socket || !user) return;
    socket.on("friend:request", () => { fetchNotifications(user.username); refreshUser(); });
    socket.on("friend:accepted", () => { fetchNotifications(user.username); refreshUser(); });
    return () => { socket.off("friend:request"); socket.off("friend:accepted"); };
  }, [socket, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(to bottom right, var(--wb-bg-app), var(--wb-bg-app-via), var(--wb-bg-app-to))` }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isLoggedIn) return <LandingPage />;

  const sidebarItems: { key: View; icon: any; label: string; badge?: number }[] = [
    { key: "lobby", icon: Home, label: "Home" },
    { key: "profile", icon: User, label: "Profile" },
    { key: "avatar", icon: Palette, label: "Avatar" },
    { key: "create", icon: Hammer, label: "Create" },
    { key: "shop", icon: ShoppingBag, label: "Shop" },
    { key: "inventory", icon: Package, label: "Inventory" },
    { key: "friends", icon: Users, label: "Friends" },
    { key: "settings", icon: Settings, label: "Settings" },
  ];

  const sidebarPosition = (user?.visual_settings?.sidebar_position || "right") as "right" | "left" | "top" | "bottom";
  const isHorizontalSidebar = sidebarPosition === "top" || sidebarPosition === "bottom";
  const sidebarW = sidebarCollapsed ? 64 : 224; // w-16 = 64px, w-56 = 224px
  const sidebarH = sidebarCollapsed ? 48 : 56; // h-12 = 48px, h-14 = 56px

  return (
    <div className={`${view === 'create' || playingGame ? 'h-screen' : 'min-h-screen'} flex flex-col`} style={{ background: view === 'create' ? '#020617' : `linear-gradient(to bottom right, var(--wb-bg-app), var(--wb-bg-app-via), var(--wb-bg-app-to))` }}>
      {/* Sidebar - hidden when in Create editor or playing a game */}
      {!playingGame && view !== "create" && (
        <aside
          className={`fixed z-50 backdrop-blur-xl transition-all duration-300 ease-in-out flex ${isHorizontalSidebar ? 'flex-row items-center' : 'flex-col'}`}
          style={{
            background: "var(--wb-bg-sidebar)",
            // Position & size based on sidebar position
            ...(isHorizontalSidebar
              ? {
                  top: sidebarPosition === 'top' ? 0 : undefined,
                  bottom: sidebarPosition === 'bottom' ? 0 : undefined,
                  left: 0,
                  right: 0,
                  height: sidebarH,
                  width: '100%',
                  borderBottom: sidebarPosition === 'top' ? '1px solid var(--wb-border)' : undefined,
                  borderTop: sidebarPosition === 'bottom' ? '1px solid var(--wb-border)' : undefined,
                }
              : {
                  top: 0,
                  bottom: 0,
                  left: sidebarPosition === 'left' ? 0 : undefined,
                  right: sidebarPosition === 'right' ? 0 : undefined,
                  width: sidebarW,
                  height: '100%',
                  borderRight: sidebarPosition === 'left' ? '1px solid var(--wb-border)' : undefined,
                  borderLeft: sidebarPosition === 'right' ? '1px solid var(--wb-border)' : undefined,
                }),
          }}
        >
          <div className={`${isHorizontalSidebar ? "px-3 flex items-center gap-2 h-full" : "p-3 flex items-center gap-2 border-b border-indigo-500/10"}`} style={{ transition: 'all 0.3s ease-in-out' }}>
            {!sidebarCollapsed && (
              <>
                <NextImage src="/logos/logo.png" alt="WB" width={28} height={28} className="rounded-lg shrink-0" unoptimized />
                {!isHorizontalSidebar && <img src="/logos/text_logo_simple.png" alt="WeildBuild" className="h-8 w-auto object-contain" />}
              </>
            )}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`${isHorizontalSidebar ? "" : "ml-auto"} p-1.5 rounded-lg hover:bg-slate-800 text-slate-400`}>
              <Menu className="w-4 h-4" />
            </button>
          </div>
          {!isHorizontalSidebar && (
          <nav className="flex-1 py-2 space-y-0.5 px-1.5 overflow-y-auto" style={{ transition: 'opacity 0.2s ease' }}>
            {sidebarItems.map(({ key, icon: Icon, label, badge }) => (
              <button key={key} onClick={() => setView(key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  view === key ? "bg-indigo-500/15 text-indigo-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}>
                <Icon className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span className="text-sm font-medium">{label}</span>}
                {!sidebarCollapsed && badge && badge > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
          )}
          {isHorizontalSidebar && (
            <nav className="flex items-center gap-0.5 px-1 h-full overflow-x-auto" style={{ transition: 'opacity 0.2s ease' }}>
              {sidebarItems.map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setView(key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-200 whitespace-nowrap ${
                    view === key ? "bg-indigo-500/15 text-indigo-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="text-xs font-medium">{label}</span>}
                </button>
              ))}
            </nav>
          )}
          {!isHorizontalSidebar && (
          <div className="p-3 border-t border-indigo-500/10" style={{ transition: 'opacity 0.2s ease' }}>
            <div className="flex items-center gap-2">
              <AvatarIcon avatar={user!.avatar} size={28} />
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{user?.username}</p>
                  <div className="flex items-center gap-1">
                    <Coins className="w-3 h-3 text-amber-400" />
                    <span className="text-xs text-amber-300">{user?.webuy ?? 0}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </aside>
      )}

      {/* Main content area — padded to account for fixed sidebar */}
      <div
        className={`flex-1 flex flex-col ${playingGame || view === 'create' ? 'min-h-0' : 'min-h-screen'} ${playingGame || view === 'create' ? 'overflow-hidden' : ''}`}
        style={{
          paddingTop: (!playingGame && view !== 'create' && sidebarPosition === 'top') ? sidebarH : 0,
          paddingBottom: (!playingGame && view !== 'create' && sidebarPosition === 'bottom') ? sidebarH : 0,
          paddingLeft: (!playingGame && view !== 'create' && sidebarPosition === 'left') ? sidebarW : 0,
          paddingRight: (!playingGame && view !== 'create' && sidebarPosition === 'right') ? sidebarW : 0,
          transition: 'padding 0.3s ease-in-out',
        }}
      >
        {/* Top bar - hidden when in Create editor or playing a game */}
        {!playingGame && view !== 'create' && <header className="sticky top-0 z-50 backdrop-blur-xl shrink-0" style={{ background: "var(--wb-bg-header)", borderBottom: "1px solid var(--wb-border)" }}>
          <div className="px-4 h-12 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {playingGame && (
                <Button variant="ghost" size="sm" onClick={() => setPlayingGame(null)} className="text-slate-400 hover:text-white gap-1">
                  <ArrowLeft className="w-4 h-4" /> Leave
                </Button>
              )}
              {!playingGame && <h2 className="text-sm font-semibold text-slate-300 capitalize">{view}</h2>}
            </div>
            <div className="flex items-center gap-2">
              <WebuyDisplay amount={user?.webuy ?? 0} variant="compact" />
              {/* Discord button */}
              <DiscordIconButton />
              {/* Notifications in top bar */}
              <button onClick={() => setView("notifications")} className="relative p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {!playingGame && (
                <Button variant="ghost" size="sm" onClick={logout} className="text-slate-400 hover:text-red-400 h-8 w-8 p-0">
                  <LogOut className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </header>}

        <main className={`flex-1 ${playingGame || view === 'create' ? 'flex flex-col p-0 overflow-hidden min-h-0' : 'px-4 py-6 max-w-6xl mx-auto overflow-y-auto'} w-full`}>
          {playingGame ? (
            <GamePlayer key={`gameplayer_${testPlayKey}`} game={playingGame} user={user!} socket={socket}
              onExit={() => {
                if (isTestPlay) {
                  setPlayingGame(null);
                  setView("create");
                  setIsTestPlay(false);
                } else {
                  setPlayingGame(null);
                }
              }}
              onUpdateGame={(id, data) => updateGame(id, data)}
              isTestPlay={isTestPlay}
            />
          ) : view === "create" ? (
            <WeildCreateStudio user={user!} onCreateGame={createGame} onPlayGame={(game) => { fetchGame(game.id); setPlayingGame(game); }} onExit={() => setView("lobby")}
              savedState={testPlayEditorState}
              onTestPlay={(state) => {
                setTestPlayEditorState(state);
                setIsTestPlay(true);
                setTestPlayKey(k => k + 1);
                const gameData = {
                  id: 'test-play',
                  name: state.name || 'Test Play',
                  description: state.description || '',
                  creator: state.creator || '',
                  public: false,
                  multiplayer: false,
                  plays: 0,
                  created: new Date().toISOString(),
                  last_update: new Date().toISOString(),
                  primitives: state.primitives || [],
                  spawn_point: state.spawn_point || [0, 3, 0],
                  sky_color_top: state.sky_color_top || [0.4, 0.6, 0.8],
                  sky_color_bottom: state.sky_color_bottom || [0.67, 0.8, 0.93],
                  baseplate_color: state.baseplate_color || [0.24, 0.4, 0.4],
                  baseplate_size: state.baseplate_size || 50,
                  max_players: state.max_players || 20,
                  ...state,
                } as GameData;
                setPlayingGame(gameData);
              }}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={view} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                {view === "lobby" && <LobbyView user={user!} games={games} onPlayGame={(game) => { fetchGame(game.id); setPlayingGame(game); }} onCreateGame={createGame} onOpenCreate={() => setView("create")} />}
                {view === "profile" && <ProfileView user={user!} onNavigate={setView} onUpdate={updateUser} />}
                {view === "avatar" && <AvatarView user={user!} items={items} onUpdate={async (u) => { await updateUser(u); toast({ title: "Avatar updated!" }); }} />}
                {view === "notifications" && <NotificationsView user={user!} notifications={notifications} unreadCount={unreadCount} onMarkRead={() => markRead(user!.username)} />}
                {view === "friends" && <FriendsView user={user!} socket={socket} onUpdate={async (u) => { await updateUser(u); }} />}
                {view === "shop" && <ShopView user={user!} items={items} onBuy={async (itemId) => {
                  const result = await buyItem(itemId);
                  if (result.success) { toast({ title: "Item purchased!", description: "Check your inventory" }); await refreshUser(); }
                  else toast({ title: "Purchase failed", description: result.error, variant: "destructive" });
                }} />}
                {view === "inventory" && <InventoryView user={user!} items={items} games={games} onNavigate={setView} onPlayGame={(game) => { fetchGame(game.id); setPlayingGame(game); }} />}
                {view === "settings" && <SettingsView user={user!} onUpdate={async (u) => { try { await updateUser(u); toast({ title: "Settings saved!" }); } catch (e: any) { toast({ title: e.message || "Failed to save", variant: "destructive" }); } }} onLogout={logout} />}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
        {/* Mobile Bottom Navigation */}
        {!playingGame && view !== "create" && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t" style={{ background: "var(--wb-bg-sidebar)", borderTopColor: "var(--wb-border)" }}>
            <div className="flex items-center justify-around h-14">
              {[
                { key: "lobby" as View, icon: Home, label: "Home" },
                { key: "shop" as View, icon: ShoppingBag, label: "Shop" },
                { key: "create" as View, icon: Hammer, label: "Create" },
                { key: "friends" as View, icon: Users, label: "Friends" },
                { key: "profile" as View, icon: User, label: "Profile" },
              ].map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setView(key)}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors ${
                    view === key ? "text-indigo-400" : "text-slate-500"}`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
