// ==================== WEILDBUILD DATA ACCESS LAYER ====================
// All data access uses Supabase PostgreSQL. All functions are async.
// Password hashing, sanitization, and validation are pure computation (sync).

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { supabase } from "./supabase-server";

// ==================== SECURITY: INPUT SANITIZATION ====================
const ALLOWED_USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export function sanitizeString(input: string, maxLength: number = 200): string {
  if (!input) return "";
  // Strip HTML tags
  let cleaned = input.replace(/<[^>]*>/g, "");
  // Strip script-related patterns
  cleaned = cleaned.replace(/javascript:/gi, "");
  cleaned = cleaned.replace(/on\w+\s*=/gi, "");
  // Trim to max length
  return cleaned.slice(0, maxLength);
}

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username) return { valid: false, error: "Username is required" };
  if (username.length < 3) return { valid: false, error: "Username must be at least 3 characters" };
  if (username.length > 20) return { valid: false, error: "Username must be at most 20 characters" };
  if (!ALLOWED_USERNAME_REGEX.test(username)) return { valid: false, error: "Username can only contain letters, numbers, and underscores" };
  // Prevent path traversal
  if (username.includes("..") || username.includes("/") || username.includes("\\")) {
    return { valid: false, error: "Invalid username" };
  }
  return { valid: true };
}

// ==================== SECURITY: PROTECTED FIELD LISTS ====================
// Fields that users can update on their own profile
export const ALLOWED_USER_UPDATES = [
  "avatar", "description", "profile_visible", "notify_friends",
  "notify_purchases", "notify_games", "visual_settings", "language",
];

// Fields that must NEVER be returned in API responses
export const SENSITIVE_FIELDS = ["password", "salt"];

// Fields that only admins can modify
export const ADMIN_ONLY_FIELDS = ["admin_role", "banned", "webuy", "items_owned"];

export function stripSensitiveFields(user: any): any {
  const { password, salt, ...safe } = user;
  return safe;
}

// Field-specific max lengths
const FIELD_MAX_LENGTHS: Record<string, number> = {
  description: 200,
  language: 10,
};

export function filterUserUpdates(updates: any, isAdmin: boolean = false): any {
  const filtered: any = {};
  const allowedFields = isAdmin
    ? [...ALLOWED_USER_UPDATES, ...ADMIN_ONLY_FIELDS]
    : ALLOWED_USER_UPDATES;

  for (const key of Object.keys(updates)) {
    if (key === "username") continue; // Username can never be changed
    if (key === "password" || key === "salt") continue; // Password changes go through dedicated endpoint
    if (allowedFields.includes(key)) {
      // Sanitize string values with field-specific max lengths
      if (typeof updates[key] === "string") {
        const maxLen = FIELD_MAX_LENGTHS[key] || 200;
        filtered[key] = sanitizeString(updates[key], maxLen);
      } else {
        filtered[key] = updates[key];
      }
    }
  }
  return filtered;
}

// ==================== PASSWORD HASHING (scrypt-based) ====================
// Legacy support: still provides simpleHash for existing accounts
export function simpleHash(password: string, salt: string): string {
  return createHash("sha256").update(password + salt).digest("hex");
}

// New secure hashing using scrypt (key derivation function)
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 16384; // CPU/memory cost parameter
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

export function secureHashPassword(password: string, salt: string): string {
  const key = scryptSync(password, salt, SCRYPT_KEY_LENGTH, { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION });
  return key.toString("hex");
}

export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

