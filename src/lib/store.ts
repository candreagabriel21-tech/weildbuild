import { create } from "zustand";

// ==================== TYPES ====================
export interface AvatarData {
  skin: string;
  face: string;
  shirt: string | null;
  left_leg: string | null;
  right_leg: string | null;
}

export interface VisualSettings {
  dark_mode: boolean;
  ui_scale: number;
  animations: boolean;
  reduce_motion: boolean;
  sidebar_position?: 'left' | 'right';
}

export interface UserData {
  username: string;
  avatar: AvatarData;
  webuy: number;
  items_owned: string[];
  friends: string[];
  friend_requests: string[];
  description: string;
  admin_role: string;
  banned: { is_banned: boolean; reason: string };
  created: string;
  last_login: string;
  notifications: string[];
  profile_visible?: boolean;
  notify_friends?: boolean;
  notify_purchases?: boolean;
  notify_games?: boolean;
  blocked_users?: string[];
  language?: string;
  visual_settings?: VisualSettings;
  /** Key-Protocol: Random 8-char key (e.g., "01gT476g"). Full Object Key is `USER-{user_key}`. */
  user_key?: string | null;
}

/**
 * Returns the user's full Object Key (e.g., "USER-01gT476g") based on their user_key.
 * Returns null if user_key is not set.
 */
export function getUserObjectKey(user: UserData | null | undefined): string | null {
  if (!user?.user_key) return null;
  return `USER-${user.user_key}`;
}

export interface ItemData {
  id: string;           // item_key like "FACE-1", "SHIRT-5"
  display_name: string; // "name" field from JSON
  item_type: "face" | "shirt" | "pants";
  price: number;
  description: string;
  creator: string;
  color: string;        // derived from ITEM_COLORS map
  date_created: string; // "year-day-month" format
  data?: string | null; // image path or base64
}

export interface GameData {
  id: string;
  name: string;
  description: string;
  creator: string;
  public: boolean;
  multiplayer: boolean;
  plays: number;
  created: string;
  last_update: string;
  primitives: PrimitiveData[];
  spawn_point: number[];
  sky_color_top: number[];
  sky_color_bottom: number[];
  baseplate_color: number[];
  baseplate_size: number;
  max_players: number;
  /**
   * Full editor state — the SINGLE source of truth for game play.
   *
   * When present, the GamePlayer loads this into the studio store and runs
   * the SAME engine the editor uses (physics, WeildCode rules, terrain,
   * sky, day/night, weather, bodyMovers, joints, effects — everything).
   *
   * When absent (legacy games saved before this fix), the GamePlayer
   * falls back to converting primitives via the legacy bridge.
   *
   * Type is `any` here to avoid a circular import between store.ts and
   * studio-project.ts. The actual type is StudioProjectState.
   */
  studioState?: any;
}

export interface PrimitiveData {
  id?: string;
  position: number[];
  size: number[];
  color: number[];
  rotation: number[];
  shape_type: "block" | "sphere" | "cylinder" | "wedge" | "corner_wedge" | "spawn_point"
    | "kill_brick" | "speed_pad" | "checkpoint" | "item_pickup" | "truss" | "ramp"
    | "lava" | "water" | "door" | "teleporter" | "npc" | "player";
  name?: string;
  anchored?: boolean;
  locked?: boolean;
  visible?: boolean;
  script?: string;
  material?: string;
  transparency?: number;
  reflectance?: number;
  player_hp?: number;
  player_walk_speed?: number;
  player_jump_force?: number;
}

export interface ChatMessage {
  id?: string;
  sender: string;
  content: string;
  receiver: string;
  timestamp?: string;
}

export interface NotificationData {
  id: string;
  type: "friend_request" | "friend_accepted" | "item_purchased" | "game_created" | "system";
  message: string;
  from?: string;
  read: boolean;
  timestamp: string;
}

// ==================== VIEW TYPE ====================
export type View = "lobby" | "avatar" | "notifications" | "friends" | "shop" | "inventory" | "settings" | "profile" | "create";

// ==================== SECURE API FETCH ====================
// Cookies (including httpOnly wb_session) are sent automatically by the browser
// with every same-origin request. The server validates the session server-side.
// As a FALLBACK for preview platforms where cookies don't persist, we also send
// the session token via X-Session-Token header.

