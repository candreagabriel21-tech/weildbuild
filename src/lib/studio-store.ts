import { create } from 'zustand';
import { WeildCodeRule } from './weildcode-types';
import type {
  TerrainHeightmap as TerrainHeightmapV2,
  TerrainGeneratorConfig,
  TerrainLayer,
  BrushType,
  BrushSettings,
  WaterBody as WaterBodyV2,
  TreeInstance as TreeInstanceV2,
  TreeVariant,
} from './terrain-v2';
import {
  DEFAULT_TERRAIN_CONFIG,
  DEFAULT_TERRAIN_LAYERS,
  DEFAULT_BRUSH,
  generateHeightmap,
  getHeightAt as getHeightAtV2,
  applyBrush as applyBrushV2,
  applyBrushStroke as applyBrushStrokeV2,
  createWaterBody as createWaterBodyV2,
  createTree as createTreeV2,
  scatterTrees as scatterTreesV2,
} from './terrain-v2';

export type PartType = 'Block' | 'Sphere' | 'Wedge' | 'Cylinder' | 'Spawn';

// ToolMode now includes terrain brush tools. When a brush tool is active,
// clicking on the terrain applies that brush at the click location.
export type ToolMode =
  | 'Select' | 'Move' | 'Scale' | 'Rotate' | 'Group' | 'Delete' | 'Union'
  // Terrain brush tools — each maps to a BrushType
  | 'BrushRaise' | 'BrushLower' | 'BrushSmooth' | 'BrushFlatten' | 'BrushErode' | 'BrushSculpt' | 'BrushPaint'
  // Tree placement tool — click terrain to drop a tree
  | 'PlaceTree';

// Re-export the new terrain types so consumers can import them from the store
export type {
  TerrainHeightmap as TerrainHeightmapV2,
  WaterBody as WaterBodyV2,
  TreeInstance as TreeInstanceV2,
  TreeVariant,
  BrushSettings,
  BrushType,
  TerrainGeneratorConfig,
  TerrainLayer,
} from './terrain-v2';


// ─── Clipboard ───

export interface ClipboardEntry {
  objects: StudioObject[];  // Can include both StudioPart and StudioModel (groups)
  cutFromIds: string[] | null; // null = copy, non-null = cut (original ids for reference)
}
export type StudioTab = 'File' | 'Home' | 'Model' | 'Terrain' | 'Test' | 'View';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type MaterialType =
  | 'Plastic' | 'Wood' | 'Slate' | 'Concrete' | 'Metal' | 'DiamondPlate'
  | 'Grass' | 'Ice' | 'Brick' | 'Sand' | 'Fabric' | 'Granite' | 'Marble'
  | 'Neon' | 'SmoothPlastic' | 'CorrodedMetal' | 'Foil' | 'Cobblestone'
  | 'Pebble' | 'WoodPlanks';

// ─── BodyMovers (WeildBuild force appliers) ───

export type BodyMoverType =
  | 'BodyForce'
  | 'BodyVelocity'
  | 'BodyGyro'
  | 'BodyPosition'
  | 'BodyThrust'
  | 'BodyAngularVelocity';

export interface BodyMover {
  id: string;
  type: BodyMoverType;
  enabled: boolean;
  force?: Vector3;
  velocity?: Vector3;
  maxForce?: Vector3;
  P?: number;
  D?: number;
  cframe?: Vector3;
  maxTorque?: Vector3;
  position?: Vector3;
  location?: Vector3;
  angularVelocity?: Vector3;
  /** Duration in seconds after which this mover auto-removes (e.g. explosion impulse) */
  duration?: number;
  /** Internal: elapsed time since creation (used for duration expiry) */
  _elapsed?: number;
}

// ─── Joints (WeildBuild connections) ───

export type JointType = 'Weld' | 'Motor' | 'Snap' | 'Glue' | 'Rotate' | 'Hinge' | 'Rope';

export interface Joint {
  id: string;
  type: JointType;
  partAId: string;
  partBId: string;
  enabled: boolean;
  C0?: Vector3;
  C1?: Vector3;
  motorSpeed?: number;
  motorMaxTorque?: number;
}

// ─── Effects (Fire, Smoke, Light) ───

export interface PartEffect {
  id: string;
  type: 'Fire' | 'Smoke' | 'Light';
  color: string;
  size: number;
  enabled: boolean;
  brightness?: number;
  range?: number;
  opacity?: number;
}

// ─── Global Variables & Timers (accessible by all objects in Logic) ───

export interface GlobalTimer {
  id: string;
  name: string;
  interval: number; // seconds
  repeat: 'once' | 'every';
  enabled: boolean;
}

// ─── StudioPart (enhanced with physics properties) ───

export interface StudioPart {
  id: string;
  name: string;
  type: PartType;
  position: Vector3;
  size: Vector3;
  rotation: Vector3;
  color: string;
  material: MaterialType;
  transparency: number;
  reflectance: number;
  anchored: boolean;
  canCollide: boolean;
  friction: number;
  elasticity: number;
  density: number;
  children: string[];
  parentId: string | null;
  bodyMovers: BodyMover[];
  effects?: PartEffect[];
  isSpawnPoint?: boolean;
  isBaseplate?: boolean;
  spawnTeam?: 'Neutral' | 'Blue' | 'Red';
  /** True if this part is a character body part (head, torso, arm, leg, face). */
  isCharacterPart?: boolean;
  /** Which body part this is — used to assemble the character in-game. */
  characterPartType?: 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'face';
  /**
   * Show in World toggle. When true, the object works normally (rendered,
   * physical, runs code). When false, the object acts as if deleted — no
   * rendering, no physics, no collision, no WeildCode — but stays in the
   * explorer so other parts can re-enable it. Character parts default to
   * false so the character doesn't appear until the player spawns.
   */
  showInWorld?: boolean;
  // ─── Avatar Modification (character parts only) ───
  // When true, the corresponding property is overridden by the joining
  // player's avatar at runtime. Lets creators make one character rig that
  // adapts to each player's skin/face/shirt/pants.
  modifyColorToAvatar?: boolean;
  modifySizeToAvatar?: boolean;
  modifyFaceToAvatar?: boolean;
  /** Item key override (e.g. "FACE-1", "SHIRT-3") for face/chest/legs parts. */
  avatarItemKey?: string;
  rules?: WeildCodeRule[];
  /** True when the part has been negated (acts as a solid-modeling cutout). */
  negated?: boolean;
  /** Color the part had before being negated — used by "De-negate" to restore. */
  preNegateColor?: string;
  /** Transparency the part had before being negated — used by "De-negate" to restore. */
  preNegateTransparency?: number;
  /** Per-object variables — scoped to this part only (vs globalVariables which are universal). */
  objectVariables?: Record<string, number | string>;
}

export interface StudioModel {
  id: string;
  name: string;
  children: string[];
  parentId: string | null;
}

export type StudioObject = StudioPart | StudioModel;

export function isPart(obj: StudioObject): obj is StudioPart {
  return 'type' in obj && ['Block', 'Sphere', 'Wedge', 'Cylinder', 'Spawn'].includes(obj.type);
}

export interface ConsoleMessage {
  id: string;
  type: 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: number;
}

export interface ScreenMessage {
  id: string;
  message: string;
  position: 'top' | 'bottom';
  textColor: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold-italic';
  fontSize: number;
  backgroundColor: string;
  duration: number;        // seconds to show
  startTime: number;       // performance.now() when created
}

export interface TerrainSettings {
  width: number;
  length: number;
  amplitude: number;
  frequency: number;
  waterHeight: number;
  baseHeight: number;
  preset: 'Nature' | 'Mountain' | 'Island' | 'Field';
  terrainStyle: 'blocky';
  maxHeight: number;
  minHeight: number;
  seaLevel: number;
  treeDensity: number;
  blockSize: number;
  terrainColor: string;
  seed: number;
}

export interface PlayState {
  isPlaying: boolean;
  isTestPlay: boolean; // true = Test Play (physics + character), false = Play (physics only)
  characterPosition: Vector3;
  characterVelocity: Vector3;
  isGrounded: boolean;
  characterRotation: number; // Y-axis rotation in radians
}

// ─── Simulation State (inline physics, no character) ───

export interface SimulationState {
  isSimulating: boolean;
}

// ─── Physics World Settings ───

export interface PhysicsSettings {
  gravity: number;
  collisionsEnabled: boolean;
  waterForce: number;
  waterDirection: Vector3;
  experimentalSolver: boolean;
}

// ─── World Settings (shown in Properties when nothing selected) ───

export interface WorldSettings {
  skyColorTop: string;
  skyColorBottom: string;
  ambientLightIntensity: number;
  baseplateSize: number;
  gravity: number;
  maxPlayers: number;
  spawnPointPosition: Vector3;
  // Sky system
  sunEnabled: boolean;
  sunColor: string;
  sunSize: number;
  moonEnabled: boolean;
  moonColor: string;
  moonSize: number;
  cloudsEnabled: boolean;
  cloudColor: string;
  cloudDensity: number;
  cloudSpeed: number;        // 0–10 (multiplier)
  windDirection: number;     // 0–360 (degrees, 0=North, 90=East, 180=South, 270=West)
  starsEnabled: boolean;
  starCount: number;         // 0–5000
  dayNightEnabled: boolean;
  timeOfDay: number;        // 0–24 (hours), e.g. 12 = noon, 0 = midnight
  dayLength: number;         // real-time seconds for a full day/night cycle
  weatherType: 'clear' | 'cloudy' | 'rain' | 'snow';
  weatherIntensity: number;  // 0–1
}

// ─── Universes (multiple scenes within a project) ───

export interface UniverseData {
  id: string;
  name: string;
  objects: StudioObject[];
  joints: Joint[];
}

export interface StudioStore {
  // Objects
  objects: Map<string, StudioObject>;
  selectedIds: string[];

  // Universes (multi-scene support)
  universes: Map<string, UniverseData>;
  currentUniverseId: string;