// Verify password - supports both legacy SHA-256 and new scrypt hashes
export function verifyPassword(password: string, storedHash: string, salt: string, hashVersion?: number): boolean {
  try {
    // Legacy (v0/undefined): SHA-256 hash (64 hex chars)
    // New (v1): scrypt-derived hash (128 hex chars)
    if (storedHash.length === 128 || hashVersion === 1) {
      const computedHash = secureHashPassword(password, salt);
      // Use timing-safe comparison to prevent timing attacks
      return timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(storedHash, "hex"));
    }
    // Legacy SHA-256
    const computedHash = simpleHash(password, salt);
    return timingSafeEqual(Buffer.from(computedHash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

// Upgrade a user's password hash from legacy SHA-256 to scrypt on successful login
async function upgradePasswordHash(user: any, username: string, password: string) {
  if (!user.hash_version || user.hash_version < 1) {
    const newSalt = generateSalt();
    user.salt = newSalt;
    user.password = secureHashPassword(password, newSalt);
    user.hash_version = 1;
    await saveUser(username, user);
  }
}

// ==================== HELPER: CONVERT SUPABASE ROW TO USER OBJECT ====================
// Supabase returns JSONB as already-parsed objects and TEXT[] as arrays.
// We just need to ensure the field names match what the API expects.
function rowToUser(row: any): any {
  if (!row) return null;
  return {
    username: row.username,
    password: row.password,
    salt: row.salt,
    hash_version: row.hash_version,
    avatar: row.avatar || {},
    webuy: row.webuy,
    items_owned: row.items_owned || [],
    friends: row.friends || [],
    friend_requests: row.friend_requests || [],
    description: row.description || "",
    admin_role: row.admin_role || "none",
    banned: row.banned || { is_banned: false, reason: "" },
    created: row.created,
    last_login: row.last_login,
    notifications: row.notifications || [],
    profile_visible: row.profile_visible ?? true,
    notify_friends: row.notify_friends ?? true,
    notify_purchases: row.notify_purchases ?? true,
    notify_games: row.notify_games ?? true,
    visual_settings: row.visual_settings || { dark_mode: true, ui_scale: 1, animations: true, reduce_motion: false },
    language: row.language || "en",
    blocked_users: row.blocked_users || [],
    // Fields used by Python desktop app
    email: row.email || "",
    unread_messages: row.unread_messages || 0,
    user_id: row.user_id || 0,
    user_key: row.user_key || null,
    messages: row.messages || {},
    inventory: row.inventory || [],
  };
}

// ==================== HELPER: CONVERT USER OBJECT TO SUPABASE ROW ====================
function userToRow(user: any): any {
  return {
    username: user.username,
    password: user.password,
    salt: user.salt,
    hash_version: user.hash_version,
    avatar: user.avatar || {},
    webuy: user.webuy,
    items_owned: user.items_owned || [],
    friends: user.friends || [],
    friend_requests: user.friend_requests || [],
    description: user.description || "",
    admin_role: user.admin_role || "none",
    banned: user.banned || { is_banned: false, reason: "" },
    created: user.created,
    last_login: user.last_login,
    notifications: user.notifications || [],
    profile_visible: user.profile_visible ?? true,
    notify_friends: user.notify_friends ?? true,
    notify_purchases: user.notify_purchases ?? true,
    notify_games: user.notify_games ?? true,
    visual_settings: user.visual_settings || { dark_mode: true, ui_scale: 1, animations: true, reduce_motion: false },
    language: user.language || "en",
    blocked_users: user.blocked_users || [],
    // Fields used by Python desktop app
    email: user.email || "",
    unread_messages: user.unread_messages || 0,
    user_id: user.user_id || 0,
    user_key: user.user_key || null,
    messages: user.messages || {},
    inventory: user.inventory || [],
  };
}

// ==================== USER OPERATIONS ====================
export async function getUser(username: string) {
  // Prevent path traversal
  if (!username || username.includes("..") || username.includes("/") || username.includes("\\")) return null;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();
    if (error || !data) return null;
    return rowToUser(data);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// KEY-PROTOCOL: Random 8-character Object Keys
// ═══════════════════════════════════════════════════════════
// Every user gets a unique 8-char key (e.g., "01gT476g")
// composed of lowercase letters, uppercase letters, and numbers.
// The full Object Key includes a type prefix: USER-01gT476g
// Collisions are checked WITHIN the same type prefix only — so
// USER-01gT476g and FACE-01gT476g can coexist happily.
// ═══════════════════════════════════════════════════════════

const KEY_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const KEY_LENGTH = 8;

/**
 * Generate a random 8-character key (e.g., "01gT476g", "fY757Gh0").
 * Uses crypto.getRandomValues for cryptographically secure randomness.
 * 62^8 = ~218 trillion combinations — collisions are astronomically rare.
 */
export function generateObjectKey(length: number = KEY_LENGTH): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let result = '';
  for (let i = 0; i < length; i++) {
    result += KEY_CHARSET[bytes[i] % KEY_CHARSET.length];
  }
  return result;
}

/**
 * Generate a unique user_key that doesn't collide with any existing user.
 * Keeps regenerating until it finds a unique key (collision chance is ~0).
 */
export async function getUniqueUserKey(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const key = generateObjectKey();
    const { data } = await supabase
      .from("users")
      .select("user_key")
      .eq("user_key", key)
      .maybeSingle();
    if (!data) return key;
  }
  return generateObjectKey();
}

/**
 * Look up a user by their Object Key (e.g., "USER-01gT476g", "USER-WB", "USER-Creator").
 * Accepts any length key after the "USER-" prefix (8-char random keys AND special easter egg keys).
 */
export async function getUserByKey(key: string) {
  if (!key || !key.startsWith("USER-")) return null;
  const userKey = key.slice(5); // Remove "USER-" prefix
  if (!userKey || userKey.length < 2 || userKey.length > 50) return null;

  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("user_key", userKey)
      .single();
    if (error || !data) return null;
    return rowToUser(data);
  } catch {
    return null;
  }
}

/**
 * Generate the full Object Key for a user (e.g., "USER-01gT476g").
 */
export function getUserKey(user: any): string | null {
  if (!user?.user_key) return null;
  return `USER-${user.user_key}`;
}

// Core columns that MUST exist in the users table
const CORE_USER_COLUMNS = [
  "username", "password", "salt", "hash_version", "avatar", "webuy",
  "items_owned", "friends", "friend_requests", "description", "admin_role",
  "banned", "created", "last_login", "notifications", "profile_visible",
  "notify_friends", "notify_purchases", "notify_games", "visual_settings",
  "language", "blocked_users",
];

// Optional columns that may not exist yet (added by ALTER TABLE)
const OPTIONAL_USER_COLUMNS = [
  "email", "unread_messages", "user_id", "messages", "inventory",
];

export async function saveUser(username: string, data: any) {
  try {
    const row = userToRow({ ...data, username });
    const { error } = await supabase
      .from("users")
      .upsert(row, { onConflict: "username" });
    if (error) {
      console.error("[Supabase] saveUser error:", error.message);
      // If the error is about missing columns, retry with only core columns
      if (error.message.includes("column") && error.message.includes("schema cache")) {
        console.warn("[Supabase] Retrying saveUser with core columns only...");
        const coreRow: any = {};
        for (const col of CORE_USER_COLUMNS) {
          if (row[col] !== undefined) coreRow[col] = row[col];
        }
        const { error: retryError } = await supabase
          .from("users")
          .upsert(coreRow, { onConflict: "username" });
        if (retryError) {
          console.error("[Supabase] saveUser retry error:", retryError.message);
        }
      }
    }
  } catch (e: any) {
    console.error("[Supabase] saveUser exception:", e.message);
  }
}

export async function getAllUsers() {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*");
    if (error || !data) return [];
    return data.map(rowToUser);
  } catch {
    return [];
  }
}