export async function apiFetch(path: string, options?: RequestInit) {
  const isGet = !options?.method || options.method === "GET";
  const headers: Record<string, string> = {};
  if (!isGet) headers["Content-Type"] = "application/json";
  // Add session token header as fallback for preview platforms
  const st = loadSessionToken();
  if (st) headers["X-Session-Token"] = st;
  const mergedHeaders = { ...headers, ...(options?.headers as Record<string, string> || {}) };

  const res = await fetch(`/api${path}`, {
    ...options,
    headers: mergedHeaders,
    credentials: "include", // Always send cookies — works on preview platforms with proxies
  });

  // Handle 401 Unauthorized — attempt automatic session recovery before giving up
  if (res.status === 401) {
    const isWriteOp = !isGet;
    if (isWriteOp) {
      // The session token might be stale (e.g. after password change on another device)
      // but the cookie might still be valid. Try to refresh the token once.
      try {
        const savedToken = loadSessionToken();
        const authHeaders: Record<string, string> = {};
        if (savedToken) authHeaders["X-Session-Token"] = savedToken;
        const sessionCheck = await fetch("/api/auth", { credentials: "include", headers: authHeaders });
        const sessionData = await sessionCheck.json();
        if (sessionData.authenticated && sessionData.username) {
          // Session cookie is valid! The X-Session-Token header might have been stale.
          // Retry the original request — the cookie will authenticate it this time.
          const retryRes = await fetch(`/api${path}`, {
            ...options,
            headers: mergedHeaders,
            credentials: "include",
          });
          if (retryRes.ok) return retryRes.json();
          if (retryRes.status !== 401) {
            // Different error on retry — handle normally
            if (retryRes.status === 429) {
              const body = await retryRes.json().catch(() => ({}));
              throw new Error(body.error || "Too many requests. Please slow down.");
            }
            if (retryRes.status === 403) {
              const body = await retryRes.json().catch(() => ({}));
              throw new Error(body.error || "You don't have permission to do that.");
            }
            const errorBody = await retryRes.json().catch(() => ({ error: `Request failed with status ${retryRes.status}` }));
            throw new Error(errorBody.error || `Request failed with status ${retryRes.status}`);
          }
          // Still 401 after retry — session is truly invalid
        }
      } catch (refreshErr: any) {
        // If the refresh attempt itself threw a non-session error, re-throw it
        if (refreshErr.message && !refreshErr.message.includes("Session expired") && !refreshErr.message.includes("Not authenticated")) {
          throw refreshErr;
        }
      }
      // Session recovery failed — user needs to log in again
      throw new Error("Session expired. Please log in again.");
    }
    // GET request returned 401 — just throw, don't auto-logout
    throw new Error("Not authenticated");
  }

  // Handle 429 Rate Limited
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Too many requests. Please slow down.");
  }

  // Handle 403 Forbidden
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "You don't have permission to do that.");
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: `Request failed with status ${res.status}` }));
    throw new Error(errorBody.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

// ==================== LOCAL PERSISTENCE HELPERS ====================
// Cache the full user object AND session token in localStorage so we can restore
// instantly on refresh, then verify with the server in the background.

function saveUserToLocal(user: UserData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("weildbuild_user", JSON.stringify(user));
  } catch {}
}

export function saveSessionToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("weildbuild_session", token);
  } catch {}
}

function loadSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("weildbuild_session");
  } catch { return null; }
}

function clearSessionToken() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem("weildbuild_session"); } catch {}
}

function loadUserFromLocal(): UserData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("weildbuild_user");
    if (!raw) return null;
    // Handle both old format (plain username string) and new format (JSON user object)
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.username) return parsed as UserData;
    // Old format: just a username string — return null, will be re-fetched by refreshUser
    return null;
  } catch {
    // Could be a plain string (old format) that isn't valid JSON
    // e.g. localStorage had "WeildBuild" (just the username)
    // Return null — refreshUser will re-authenticate via the session cookie
    return null;
  }
}

function clearLocalUser() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem("weildbuild_user"); } catch {}
}

