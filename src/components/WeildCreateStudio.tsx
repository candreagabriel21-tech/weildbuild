'use client';

import { useEffect, useCallback, useRef } from 'react';
import { StudioLayout } from '@/components/studio/StudioLayout';
import { useStudioStore, StudioPart, StudioObject, isPart, PartType, MaterialType } from '@/lib/studio-store';
import type { UserData, GameData, PrimitiveData } from '@/lib/store';
import { snapshotStudioState, restoreStudioState, isValidStudioState, type StudioProjectState } from '@/lib/studio-project';

// ==================== DATA FORMAT BRIDGE ====================

/**
 * Convert a hex color string (#ff0000) to RGB 0-1 array [1, 0, 0]
 */
function hexToRgb01(hex: string): [number, number, number] {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return [0.6, 0.6, 0.75];
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

/**
 * Convert RGB 0-1 array [1, 0, 0] to hex color string (#ff0000)
 */
function rgb01ToHex(r: number, g: number, b: number): string {
  return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`;
}

/**
 * Map studio PartType to platform shape_type
 */
const PART_TYPE_MAP: Record<PartType, PrimitiveData['shape_type']> = {
  'Block': 'block',
  'Sphere': 'sphere',
  'Wedge': 'wedge',
  'Cylinder': 'cylinder',
  'Spawn': 'spawn_point',
};

/**
 * Map platform shape_type to studio PartType
 */
const SHAPE_TYPE_MAP: Record<string, PartType> = {
  'block': 'Block',
  'sphere': 'Sphere',
  'wedge': 'Wedge',
  'cylinder': 'Cylinder',
  'corner_wedge': 'Block',
  'spawn_point': 'Spawn',
  'kill_brick': 'Block',
  'speed_pad': 'Block',
  'checkpoint': 'Block',
  'item_pickup': 'Block',
  'truss': 'Block',
  'ramp': 'Block',
  'lava': 'Block',
  'water': 'Block',
  'door': 'Block',
  'teleporter': 'Block',
  'npc': 'Block',
  'player': 'Block',
};

/**
 * Map studio MaterialType (PascalCase) to platform material (lowercase)
 */
const MATERIAL_TO_PLATFORM: Record<string, string> = {
  'Plastic': 'plastic',
  'Wood': 'wood',
  'WoodPlanks': 'wood',
  'Slate': 'slate',
  'Concrete': 'slate',
  'Metal': 'metal',
  'DiamondPlate': 'metal',
  'Grass': 'grass',
  'Ice': 'ice',
  'Brick': 'plastic',
  'Sand': 'sand',
  'Fabric': 'plastic',
  'Granite': 'slate',
  'Marble': 'plastic',
  'Neon': 'neon',
  'SmoothPlastic': 'plastic',
  'CorrodedMetal': 'metal',
  'Foil': 'metal',
  'Cobblestone': 'slate',
  'Pebble': 'slate',
};

/**
 * Map platform material (lowercase) to studio MaterialType (PascalCase)
 */
const MATERIAL_TO_STUDIO: Record<string, MaterialType> = {
  'plastic': 'Plastic',
  'neon': 'Neon',
  'glass': 'Plastic',
  'wood': 'Wood',
  'metal': 'Metal',
  'grass': 'Grass',
  'sand': 'Sand',
  'ice': 'Ice',
  'slate': 'Slate',
};

/**
 * Convert a StudioPart to platform PrimitiveData for saving
 */
export function studioPartToPrimitive(part: StudioPart): PrimitiveData {
  return {
    id: part.id,
    position: [part.position.x, part.position.y, part.position.z],
    size: [part.size.x, part.size.y, part.size.z],
    color: hexToRgb01(part.color),
    rotation: [part.rotation.x, part.rotation.y, part.rotation.z],
    shape_type: part.isSpawnPoint ? 'spawn_point' : (PART_TYPE_MAP[part.type] || 'block'),
    name: part.name,
    anchored: part.anchored,
    visible: true,
    material: MATERIAL_TO_PLATFORM[part.material] || 'plastic',
    transparency: part.transparency,
    reflectance: part.reflectance,
  };
}

/**
 * Convert platform PrimitiveData to a StudioPart for loading
 */
export function primitiveToStudioPart(prim: PrimitiveData): StudioPart {
  const color = Array.isArray(prim.color) && prim.color.length >= 3
    ? rgb01ToHex(prim.color[0], prim.color[1], prim.color[2])
    : '#4a90d9';

  const isSpawn = prim.shape_type === 'spawn_point';

  return {
    id: prim.id || `obj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: prim.name || (isSpawn ? 'SpawnLocation' : 'Part'),
    type: SHAPE_TYPE_MAP[prim.shape_type] || 'Block',
    position: {
      x: prim.position?.[0] ?? 0,
      y: prim.position?.[1] ?? 0,
      z: prim.position?.[2] ?? 0,
    },
    size: {
      x: prim.size?.[0] ?? 4,
      y: prim.size?.[1] ?? 1,
      z: prim.size?.[2] ?? 4,
    },
    rotation: {
      x: prim.rotation?.[0] ?? 0,
      y: prim.rotation?.[1] ?? 0,
      z: prim.rotation?.[2] ?? 0,
    },
    color,
    material: MATERIAL_TO_STUDIO[prim.material || 'plastic'] || 'Plastic',
    transparency: prim.transparency ?? 0,
    reflectance: prim.reflectance ?? 0,
    anchored: prim.anchored ?? true,
    canCollide: true,
    friction: 0.5,
    elasticity: 0.2,
    density: 1.0,
    children: [],
    parentId: null,
    bodyMovers: [],
    effects: [],
    isSpawnPoint: isSpawn,
  };
}