export async function searchUsers(query: string) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .ilike("username", `%${query}%`)
      .limit(20);
    if (error || !data) return [];
    return data.map((row: any) => stripSensitiveFields(rowToUser(row)));
  } catch {
    return [];
  }
}

export async function createUser(username: string, password: string) {
  // Validate username
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) return { error: usernameValidation.error };

  if (!password || password.length < 6) return { error: "Password must be at least 6 characters" };
  if (password.length > 128) return { error: "Password must be at most 128 characters" };

  const existing = await getUser(username);
  if (existing) return { error: "Username already exists" };

  // ─── KEY-PROTOCOL: Generate a unique random 8-char key ───
  const userKey = await getUniqueUserKey();

  const salt = generateSalt();
  const user = {
    username,
    password: secureHashPassword(password, salt),
    salt,
    hash_version: 1,
    avatar: { shirt: "SHIRT-1", left_leg: "PANTS-1", right_leg: "PANTS-1", face: "FACE-1", skin: "#f8ff6d" },
    webuy: 100,
    items_owned: ["FACE-1", "SHIRT-1", "PANTS-1"],
    friends: [] as string[],
    friend_requests: [] as string[],
    description: "",
    admin_role: "none",
    banned: { is_banned: false, reason: "" },
    created: new Date().toISOString(),
    last_login: new Date().toISOString(),
    notifications: ["Welcome to WeildBuild!"] as string[],
    profile_visible: true,
    notify_friends: true,
    notify_purchases: true,
    notify_games: true,
    visual_settings: { dark_mode: true, ui_scale: 1, animations: true, reduce_motion: false },
    language: "en",
    blocked_users: [] as string[],
    user_key: userKey,  // ← Random 8-char key
  };
  await saveUser(username, user);
  return { success: true, user };
}

export async function verifyLogin(username: string, password: string) {
  const user = await getUser(username);
  if (!user) return { error: "Invalid username or password" }; // Don't reveal if user exists
  if (user.banned?.is_banned) return { error: "Account is banned: " + (user.banned.reason || "No reason given") };

  const isValid = verifyPassword(password, user.password, user.salt, user.hash_version);
  if (!isValid) return { error: "Invalid username or password" }; // Same message for user not found

  // Reset rate limit on successful login (import dynamically to avoid circular dependency)
  const { resetRateLimit } = await import("./security");
  await resetRateLimit(username);

  // Upgrade password hash if needed
  await upgradePasswordHash(user, username, password);

  user.last_login = new Date().toISOString();
  await saveUser(username, user);
  return { success: true, user };
}