// ==================== AUTH STORE ====================
interface AuthState {
  user: UserData | null;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<UserData>) => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  // Always start as logged out — we'll restore from localStorage in refreshUser()
  // This avoids hydration mismatches between server (no localStorage) and client
  user: null,
  isLoggedIn: false,

  login: async (username, password) => {
    try {
      const result = await apiFetch("/auth", {
        method: "POST",
        body: JSON.stringify({ action: "login", username, password }),
      });
      if (result.success) {
        saveUserToLocal(result.user);
        if (result.sessionToken) saveSessionToken(result.sessionToken);
        set({ user: result.user, isLoggedIn: true });
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (e: any) {
      return { success: false, error: e.message || "Login failed" };
    }
  },

  register: async (username, password) => {
    try {
      const result = await apiFetch("/auth", {
        method: "POST",
        body: JSON.stringify({ action: "register", username, password }),
      });
      if (result.success) {
        saveUserToLocal(result.user);
        if (result.sessionToken) saveSessionToken(result.sessionToken);
        set({ user: result.user, isLoggedIn: true });
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (e: any) {
      return { success: false, error: e.message || "Registration failed" };
    }
  },

  logout: async () => {
    // Call logout API to clear session cookie server-side
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(loadSessionToken() ? { "X-Session-Token": loadSessionToken()! } : {}) },
        body: JSON.stringify({ action: "logout" }),
        credentials: "include",
      });
    } catch (e) {
      console.warn('Logout API call failed - server session may still be active', e);
    }
    clearLocalUser();
    clearSessionToken();
    set({ user: null, isLoggedIn: false });
  },

  refreshUser: async () => {
    // STEP 1: Instantly restore from localStorage cache (avoids flash of logged-out state)
    const cachedUser = loadUserFromLocal();
    const savedToken = loadSessionToken();
    if (cachedUser) {
      set({ user: cachedUser, isLoggedIn: true });
    }

    // STEP 2: Verify session with the server
    // Always check even if we have cached data — the session might have been invalidated
    try {
      const authHeaders: Record<string, string> = {};
      if (savedToken) authHeaders["X-Session-Token"] = savedToken;
      const sessionCheck = await fetch("/api/auth", { credentials: "include", headers: authHeaders });
      const sessionData = await sessionCheck.json();

      if (sessionData.authenticated && sessionData.username) {
        // Session is valid! Fetch fresh user data from server
        try {
          const user = await apiFetch(`/users?username=${sessionData.username}`);
          if (user.username) {
            saveUserToLocal(user);
            set({ user, isLoggedIn: true });
            return;
          }
        } catch {
          // Failed to fetch user data, but session IS valid — keep cached data
          if (cachedUser) {
            set({ user: cachedUser, isLoggedIn: true });
            return;
          }
        }
      }

      // Session check failed. Try fallback: if we have cached username, fetch user data directly
      if (cachedUser) {
        try {
          const userRes = await fetch(`/api/users?username=${cachedUser.username}`, { credentials: "include", headers: authHeaders });
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.username) {
              saveUserToLocal(userData);
              set({ user: userData, isLoggedIn: true });
              return;
            }
          }
        } catch {}
        // Can't verify with server but have cache — keep cached, stay logged in
        set({ user: cachedUser, isLoggedIn: true });
        return;
      }

      // No cached data and no valid session — truly logged out
      clearLocalUser();
      clearSessionToken();
      set({ user: null, isLoggedIn: false });
    } catch {
      // Network error — don't clear session, keep cached user data
      if (cachedUser) {
        set({ user: cachedUser, isLoggedIn: true });
      }
    }
  },

  updateUser: async (updates) => {
    const { user } = get();
    if (!user) return;
    try {
      const result = await apiFetch(`/users`, {
        method: "PUT",
        body: JSON.stringify({ username: user.username, ...updates }),
      });
      if (result.username) {
        saveUserToLocal(result);
        set({ user: result });
      }
    } catch (e: any) {
      throw e;
    }
  },
}));

// ==================== ITEMS STORE ====================
interface ItemsState {
  items: ItemData[];
  loading: boolean;
  itemsLoading: boolean;
  fetchItems: (type?: string) => Promise<void>;
  buyItem: (itemId: string) => Promise<{ success: boolean; error?: string }>;
}