  // Tools
  activeTool: ToolMode;
  activeTab: StudioTab;

  // Play mode
  playState: PlayState;

  // Simulation mode (inline physics, no character)
  simulationState: SimulationState;

  // Terrain
  terrainSettings: TerrainSettings;
  showTerrain: boolean;

  // ─── Terrain v2 (rebuilt terrain system) ───
  /** Live heightmap — null until the user generates terrain. Brushedits modify this in place (immutable update). */
  terrainHeightmap: TerrainHeightmapV2 | null;
  /** Terrain generator config — seed, dimensions, amplitude, etc. */
  terrainConfig: TerrainGeneratorConfig;
  /** Per-instance water bodies (independent objects, not tied to terrain). */
  waterBodies: WaterBodyV2[];
  /** Per-instance trees (blocky, stylized). */
  treeInstances: TreeInstanceV2[];
  /** Brush settings used by the brush tools in the Terrain tab. */
  brushSettings: BrushSettings;
  /** Selected tree variant for the PlaceTree tool. */
  activeTreeVariant: TreeVariant;
  /** Global terrain surface color (overrides per-cell biome coloring when set). */
  terrainColor: string;
  /** Global water color (used as the default when creating new water bodies). */
  waterColor: string;
  /** Terrain layers — depth bands below the surface, each with its own color. */
  terrainLayers: TerrainLayer[];
  /** Paint color used by the BrushPaint tool. */
  brushPaintColor: string;

  // Console
  consoleMessages: ConsoleMessage[];

  // Screen messages (WeildCode print_message action)
  screenMessages: ScreenMessage[];

  // Grid
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;

  // Panel visibility (View tab toggles)
  showExplorer: boolean;
  showProperties: boolean;
  showOutput: boolean;
  showAxisGizmo: boolean;
  /** Show the character body parts preview in the editor viewport. */
  showCharacterPreview: boolean;

  // Global variables & timers (accessible by all objects in Logic)
  globalVariables: Record<string, number | string | boolean>;
  globalTimers: GlobalTimer[];

  // Clipboard
  clipboard: ClipboardEntry | null;

  // Physics settings
  physicsSettings: PhysicsSettings;

  // Joints (stored globally, not per-part)
  joints: Joint[];

  // World settings
  worldSettings: WorldSettings;

  // Avatar data — so play mode uses the REAL character, not a cheap replica
  avatar: {
    skin: string;
    face: string | null;
    shirt: string | null;
    left_leg: string | null;
    right_leg: string | null;
  };

  // Group mode
  groupModeIds: string[];
  // Union multi-select mode (parallel to groupModeIds)
  unionModeIds: string[];

  // Explosion visuals (for Viewport3D to render)
  explosionVisuals: Array<{ id: string; position: Vector3; radius: number; startTime: number }>;

  // Undo/Redo
  undoStack: string[];
  redoStack: string[];
  undo: () => void;
  redo: () => void;

  // Play mode snapshot (internal — not exposed to consumers)
  _playSnapshot: string | null;

  // ─── Atomic Play/Simulate Mode Functions ───
  // These handle the complete start/stop lifecycle, including snapshot save/restore.
  // CRITICAL: stopPlayMode() sets isPlaying=false BEFORE restoring the snapshot,
  // so that useFrame loops bail out immediately and don't overwrite restored state.
  startPlayMode: () => void;
  stopPlayMode: () => void;
  startTestPlayMode: (spawnPosition: Vector3) => void;
  startSimulationMode: () => void;
  stopSimulationMode: () => void;

  // Actions
  addObject: (obj: StudioObject) => void;
  removeObject: (id: string) => void;
  updateObject: (id: string, updates: Partial<StudioObject>) => void;
  selectObject: (id: string | null, multi?: boolean) => void;
  clearSelection: () => void;
  setActiveTool: (tool: ToolMode) => void;
  setActiveTab: (tab: StudioTab) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  addPart: (type: PartType) => void;
  addConsoleMessage: (type: ConsoleMessage['type'], message: string) => void;
  clearConsole: () => void;
  addScreenMessage: (msg: Omit<ScreenMessage, 'id' | 'startTime'>) => void;
  removeScreenMessage: (id: string) => void;
  clearScreenMessages: () => void;
  setPlayState: (updates: Partial<PlayState>) => void;
  setSimulationState: (updates: Partial<SimulationState>) => void;
  setTerrainSettings: (updates: Partial<TerrainSettings>) => void;
  setShowTerrain: (show: boolean) => void;
  // ─── Terrain v2 actions ───
  /** Update the terrain generator config (does NOT auto-regenerate — call generateTerrain to apply). */
  setTerrainConfig: (updates: Partial<TerrainGeneratorConfig>) => void;
  /** Generate a fresh heightmap from the current terrainConfig. */
  generateTerrain: () => void;
  /** Apply a single brush stroke at world coords. */
  applyBrushAt: (worldX: number, worldZ: number) => void;
  /** Apply a brush stroke along a path (for drag-painting). */
  applyBrushStroke: (x1: number, z1: number, x2: number, z2: number) => void;
  /** Update brush settings (type, size, strength). */
  setBrushSettings: (updates: Partial<BrushSettings>) => void;
  /** Add a new water body. Returns its id. */
  addWaterBody: (opts?: Partial<WaterBodyV2>) => string;
  /** Update an existing water body. */
  updateWaterBody: (id: string, updates: Partial<WaterBodyV2>) => void;
  /** Remove a water body. */
  removeWaterBody: (id: string) => void;
  /** Add a new tree. Returns its id. */
  addTree: (opts?: Partial<TreeInstanceV2>) => string;
  /** Update an existing tree. */
  updateTree: (id: string, updates: Partial<TreeInstanceV2>) => void;
  /** Remove a tree. */
  removeTree: (id: string) => void;
  /** Remove all trees. */
  clearTrees: () => void;
  /** Scatter N random trees across the current terrain. */
  scatterTrees: (count: number) => void;
  /** Set the active tree variant for the PlaceTree tool. */
  setActiveTreeVariant: (variant: TreeVariant) => void;
  /** Set global terrain surface color. */
  setTerrainColor: (color: string) => void;
  /** Set global water color (also applied as default for new water bodies). */
  setWaterColor: (color: string) => void;
  /** Set the terrain layers (depth bands below surface). */
  setTerrainLayers: (layers: TerrainLayer[]) => void;
  /** Update a single terrain layer by index. */
  updateTerrainLayer: (index: number, updates: Partial<TerrainLayer>) => void;
  /** Add a new terrain layer. */
  addTerrainLayer: () => void;
  /** Remove a terrain layer by index. */
  removeTerrainLayer: (index: number) => void;
  /** Set the paint color for the BrushPaint tool. */
  setBrushPaintColor: (color: string) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  getObjectById: (id: string) => StudioObject | undefined;
  getChildren: (parentId: string | null) => StudioObject[];
  getGroupLeafPartIds: (groupId: string) => string[];
  getGroupCenter: (groupId: string) => Vector3;
  loadProject: (data: { objects: StudioObject[] }) => void;
  // Physics actions
  setPhysicsSettings: (updates: Partial<PhysicsSettings>) => void;
  addJoint: (joint: Joint) => void;
  removeJoint: (id: string) => void;
  updateJoint: (id: string, updates: Partial<Joint>) => void;
  addBodyMover: (partId: string, mover: BodyMover) => void;
  removeBodyMover: (partId: string, moverId: string) => void;
  updateBodyMover: (partId: string, moverId: string, updates: Partial<BodyMover>) => void;
  createExplosion: (position: Vector3, blastRadius: number, blastPressure: number) => void;
  makeJoints: (partId: string) => void;
  breakJoints: (partId: string) => void;
  // Effects actions
  addEffect: (partId: string, effect: PartEffect) => void;
  removeEffect: (partId: string, effectId: string) => void;
  updateEffect: (partId: string, effectId: string, updates: Partial<PartEffect>) => void;
  // Spawn point
  addSpawnPoint: (opts?: { team?: string }) => void;
  addBaseplate: () => void;
  /** Create the 7 default character body parts (head, torso, arms, legs, face). */
  addDefaultCharacterParts: () => void;
  // World settings
  setWorldSettings: (updates: Partial<WorldSettings>) => void;
  // Avatar
  setAvatar: (avatar: { skin: string; face: string | null; shirt: string | null; left_leg: string | null; right_leg: string | null }) => void;

  // Group mode
  setGroupModeIds: (ids: string[]) => void;
  // Union multi-select mode — same UX as Group mode but confirms with a Union operation
  setUnionModeIds: (ids: string[]) => void;
  // Per-object variables (scoped to a single StudioPart)
  setObjectVariable: (partId: string, name: string, value: number | string) => void;
  deleteObjectVariable: (partId: string, name: string) => void;
  // Remove joints of a specific type (e.g. only Ropes) touching a given part
  removeJointsOfType: (partId: string, type: JointType) => number;
  // Universes actions
  addUniverse: (name: string) => string; // returns new universe id
  switchUniverse: (universeId: string) => void;
  deleteUniverse: (universeId: string) => void;
  renameUniverse: (universeId: string, newName: string) => void;
  // Clear project (new universe)
  clearProject: () => void;
  // Explosion visual cleanup
  removeExplosionVisual: (id: string) => void;
  // Clipboard actions
  copySelected: () => void;
  cutSelected: () => void;
  pasteClipboard: () => void;
  setShowGrid: (show: boolean) => void;
  setShowExplorer: (show: boolean) => void;
  setShowProperties: (show: boolean) => void;
  setShowOutput: (show: boolean) => void;
  setShowAxisGizmo: (show: boolean) => void;
  setShowCharacterPreview: (show: boolean) => void;
  // Global variables & timers
  setGlobalVariable: (name: string, value: number | string | boolean) => void;
  deleteGlobalVariable: (name: string) => void;
  addGlobalTimer: (timer: GlobalTimer) => void;
  updateGlobalTimer: (id: string, updates: Partial<GlobalTimer>) => void;
  deleteGlobalTimer: (id: string) => void;
  // WeildCode rule management
  addRule: (partId: string, rule: WeildCodeRule) => void;
  removeRule: (partId: string, ruleId: string) => void;
  updateRule: (partId: string, ruleId: string, updates: Partial<WeildCodeRule>) => void;

}