// ==================== ITEM OPERATIONS ====================
// Items are loaded from JSON files in /data/items/ directory.
// The JSON file loader reads item_key, name, type, price, description, etc.
// LOCAL_ITEMS is only a fallback if JSON files aren't found.

import { ITEM_COLORS } from "@/components/app/shared";

const LOCAL_ITEMS = (() => {
  const faces = [
    { id: "FACE-1", display_name: "Smile Face", price: 0, description: "The iconic pixel smile — a WeildBuild classic", creator: "WeildBuild", data: "/items/faces/FACE-1.png" },
    { id: "FACE-2", display_name: "Pity Face", price: 10, description: "Why are you so mean? :(", creator: "WeildBuild", data: "/items/faces/FACE-2.png" },
    { id: "FACE-3", display_name: "Spooked Face", price: 15, description: "BOO!", creator: "WeildBuild", data: "/items/faces/FACE-3.png" },
    { id: "FACE-4", display_name: "Smug Face", price: 10, description: "I know something you don't...", creator: "WeildBuild", data: "/items/faces/FACE-4.png" },
    { id: "FACE-5", display_name: "Tired Face", price: 20, description: "I'll sleep.. later.", creator: "WeildBuild", data: "/items/faces/FACE-5.png" },
    { id: "FACE-6", display_name: "Neutral Face", price: 5, description: "Just... neutral.", creator: "WeildBuild", data: "/items/faces/FACE-6.png" },
    { id: "FACE-7", display_name: "Girl Face", price: 0, description: "Hi there!", creator: "WeildBuild", data: "/items/faces/FACE-7.png" },
    { id: "FACE-8", display_name: "Surprised Guy", price: 5, description: "Wait, WHAT?!", creator: "WeildBuild", data: "/items/faces/FACE-8.png" },
    { id: "FACE-9", display_name: "Happy Face", price: 8, description: "Best day ever!", creator: "WeildBuild", data: "/items/faces/FACE-9.png" },
    { id: "FACE-11", display_name: "Meanie Face", price: 10, description: "Why are you so mean? :(", creator: "WeildBuild", data: "/items/faces/FACE-11.png" },
    { id: "FACE-12", display_name: "Sad Face", price: 0, description: "It's not fine, but it's okay...", creator: "WeildBuild", data: "/items/faces/FACE-12.png" },
    { id: "FACE-13", display_name: "Angry Face", price: 16, description: "GRRRR!!!", creator: "WeildBuild", data: "/items/faces/FACE-13.png" },
    { id: "FACE-14", display_name: "Question Face", price: 15, description: "Hmm? What? Where?", creator: "WeildBuild", data: "/items/faces/FACE-14.png" },
    { id: "FACE-15", display_name: "Looking Up", price: 5, description: "The calm sound of nothing...", creator: "WeildBuild", data: "/items/faces/FACE-15.png" },
    { id: "FACE-16", display_name: "Neutral Boy", price: 15, description: "Just a neutral boy.", creator: "Megan", data: "/items/faces/FACE-16.png" },
    { id: "FACE-17", display_name: "Man Smile", price: 15, description: "A handsome smile.", creator: "Megan", data: "/items/faces/FACE-17.png" },
    { id: "FACE-18", display_name: "Girl Smile", price: 15, description: "A beautiful smile.", creator: "Gabriel", data: "/items/faces/FACE-18.png" },
    { id: "FACE-19", display_name: "Calm Face", price: 3, description: "The calm sound of nothing...", creator: "WeildBuild", data: "/items/faces/FACE-19.png" },
    { id: "FACE-20", display_name: "Fury Face", price: 3, description: "That's so overly unfair!", creator: "WeildBuild", data: "/items/faces/FACE-20.png" },
    { id: "FACE-21", display_name: "Bearded Face", price: 3, description: "I am John. The lumberjack.", creator: "WeildBuild", data: "/items/faces/FACE-21.png" },
  ];
  const shirts = [
    { id: "SHIRT-1", display_name: "Classic Red", price: 50, description: "A bold red shirt", creator: "WeildBuild", data: null },
    { id: "SHIRT-2", display_name: "Flame", price: 75, description: "Burn bright", creator: "WeildBuild", data: null },
    { id: "SHIRT-3", display_name: "Forest", price: 60, description: "Earthy green tones", creator: "WeildBuild", data: null },
    { id: "SHIRT-4", display_name: "Royal Purple", price: 80, description: "Fit for royalty", creator: "WeildBuild", data: null },
    { id: "SHIRT-5", display_name: "Gold Rush", price: 100, description: "Shimmer and shine", creator: "WeildBuild", data: null },
    { id: "SHIRT-6", display_name: "Midnight", price: 70, description: "Dark and mysterious", creator: "WeildBuild", data: null },
    { id: "SHIRT-7", display_name: "Blossom", price: 60, description: "Soft and sweet", creator: "WeildBuild", data: null },
    { id: "SHIRT-8", display_name: "Ocean", price: 75, description: "Deep sea vibes", creator: "WeildBuild", data: null },
  ];
  const pants = [
    { id: "PANTS-1", display_name: "Denim Blue", price: 40, description: "Classic blue jeans", creator: "WeildBuild", data: null },
    { id: "PANTS-2", display_name: "Midnight", price: 60, description: "Dark as night", creator: "WeildBuild", data: null },
    { id: "PANTS-3", display_name: "Camo", price: 55, description: "Blend right in", creator: "WeildBuild", data: null },
    { id: "PANTS-4", display_name: "Crimson", price: 50, description: "Stand out in red", creator: "WeildBuild", data: null },
    { id: "PANTS-5", display_name: "Cloud White", price: 45, description: "Light and clean", creator: "WeildBuild", data: null },
    { id: "PANTS-6", display_name: "Nebula", price: 80, description: "Cosmic style", creator: "WeildBuild", data: null },
  ];

  const allItems = [...faces, ...shirts, ...pants].map(item => ({
    ...item,
    item_type: item.id.startsWith("FACE") ? "face" : item.id.startsWith("SHIRT") ? "shirt" : "pants",
    color: ITEM_COLORS[item.id] || "#888",
    date_created: new Date().toISOString(),
  }));

  return allItems;
})();

