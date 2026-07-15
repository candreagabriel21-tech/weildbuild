// ═══════════════════════════════════════════════════════════════════
// StudioProjectState — Serializable snapshot of the full studio state
// ═══════════════════════════════════════════════════════════════════
//
// This is the SINGLE source of truth for what gets serialized when a
// user publishes a game (or hits Test Play). It captures EVERYTHING
// the editor needs to reconstruct the scene 1:1 in the game player:
//   - All objects (parts + groups) with their physics, effects, rules
//   - All joints
//   - All world settings (sky, sun, moon, clouds, weather, day/night)
//   - All terrain v2 state (heightmap, water bodies, trees, layers)
//   - All global variables / timers (for WeildCode)
//   - Physics settings
//   - Avatar (so the right character shows up)
//
// GameData.studioState?: StudioProjectState is the field that carries
// this payload. It is optional so legacy games (saved before this fix)
// still load via the fallback primitive converter.

import { useStudioStore, isPart } from './studio-store';
import type {
  StudioObject,
  Joint,
  WorldSettings,
  PhysicsSettings,
  GlobalTimer,
} from './studio-store';
import type {
  TerrainHeightmap as TerrainHeightmapV2,
  TerrainGeneratorConfig,
  TerrainLayer,
  WaterBody as WaterBodyV2,
  TreeInstance as TreeInstanceV2,
} from './terrain-v2';

// ─── Serializable Studio State ───

export interface StudioProjectState {
  // Core scene
  objects: StudioObject[];
  joints: Joint[];

  // World / sky / weather / day-night
  worldSettings: WorldSettings;

  // Physics
  physicsSettings: PhysicsSettings;

  // Terrain v2
  terrainHeightmap: TerrainHeightmapV2 | null;
  terrainConfig: TerrainGeneratorConfig;
  waterBodies: WaterBodyV2[];
  treeInstances: TreeInstanceV2[];
  terrainLayers: TerrainLayer[];
  terrainColor: string;
  waterColor: string;

  // WeildCode
  globalVariables: Record<string, number | string | boolean>;
  globalTimers: GlobalTimer[];

  // Character
  avatar: {
    skin: string;
    face: string | null;
    shirt: string | null;
    left_leg: string | null;
    right_leg: string | null;
  };

  // Metadata
  schemaVersion: 1;
}

// ─── Deep-clone helper (avoids sharing references between store & snapshot) ───

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

// ─── Snapshot: capture the full studio state from the live store ───

export function snapshotStudioState(): StudioProjectState {
  const s = useStudioStore.getState();

  const objects: StudioObject[] = [];
  s.objects.forEach((obj) => objects.push(deepClone(obj)));

  return {
    objects,
    joints: deepClone(s.joints),
    worldSettings: { ...s.worldSettings },
    physicsSettings: { ...s.physicsSettings },
    terrainHeightmap: s.terrainHeightmap ? deepClone(s.terrainHeightmap) : null,
    terrainConfig: { ...s.terrainConfig },
    waterBodies: deepClone(s.waterBodies),
    treeInstances: deepClone(s.treeInstances),
    terrainLayers: deepClone(s.terrainLayers),
    terrainColor: s.terrainColor,
    waterColor: s.waterColor,
    globalVariables: { ...s.globalVariables },
    globalTimers: deepClone(s.globalTimers),
    avatar: { ...s.avatar },
    schemaVersion: 1,
  };
}

// ─── Restore: load a serialized studio state back into the live store ───

export function restoreStudioState(state: StudioProjectState): void {
  const newObjects = new Map<string, StudioObject>();
  for (const obj of state.objects) {
    const cloned = deepClone(obj);
    // Fix: Force character parts to be visible. Old saved projects may have
    // showInWorld=false on character parts from before the fix. Character parts
    // should always be visible in both editor and play mode.
    if (isPart(cloned) && cloned.isCharacterPart) {
      cloned.showInWorld = true;
    }
    newObjects.set(obj.id, cloned);
  }

  // Single atomic setState so we don't trigger intermediate re-renders
  useStudioStore.setState({
    objects: newObjects,
    joints: deepClone(state.joints),
    worldSettings: deepClone(state.worldSettings),
    physicsSettings: deepClone(state.physicsSettings),
    terrainHeightmap: state.terrainHeightmap ? deepClone(state.terrainHeightmap) : null,
    terrainConfig: deepClone(state.terrainConfig),
    waterBodies: deepClone(state.waterBodies),
    treeInstances: deepClone(state.treeInstances),
    terrainLayers: deepClone(state.terrainLayers),
    terrainColor: state.terrainColor,
    waterColor: state.waterColor,
    globalVariables: { ...state.globalVariables },
    globalTimers: deepClone(state.globalTimers),
    avatar: { ...state.avatar },
    showTerrain: !!state.terrainHeightmap,
    selectedIds: [],
    groupModeIds: [],
    unionModeIds: [],
    explosionVisuals: [],
    consoleMessages: [],
    screenMessages: [],
    undoStack: [],
    redoStack: [],
    clipboard: null,
  });
}

// ─── Find spawn position from studio objects ───

export function findSpawnPosition(state: StudioProjectState): { x: number; y: number; z: number } {
  for (const obj of state.objects) {
    if ('isSpawnPoint' in obj && (obj as any).isSpawnPoint) {
      return {
        x: obj.position.x,
        y: obj.position.y + (obj.size.y / 2) + 1.5,
        z: obj.position.z,
      };
    }
  }
  // Fallback: world origin
  return { x: 0, y: 3, z: 0 };
}

// ─── Validate: ensure a studio state is well-formed enough to play ───

export function isValidStudioState(state: any): state is StudioProjectState {
  if (!state || typeof state !== 'object') return false;
  if (!Array.isArray(state.objects)) return false;
  if (!state.worldSettings || typeof state.worldSettings !== 'object') return false;
  if (!state.physicsSettings || typeof state.physicsSettings !== 'object') return false;
  return true;
}
