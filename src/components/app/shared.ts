// ==================== SHARED CONSTANTS & UTILITIES ====================
// This file contains constants, types, and utility functions shared across
// multiple component files extracted from page.tsx.
// SINGLE SOURCE OF TRUTH for ITEM_COLORS — all other files must import from here.

import type { AvatarData } from "@/lib/store";

// ==================== ITEM COLORS ====================
// Single source of truth — do NOT duplicate this map in other files.
// Import getItemColor() from this file instead.
export const ITEM_COLORS: Record<string, string> = {
  // Faces
  "FACE-1": "#FFD700",  // Smile Face (pixel smile, default)
  "FACE-2": "#87CEEB",  // Pity Face
  "FACE-3": "#FFD700",  // Spooked Face
  "FACE-4": "#87CEEB",  // Smug Face
  "FACE-5": "#7B8794",  // Tired Face
  "FACE-6": "#00BFFF",  // Neutral Face
  "FACE-7": "#8B4513",  // Girl Face
  "FACE-8": "#9370DB",  // Surprised Guy
  "FACE-9": "#FF4500",  // Happy Face
  "FACE-11": "#32CD32", // Meanie Face
  "FACE-12": "#FF6347", // Sad Face
  "FACE-13": "#4169E1", // Angry Face
  "FACE-14": "#FF1493", // Question Face
  "FACE-15": "#00CED1", // Looking Up
  "FACE-16": "#FF8C00", // Neutral Boy
  "FACE-17": "#8A2BE2", // Man Smile
  "FACE-18": "#2E8B57", // Girl Smile
  "FACE-19": "#DC143C", // Calm Face
  "FACE-20": "#4B0082", // Fury Face
  "FACE-21": "#8B4513", // Bearded Face
  // Shirts
  "SHIRT-1": "#CC0000", "SHIRT-2": "#FF4500", "SHIRT-3": "#228B22", "SHIRT-4": "#6A0DAD",
  "SHIRT-5": "#FFD700", "SHIRT-6": "#191970", "SHIRT-7": "#FFB6C1", "SHIRT-8": "#006994",
  // Pants
  "PANTS-1": "#2196F3", "PANTS-2": "#0D1B2A", "PANTS-3": "#556B2F", "PANTS-4": "#CC0000",
  "PANTS-5": "#F5F5F5", "PANTS-6": "#7B2D8E",
};

// ==================== ITEM TYPE HELPERS ====================

/** Get the display color for an item (used for shirt/pants 3D rendering) */
export function getItemColor(itemId: string): string {
  return ITEM_COLORS[itemId] || "#888";
}