function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

// ==================== JSON FILE ITEMS LOADER ====================
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const ITEMS_DIR = join(process.cwd(), "data", "items");

function loadItemsFromJSON(): any[] | null {
  try {
    if (!existsSync(ITEMS_DIR)) return null;
    const files = readdirSync(ITEMS_DIR).filter(f => f.endsWith(".json"));
    if (files.length === 0) return null;

    return files.map(f => {
      const raw = JSON.parse(readFileSync(join(ITEMS_DIR, f), "utf-8"));
      // JSON files use "name" field — map to display_name for the API
      // CRITICAL: Use raw.name directly, do NOT append the item type.
      // E.g. "Smile Face" stays "Smile Face", NOT "Smile Face Face"
      const displayName = raw.name || raw.display_name || raw.item_key;
      return {
        id: raw.item_key,
        display_name: displayName,
        item_type: raw.type || raw.item_type,
        price: raw.price ?? 0,
        description: raw.description || "",
        creator: raw.creator || "WeildBuild",
        color: ITEM_COLORS[raw.item_key] || "#888",
        date_created: raw.date_created || new Date().toISOString(),
        data: raw.data || null,
      };
    });
  } catch {
    return null;
  }
}

// Cached JSON items (loaded once, refreshed on demand)
let _jsonItemsCache: any[] | null = null;

function getLocalItems(): any[] {
  // Try JSON files first, fall back to hardcoded LOCAL_ITEMS
  if (!_jsonItemsCache) {
    _jsonItemsCache = loadItemsFromJSON();
  }
  return _jsonItemsCache || LOCAL_ITEMS;
}

// Call this to refresh the cache after adding new items
export function refreshItemsCache() {
  _jsonItemsCache = loadItemsFromJSON();
}