/**
 * Serialize the full studio state to a saveable Partial<GameData>.
 *
 * CRITICAL: This now embeds the full `studioState` snapshot — the SAME
 * state the editor uses. The GamePlayer loads this snapshot directly
 * into the studio store and runs the same engine, so EVERYTHING that
 * shows up in the editor (physics, WeildCode rules, terrain, sky,
 * day/night, weather, bodyMovers, joints, effects, etc.) shows up
 * identically in the published game.
 *
 * The legacy `primitives` array is still populated for backwards
 * compatibility (e.g. game browsers that show a thumbnail count).
 */
export function studioStateToGameData(
  objects: Map<string, StudioObject>,
  name: string = 'Untitled Game',
  description: string = '',
  creator: string = '',
): Partial<GameData> {
  const primitives: PrimitiveData[] = [];
  let spawnPoint: number[] | null = null;
  let spawnFound = false;

  objects.forEach((obj) => {
    if (isPart(obj)) {
      primitives.push(studioPartToPrimitive(obj));
      // Find the first spawn point for the game's spawn_point
      if (obj.isSpawnPoint && !spawnFound) {
        spawnPoint = [obj.position.x, obj.position.y + obj.size.y / 2 + 1.5, obj.position.z];
        spawnFound = true;
      }
    }
  });

  const worldSettings = useStudioStore.getState().worldSettings;

  // If no spawn point part found, use the world settings spawn point
  if (!spawnFound && worldSettings.spawnPointPosition) {
    spawnPoint = [worldSettings.spawnPointPosition.x, worldSettings.spawnPointPosition.y, worldSettings.spawnPointPosition.z];
  }
  // Final fallback
  if (!spawnPoint) {
    spawnPoint = [0, 0.15, 0];
  }

  // Baseplate color matching the editor baseplate (#3d6666)
  const baseplateColorRgb = hexToRgb01('#3d6666');

  // ─── THE KEY FIX: capture the FULL studio state ───
  // This snapshot is what the GamePlayer loads to run the same engine
  // the editor uses. Without it, the game would only see the downgraded
  // `primitives` array (no rules, no terrain, no sky settings, etc.).
  const studioState: StudioProjectState = snapshotStudioState();

  return {
    name,
    description,
    creator,
    public: true,
    multiplayer: false,
    primitives,
    spawn_point: spawnPoint,
    sky_color_top: hexToRgb01(worldSettings.skyColorTop),
    sky_color_bottom: hexToRgb01(worldSettings.skyColorBottom),
    baseplate_color: baseplateColorRgb,
    baseplate_size: worldSettings.baseplateSize,
    max_players: worldSettings.maxPlayers,
    studioState,
  };
}

/**
 * Deserialize a game for the studio to load
 */
export function gameDataToStudioState(game: GameData): StudioObject[] {
  const studioObjects: StudioObject[] = [];
  for (const prim of (game.primitives || [])) {
    if (prim.shape_type === 'player') continue;
    studioObjects.push(primitiveToStudioPart(prim));
  }
  return studioObjects;
}

// ==================== WRAPPER COMPONENT ====================

interface WeildCreateStudioProps {
  user: UserData;
  onCreateGame: (game: Partial<GameData>) => Promise<GameData | null>;
  onPlayGame: (game: GameData) => void;
  onExit?: () => void;
  savedState?: any;
  onTestPlay?: (state: any) => void;
}