/** Get the human-readable type name without appending it to the item name */
export function getItemTypeName(type: string): string {
  switch (type) {
    case "face": return "Face";
    case "shirt": return "Shirt";
    case "pants": return "Pants";
    default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

/** Get the local image path for a face item. ALL faces use /items/faces/FACE-N.png */
export function getFaceImagePath(faceId: string): string {
  return `/items/faces/${faceId}.png`;
}

// ==================== PRICE FORMATTING ====================

/** Format price for display: 1000 → "1k", 1000000 → "1M", 0 → "Free" */
export function formatPrice(price: number): string {
  if (price === 0) return "Free";
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (price >= 1_000) return `${(price / 1_000).toFixed(1).replace('.0', '')}k`;
  return price.toString();
}

// ==================== TEXT MODERATION ====================
export const BANNED_WORDS = ["fuck", "shit", "ass", "bitch", "dick", "piss", "crap", "damn", "hell", "bastard", "slut", "whore", "nigger", "nigga", "fag", "retard", "idiot", "stupid", "dumb", "moron", "pussy", "cock", "penis", "vagina", "sex", "porn", "nude", "nsfw", "kill", "die", "suicide", "murder", "rape", "terrorist", "nazi"];

export function moderateText(text: string): string {
  if (!text) return text;
  let moderated = text;
  for (const word of BANNED_WORDS) {
    try {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      moderated = moderated.replace(regex, word[0] + "*".repeat(word.length - 1));
    } catch {}
  }
  return moderated;
}

export function isTextClean(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return !BANNED_WORDS.some(w => {
    try {
      const regex = new RegExp(`\\b${w}\\b`, 'i');
      return regex.test(lower);
    } catch {
      return false;
    }
  });
}

// ==================== DEFAULT AVATAR ====================
// FACE-1 = Smile Face (the iconic pixel smile) is the default face
export const DEFAULT_AVATAR: AvatarData = { skin: "#f8ff6d", face: "FACE-1", shirt: "SHIRT-1", left_leg: "PANTS-1", right_leg: "PANTS-1" };

// Default items every new user owns
export const DEFAULT_OWNED_ITEMS = ["FACE-1", "SHIRT-1", "PANTS-1"];

// ==================== BODY DIMENSIONS ====================
export const TORSO_HEIGHT = 1.0;
export const TORSO_WIDTH = 0.875;
export const TORSO_DEPTH = 0.6;
export const HEAD_WIDTH = 0.625;
export const HEAD_HEIGHT = 0.625;
export const HEAD_DEPTH = 0.6;
export const ARM_WIDTH = 0.4375;
export const ARM_HEIGHT = 0.975;
export const ARM_DEPTH = 0.5;
export const LEG_WIDTH = 0.4375;
export const LEG_HEIGHT = 0.875;
export const LEG_DEPTH = 0.5;
export const ARM_GAP = 0.02;
export const HEAD_GAP = 0.05;
export const LEG_GAP = 0.05;

export const UNEQUIPPED_TORSO_COLOR = "#CC0000";
export const UNEQUIPPED_LEGS_COLOR = "#2196F3";

export const SKIN_COLORS = [
  { name: "Porcelain", color: "#f5f0e6" }, { name: "Ivory", color: "#faf0e6" }, { name: "Light Gray", color: "#d1d1d1" },
  { name: "Vanilla Cream", color: "#f5d6b4" }, { name: "Peach", color: "#ffcba4" }, { name: "Beige", color: "#d4b896" },
  { name: "Caramel", color: "#d4a373" }, { name: "Tan", color: "#d2a679" }, { name: "Bronze", color: "#a0785a" },
  { name: "Coffee Ground", color: "#8d5524" }, { name: "Espresso", color: "#5c4033" }, { name: "Wenge", color: "#3d2314" },
  { name: "Ocean Blue", color: "#7dd3fc" }, { name: "Sky Blue", color: "#38bdf8" }, { name: "Electric Blue", color: "#3b82f6" },
  { name: "Navy", color: "#1e3a5f" }, { name: "Cyan", color: "#22d3ee" }, { name: "Teal", color: "#14b8a6" },
  { name: "Coral Red", color: "#f87171" }, { name: "Cherry Red", color: "#dc2626" }, { name: "Rose", color: "#fb7185" },
  { name: "Sunset Orange", color: "#fb923c" }, { name: "Tangerine", color: "#f97316" }, { name: "Apricot", color: "#fdba74" },
  { name: "Lemon Cream", color: "#f8ff6d" },
  { name: "Pale Yellow", color: "#fef9c3" }, { name: "Buttercup", color: "#fef08a" }, { name: "Sunflower", color: "#fde047" },
  { name: "Canary", color: "#facc15" }, { name: "Golden Yellow", color: "#eab308" }, { name: "Amber", color: "#d97706" },
  { name: "Mint Green", color: "#86efac" }, { name: "Lime", color: "#84cc16" }, { name: "Forest Green", color: "#22c55e" },
  { name: "Emerald", color: "#10b981" }, { name: "Olive", color: "#68a357" },
  { name: "Lavender", color: "#a78bfa" }, { name: "Grape Purple", color: "#c084fc" }, { name: "Violet", color: "#8b5cf6" },
  { name: "Royal Purple", color: "#7c3aed" }, { name: "Magenta", color: "#d946ef" },
  { name: "Soft Pink", color: "#f9a8d4" }, { name: "Bubblegum", color: "#ec4899" }, { name: "Strawberry Pink", color: "#f472b6" },
  { name: "Salmon", color: "#fa8072" },
  { name: "Silver", color: "#c0c0c0" }, { name: "Gold", color: "#fbbf24" }, { name: "Charcoal", color: "#374151" },
  { name: "Slate", color: "#64748b" }, { name: "Pure Light", color: "#ffffff" }, { name: "Night", color: "#1a1a1a" },
];

// ==================== SCRIPT TYPES (used by GamePlayer/GameWorld) ====================
export type ScriptEvent = "on_start" | "on_click" | "on_touch" | "on_key_press"
  | "on_variable_change" | "on_timer" | "on_player_join" | "on_player_die"
  | "on_item_collect" | "on_checkpoint" | "on_collide" | "on_proximity" | "on_custom_event";

export type ScriptAction = "destroy_self" | "destroy_object" | "change_color" | "change_size" | "move_to"
  | "rotate_to" | "set_variable" | "play_sound" | "show_message"
  | "teleport_player" | "give_item" | "take_damage" | "heal"
  | "spawn_object" | "enable_object" | "disable_object" | "change_transparency"
  | "change_material" | "apply_force" | "set_timer" | "trigger_event"
  | "open_door" | "close_door" | "start_animation" | "show_dialog"
  | "wait" | "if_branch";

export interface ScriptCondition {
  type: "variable_equals" | "variable_greater" | "variable_less" | "has_item" | "custom";
  variable?: string;
  value?: any;
}

export interface ScriptRule {
  id: string;
  event: ScriptEvent;
  action: ScriptAction;
  params: Record<string, any>;
  condition?: ScriptCondition;
  enabled: boolean;
  collapsed?: boolean;
}

// ==================== MATERIAL CONSTANTS (used by WorldPrimitive) ====================
export const MATERIAL_ROUGHNESS: Record<string, number> = { plastic: 0.5, neon: 0.1, glass: 0.05, wood: 0.8, metal: 0.3, grass: 0.9, sand: 0.95, ice: 0.02, slate: 0.7 };
export const MATERIAL_EMISSIVE: Record<string, boolean> = { neon: true };
export const MATERIAL_METALNESS: Record<string, number> = { plastic: 0, neon: 0, glass: 0.1, wood: 0, metal: 0.9, grass: 0, sand: 0, ice: 0, slate: 0.3 };
export const MATERIAL_COLOR_TINT: Record<string, string | null> = { wood: "#8B6914", grass: "#3A7D2C", sand: "#D4B96A", ice: "#B0E0E6", slate: "#4A4A4A" };
export const MATERIAL_OPACITY: Record<string, number> = { glass: 0.35, ice: 0.7 };

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${Math.round(r * 255).toString(16).padStart(2, "0")}${Math.round(g * 255).toString(16).padStart(2, "0")}${Math.round(b * 255).toString(16).padStart(2, "0")}`;
}

// ==================== PHYSICS CONSTANTS ====================
export const GRAVITY = -0.025;
export const JUMP_FORCE = 0.32;
export const MOVE_SPEED = 0.18;
export const PLAYER_HEIGHT = LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT;
export const PLAYER_RADIUS = 0.25;
export const GROUND_SKIN = 0.15;
export const STEP_HEIGHT = 0.6;

// ==================== MOBILE CONTROLS ====================
export const mobileInputRef = {
  moveX: 0,
  moveZ: 0,
  jump: false,
  cameraYawDelta: 0,
  cameraPitchDelta: 0,
};

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// D-pad button style constants
export const DPAD_BTN_SIZE = 52;
export const DPAD_GAP = 4;

// ==================== REMOTE PLAYER DATA ====================
export interface RemotePlayerData {
  socketId: string;
  username: string;
  position: [number, number, number];
  rotation: [number, number, number];
  avatar: AvatarData;
}