export const useItems = create<ItemsState>((set, get) => ({
  items: [],
  loading: false,
  itemsLoading: false,

  fetchItems: async (type) => {
    if (get().itemsLoading) return; // Dedup: already fetching
    set({ loading: true, itemsLoading: true });
    try {
      const query = type ? `?type=${type}` : "";
      const items = await apiFetch(`/items${query}`);
      set({ items: Array.isArray(items) ? items : [], loading: false, itemsLoading: false });
    } catch {
      set({ items: [], loading: false, itemsLoading: false });
    }
  },

  buyItem: async (itemId) => {
    const { user } = useAuth.getState();
    if (!user) return { success: false, error: "Not logged in" };
    try {
      const result = await apiFetch(`/items`, {
        method: "POST",
        body: JSON.stringify({ username: user.username, itemId }),
      });
      if (result.success) {
        // Update items list to reflect new ownership
        set({
          items: get().items.map(item =>
            item.id === itemId ? { ...item, owned: true } : item
          )
        });
        useAuth.setState({ user: result.user });
        saveUserToLocal(result.user);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (e: any) {
      return { success: false, error: e.message || "Purchase failed" };
    }
  },
}));

// ==================== GAMES STORE ====================
interface GamesState {
  games: GameData[];
  currentGame: GameData | null;
  loading: boolean;
  gamesLoading: boolean;
  fetchGames: () => Promise<void>;
  fetchGame: (id: string) => Promise<void>;
  createGame: (game: Partial<GameData>) => Promise<GameData | null>;
  updateGame: (id: string, updates: Partial<GameData>) => Promise<void>;
}

export const useGames = create<GamesState>((set, get) => ({
  games: [],
  currentGame: null,
  loading: false,
  gamesLoading: false,

  fetchGames: async () => {
    if (get().gamesLoading) return; // Dedup: already fetching
    set({ loading: true, gamesLoading: true });
    try {
      const games = await apiFetch("/games");
      set({ games: Array.isArray(games) ? games : [], loading: false, gamesLoading: false });
    } catch {
      set({ games: [], loading: false, gamesLoading: false });
    }
  },

  fetchGame: async (id) => {
    set({ loading: true });
    try {
      const game = await apiFetch(`/games?id=${id}`);
      set({ currentGame: game.id ? game : null, loading: false });
    } catch {
      set({ currentGame: null, loading: false });
    }
  },

  createGame: async (gameData) => {
    try {
      const result = await apiFetch("/games", {
        method: "POST",
        body: JSON.stringify(gameData),
      });
      if (result.id) {
        set((s) => ({ games: [result, ...s.games] }));
        return result;
      }
      return null;
    } catch {
      return null;
    }
  },

  updateGame: async (id, updates) => {
    try {
      const result = await apiFetch(`/games`, {
        method: "PUT",
        body: JSON.stringify({ id, ...updates }),
      });
      if (result.id) {
        set((s) => ({
          games: s.games.map((g) => (g.id === id ? result : g)),
          currentGame: s.currentGame?.id === id ? result : s.currentGame,
        }));
      }
    } catch (e) {
      console.error("Failed to update game:", e);
    }
  },
}));

// ==================== FRIENDS STORE ====================
interface FriendsState {
  friendRequests: string[];
  searchResults: Array<{ username: string; avatar?: AvatarData; webuy?: number; description?: string; created?: string }>;
  loading: boolean;
  fetchFriends: (username: string) => Promise<void>;
  sendRequest: (from: string, to: string) => Promise<{ success: boolean; error?: string }>;
  acceptRequest: (username: string, friend: string) => Promise<{ success: boolean; error?: string }>;
  declineRequest: (username: string, friend: string) => Promise<{ success: boolean; error?: string }>;
  removeFriend: (username: string, friend: string) => Promise<{ success: boolean; error?: string }>;
  blockUser: (username: string, target: string) => Promise<{ success: boolean; error?: string }>;
  unblockUser: (username: string, target: string) => Promise<{ success: boolean; error?: string }>;
  searchUsers: (query: string) => Promise<void>;
}

export const useFriends = create<FriendsState>((set) => ({
  friendRequests: [],
  searchResults: [],
  loading: false,

  fetchFriends: async (username) => {
    set({ loading: true });
    try {
      const result = await apiFetch(`/friends?username=${username}`);
      set({ friendRequests: result.friend_requests || [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  sendRequest: async (from, to) => {
    try {
      const result = await apiFetch("/friends", {
        method: "POST",
        body: JSON.stringify({ action: "request", from, to }),
      });
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  acceptRequest: async (username, friend) => {
    try {
      const result = await apiFetch("/friends", {
        method: "POST",
        body: JSON.stringify({ action: "accept", username, friend }),
      });
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  declineRequest: async (username, friend) => {
    try {
      const result = await apiFetch("/friends", {
        method: "POST",
        body: JSON.stringify({ action: "decline", username, friend }),
      });
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  removeFriend: async (username, friend) => {
    try {
      const result = await apiFetch("/friends", {
        method: "POST",
        body: JSON.stringify({ action: "remove", username, friend }),
      });
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  blockUser: async (username, target) => {
    try {
      const result = await apiFetch("/friends", {
        method: "POST",
        body: JSON.stringify({ action: "block", username, target }),
      });
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  unblockUser: async (username, target) => {
    try {
      const result = await apiFetch("/friends", {
        method: "POST",
        body: JSON.stringify({ action: "unblock", username, target }),
      });
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  searchUsers: async (query) => {
    set({ loading: true });
    try {
      const result = await apiFetch(`/users?search=${encodeURIComponent(query)}`);
      set({ searchResults: Array.isArray(result) ? result : [], loading: false });
    } catch {
      set({ searchResults: [], loading: false });
    }
  },
}));

// ==================== NOTIFICATIONS STORE ====================
interface NotificationsState {
  notifications: NotificationData[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (username: string) => Promise<void>;
  markRead: (username: string) => Promise<void>;
}

export const useNotifications = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async (username) => {
    set({ loading: true });
    try {
      const result = await apiFetch(`/notifications?username=${username}`);
      const notifs = Array.isArray(result) ? result : [];
      set({
        notifications: notifs,
        unreadCount: notifs.filter((n: NotificationData) => !n.read).length,
        loading: false,
      });
    } catch {
      set({ notifications: [], unreadCount: 0, loading: false });
    }
  },

  markRead: async (username) => {
    try {
      await apiFetch("/notifications", {
        method: "POST",
        body: JSON.stringify({ action: "markRead", username }),
      });
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch {
      // Silently fail — non-critical operation
    }
  },
}));