let partCounter = 0;

function collectDescendants(objects: Map<string, StudioObject>, id: string): string[] {
  const obj = objects.get(id);
  if (!obj || !('children' in obj)) return [id];
  let ids = [id];
  for (const childId of (obj as any).children || []) {
    ids = ids.concat(collectDescendants(objects, childId));
  }
  return ids;
}

/** Collect only leaf StudioPart IDs from a group (recursive) */
export function collectLeafPartIds(objects: Map<string, StudioObject>, id: string): string[] {
  const obj = objects.get(id);
  if (!obj) return [];
  if (isPart(obj)) return [id];
  // It's a model — collect leaves from all children
  const leaves: string[] = [];
  if ('children' in obj) {
    for (const childId of (obj as StudioModel).children) {
      leaves.push(...collectLeafPartIds(objects, childId));
    }
  }
  return leaves;
}

/** Compute the center position of a group from its leaf parts */
export function computeGroupCenter(objects: Map<string, StudioObject>, groupId: string): Vector3 {
  const leafIds = collectLeafPartIds(objects, groupId);
  if (leafIds.length === 0) return { x: 0, y: 0, z: 0 };
  let sumX = 0, sumY = 0, sumZ = 0;
  leafIds.forEach(id => {
    const obj = objects.get(id);
    if (obj && isPart(obj)) {
      sumX += obj.position.x;
      sumY += obj.position.y;
      sumZ += obj.position.z;
    }
  });
  return { x: sumX / leafIds.length, y: sumY / leafIds.length, z: sumZ / leafIds.length };
}

function deepClonePart(part: StudioPart, idOverride?: string, nameOverride?: string, positionOffset?: Vector3): StudioPart {
  partCounter++;
  return {
    ...part,
    id: idOverride || generateId(),
    name: nameOverride || `${part.name} (${partCounter})`,
    position: positionOffset
      ? { x: part.position.x + positionOffset.x, y: part.position.y + positionOffset.y, z: part.position.z + positionOffset.z }
      : { ...part.position },
    rotation: { ...part.rotation },
    size: { ...part.size },
    parentId: null,
    children: [],
    bodyMovers: [],
    effects: [],
    rules: [],
  };
}