export default function WeildCreateStudio({
  user,
  onCreateGame,
  onPlayGame,
  onExit,
  savedState,
  onTestPlay,
}: WeildCreateStudioProps) {
  const initializedRef = useRef(false);

  // Sync the user's avatar into the studio store so play mode uses the REAL character
  useEffect(() => {
    if (user?.avatar) {
      useStudioStore.getState().setAvatar(user.avatar);
    }
  }, [user?.avatar]);

  // Load saved state or existing game on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // ─── Returning from Test Play ───
    // When the user clicks "Back" from Test Play, the global studio store
    // ALREADY has their work-in-progress state (the GamePlayer never
    // overwrote it for test play — it only called startTestPlayMode which
    // snapshots + restores). So we should NOT reload from savedState —
    // that would clobber joints, worldSettings, terrain, etc.
    //
    // We only load from savedState if the store is empty (fresh editor
    // session) OR if savedState carries a full studioState snapshot that
    // differs from what's in the store.
    const storeState = useStudioStore.getState();
    const storeHasObjects = storeState.objects.size > 0;

    if (savedState) {
      try {
        // Preferred path: savedState has a full studioState snapshot.
        // Use restoreStudioState for a complete 1:1 restore (objects,
        // joints, worldSettings, terrain, WeildCode rules, etc.).
        if (savedState.studioState && isValidStudioState(savedState.studioState)) {
          // Only restore if the store is empty OR if the snapshot is
          // different from what's already loaded (avoids needlessly
          // clobbering state that's already correct).
          if (!storeHasObjects) {
            restoreStudioState(savedState.studioState as StudioProjectState);
          }
        } else if (savedState.studioObjects && !storeHasObjects) {
          // Legacy partial state (just objects) — only load if store is empty.
          useStudioStore.getState().loadProject({ objects: savedState.studioObjects });
        } else if (savedState.primitives && !storeHasObjects) {
          // Even older legacy state (just primitives) — convert + load.
          const studioObjects = gameDataToStudioState(savedState as GameData);
          useStudioStore.getState().loadProject({ objects: studioObjects });
        }
      } catch (e) {
        console.error('Failed to restore studio state:', e);
      }
    }

    // Ensure a default spawn point exists — same as the one from the parts menu
    const store = useStudioStore.getState();
    const hasSpawn = Array.from(store.objects.values()).some(obj => isPart(obj) && obj.isSpawnPoint);
    if (!hasSpawn) {
      store.addSpawnPoint();
    }
  }, [savedState]);

  const handleSave = useCallback(async () => {
    const state = useStudioStore.getState();
    const gameData = studioStateToGameData(
      state.objects,
      'Untitled Game',
      'Created in WeildCreate',
      user.username,
    );
    const result = await onCreateGame(gameData);
    if (result) {
      useStudioStore.getState().addConsoleMessage('success', `Game saved: ${result.name} (${result.id})`);
    } else {
      useStudioStore.getState().addConsoleMessage('error', 'Failed to save game');
    }
  }, [onCreateGame, user.username]);

  const handleTestPlay = useCallback(() => {
    const state = useStudioStore.getState();

    // Deselect any active tool (switch back to Select) so brush/place tools
    // don't carry over into the Test Play view. Also clear the selection so
    // no part appears highlighted in the game.
    state.setActiveTool('Select');
    state.clearSelection();
    state.setGroupModeIds([]);
    state.setUnionModeIds([]);

    const gameData = studioStateToGameData(
      state.objects,
      'Test Play',
      'Test game from WeildCreate',
      user.username,
    );

    const studioObjects: StudioObject[] = [];
    state.objects.forEach((obj) => studioObjects.push(obj));

    const stateForTestPlay = {
      ...gameData,
      studioObjects,
    };

    if (onTestPlay) {
      onTestPlay(stateForTestPlay);
    }
  }, [onTestPlay, user.username]);

  // Listen for custom events from RibbonToolbar
  useEffect(() => {
    const handleTestPlayEvent = () => {
      handleTestPlay();
    };

    const handlePublishEvent = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { name, description, isPublic } = customEvent.detail || {};
      const state = useStudioStore.getState();
      const gameData = studioStateToGameData(
        state.objects,
        name || 'Untitled Game',
        description || '',
        user.username,
      );
      if (!isPublic) {
        (gameData as any).public = false;
      }
      const result = await onCreateGame(gameData);
      if (result) {
        state.addConsoleMessage('success', `Published: ${result.name} (${result.id})`);
      } else {
        state.addConsoleMessage('error', 'Failed to publish game');
      }
    };

    window.addEventListener('weildcreate-testplay', handleTestPlayEvent);
    window.addEventListener('weildcreate-publish', handlePublishEvent);

    return () => {
      window.removeEventListener('weildcreate-testplay', handleTestPlayEvent);
      window.removeEventListener('weildcreate-publish', handlePublishEvent);
    };
  }, [handleTestPlay, onCreateGame, user.username]);

  // Listen for keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        if (onExit) onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit, handleSave]);

  return (
    <div className="w-full h-full relative">
      <StudioLayout />
      {/* Floating action bar for platform integration */}
      <div className="absolute top-1 right-3 z-50 flex items-center gap-1.5">
        <button
          onClick={handleTestPlay}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors text-xs font-medium"
          title="Test Play (launches game player with current studio state)"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
          Test Play
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30 transition-colors text-xs font-medium"
          title="Save game (Ctrl+S)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save
        </button>
        {onExit && (
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-700/60 text-purple-100 border border-purple-500/40 hover:bg-purple-700/80 hover:text-white transition-colors text-xs font-medium"
            title="Exit to lobby (Esc)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Exit
          </button>
        )}
      </div>
    </div>
  );
}