export async function getItemsByType(type: string) {
  if (!isSupabaseConfigured()) {
    return getLocalItems().filter(i => i.item_type === type);
  }
  try {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("item_type", type);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function getAllItems() {
  if (!isSupabaseConfigured()) {
    return getLocalItems();
  }
  try {
    const { data, error } = await supabase
      .from("items")
      .select("*");
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function getItem(itemId: string) {
  if (!itemId || itemId.includes("..") || itemId.includes("/") || itemId.includes("\\")) return null;
  if (!isSupabaseConfigured()) {
    return getLocalItems().find(i => i.id === itemId) || null;
  }
  try {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", itemId)
      .single();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// ==================== GAME OPERATIONS ====================
export async function getGame(gameId: string) {
  if (!gameId || gameId.includes("..") || gameId.includes("/") || gameId.includes("\\")) return null;
  try {
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getAllGames() {
  try {
    const { data, error } = await supabase
      .from("games")
      .select("*");
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function createGameRecord(gameData: any) {
  const id = gameData.id || randomBytes(4).toString("hex");
  const game = {
    ...gameData,
    id,
    plays: 0,
    created: new Date().toISOString(),
    last_update: new Date().toISOString(),
  };
  try {
    const { data, error } = await supabase
      .from("games")
      .insert(game)
      .select()
      .single();
    if (error) {
      console.error("[Supabase] createGameRecord error:", error.message);
      return game; // Return the game object even if insert fails
    }
    return data;
  } catch {
    return game;
  }
}

export async function updateGameRecord(gameId: string, updates: any) {
  const game = await getGame(gameId);
  if (!game) return null;
  const updated = { ...updates, last_update: new Date().toISOString() };
  try {
    const { data, error } = await supabase
      .from("games")
      .update(updated)
      .eq("id", gameId)
      .select()
      .single();
    if (error) {
      console.error("[Supabase] updateGameRecord error:", error.message);
      return { ...game, ...updated };
    }
    return data;
  } catch {
    return { ...game, ...updated };
  }
}

// ==================== MESSAGE OPERATIONS ====================
export async function saveMessage(msg: any) {
  const id = msg.id || randomBytes(8).toString("hex");
  const message = { ...msg, id, timestamp: new Date().toISOString(), read: false };
  try {
    await supabase
      .from("messages")
      .insert({
        id: message.id,
        sender: message.sender,
        content: message.content,
        receiver: message.receiver || "all",
        timestamp: message.timestamp,
        read: message.read,
      });
  } catch (e: any) {
    console.error("[Supabase] saveMessage error:", e.message);
  }
  return message;
}

export async function getMessages(username: string) {
  try {
    // Get messages where user is sender, receiver, or receiver is "all"
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender.eq.${username},receiver.eq.${username},receiver.eq.all`)
      .order("timestamp", { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

// ==================== FRIEND OPERATIONS ====================
export async function sendFriendRequest(from: string, to: string) {
  const targetUser = await getUser(to);
  const fromUser = await getUser(from);
  if (!targetUser) return { error: "User not found" };
  if (from === to) return { error: "Cannot send request to yourself" };
  if ((targetUser.friends || []).includes(from)) return { error: "Already friends" };

  // Mutual friend request auto-accept: if the target already sent a request to from,
  // automatically become friends instead of adding another request
  if (fromUser && (fromUser.friend_requests || []).includes(to)) {
    // Auto-accept: both become friends, remove both requests
    if (!fromUser.friends.includes(to)) fromUser.friends = [...(fromUser.friends || []), to];
    fromUser.friend_requests = (fromUser.friend_requests || []).filter((f: string) => f !== to);
    fromUser.notifications = [...(fromUser.notifications || []), `You are now friends with ${to}!`];
    await saveUser(from, fromUser);

    if (!targetUser.friends.includes(from)) targetUser.friends = [...(targetUser.friends || []), from];
    targetUser.friend_requests = (targetUser.friend_requests || []).filter((f: string) => f !== from);
    targetUser.notifications = [...(targetUser.notifications || []), `${from} accepted your friend request!`];
    await saveUser(to, targetUser);

    await createNotification(from, "friend_accepted", `You are now friends with ${to}!`, to);
    await createNotification(to, "friend_accepted", `${from} accepted your friend request!`, from);
    return { success: true, autoAccepted: true };
  }

  if ((targetUser.friend_requests || []).includes(from)) return { error: "Already requested" };
  targetUser.friend_requests = [...(targetUser.friend_requests || []), from];
  targetUser.notifications = [...(targetUser.notifications || []), `${from} sent you a friend request!`];
  await saveUser(to, targetUser);
  // Create notification record
  await createNotification(to, "friend_request", `${from} sent you a friend request!`, from);
  return { success: true };
}

export async function acceptFriendRequest(username: string, friend: string) {
  const user = await getUser(username);
  const friendUser = await getUser(friend);
  if (!user || !friendUser) return { error: "User not found" };
  // Dedup guard: don't add friend if already in the list
  if (!user.friends.includes(friend)) user.friends = [...(user.friends || []), friend];
  user.friend_requests = (user.friend_requests || []).filter((f: string) => f !== friend);
  user.notifications = [...(user.notifications || []), `You are now friends with ${friend}!`];
  await saveUser(username, user);
  if (!friendUser.friends.includes(username)) friendUser.friends = [...(friendUser.friends || []), username];
  friendUser.notifications = [...(friendUser.notifications || []), `${username} accepted your friend request!`];
  await saveUser(friend, friendUser);
  await createNotification(username, "friend_accepted", `You are now friends with ${friend}!`, friend);
  await createNotification(friend, "friend_accepted", `${username} accepted your friend request!`, username);
  return { success: true };
}

export async function declineFriendRequest(username: string, friend: string) {
  const user = await getUser(username);
  if (!user) return { error: "User not found" };
  user.friend_requests = (user.friend_requests || []).filter((f: string) => f !== friend);
  await saveUser(username, user);
  return { success: true };
}

export async function cancelFriendRequest(from: string, to: string) {
  const targetUser = await getUser(to);
  if (!targetUser) return { error: "User not found" };
  targetUser.friend_requests = (targetUser.friend_requests || []).filter((f: string) => f !== from);
  await saveUser(to, targetUser);
  return { success: true };
}

export async function removeFriend(username: string, friend: string) {
  const user = await getUser(username);
  const friendUser = await getUser(friend);
  if (!user) return { error: "User not found" };
  user.friends = (user.friends || []).filter((f: string) => f !== friend);
  await saveUser(username, user);
  if (friendUser) {
    friendUser.friends = (friendUser.friends || []).filter((f: string) => f !== username);
    await saveUser(friend, friendUser);
  }
  return { success: true };
}

// ==================== NOTIFICATION OPERATIONS ====================
export async function createNotification(username: string, type: string, message: string, from?: string) {
  const id = randomBytes(6).toString("hex");
  const notification = {
    id,
    username,
    type,
    message: sanitizeString(message, 500),
    from_user: from || "",
    read: false,
    timestamp: new Date().toISOString(),
  };
  try {
    await supabase
      .from("notifications")
      .insert(notification);
  } catch (e: any) {
    console.error("[Supabase] createNotification error:", e.message);
  }
  // Return in the same format the old code expected (from_user → from)
  return {
    id: notification.id,
    username: notification.username,
    type: notification.type,
    message: notification.message,
    from: notification.from_user,
    read: notification.read,
    timestamp: notification.timestamp,
  };
}

export async function getNotifications(username: string) {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("username", username)
      .order("timestamp", { ascending: false });
    if (error || !data) return [];
    // Map from_user → from for API compatibility
    return data.map((n: any) => ({
      id: n.id,
      username: n.username,
      type: n.type,
      message: n.message,
      from: n.from_user || "",
      read: n.read,
      timestamp: n.timestamp,
    }));
  } catch {
    return [];
  }
}

export async function markNotificationsRead(username: string) {
  try {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("username", username)
      .eq("read", false);
  } catch (e: any) {
    console.error("[Supabase] markNotificationsRead error:", e.message);
  }
  return { success: true };
}

// ==================== DM MESSAGE OPERATIONS ====================
export async function saveDMMessage(from: string, to: string, content: string) {
  const id = randomBytes(8).toString("hex");
  const conversationKey = [from, to].sort().join("_");
  const message = {
    id,
    from,
    to,
    conversation_key: conversationKey,
    content: sanitizeString(content, 1000),
    timestamp: new Date().toISOString(),
  };
  try {
    await supabase
      .from("dms")
      .insert(message);
  } catch (e: any) {
    console.error("[Supabase] saveDMMessage error:", e.message);
  }
  // Return in the same format the old code expected
  return {
    id: message.id,
    from: message.from,
    to: message.to,
    content: message.content,
    timestamp: message.timestamp,
  };
}

export async function getDMMessages(user1: string, user2: string) {
  const conversationKey = [user1, user2].sort().join("_");
  try {
    const { data, error } = await supabase
      .from("dms")
      .select("*")
      .eq("conversation_key", conversationKey)
      .order("timestamp", { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

// ==================== CLEANUP: DELETE OLD RECORDS ====================
export interface CleanupResult {
  notificationsDeleted: number;
  readNotificationsDeleted: number;
  dmMessagesDeleted: number;
  chatMessagesDeleted: number;
  rateLimitsDeleted: number;
  sessionsDeleted: number;
  transactionLogsDeleted: number;
  totalFreed: number;
  errors: string[];
}

export async function runCleanup(): Promise<CleanupResult> {
  const result: CleanupResult = {
    notificationsDeleted: 0,
    readNotificationsDeleted: 0,
    dmMessagesDeleted: 0,
    chatMessagesDeleted: 0,
    rateLimitsDeleted: 0,
    sessionsDeleted: 0,
    transactionLogsDeleted: 0,
    totalFreed: 0,
    errors: [],
  };

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ---- 1. NOTIFICATIONS: Delete read older than 7 days ----
  try {
    const { count: readCount, error: readErr } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .eq("read", true)
      .lt("timestamp", sevenDaysAgo);
    if (!readErr && readCount) result.readNotificationsDeleted = readCount;
  } catch (e: any) {
    result.errors.push(`Read notifications cleanup error: ${e.message}`);
  }

  // ---- 2. NOTIFICATIONS: Delete unread older than 30 days ----
  try {
    const { count: unreadCount, error: unreadErr } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .lt("timestamp", thirtyDaysAgo);
    if (!unreadErr && unreadCount) result.notificationsDeleted = unreadCount;
  } catch (e: any) {
    result.errors.push(`Unread notifications cleanup error: ${e.message}`);
  }

  // ---- 3. DM MESSAGES: Delete older than 90 days ----
  try {
    const { count: dmCount, error: dmErr } = await supabase
      .from("dms")
      .delete({ count: "exact" })
      .lt("timestamp", ninetyDaysAgo);
    if (!dmErr && dmCount) result.dmMessagesDeleted = dmCount;
  } catch (e: any) {
    result.errors.push(`DM cleanup error: ${e.message}`);
  }

  // ---- 4. GLOBAL CHAT MESSAGES: Delete older than 90 days ----
  try {
    const { count: msgCount, error: msgErr } = await supabase
      .from("messages")
      .delete({ count: "exact" })
      .lt("timestamp", ninetyDaysAgo);
    if (!msgErr && msgCount) result.chatMessagesDeleted = msgCount;
  } catch (e: any) {
    result.errors.push(`Messages cleanup error: ${e.message}`);
  }

  // ---- 5. RATE LIMITS: Delete older than 1 hour ----
  try {
    const oneHourAgo = now - 60 * 60 * 1000;
    const { count: rlCount, error: rlErr } = await supabase
      .from("rate_limits")
      .delete({ count: "exact" })
      .lt("window_start", oneHourAgo);
    if (!rlErr && rlCount) result.rateLimitsDeleted = rlCount;
  } catch (e: any) {
    result.errors.push(`Rate limits cleanup error: ${e.message}`);
  }

  // ---- 6. ORPHANED SESSIONS: Delete sessions with expires_at > 0 and expired ----
  // Sessions with expires_at = 0 never expire (permanent sessions).
  // This only cleans up legacy sessions from before the "never expire" update.
  try {
    const { count: sessCount, error: sessErr } = await supabase
      .from("sessions")
      .delete({ count: "exact" })
      .gt("expires_at", 0)  // Only sessions that have a real expiry (not 0 = never)
      .lt("expires_at", now); // And that expiry has passed
    if (!sessErr && sessCount) result.sessionsDeleted = sessCount;
  } catch (e: any) {
    result.errors.push(`Sessions cleanup error: ${e.message}`);
  }

  // ---- 7. TRANSACTION LOGS: Delete older than 90 days ----
  try {
    const ninetyDaysAgoDate = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { count: txCount, error: txErr } = await supabase
      .from("transaction_logs")
      .delete({ count: "exact" })
      .lt("log_date", ninetyDaysAgoDate);
    if (!txErr && txCount) result.transactionLogsDeleted = txCount;
  } catch (e: any) {
    result.errors.push(`Transaction logs cleanup error: ${e.message}`);
  }

  // ---- Calculate total ----
  result.totalFreed =
    result.notificationsDeleted +
    result.readNotificationsDeleted +
    result.dmMessagesDeleted +
    result.chatMessagesDeleted +
    result.rateLimitsDeleted +
    result.sessionsDeleted +
    result.transactionLogsDeleted;

  return result;
}

// ---- Trim the in-user notification arrays to prevent bloat ----
// Each user has a `notifications` TEXT[] that grows forever.
// This keeps only the last 50 entries per user.
export async function trimUserNotificationArrays(): Promise<number> {
  let trimmed = 0;
  const MAX_NOTIFICATIONS = 50;
  const PAGE_SIZE = 100;
  let offset = 0;
  try {
    // Paginate through users instead of fetching all at once
    while (true) {
      const { data, error } = await supabase
        .from("users")
        .select("username, notifications")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error || !data || data.length === 0) break;

      for (const row of data) {
        const notifs = row.notifications || [];
        if (notifs.length > MAX_NOTIFICATIONS) {
          const trimmedNotifs = notifs.slice(-MAX_NOTIFICATIONS);
          const { error: updateErr } = await supabase
            .from("users")
            .update({ notifications: trimmedNotifs })
            .eq("username", row.username);
          if (!updateErr) trimmed++;
        }
      }
      offset += PAGE_SIZE;
    }
  } catch {}
  return trimmed;
}