function generateId(): string {
  return `obj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const defaultPartProps = {
  color: '#4a90d9',
  material: 'Plastic' as MaterialType,
  transparency: 0,
  reflectance: 0,
  anchored: true,
  canCollide: true,
  friction: 0.5,
  elasticity: 0.2,
  density: 1.0,
  bodyMovers: [] as BodyMover[],
  effects: [] as PartEffect[],
  isSpawnPoint: false,
};

// Default colors per shape type — bright, distinct, WeildBuild defaults
const PART_DEFAULTS: Record<string, { color: string; size: { x: number; y: number; z: number } }> = {
  Block:     { color: '#4ff7f5', size: { x: 1, y: 1, z: 1 } },  // Bright cyan
  Sphere:    { color: '#f24b4b', size: { x: 1, y: 1, z: 1 } },  // Bright red
  Cylinder:  { color: '#37e62e', size: { x: 1, y: 1, z: 1 } },  // Bright green
  Wedge:     { color: '#f7f54f', size: { x: 1, y: 1, z: 1 } },  // Bright yellow
  CornerWedge: { color: '#f7f54f', size: { x: 1, y: 1, z: 1 } }, // Bright yellow
  Spawn:     { color: '#4a90d9', size: { x: 3, y: 0.3, z: 3 } },  // Blue spawn pad
};

// ─── Undo/Redo helpers ───

function snapshotState(objects: Map<string, StudioObject>, joints: Joint[]): string {
  const objs: StudioObject[] = [];
  objects.forEach((obj) => objs.push(JSON.parse(JSON.stringify(obj))));
  return JSON.stringify({ objects: objs, joints });
}

function restoreSnapshot(snapshot: string): { objects: Map<string, StudioObject>; joints: Joint[] } {
  const parsed = JSON.parse(snapshot);
  const objects = new Map<string, StudioObject>();
  parsed.objects.forEach((obj: StudioObject) => objects.set(obj.id, obj));
  return { objects, joints: parsed.joints || [] };
}

const MAX_UNDO_STACK = 50;

// Internal undo helper — defined outside the store so it can be used by action implementations
function _pushUndo(get: () => StudioStore, set: (partial: Partial<StudioStore> | ((s: StudioStore) => Partial<StudioStore>)) => void) {
  const state = get();
  const snapshot = snapshotState(state.objects, state.joints);
  const undoStack = [...state.undoStack, snapshot];
  if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();
  set({ undoStack, redoStack: [] });
}

export const useStudioStore = create<StudioStore>((set, get) => ({
  objects: new Map<string, StudioObject>(),
  selectedIds: [],

  // Universes — start with a default universe called "Start"
  universes: new Map<string, UniverseData>([
    ['place_default', { id: 'place_default', name: 'Start', objects: [], joints: [] }],
  ]),
  currentUniverseId: 'place_default',

  activeTool: 'Select',
  activeTab: 'Home',
  playState: {
    isPlaying: false,
    isTestPlay: false,
    characterPosition: { x: 0, y: 5, z: 0 },
    characterVelocity: { x: 0, y: 0, z: 0 },
    isGrounded: false,
    characterRotation: 0,
  },
  simulationState: {
    isSimulating: false,
  },
  terrainSettings: {
    width: 100,
    length: 100,
    amplitude: 10,
    frequency: 0.1,
    waterHeight: 2,
    baseHeight: 0,
    terrainStyle: 'blocky',
    preset: 'Nature',
    maxHeight: 20,
    minHeight: 0,
    seaLevel: 2,
    treeDensity: 0.3,
    blockSize: 4,
    terrainColor: '#4a7c3f',
    seed: 42,
  },
  showTerrain: false,
  // ─── Terrain v2 initial state ───
  terrainHeightmap: null,
  terrainConfig: { ...DEFAULT_TERRAIN_CONFIG },
  waterBodies: [],
  treeInstances: [],
  brushSettings: { ...DEFAULT_BRUSH },
  activeTreeVariant: 'oak',
  terrainColor: '#4a7c3f',
  waterColor: '#2c7be0',
  terrainLayers: DEFAULT_TERRAIN_LAYERS.map(l => ({ ...l })),
  brushPaintColor: '#ff6600',
  consoleMessages: [],
  screenMessages: [],
  showGrid: true,
  snapToGrid: true,
  gridSize: 1,
  showExplorer: true,
  showProperties: true,
  showOutput: true,
  showAxisGizmo: true,
  showCharacterPreview: true,
  globalVariables: {},
  globalTimers: [],
  clipboard: null,
  physicsSettings: {
    gravity: -9.81,
    collisionsEnabled: true,
    waterForce: 1,
    waterDirection: { x: 1, y: 0, z: 0 },
    experimentalSolver: false,
  },
  joints: [],
  worldSettings: {
    skyColorTop: '#6699e6',
    skyColorBottom: '#b3cce6',
    ambientLightIntensity: 0.4,
    baseplateSize: 100,
    gravity: -9.81,
    maxPlayers: 10,
    spawnPointPosition: { x: 0, y: 1, z: 0 },
    sunEnabled: true,
    sunColor: '#fff4e0',
    sunSize: 1.0,
    moonEnabled: true,
    moonColor: '#e8e8f0',
    moonSize: 0.8,
    cloudsEnabled: true,
    cloudColor: '#ffffff',
    cloudDensity: 0.4,
    cloudSpeed: 1.0,
    windDirection: 90,
    starsEnabled: true,
    starCount: 1200,
    dayNightEnabled: false,
    timeOfDay: 12,
    dayLength: 120,
    weatherType: 'clear',
    weatherIntensity: 0.5,
  },
  groupModeIds: [],
  unionModeIds: [],
  explosionVisuals: [],
  undoStack: [],
  redoStack: [],
  _playSnapshot: null,
  avatar: {
    skin: '#f8ff6d',
    face: 'FACE-1',
    shirt: 'SHIRT-1',
    left_leg: 'PANTS-1',
    right_leg: 'PANTS-1',
  },

  addObject: (obj) => {
    _pushUndo(get, set);
    set((state) => {
      const newObjects = new Map(state.objects);
      newObjects.set(obj.id, obj);
      return { objects: newObjects };
    });
  },

  removeObject: (id) => {
    _pushUndo(get, set);
    set((state) => {
      const newObjects = new Map(state.objects);
      const allIdsToDelete = new Set(collectDescendants(state.objects, id));
      const obj = newObjects.get(id);
      if (obj && obj.parentId) {
        const parent = newObjects.get(obj.parentId);
        if (parent && 'children' in parent) {
          newObjects.set(obj.parentId, {
            ...parent,
            children: parent.children.filter((c) => !allIdsToDelete.has(c)),
          });
        }
      }
      allIdsToDelete.forEach((deleteId) => newObjects.delete(deleteId));
      const updatedJoints = state.joints.filter(j => !allIdsToDelete.has(j.partAId) && !allIdsToDelete.has(j.partBId));
      return {
        objects: newObjects,
        selectedIds: state.selectedIds.filter((sid) => !allIdsToDelete.has(sid)),
        joints: updatedJoints,
      };
    });
  },

  updateObject: (id, updates) => {
    _pushUndo(get, set);
    set((state) => {
      const newObjects = new Map(state.objects);
      const obj = newObjects.get(id);
      if (obj) {
        const partUpdates = updates as Partial<StudioPart>;
        let mergedUpdates: Record<string, unknown> = { ...updates };
        // Deep merge bodyMovers: if updates contains partial bodyMover entries, merge with existing
        if (partUpdates.bodyMovers && isPart(obj)) {
          mergedUpdates.bodyMovers = partUpdates.bodyMovers.map((updateMover: BodyMover) => {
            const existing = obj.bodyMovers.find((m) => m.id === updateMover.id);
            return existing ? { ...existing, ...updateMover } : updateMover;
          });
        }
        // Deep merge effects: if updates contains partial effect entries, merge with existing
        if (partUpdates.effects && isPart(obj)) {
          mergedUpdates.effects = partUpdates.effects.map((updateEffect: PartEffect) => {
            const existing = (obj.effects || []).find((e) => e.id === updateEffect.id);
            return existing ? { ...existing, ...updateEffect } : updateEffect;
          });
        }
        newObjects.set(id, { ...obj, ...mergedUpdates } as StudioObject);
      }
      return { objects: newObjects };
    });
  },

  selectObject: (id, multi = false) =>
    set((state) => {
      if (id === null) return { selectedIds: [] };
      if (multi) {
        const exists = state.selectedIds.includes(id);
        return {
          selectedIds: exists
            ? state.selectedIds.filter((sid) => sid !== id)
            : [...state.selectedIds, id],
        };
      }
      return { selectedIds: [id] };
    }),

  clearSelection: () => set({ selectedIds: [] }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  duplicateSelected: () => {
    _pushUndo(get, set);
    const state = get();
    const newObjects = new Map(state.objects);
    const newIds: string[] = [];
    const offset = { x: 2, y: 0, z: 0 };
    state.selectedIds.forEach((id) => {
      const obj = newObjects.get(id);
      if (obj && isPart(obj)) {
        const newObj = deepClonePart(obj, undefined, undefined, offset);
        newObjects.set(newObj.id, newObj);
        newIds.push(newObj.id);
      }
      // Also handle models: duplicate all children
      if (obj && !isPart(obj) && 'children' in obj) {
        const clonedChildren: string[] = [];
        obj.children.forEach((childId) => {
          const child = newObjects.get(childId);
          if (child && isPart(child)) {
            const newChild = deepClonePart(child, undefined, undefined, offset);
            newObjects.set(newChild.id, newChild);
            newIds.push(newChild.id);
            clonedChildren.push(newChild.id);
          }
        });
        if (clonedChildren.length > 0) {
          partCounter++;
          const modelId = generateId();
          const newModel: StudioModel = {
            id: modelId,
            name: `${obj.name} (${partCounter})`,
            children: clonedChildren,
            parentId: null,
          };
          clonedChildren.forEach((cid) => {
            const child = newObjects.get(cid);
            if (child) {
              newObjects.set(cid, { ...child, parentId: modelId } as StudioObject);
            }
          });
          newObjects.set(modelId, newModel);
          newIds.push(modelId);
        }
      }
    });
    set({ objects: newObjects, selectedIds: newIds });
    if (newIds.length > 0) {
      state.addConsoleMessage('info', `Duplicated ${newIds.length} object(s)`);
    }
  },

  copySelected: () => {
    const state = get();
    const clipboardObjects: StudioObject[] = [];
    state.selectedIds.forEach((id) => {
      const obj = state.objects.get(id);
      if (!obj) return;
      if (isPart(obj)) {
        // Single part — deep clone it
        clipboardObjects.push(JSON.parse(JSON.stringify(obj)));
      } else if ('children' in obj) {
        // Group (StudioModel) — deep clone the model AND all its descendant parts
        const model = JSON.parse(JSON.stringify(obj)) as StudioModel;
        clipboardObjects.push(model);
        // Also clone all descendant parts recursively
        const descendantIds = collectDescendants(state.objects, id);
        descendantIds.forEach(descId => {
          if (descId === id) return; // Skip the model itself
          const desc = state.objects.get(descId);
          if (desc) clipboardObjects.push(JSON.parse(JSON.stringify(desc)));
        });
      }
    });
    if (clipboardObjects.length > 0) {
      set({ clipboard: { objects: clipboardObjects, cutFromIds: null } });
      state.addConsoleMessage('info', `Copied ${clipboardObjects.length} object(s) to clipboard`);
    } else {
      state.addConsoleMessage('warn', 'Nothing to copy — select some parts first');
    }
  },

  cutSelected: () => {
    _pushUndo(get, set);
    set((s) => {
      const clipboardObjects: StudioObject[] = [];
      const cutFromIds: string[] = [];
      const allIdsToDelete = new Set<string>();

      s.selectedIds.forEach(id => {
        const obj = s.objects.get(id);
        if (!obj) return;
        cutFromIds.push(id);
        allIdsToDelete.add(id);

        if (isPart(obj)) {
          clipboardObjects.push(JSON.parse(JSON.stringify(obj)));
        } else if ('children' in obj) {
          // Group — clone model and all descendants, then delete them all
          clipboardObjects.push(JSON.parse(JSON.stringify(obj)));
          const descendantIds = collectDescendants(s.objects, id);
          descendantIds.forEach(descId => {
            if (descId === id) return;
            allIdsToDelete.add(descId);
            const desc = s.objects.get(descId);
            if (desc) clipboardObjects.push(JSON.parse(JSON.stringify(desc)));
          });
        }
      });

      // Clean up: remove from parent's children array, cascade delete descendants
      const newObjects = new Map(s.objects);
      allIdsToDelete.forEach(id => {
        const obj = newObjects.get(id);
        if (obj && obj.parentId) {
          const parent = newObjects.get(obj.parentId);
          if (parent && 'children' in parent) {
            newObjects.set(obj.parentId, {
              ...parent,
              children: parent.children.filter((c) => !allIdsToDelete.has(c)),
            });
          }
        }
        newObjects.delete(id);
      });

      const updatedJoints = s.joints.filter(j => !allIdsToDelete.has(j.partAId) && !allIdsToDelete.has(j.partBId));
      return {
        clipboard: { objects: clipboardObjects, cutFromIds },
        objects: newObjects,
        selectedIds: [],
        joints: updatedJoints,
      };
    });
    const state = get();
    if (state.clipboard && state.clipboard.objects.length > 0) {
      state.addConsoleMessage('info', `Cut ${state.clipboard.objects.length} object(s) to clipboard`);
    } else {
      state.addConsoleMessage('warn', 'Nothing to cut — select some parts first');
    }
  },

  pasteClipboard: () => {
    const state = get();
    if (!state.clipboard) {
      state.addConsoleMessage('warn', 'Nothing to paste — clipboard is empty');
      return;
    }
    _pushUndo(get, set);
    const newObjects = new Map(state.objects);
    const newIds: string[] = [];
    const offset = { x: 3, y: 0, z: 0 };
    // Map old IDs → new IDs for rebuilding parent/child relationships
    const idMap = new Map<string, string>();

    // First pass: clone all objects with new IDs
    state.clipboard.objects.forEach((obj) => {
      if (isPart(obj)) {
        const newObj = deepClonePart(obj, undefined, undefined, offset);
        idMap.set(obj.id, newObj.id);
        newObjects.set(newObj.id, newObj);
        newIds.push(newObj.id);
      } else if ('children' in obj) {
        // It's a model/group — clone with new ID
        partCounter++;
        const newId = generateId();
        idMap.set(obj.id, newId);
        const newModel: StudioModel = {
          id: newId,
          name: `${obj.name} (${partCounter})`,
          children: [], // Will be remapped in second pass
          parentId: null,
        };
        newObjects.set(newId, newModel);
        newIds.push(newId);
      }
    });

    // Second pass: rebuild parent/child relationships with new IDs
    state.clipboard.objects.forEach((obj) => {
      if ('children' in obj && !isPart(obj)) {
        const newModelId = idMap.get(obj.id);
        if (!newModelId) return;
        const newModel = newObjects.get(newModelId) as StudioModel;
        // Remap children to new IDs
        newModel.children = obj.children
          .map(oldChildId => idMap.get(oldChildId))
          .filter(Boolean) as string[];
        // Set parentId on each child
        newModel.children.forEach(childId => {
          const child = newObjects.get(childId);
          if (child) {
            newObjects.set(childId, { ...child, parentId: newModelId } as StudioObject);
          }
        });
        newObjects.set(newModelId, newModel);
      } else if (isPart(obj) && obj.parentId) {
        // Part had a parent — remap if the parent was also in the clipboard
        const newObjId = idMap.get(obj.id);
        if (!newObjId) return;
        const newObj = newObjects.get(newObjId) as StudioPart;
        const newParentId = obj.parentId ? idMap.get(obj.parentId) : null;
        if (newParentId) {
          newObj.parentId = newParentId;
          newObjects.set(newObjId, newObj);
        }
      }
    });

    // Select the top-level pasted objects (those with parentId = null)
    const topLevelIds = newIds.filter(id => {
      const obj = newObjects.get(id);
      return obj && obj.parentId === null;
    });

    set({ objects: newObjects, selectedIds: topLevelIds.length > 0 ? topLevelIds : newIds });
    state.addConsoleMessage('info', `Pasted ${newIds.length} object(s) from clipboard`);
  },

  setShowGrid: (show) => set({ showGrid: show }),
  setShowExplorer: (show) => set({ showExplorer: show }),
  setShowProperties: (show) => set({ showProperties: show }),
  setShowOutput: (show) => set({ showOutput: show }),
  setShowAxisGizmo: (show) => set({ showAxisGizmo: show }),
  setShowCharacterPreview: (show) => set({ showCharacterPreview: show }),
  // Global variables & timers
  setGlobalVariable: (name, value) => set(state => ({ globalVariables: { ...state.globalVariables, [name]: value } })),
  deleteGlobalVariable: (name) => set(state => {
    const vars = { ...state.globalVariables };
    delete vars[name];
    return { globalVariables: vars };
  }),
  addGlobalTimer: (timer) => set(state => ({ globalTimers: [...state.globalTimers, timer] })),
  updateGlobalTimer: (id, updates) => set(state => ({
    globalTimers: state.globalTimers.map(t => t.id === id ? { ...t, ...updates } : t),
  })),
  deleteGlobalTimer: (id) => set(state => ({
    globalTimers: state.globalTimers.filter(t => t.id !== id),
  })),

  deleteSelected: () => {
    _pushUndo(get, set);
    const state = get();
    const newObjects = new Map(state.objects);
    const deletedIds = new Set(state.selectedIds);
    state.selectedIds.forEach((id) => {
      const obj = newObjects.get(id);
      if (obj && 'children' in obj) {
        obj.children.forEach((childId) => {
          newObjects.delete(childId);
          deletedIds.add(childId);
        });
      }
      if (obj && obj.parentId) {
        const parent = newObjects.get(obj.parentId);
        if (parent && 'children' in parent) {
          newObjects.set(obj.parentId, {
            ...parent,
            children: parent.children.filter((c) => c !== id),
          });
        }
      }
      newObjects.delete(id);
    });
    const updatedJoints = state.joints.filter(j => !deletedIds.has(j.partAId) && !deletedIds.has(j.partBId));
    set({ objects: newObjects, selectedIds: [], joints: updatedJoints });
  },

  groupSelected: () => {
    const state = get();
    if (state.selectedIds.length < 2) return;
    _pushUndo(get, set);
    const newObjects = new Map(state.objects);
    const modelId = generateId();
    const model: StudioModel = {
      id: modelId,
      name: 'Model',
      children: [...state.selectedIds],
      parentId: null,
    };
    state.selectedIds.forEach((id) => {
      const obj = newObjects.get(id);
      if (obj) {
        // Remove from old parent's children array to avoid dangling refs
        if (obj.parentId) {
          const oldParent = newObjects.get(obj.parentId);
          if (oldParent && 'children' in oldParent) {
            const updatedOldParent = { ...oldParent, children: oldParent.children.filter((c: string) => c !== id) };
            newObjects.set(obj.parentId, updatedOldParent);
          }
        }
        newObjects.set(id, { ...obj, parentId: modelId } as StudioObject);
      }
    });
    newObjects.set(modelId, model);
    set({ objects: newObjects, selectedIds: [modelId] });
  },

  ungroupSelected: () => {
    _pushUndo(get, set);
    const state = get();
    const newObjects = new Map(state.objects);
    const newSelectedIds: string[] = [];
    state.selectedIds.forEach((id) => {
      const obj = newObjects.get(id);
      if (obj && !isPart(obj) && 'children' in obj) {
        // Remember the group's parentId so children stay at the same level
        const groupParentId = obj.parentId;
        obj.children.forEach((childId) => {
          const child = newObjects.get(childId);
          if (child) {
            // Place children at the same level as the group was
            newObjects.set(childId, { ...child, parentId: groupParentId } as StudioObject);
            newSelectedIds.push(childId);
          }
        });
        // If the group had a parent, update the parent's children array
        // (replace group id with the group's children ids)
        if (groupParentId) {
          const parent = newObjects.get(groupParentId);
          if (parent && 'children' in parent) {
            const updatedChildren = parent.children.flatMap((cid) =>
              cid === id ? obj.children : [cid]
            );
            newObjects.set(groupParentId, { ...parent, children: updatedChildren } as StudioObject);
          }
        }
        newObjects.delete(id);
      }
    });
    set({ objects: newObjects, selectedIds: newSelectedIds });
  },

  addPart: (type) => {
    // Spawn parts delegate to addSpawnPoint for consistent creation
    if (type === 'Spawn') {
      const state = get();
      state.addSpawnPoint({ team: 'Neutral' });
      return;
    }
    _pushUndo(get, set);
    const state = get();
    partCounter++;
    const id = generateId();
    // Get per-type defaults (color + size)
    const defaults = PART_DEFAULTS[type] || PART_DEFAULTS['Block'];
    const size = { ...defaults.size };
    // Position so the part sits on the ground (y=0 baseplate)
    const yPos = size.y / 2;
    const part: StudioPart = {
      id,
      name: `${type}${partCounter}`,
      type,
      position: { x: 0, y: yPos, z: 0 },
      size,
      rotation: { x: 0, y: 0, z: 0 },
      ...defaultPartProps,
      color: defaults.color,
      children: [],
      parentId: null,
    };
    const newObjects = new Map(state.objects);
    newObjects.set(id, part);
    set({ objects: newObjects, selectedIds: [id] });
    const addMsg = state.addConsoleMessage;
    addMsg('info', `Created ${type}: ${part.name}`);
  },

  addConsoleMessage: (type, message) =>
    set((state) => {
      const newMsg: ConsoleMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        message,
        timestamp: Date.now(),
      };
      return {
        consoleMessages: [...state.consoleMessages.slice(-499), newMsg],
      };
    }),

  clearConsole: () => set({ consoleMessages: [] }),

  addScreenMessage: (msg) =>
    set((state) => ({
      screenMessages: [...state.screenMessages, {
        ...msg,
        id: `scrmsg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        startTime: performance.now(),
      }],
    })),

  removeScreenMessage: (id) =>
    set((state) => ({
      screenMessages: state.screenMessages.filter((m) => m.id !== id),
    })),

  clearScreenMessages: () => set({ screenMessages: [] }),

  setPlayState: (updates) =>
    set((state) => ({
      playState: { ...state.playState, ...updates },
    })),

  setSimulationState: (updates) =>
    set((state) => ({
      simulationState: { ...state.simulationState, ...updates },
    })),

  setTerrainSettings: (updates) =>
    set((state) => ({
      terrainSettings: { ...state.terrainSettings, ...updates },
    })),

  setShowTerrain: (show) => set({ showTerrain: show }),

  // ─── Terrain v2 action implementations ───

  setTerrainConfig: (updates) =>
    set((state) => ({
      terrainConfig: { ...state.terrainConfig, ...updates },
    })),

  generateTerrain: () => {
    const state = get();
    const heightmap = generateHeightmap(state.terrainConfig);
    set({
      terrainHeightmap: heightmap,
      showTerrain: true,
    });
    get().addConsoleMessage(
      'success',
      `Terrain generated — seed: ${state.terrainConfig.seed}, ${heightmap.width}×${heightmap.length} cells`
    );
  },

  applyBrushAt: (worldX, worldZ) => {
    const state = get();
    if (!state.terrainHeightmap) return;
    const next = applyBrushV2(state.terrainHeightmap, worldX, worldZ, state.brushSettings);
    set({ terrainHeightmap: next });
  },

  applyBrushStroke: (x1, z1, x2, z2) => {
    const state = get();
    if (!state.terrainHeightmap) return;
    const next = applyBrushStrokeV2(state.terrainHeightmap, x1, z1, x2, z2, state.brushSettings);
    set({ terrainHeightmap: next });
  },

  setBrushSettings: (updates) =>
    set((state) => ({
      brushSettings: { ...state.brushSettings, ...updates },
    })),

  addWaterBody: (opts) => {
    const state = get();
    // Auto-stretch water to fit the terrain footprint exactly (full width × full length).
    // This makes "Add Water" immediately useful — the water covers the whole map
    // at sea level, and the user can resize/raise it from there.
    const terrainW = state.terrainConfig.width * state.terrainConfig.cellSize;
    const terrainL = state.terrainConfig.length * state.terrainConfig.cellSize;
    const body = createWaterBodyV2({
      position: opts?.position ?? {
        x: 0,
        y: state.terrainConfig.seaLevel + state.terrainConfig.baseHeight,
        z: 0,
      },
      size: opts?.size ?? {
        x: terrainW,
        y: Math.max(6, state.terrainConfig.amplitude + 4),
        z: terrainL,
      },
      color: opts?.color ?? state.waterColor,
      ...opts,
    });
    set({ waterBodies: [...state.waterBodies, body] });
    get().addConsoleMessage('info', `Added water body "${body.name}" at (${body.position.x}, ${body.position.y}, ${body.position.z}) — ${body.size.x.toFixed(0)}×${body.size.z.toFixed(0)} units`);
    return body.id;
  },

  updateWaterBody: (id, updates) =>
    set((state) => ({
      waterBodies: state.waterBodies.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    })),

  removeWaterBody: (id) => {
    const state = get();
    const body = state.waterBodies.find((w) => w.id === id);
    set({ waterBodies: state.waterBodies.filter((w) => w.id !== id) });
    if (body) get().addConsoleMessage('info', `Removed water body "${body.name}"`);
  },

  addTree: (opts) => {
    const state = get();
    const tree = createTreeV2({
      variant: state.activeTreeVariant,
      ...opts,
    });
    set({ treeInstances: [...state.treeInstances, tree] });
    return tree.id;
  },

  updateTree: (id, updates) =>
    set((state) => ({
      treeInstances: state.treeInstances.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  removeTree: (id) => {
    const state = get();
    set({ treeInstances: state.treeInstances.filter((t) => t.id !== id) });
  },

  clearTrees: () => {
    const state = get();
    const count = state.treeInstances.length;
    set({ treeInstances: [] });
    if (count > 0) get().addConsoleMessage('info', `Cleared ${count} tree(s)`);
  },

  scatterTrees: (count) => {
    const state = get();
    if (!state.terrainHeightmap) {
      get().addConsoleMessage('warn', 'Generate terrain first before scattering trees');
      return;
    }
    const halfW = state.terrainConfig.width * state.terrainConfig.cellSize;
    const halfL = state.terrainConfig.length * state.terrainConfig.cellSize;
    const seed = state.terrainConfig.seed ^ 0x12345;
    const newTrees = scatterTreesV2(
      count,
      seed,
      halfW,
      halfL,
      (x, z) => getHeightAtV2(state.terrainHeightmap!, x, z)
    );
    set({ treeInstances: [...state.treeInstances, ...newTrees] });
    get().addConsoleMessage('success', `Scattered ${newTrees.length} trees across the terrain`);
  },

  setActiveTreeVariant: (variant) => set({ activeTreeVariant: variant }),

  setTerrainColor: (color) => set({ terrainColor: color }),

  setWaterColor: (color) => set({ waterColor: color }),

  setTerrainLayers: (layers) => set({ terrainLayers: layers }),

  updateTerrainLayer: (index, updates) =>
    set((state) => ({
      terrainLayers: state.terrainLayers.map((l, i) => (i === index ? { ...l, ...updates } : l)),
    })),

  addTerrainLayer: () =>
    set((state) => ({
      terrainLayers: [...state.terrainLayers, { name: `Layer ${state.terrainLayers.length + 1}`, color: '#888888', thickness: 2 }],
    })),

  removeTerrainLayer: (index) =>
    set((state) => ({
      terrainLayers: state.terrainLayers.filter((_, i) => i !== index),
    })),

  setBrushPaintColor: (color) => set({ brushPaintColor: color }),

  setSnapToGrid: (snap) => set({ snapToGrid: snap }),

  setGridSize: (size) => set({ gridSize: size }),

  getObjectById: (id) => get().objects.get(id),

  getChildren: (parentId) => {
    const objects = get().objects;
    const children: StudioObject[] = [];
    objects.forEach((obj) => {
      if (obj.parentId === parentId) {
        children.push(obj);
      }
    });
    return children;
  },

  getGroupLeafPartIds: (groupId) => {
    return collectLeafPartIds(get().objects, groupId);
  },

  getGroupCenter: (groupId) => {
    return computeGroupCenter(get().objects, groupId);
  },

  loadProject: (data) => {
    const newObjects = new Map<string, StudioObject>();
    data.objects.forEach((obj) => newObjects.set(obj.id, obj));
    set({
      objects: newObjects,
      selectedIds: [],
      joints: [],
      explosionVisuals: [],
      groupModeIds: [],
      unionModeIds: [],
      consoleMessages: [],
    });
  },

  setPhysicsSettings: (updates) =>
    set((state) => ({
      physicsSettings: { ...state.physicsSettings, ...updates },
    })),

  addJoint: (joint) =>
    set((state) => ({
      joints: [...state.joints, joint],
    })),

  removeJoint: (id) =>
    set((state) => ({
      joints: state.joints.filter((j) => j.id !== id),
    })),

  updateJoint: (id, updates) =>
    set((state) => ({
      joints: state.joints.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    })),

  addBodyMover: (partId, mover) => {
    set((s) => {
      const obj = s.objects.get(partId);
      if (!obj || !isPart(obj)) return {};
      const newObjects = new Map(s.objects);
      newObjects.set(partId, { ...obj, bodyMovers: [...obj.bodyMovers, mover] } as StudioPart);
      return { objects: newObjects };
    });
  },

  removeBodyMover: (partId, moverId) => {
    set((s) => {
      const obj = s.objects.get(partId);
      if (!obj || !isPart(obj)) return {};
      const newObjects = new Map(s.objects);
      newObjects.set(partId, { ...obj, bodyMovers: obj.bodyMovers.filter((m) => m.id !== moverId) } as StudioPart);
      return { objects: newObjects };
    });
  },

  updateBodyMover: (partId, moverId, updates) => {
    set((s) => {
      const obj = s.objects.get(partId);
      if (!obj || !isPart(obj)) return {};
      const newObjects = new Map(s.objects);
      newObjects.set(partId, { ...obj, bodyMovers: obj.bodyMovers.map((m) =>
        m.id === moverId ? { ...m, ...updates } : m
      ) } as StudioPart);
      return { objects: newObjects };
    });
  },

  createExplosion: (position, blastRadius, blastPressure) => {
    const state = get();
    const addMsg = state.addConsoleMessage;
    addMsg('info', `Explosion at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) — radius: ${blastRadius}, pressure: ${blastPressure}`);

    const newObjects = new Map(state.objects);
    state.objects.forEach((obj) => {
      if (!isPart(obj) || obj.anchored) return;

      const dx = obj.position.x - position.x;
      const dy = obj.position.y - position.y;
      const dz = obj.position.z - position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < blastRadius && distance > 0.01) {
        const force = blastPressure * (1 - distance / blastRadius);
        const dirX = dx / distance;
        const dirY = dy / distance + 0.5;
        const dirZ = dz / distance;

        const explosionMover: BodyMover = {
          id: `explosion_${Date.now()}_${obj.id}`,
          type: 'BodyForce',
          enabled: true,
          force: {
            x: dirX * force * 1000,
            y: dirY * force * 1000,
            z: dirZ * force * 1000,
          },
          duration: 0.15, // Auto-remove after EXPLOSION_IMPULSE_DURATION seconds
          _elapsed: 0,
        };

        const updatedMovers = [...obj.bodyMovers, explosionMover];
        newObjects.set(obj.id, { ...obj, bodyMovers: updatedMovers } as StudioPart);
      }
    });

    const brokenJoints = state.joints.filter((j) => {
      const partA = state.objects.get(j.partAId);
      if (!partA || !isPart(partA)) return false;
      const dx = partA.position.x - position.x;
      const dy = partA.position.y - position.y;
      const dz = partA.position.z - position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return distance < blastRadius;
    });

    const updatedJoints = state.joints.filter(
      (j) => !brokenJoints.some((bj) => bj.id === j.id)
    );

    // Add explosion visual
    const explosionVisual = {
      id: `explosion_vis_${Date.now()}`,
      position: { ...position },
      radius: blastRadius,
      startTime: Date.now(),
    };

    set({ objects: newObjects, joints: updatedJoints, explosionVisuals: [...state.explosionVisuals, explosionVisual] });
    if (brokenJoints.length > 0) {
      addMsg('info', `Explosion broke ${brokenJoints.length} joint(s)`);
    }
  },

  makeJoints: (partId) => {
    const state = get();
    const part = state.objects.get(partId);
    if (!part || !isPart(part)) return;

    const newJoints: Joint[] = [];
    state.objects.forEach((obj) => {
      if (!isPart(obj) || obj.id === partId) return;

      const overlapX = Math.abs(part.position.x - obj.position.x) < (part.size.x + obj.size.x) / 2;
      const overlapY = Math.abs(part.position.y - obj.position.y) < (part.size.y + obj.size.y) / 2;
      const overlapZ = Math.abs(part.position.z - obj.position.z) < (part.size.z + obj.size.z) / 2;

      if (overlapX && overlapY && overlapZ) {
        const exists = state.joints.some(
          (j) =>
            (j.partAId === partId && j.partBId === obj.id) ||
            (j.partAId === obj.id && j.partBId === partId)
        );
        if (!exists) {
          newJoints.push({
            id: `joint_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: 'Weld',
            partAId: partId,
            partBId: obj.id,
            enabled: true,
            C0: { x: 0, y: 0, z: 0 },
            C1: { x: obj.position.x - part.position.x, y: obj.position.y - part.position.y, z: obj.position.z - part.position.z },
          });
        }
      }
    });

    if (newJoints.length > 0) {
      set((s) => ({ joints: [...s.joints, ...newJoints] }));
      state.addConsoleMessage('info', `Created ${newJoints.length} weld joint(s) for ${part.name}`);
    } else {
      state.addConsoleMessage('info', `No touching parts found for ${part.name}`);
    }
  },

  breakJoints: (partId) => {
    const state = get();
    const removed = state.joints.filter(
      (j) => j.partAId === partId || j.partBId === partId
    );
    set({
      joints: state.joints.filter(
        (j) => j.partAId !== partId && j.partBId !== partId
      ),
    });
    state.addConsoleMessage('info', `Broke ${removed.length} joint(s)`);
  },

  addEffect: (partId, effect) => {
    set((s) => {
      const obj = s.objects.get(partId);
      if (!obj || !isPart(obj)) return {};
      const newObjects = new Map(s.objects);
      newObjects.set(partId, { ...obj, effects: [...(obj.effects || []), effect] } as StudioPart);
      return { objects: newObjects };
    });
    const obj = get().objects.get(partId);
    if (obj && isPart(obj)) {
      get().addConsoleMessage('info', `Added ${effect.type} effect to ${obj.name}`);
    }
  },

  removeEffect: (partId, effectId) => {
    set((s) => {
      const obj = s.objects.get(partId);
      if (!obj || !isPart(obj)) return {};
      const newObjects = new Map(s.objects);
      newObjects.set(partId, { ...obj, effects: (obj.effects || []).filter((e) => e.id !== effectId) } as StudioPart);
      return { objects: newObjects };
    });
  },

  updateEffect: (partId, effectId, updates) => {
    set((s) => {
      const obj = s.objects.get(partId);
      if (!obj || !isPart(obj)) return {};
      const newObjects = new Map(s.objects);
      newObjects.set(partId, { ...obj, effects: (obj.effects || []).map((e) =>
        e.id === effectId ? { ...e, ...updates } : e
      ) } as StudioPart);
      return { objects: newObjects };
    });
  },

  addSpawnPoint: (opts?: { team?: string }) => {
    _pushUndo(get, set);
    const state = get();
    partCounter++;
    const id = generateId();
    const team = (opts?.team as 'Neutral' | 'Blue' | 'Red') || 'Neutral';
    const spawnColor = team === 'Blue' ? '#3366cc' : team === 'Red' ? '#cc3333' : '#4a90d9';
    const spawnPart: StudioPart = {
      id,
      name: 'Spawn_Location',
      type: 'Spawn',
      position: { x: 0, y: 0, z: 0 }, // at ground level — the SpawnMarker renders at y=0
      size: { x: 3, y: 0.3, z: 3 },
      rotation: { x: 0, y: 0, z: 0 },
      color: spawnColor,
      material: 'Neon',
      transparency: 0.6, // Semi-transparent — shows SpawnMarker circle underneath
      reflectance: 0,
      anchored: true,
      canCollide: false, // Not a physical object — it's a visual marker only
      friction: 0.5,
      elasticity: 0.2,
      density: 1.0,
      children: [],
      parentId: null,
      bodyMovers: [],
      effects: [],
      isSpawnPoint: true,
      spawnTeam: team,
    };
    const newObjects = new Map(state.objects);
    newObjects.set(id, spawnPart);
    set({ objects: newObjects, selectedIds: [] });
    state.addConsoleMessage('info', `Created SpawnLocation: ${spawnPart.name}`);
  },

  addBaseplate: () => {
    const state = get();
    // Check if a baseplate already exists
    let existingBaseplate: StudioPart | null = null;
    state.objects.forEach((obj) => {
      if (isPart(obj) && obj.isBaseplate) existingBaseplate = obj;
    });
    if (existingBaseplate) return; // Don't add duplicate baseplate

    _pushUndo(get, set);
    const currentState = get();
    partCounter++;
    const id = generateId();
    const bpSize = currentState.worldSettings.baseplateSize;
    const baseplatePart: StudioPart = {
      id,
      name: 'Baseplate',
      type: 'Block',
      position: { x: 0, y: -0.5, z: 0 },
      size: { x: bpSize, y: 1, z: bpSize },
      rotation: { x: 0, y: 0, z: 0 },
      color: '#3d6666',
      material: 'Plastic',
      transparency: 0,
      reflectance: 0,
      anchored: true,
      canCollide: true,
      friction: 0.5,
      elasticity: 0.2,
      density: 1.0,
      children: [],
      parentId: null,
      bodyMovers: [],
      effects: [],
      isBaseplate: true,
    };
    const newObjects = new Map(currentState.objects);
    newObjects.set(id, baseplatePart);
    set({ objects: newObjects });
    currentState.addConsoleMessage('info', `Created Baseplate`);
  },

  // ─── Character body parts ───
  // Creates 7 StudioParts representing the character's body. These are REAL
  // parts — they can be selected, colored, resized, have effects/rules, and
  // even deleted (delete the head → no head in-game). The game player reads
  // these parts to assemble the character instead of using a hardcoded mesh.
  addDefaultCharacterParts: () => {
    const state = get();
    const hasCharacterParts = Array.from(state.objects.values()).some(
      (obj) => isPart(obj) && obj.isCharacterPart
    );
    if (hasCharacterParts) return;

    const S = 2.0 / 2.55;
    const TORSO_H = 1.0 * S, TORSO_W = 0.875 * S, TORSO_D = 0.6 * S;
    const HEAD_W = 0.625 * S, HEAD_H = 0.625 * S, HEAD_D = 0.6 * S;
    const ARM_W = 0.4375 * S, ARM_H = 0.975 * S, ARM_D = 0.5 * S;
    const LEG_W = 0.4375 * S, LEG_H = 0.875 * S, LEG_D = 0.5 * S;
    const ARM_GAP = 0.02 * S, HEAD_GAP = 0.05 * S, LEG_GAP = 0.05 * S;

    const torsoY = LEG_H;
    const headY = LEG_H + TORSO_H + HEAD_GAP;

    const skinColor = state.avatar.skin || '#f8ff6d';
    const shirtColor = '#CC0000';
    const pantsColor = '#2196F3';

    const makeCharPart = (
      name: string,
      partType: 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'face',
      pos: { x: number; y: number; z: number },
      size: { x: number; y: number; z: number },
      color: string,
    ): StudioPart => ({
      id: generateId(),
      name,
      type: 'Block',
      position: pos,
      size,
      rotation: { x: 0, y: 0, z: 0 },
      color,
      material: 'Plastic',
      transparency: 0,
      reflectance: 0,
      anchored: true,
      canCollide: false,
      friction: 0.5,
      elasticity: 0.2,
      density: 1.0,
      children: [],
      parentId: null,
      bodyMovers: [],
      effects: [],
      isCharacterPart: true,
      characterPartType: partType,
      showInWorld: true, // visible in editor and during gameplay
      // ─── Avatar Modification defaults ───
      // Enable "Modify Color to Player's Avatar" by default for all body parts
      // so the joining player's equipped skin/shirt/pants override the part's
      // own color in play mode. Without this, the checkboxes are all unchecked
      // and the player's avatar doesn't apply to the character rig.
      // - head/arms → use avatar.skin
      // - torso     → use avatar.shirt (by ID)
      // - legs      → use avatar.left_leg / avatar.right_leg (by ID)
      modifyColorToAvatar: true,
      // Enable "Modify Face to Player's Avatar" by default for face parts so
      // the joining player's equipped face (avatar.face, by ID) overrides the
      // face part's own texture in play mode.
      modifyFaceToAvatar: partType === 'face',
    });

    const parts: StudioPart[] = [
      makeCharPart('Head', 'head', { x: 0, y: headY + HEAD_H / 2, z: 0 }, { x: HEAD_W, y: HEAD_H, z: HEAD_D }, skinColor),
      makeCharPart('Face', 'face', { x: 0, y: headY + HEAD_H / 2, z: HEAD_D / 2 + 0.002 }, { x: HEAD_W * 0.95, y: HEAD_H * 0.95, z: 0.01 }, skinColor),
      makeCharPart('Torso', 'torso', { x: 0, y: torsoY + TORSO_H / 2, z: 0 }, { x: TORSO_W, y: TORSO_H, z: TORSO_D }, shirtColor),
      makeCharPart('LeftArm', 'leftArm', { x: -(TORSO_W / 2 + ARM_W / 2 + ARM_GAP), y: torsoY + ARM_H / 2, z: 0 }, { x: ARM_W, y: ARM_H, z: ARM_D }, skinColor),
      makeCharPart('RightArm', 'rightArm', { x: TORSO_W / 2 + ARM_W / 2 + ARM_GAP, y: torsoY + ARM_H / 2, z: 0 }, { x: ARM_W, y: ARM_H, z: ARM_D }, skinColor),
      makeCharPart('LeftLeg', 'leftLeg', { x: -(LEG_W / 2 + LEG_GAP / 2), y: LEG_H / 2, z: 0 }, { x: LEG_W, y: LEG_H, z: LEG_D }, pantsColor),
      makeCharPart('RightLeg', 'rightLeg', { x: LEG_W / 2 + LEG_GAP / 2, y: LEG_H / 2, z: 0 }, { x: LEG_W, y: LEG_H, z: LEG_D }, pantsColor),
    ];

    const newObjects = new Map(state.objects);
    for (const part of parts) newObjects.set(part.id, part);
    set({ objects: newObjects });
    state.addConsoleMessage('info', `Created character body parts (${parts.length} parts)`);
  },

  setWorldSettings: (updates) =>
    set((state) => ({
      worldSettings: { ...state.worldSettings, ...updates },
    })),

  setAvatar: (avatar) => set({ avatar }),

  setGroupModeIds: (ids) => set({ groupModeIds: ids }),
  setUnionModeIds: (ids) => set({ unionModeIds: ids }),

  // ─── Per-object variables ───
  // Stored on the part itself so they are scoped to that part only (vs globalVariables).
  setObjectVariable: (partId, name, value) => {
    set((s) => {
      const obj = s.objects.get(partId);
      if (!obj || !isPart(obj)) return {};
      const newObjects = new Map(s.objects);
      const nextVars = { ...(obj.objectVariables || {}) };
      nextVars[name] = value;
      newObjects.set(partId, { ...obj, objectVariables: nextVars } as StudioPart);
      return { objects: newObjects };
    });
  },

  deleteObjectVariable: (partId, name) => {
    set((s) => {
      const obj = s.objects.get(partId);
      if (!obj || !isPart(obj) || !obj.objectVariables) return {};
      const newObjects = new Map(s.objects);
      const nextVars = { ...obj.objectVariables };
      delete nextVars[name];
      newObjects.set(partId, { ...obj, objectVariables: nextVars } as StudioPart);
      return { objects: newObjects };
    });
  },

  // ─── Typed joint removal (e.g. only Ropes) ───
  removeJointsOfType: (partId, type) => {
    const state = get();
    const matching = state.joints.filter(
      (j) => j.type === type && (j.partAId === partId || j.partBId === partId)
    );
    if (matching.length === 0) return 0;
    const matchingIds = new Set(matching.map((j) => j.id));
    set({
      joints: state.joints.filter((j) => !matchingIds.has(j.id)),
    });
    return matching.length;
  },

  // ─── Universes actions ───

  addUniverse: (name: string) => {
    const state = get();
    // Save current scene to the current universe first
    const currentUniverseId = state.currentUniverseId;
    const currentObjects: StudioObject[] = [];
    state.objects.forEach((obj) => currentObjects.push(JSON.parse(JSON.stringify(obj))));
    const currentJoints = [...state.joints];

    const newUniverseId = `place_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUniverse: UniverseData = { id: newUniverseId, name, objects: [], joints: [] };

    const newUniverses = new Map(state.universes);
    // Update the current universe with its latest objects
    newUniverses.set(currentUniverseId, {
      ...newUniverses.get(currentUniverseId)!,
      objects: currentObjects,
      joints: currentJoints,
    });
    // Add the new universe
    newUniverses.set(newUniverseId, newUniverse);

    // Switch to the new universe (clear objects and joints, create fresh scene)
    partCounter = 0;
    set({
      universes: newUniverses,
      currentUniverseId: newUniverseId,
      objects: new Map<string, StudioObject>(),
      selectedIds: [],
      joints: [],
      groupModeIds: [],
      unionModeIds: [],
      explosionVisuals: [],
      consoleMessages: [],
    });
    return newUniverseId;
  },

  switchUniverse: (universeId: string) => {
    const state = get();
    if (universeId === state.currentUniverseId) return;

    // Save current scene to the current universe
    const currentObjects: StudioObject[] = [];
    state.objects.forEach((obj) => currentObjects.push(JSON.parse(JSON.stringify(obj))));
    const currentJoints = [...state.joints];

    const newUniverses = new Map(state.universes);
    newUniverses.set(state.currentUniverseId, {
      ...newUniverses.get(state.currentUniverseId)!,
      objects: currentObjects,
      joints: currentJoints,
    });

    // Load the target universe's objects
    const targetUniverse = newUniverses.get(universeId);
    if (!targetUniverse) return;

    const newObjects = new Map<string, StudioObject>();
    targetUniverse.objects.forEach((obj) => newObjects.set(obj.id, obj));

    set({
      universes: newUniverses,
      currentUniverseId: universeId,
      objects: newObjects,
      selectedIds: [],
      joints: [...targetUniverse.joints],
      groupModeIds: [],
      unionModeIds: [],
      explosionVisuals: [],
    });
  },

  deleteUniverse: (universeId: string) => {
    const state = get();
    if (state.universes.size <= 1) return; // Don't delete the last universe
    if (universeId === state.currentUniverseId) return; // Can't delete active universe

    const newUniverses = new Map(state.universes);
    newUniverses.delete(universeId);
    set({ universes: newUniverses });
  },

  renameUniverse: (universeId: string, newName: string) => {
    const state = get();
    const newUniverses = new Map(state.universes);
    const universe = newUniverses.get(universeId);
    if (!universe) return;
    newUniverses.set(universeId, { ...universe, name: newName });
    set({ universes: newUniverses });
  },

  clearProject: () => {
    partCounter = 0;
    set({
      objects: new Map<string, StudioObject>(),
      selectedIds: [],
      joints: [],
      groupModeIds: [],
      unionModeIds: [],
      explosionVisuals: [],
      clipboard: null,
      consoleMessages: [],
      activeTool: 'Select',
      activeTab: 'Home',
      playState: {
        isPlaying: false,
        isTestPlay: false,
        characterPosition: { x: 0, y: 5, z: 0 },
        characterVelocity: { x: 0, y: 0, z: 0 },
        isGrounded: false,
        characterRotation: 0,
      },
      simulationState: {
        isSimulating: false,
      },
      physicsSettings: {
        gravity: -9.81,
        collisionsEnabled: true,
        waterForce: 1,
        waterDirection: { x: 1, y: 0, z: 0 },
        experimentalSolver: false,
      },
      terrainSettings: {
        width: 100,
        length: 100,
        amplitude: 10,
        frequency: 0.1,
        waterHeight: 2,
        baseHeight: 0,
        terrainStyle: 'blocky',
        preset: 'Nature',
        maxHeight: 20,
        minHeight: 0,
        seaLevel: 2,
        treeDensity: 0.3,
        blockSize: 4,
        terrainColor: '#4a7c3f',
        seed: 42,
      },
      showTerrain: false,
      // Reset terrain v2 state too — new project = fresh terrain
      terrainHeightmap: null,
      terrainConfig: { ...DEFAULT_TERRAIN_CONFIG },
      waterBodies: [],
      treeInstances: [],
      brushSettings: { ...DEFAULT_BRUSH },
      activeTreeVariant: 'oak',
      terrainColor: '#4a7c3f',
      waterColor: '#2c7be0',
      terrainLayers: DEFAULT_TERRAIN_LAYERS.map(l => ({ ...l })),
      brushPaintColor: '#ff6600',
      worldSettings: {
        skyColorTop: '#6699e6',
        skyColorBottom: '#b3cce6',
        ambientLightIntensity: 0.4,
        baseplateSize: 100,
        gravity: -9.81,
        maxPlayers: 10,
        spawnPointPosition: { x: 0, y: 1, z: 0 },
        sunEnabled: true,
        sunColor: '#fff4e0',
        sunSize: 1.0,
        moonEnabled: true,
        moonColor: '#e8e8f0',
        moonSize: 0.8,
        cloudsEnabled: true,
        cloudColor: '#ffffff',
        cloudDensity: 0.4,
        cloudSpeed: 1.0,
        windDirection: 90,
        starsEnabled: true,
        starCount: 1200,
        dayNightEnabled: false,
        timeOfDay: 12,
        dayLength: 120,
        weatherType: 'clear',
        weatherIntensity: 0.5,
      },
      avatar: {
        skin: '#f8ff6d',
        face: 'FACE-1',
        shirt: 'SHIRT-1',
        left_leg: 'PANTS-1',
        right_leg: 'PANTS-1',
      },
      showGrid: true,
      snapToGrid: true,
      gridSize: 1,
      universes: new Map<string, UniverseData>([
        ['place_default', { id: 'place_default', name: 'Start', objects: [], joints: [] }],
      ]),
      currentUniverseId: 'place_default',
      undoStack: [],
      redoStack: [],
    });
  },

  removeExplosionVisual: (id) =>
    set((state) => ({
      explosionVisuals: state.explosionVisuals.filter((e) => e.id !== id),
    })),

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const currentSnapshot = snapshotState(state.objects, state.joints);
    const undoStack = [...state.undoStack];
    const previousSnapshot = undoStack.pop()!;
    const redoStack = [...state.redoStack, currentSnapshot];
    if (redoStack.length > MAX_UNDO_STACK) redoStack.shift();
    const { objects, joints } = restoreSnapshot(previousSnapshot);
    set({ objects, joints, undoStack, redoStack, selectedIds: [] });
    state.addConsoleMessage('info', 'Undo');
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const currentSnapshot = snapshotState(state.objects, state.joints);
    const redoStack = [...state.redoStack];
    const nextSnapshot = redoStack.pop()!;
    const undoStack = [...state.undoStack, currentSnapshot];
    if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();
    const { objects, joints } = restoreSnapshot(nextSnapshot);
    set({ objects, joints, undoStack, redoStack, selectedIds: [] });
    state.addConsoleMessage('info', 'Redo');
  },

  // ─── WeildCode Rule Management ───

  addRule: (partId: string, rule: WeildCodeRule) => {
    const state = get();
    const obj = state.objects.get(partId);
    if (!obj || !isPart(obj)) return;
    const newObjects = new Map(state.objects);
    const existingRules = obj.rules || [];
    newObjects.set(partId, { ...obj, rules: [...existingRules, rule] } as StudioPart);
    set({ objects: newObjects });
  },

  removeRule: (partId: string, ruleId: string) => {
    const state = get();
    const obj = state.objects.get(partId);
    if (!obj || !isPart(obj)) return;
    const newObjects = new Map(state.objects);
    const existingRules = obj.rules || [];
    newObjects.set(partId, { ...obj, rules: existingRules.filter((r) => r.id !== ruleId) } as StudioPart);
    set({ objects: newObjects });
  },

  updateRule: (partId: string, ruleId: string, updates: Partial<WeildCodeRule>) => {
    const state = get();
    const obj = state.objects.get(partId);
    if (!obj || !isPart(obj)) return;
    const newObjects = new Map(state.objects);
    const existingRules = obj.rules || [];
    newObjects.set(partId, {
      ...obj,
      rules: existingRules.map((r) => r.id === ruleId ? { ...r, ...updates } : r),
    } as StudioPart);
    set({ objects: newObjects });
  },

  // ─── Atomic Play/Simulate Mode Functions ───
  // These handle the complete start/stop lifecycle atomically.
  // CRITICAL DESIGN: On stop, we set isPlaying/isSimulating=false FIRST,
  // so that useFrame loops (PhysicsSimulation, PlayCharacter, SimulationOnly)
  // bail out immediately and never overwrite the restored snapshot state.

  startPlayMode: () => {
    const state = get();
    // Save snapshot of current state before any physics/modifications occur
    const snapshot = snapshotState(state.objects, state.joints);
    set({
      _playSnapshot: snapshot,
      playState: {
        isPlaying: true,
        isTestPlay: false,
        characterPosition: { x: 0, y: 5, z: 0 },
        characterVelocity: { x: 0, y: 0, z: 0 },
        isGrounded: false,
        characterRotation: 0,
      },
    });
  },

  stopPlayMode: () => {
    const state = get();
    if (!state._playSnapshot) return;

    // STEP 1: Set isPlaying=false FIRST — this causes all useFrame loops
    // (PhysicsSimulation, PlayCharacter) to bail out on their very next read
    // of useStudioStore.getState().playState.isPlaying. Since zustand updates
    // synchronously and useFrame runs on the next animation frame, no physics
    // step can fire between this set() and the snapshot restore below.
    set({
      playState: {
        isPlaying: false,
        isTestPlay: false,
        characterPosition: { x: 0, y: 5, z: 0 },
        characterVelocity: { x: 0, y: 0, z: 0 },
        isGrounded: false,
        characterRotation: 0,
      },
    });

    // STEP 2: Now that all loops are stopped, safely restore the snapshot.
    // Nothing can overwrite this because isPlaying === false.
    const restored = restoreSnapshot(state._playSnapshot);
    set({
      objects: restored.objects,
      joints: restored.joints,
      _playSnapshot: null,
      explosionVisuals: [],
      screenMessages: [],
    });
  },

  startTestPlayMode: (spawnPosition: Vector3) => {
    const state = get();
    // Save snapshot of current state before any physics/modifications occur
    const snapshot = snapshotState(state.objects, state.joints);
    set({
      _playSnapshot: snapshot,
      playState: {
        isPlaying: true,
        isTestPlay: true,
        characterPosition: { ...spawnPosition },
        characterVelocity: { x: 0, y: 0, z: 0 },
        isGrounded: false,
        characterRotation: 0,
      },
    });
  },

  startSimulationMode: () => {
    const state = get();
    // Save snapshot of current state before any physics/modifications occur
    const snapshot = snapshotState(state.objects, state.joints);
    set({
      _playSnapshot: snapshot,
      simulationState: { isSimulating: true },
    });
  },

  stopSimulationMode: () => {
    const state = get();
    if (!state._playSnapshot) return;

    // STEP 1: Set isSimulating=false FIRST — this causes SimulationOnly's
    // useFrame loop to bail out immediately on the next read.
    set({ simulationState: { isSimulating: false } });

    // STEP 2: Now that the simulation loop is stopped, safely restore.
    const restored = restoreSnapshot(state._playSnapshot);
    set({
      objects: restored.objects,
      joints: restored.joints,
      _playSnapshot: null,
      explosionVisuals: [],
      screenMessages: [],
    });
  },
}));

