'use client';

/**
 * StudioPlayViewport — The unified game-play renderer.
 *
 * Renders the EXACT same scene the WeildCreate editor uses
 * (PhysicsSimulation, WeildCode engine, SkySystem, TerrainMesh,
 * PartMesh, etc.) for 1:1 editor↔game compatibility.
 *
 * The local player character + camera use a NEW, polished controller
 * that keeps the same core feel (camera fixed on character, zoom
 * in/out, camera-relative movement) but adds a bunch of game-feel
 * improvements:
 *
 *   ── Camera ──
 *   • Spring-damper follow (buttery smooth, no jitter, frame-rate independent)
 *   • Camera collision (raycasts against parts so it never clips through walls)
 *   • FOV kick on sprint (50° → 65° for a sense of speed)
 *   • Camera shake on hard landings & explosions
 *   • First-person toggle (press V) — camera zooms to head, character hidden
 *   • Subtle head bob while walking in first person
 *
 *   ── Movement ──
 *   • Velocity-based horizontal movement with momentum (not instant stop)
 *   • Air control (35% of ground control — floaty but steerable jumps)
 *   • Sprint (hold Shift) — 1.7× speed
 *   • Coyote time (100ms grace to jump after leaving a ledge)
 *   • Jump buffering (120ms — press jump early, it queues)
 *   • Squash & stretch on the character (stretch up on jump, squash on land)
 *
 *   ── Physics ──
 *   • Custom AABB resolver with shape-aware surfaces (block/sphere/cylinder/wedge)
 *   • Slope detection + sliding (steep slopes make you slide downhill)
 *   • Smooth step-up (ledges under 0.6 units are walked up, not blocked)
 *   • Ceiling clamp + wall slide (preserve tangential velocity along walls)
 *
 * The studio's PhysicsSimulation runs in parallel for unanchored parts,
 * joints, bodyMovers, and explosions.
 */

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStudioStore, isPart } from '@/lib/studio-store';
import {
  PartMesh,
  PhysicsSimulation,
  TerrainMesh,
  JointVisualizer,
  ExplosionVisuals,
  NameLabels,
  ScreenMessageOverlay,
} from '@/components/studio/Viewport3D';
import { SkySystem } from '@/components/studio/SkySystem';
import { WeildBuildCharacter, DEFAULT_AVATAR } from '@/components/shared/WeildBuildCharacter';
import { CharacterPartsRenderer } from '@/components/studio/CharacterPartsRenderer';
import {
  mobileInputRef,
  type RemotePlayerData,
  GRAVITY,
  JUMP_FORCE,
  MOVE_SPEED,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  GROUND_SKIN,
  STEP_HEIGHT,
} from '@/components/app/shared';
import { lerpAngle } from '@/components/app/GameWorld';
import { playSound, preloadSounds } from '@/lib/sounds';
import { weildCodeEngine } from '@/lib/weildcode-engine';
import { getHeightAt, generateTreeBlocks } from '@/lib/terrain-v2';
import type { TreeBlock } from '@/lib/terrain-v2';

// ═══════════════════════════════════════════════════════════════════
// PHYSICS — Custom AABB resolver with slope detection + rotation support
// ═══════════════════════════════════════════════════════════════════

interface PhysicsResult {
  newPos: [number, number, number];
  velY: number;
  grounded: boolean;
  slopeAngle: number;     // radians from horizontal (0 = flat)
  slopeDirX: number;      // normalized downhill X
  slopeDirZ: number;      // normalized downhill Z
  landedHard: boolean;    // true if just landed with significant impact
  impactSpeed: number;    // downward speed at impact (0 if no landing)
  blockedX: boolean;      // true if movement was blocked in X (wall)
  blockedZ: boolean;      // true if movement was blocked in Z (wall)
}

/** A part prepared for collision detection (precomputed for performance). */
interface CollisionPart {
  px: number; py: number; pz: number;   // world position
  hw: number; hh: number; hd: number;   // half-extents
  rotY: number;                          // rotation around Y (radians)
  shapeType: string;                     // 'block' | 'sphere' | 'cylinder' | 'wedge' | ...
}

// Non-solid shape types (triggers, not barriers)
const NON_SOLID = new Set([
  'water', 'checkpoint', 'item_pickup', 'teleporter', 'npc', 'player',
  'spawn_point', 'speed_pad',
]);

/**
 * Get the top surface height of a shape at a given LOCAL XZ position.
 * `lx`, `lz` are in the part's local (un-rotated) space.
 * Returns the LOCAL surface height (caller adds `py` for world height).
 */
function getLocalSurfaceHeight(
  lx: number, lz: number,
  shapeType: string,
  hh: number, hw: number, hd: number,
): number | null {
  switch (shapeType) {
    case 'sphere': {
      const r = hw;
      const d = Math.sqrt(lx * lx + lz * lz);
      if (d > r) return null;
      return Math.sqrt(Math.max(0, r * r - d * d));
    }
    case 'cylinder': {
      const r = hw;
      const d = Math.sqrt(lx * lx + lz * lz);
      if (d > r) return null;
      return hh;
    }
    case 'wedge': {
      if (Math.abs(lx) > hw || Math.abs(lz) > hd) return null;
      const xNorm = (lx + hw) / (2 * hw);
      return -hh + (1 - xNorm) * (hh * 2);
    }
    default: {
      // block, door (closed), etc.
      if (Math.abs(lx) > hw || Math.abs(lz) > hd) return null;
      return hh;
    }
  }
}

/**
 * Resolve player physics for one frame.
 * Single-pass AABB resolution with shape-aware surfaces + slope detection.
 *
 * ROTATED PARTS: We transform the player's position into each part's local
 * space (un-rotating around the part's Y axis only — that's the only axis
 * the editor rotates parts around for collision purposes). This makes
 * rotated blocks/wedges collide correctly without needing full OBB math.
 *
 * UNANCHORED PARTS: The caller passes the LATEST positions from the studio's
 * physics world (synced each frame), so moving parts collide in real time.
 */
function resolvePhysicsV2(
  pos: [number, number, number],
  velX: number,
  velY: number,
  velZ: number,
  parts: CollisionPart[],
  wasGrounded: boolean,
  prevVelY: number,
): PhysicsResult {
  const PR = PLAYER_RADIUS;
  const PH = PLAYER_HEIGHT;

  let cx = pos[0] + velX;
  let cy = pos[1] + velY;
  let cz = pos[2] + velZ;

  let groundY: number | null = null;
  let groundSlopeAngle = 0;
  let groundSlopeDirX = 0;
  let groundSlopeDirZ = 0;
  let ceilY: number | null = null;
  let blockedX = false;
  let blockedZ = false;

  // Per-part checks (NO invisible world ground — baseplate is a real part)
  for (const part of parts) {
    const { px, py, pz, hw, hh, hd, rotY, shapeType } = part;
    const isSlope = shapeType === 'wedge' || shapeType === 'ramp' || shapeType === 'corner_wedge';

    // Transform player position into part's local space (un-rotate around Y)
    const dx0 = cx - px;
    const dz0 = cz - pz;
    const cosR = Math.cos(-rotY);
    const sinR = Math.sin(-rotY);
    const lx = dx0 * cosR - dz0 * sinR;  // local x
    const lz = dx0 * sinR + dz0 * cosR;  // local z

    // Ground surface (center XZ, in local space)
    const surf = getLocalSurfaceHeight(lx, lz, shapeType, hh, hw, hd);
    if (surf !== null) {
      const worldSurf = surf + py;  // surface height in world space (rotation around Y doesn't change Y)
      const isAtOrBelow = worldSurf <= pos[1] + 0.05;
      const isStepUp = isSlope && wasGrounded && worldSurf <= pos[1] + STEP_HEIGHT;
      if (isAtOrBelow || isStepUp) {
        if (groundY === null || worldSurf > groundY) {
          groundY = worldSurf;
          // Compute slope by sampling surface at nearby points (in local space)
          const sx1 = getLocalSurfaceHeight(lx + 0.3, lz, shapeType, hh, hw, hd);
          const sx2 = getLocalSurfaceHeight(lx - 0.3, lz, shapeType, hh, hw, hd);
          const sz1 = getLocalSurfaceHeight(lx, lz + 0.3, shapeType, hh, hw, hd);
          const sz2 = getLocalSurfaceHeight(lx, lz - 0.3, shapeType, hh, hw, hd);
          if (sx1 !== null && sx2 !== null) {
            const d = sx1 - sx2;
            const a = Math.atan2(Math.abs(d), 0.6);
            if (a > groundSlopeAngle) {
              groundSlopeAngle = a;
              // Slope direction in world space (rotate back)
              groundSlopeDirX = -Math.sign(d) * cosR;
              groundSlopeDirZ = -Math.sign(d) * (-sinR);
            }
          }
          if (sz1 !== null && sz2 !== null) {
            const d = sz1 - sz2;
            const a = Math.atan2(Math.abs(d), 0.6);
            if (a > groundSlopeAngle) {
              groundSlopeAngle = a;
              groundSlopeDirX = -Math.sign(d) * sinR;
              groundSlopeDirZ = -Math.sign(d) * cosR;
            }
          }
        }
      }
    }

    // Ceiling (padded XZ, in local space)
    if (lx + PR > -hw && lx - PR < hw &&
        lz + PR > -hd && lz - PR < hd) {
      const primBottom = py - hh;
      if (primBottom < cy + PH && primBottom > cy && velY > 0) {
        if (ceilY === null || primBottom < ceilY) ceilY = primBottom;
      }
    }

    // X wall (old Z, padded) — checked in local space.
    // IMPORTANT: use pos[1] (the pre-gravity position) for the Y overlap test,
    // NOT cy (which includes gravity). Also add GROUND_SKIN tolerance so the
    // part the player is STANDING ON is never detected as a wall (only parts
    // whose top is significantly above the player's feet count as walls).
    // Without the skin, floating-point errors make pos[1] flicker above/below
    // the surface every frame, causing movement jitter.
    const wallFeetThreshold = pos[1] + 0.3; // 0.3 unit tolerance — must be this far below the top to count as a wall. Prevents flip-flopping.
    const oldDx = pos[0] - px;
    const oldDz = pos[2] - pz;
    const oldLx = oldDx * cosR - oldDz * sinR;
    const oldLz = oldDx * sinR + oldDz * cosR;

    if (!blockedX &&
        lx + PR > -hw && lx - PR < hw &&
        oldLz + PR > -hd && oldLz - PR < hd &&
        wallFeetThreshold < py + hh && pos[1] + PH > py - hh) {
      if (isSlope) {
        const s = getLocalSurfaceHeight(lx, oldLz, shapeType, hh, hw, hd);
        if (s !== null && pos[1] < s + py - 0.15) blockedX = true;
      } else {
        blockedX = true;
      }
    }

    // Z wall (resolved X, padded) — checked in local space
    if (!blockedZ) {
      const testLx = blockedX ? oldLx : lx;
      if (testLx + PR > -hw && testLx - PR < hw &&
          lz + PR > -hd && lz - PR < hd &&
          wallFeetThreshold < py + hh && pos[1] + PH > py - hh) {
        if (isSlope) {
          const s = getLocalSurfaceHeight(testLx, lz, shapeType, hh, hw, hd);
          if (s !== null && pos[1] < s + py - 0.15) blockedZ = true;
        } else {
          blockedZ = true;
        }
      }
    }
  }

  // Y resolution
  let grounded = false;
  let landedHard = false;
  let impactSpeed = 0;

  if (groundY !== null && velY <= 0) {
    if (cy <= groundY) {
      // Landed
      cy = groundY;
      if (prevVelY < -0.3) {
        landedHard = true;
        impactSpeed = Math.abs(prevVelY);
      }
      velY = 0;
      grounded = true;
    } else if (cy - groundY <= GROUND_SKIN) {
      // Ground snap (skin)
      cy = groundY;
      velY = 0;
      grounded = true;
    }
  }
  if (ceilY !== null && cy + PH > ceilY) {
    cy = ceilY - PH;
    if (velY > 0) velY = 0;
  }

  // Wall blocking — zero out velocity in the blocked direction so the
  // character doesn't "stick" to walls. Tangential velocity (along the wall)
  // is preserved so the character slides smoothly along the wall surface.
  if (blockedX) {
    cx = pos[0];
    // Caller will zero playerVelX based on this returned info
  }
  if (blockedZ) {
    cz = pos[2];
    // Caller will zero playerVelZ based on this returned info
  }

  return {
    newPos: [cx, cy, cz],
    velY,
    grounded,
    slopeAngle: groundSlopeAngle,
    slopeDirX: groundSlopeDirX,
    slopeDirZ: groundSlopeDirZ,
    landedHard,
    impactSpeed,
    blockedX,
    blockedZ,
  };
}

// ═══════════════════════════════════════════════════════════════════
// CAMERA COLLISION — Ray vs AABB
// ═══════════════════════════════════════════════════════════════════

function rayVsAABB(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  minX: number, minY: number, minZ: number,
  maxX: number, maxY: number, maxZ: number,
): number | null {
  let tmin = -Infinity, tmax = Infinity;
  // X
  if (Math.abs(dx) < 1e-8) {
    if (ox < minX || ox > maxX) return null;
  } else {
    const t1 = (minX - ox) / dx;
    const t2 = (maxX - ox) / dx;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  // Y
  if (Math.abs(dy) < 1e-8) {
    if (oy < minY || oy > maxY) return null;
  } else {
    const t1 = (minY - oy) / dy;
    const t2 = (maxY - oy) / dy;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  // Z
  if (Math.abs(dz) < 1e-8) {
    if (oz < minZ || oz > maxZ) return null;
  } else {
    const t1 = (minZ - oz) / dz;
    const t2 = (maxZ - oz) / dz;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  if (tmax < tmin) return null;
  return tmin >= 0 ? tmin : (tmax >= 0 ? tmax : null);
}

// ═══════════════════════════════════════════════════════════════════
// Build collision parts from the studio store + physics world
// ═══════════════════════════════════════════════════════════════════
//
// This gathers ALL collidable parts each frame:
//   - Anchored parts: read directly from the studio store (position, size, rotation)
//   - Unanchored (physics-enabled) parts: read from the studio's PhysicsWorld
//     (stored on window.__weildPhysicsWorld by PhysicsSimulation) so we get
//     their REAL-TIME positions as they fall/bounce/get pushed.
//
// Rotation is converted from degrees (studio) to radians and we only use
// the Y-axis rotation (the editor rotates parts around Y for collision).

const STUDIO_TYPE_TO_SHAPE: Record<string, string> = {
  'Block': 'block',
  'Sphere': 'sphere',
  'Cylinder': 'cylinder',
  'Wedge': 'wedge',
  'Spawn': 'spawn_point',
};

function buildCollisionParts(): CollisionPart[] {
  const result: CollisionPart[] = [];
  const studioState = useStudioStore.getState();

  // Get the physics world (if play mode is active, PhysicsSimulation stores it here)
  const physicsWorld = (typeof window !== 'undefined' ? (window as any).__weildPhysicsWorld : null) as
    { bodies: Map<string, { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; anchored: boolean }> } | null;

  studioState.objects.forEach((obj) => {
    if (!isPart(obj)) return;
    if (!obj.canCollide) return;
    if (obj.isSpawnPoint) return;
    if (obj.isCharacterPart) return;
    if (obj.showInWorld === false) return; // hidden parts don't collide

    const shapeType = STUDIO_TYPE_TO_SHAPE[obj.type] || 'block';
    if (NON_SOLID.has(shapeType)) return;

    // For unanchored parts that are being simulated, use the physics body's
    // live position/rotation. For anchored parts (or when no physics world),
    // use the store position/rotation.
    let px = obj.position.x, py = obj.position.y, pz = obj.position.z;
    let rotY = obj.rotation.y * Math.PI / 180;

    if (!obj.anchored && physicsWorld) {
      const body = physicsWorld.bodies.get(obj.id);
      if (body) {
        px = body.position.x;
        py = body.position.y;
        pz = body.position.z;
        rotY = body.rotation.y;
      }
    }

    result.push({
      px, py, pz,
      hw: obj.size.x / 2,
      hh: obj.size.y / 2,
      hd: obj.size.z / 2,
      rotY,
      shapeType,
    });
  });

  // ─── Add tree blocks as collision parts ───
  // Each tree is decomposed into its constituent blocks (trunk + leaves).
  // Each block is a solid box that the character can stand on / walk into.
  if (studioState.treeInstances.length > 0) {
    for (const tree of studioState.treeInstances) {
      const blocks: TreeBlock[] = generateTreeBlocks(tree);
      for (const block of blocks) {
        result.push({
          px: block.position.x,
          py: block.position.y,
          pz: block.position.z,
          hw: block.size.x / 2,
          hh: block.size.y / 2,
          hd: block.size.z / 2,
          rotY: 0, // tree blocks are axis-aligned
          shapeType: 'block',
        });
      }
    }
  }

  return result;
}

/**
 * Get the terrain surface height at a world XZ position.
 * Returns null if there's no terrain or the position is outside the terrain.
 */
function getTerrainHeightAt(worldX: number, worldZ: number): number | null {
  const studioState = useStudioStore.getState();
  if (!studioState.terrainHeightmap) return null;
  const h = getHeightAt(studioState.terrainHeightmap, worldX, worldZ);
  // getHeightAt returns 0 for out-of-bounds; we treat that as "no terrain"
  // only if the player is actually outside the footprint.
  const hm = studioState.terrainHeightmap;
  const halfW = (hm.width * hm.cellSize) / 2;
  const halfL = (hm.length * hm.cellSize) / 2;
  if (worldX < -halfW || worldX > halfW || worldZ < -halfL || worldZ > halfL) {
    return null;
  }
  return h;
}

// ═══════════════════════════════════════════════════════════════════
// Local player character + camera (the polished controller)
// ═══════════════════════════════════════════════════════════════════

function GamePlayerCharacter({
  onPositionUpdate,
  cameraZoomOverride,
  onCameraZoomChange,
  spawnPosition,
  animationsEnabled = true,
}: {
  onPositionUpdate?: (pos: [number, number, number], rot: number) => void;
  cameraZoomOverride?: number;
  onCameraZoomChange?: (z: number) => void;
  spawnPosition: [number, number, number];
  animationsEnabled?: boolean;
}) {
  const { gl, camera } = useThree();
  const avatar = useStudioStore((s) => s.avatar);

  // ─── Player state ───
  const playerPos = useRef<[number, number, number]>([...spawnPosition]);
  const playerVelX = useRef(0);  // horizontal velocity X (momentum-based)
  const playerVelZ = useRef(0);  // horizontal velocity Z
  const playerVelY = useRef(0);  // vertical velocity
  const playerRot = useRef(0);
  const isGrounded = useRef(true);
  const isJumping = useRef(false);
  const walkPhase = useRef(0);
  const keysDown = useRef<Set<string>>(new Set());
  const wasGroundedRef = useRef(true);
  const prevVelYRef = useRef(0);
  const lastFootstepTime = useRef(0);

  // ─── Coyote time + jump buffer ───
  const coyoteTimer = useRef(0);       // counts down from 0.1 when leaving ground
  const jumpBufferTimer = useRef(0);   // counts down from 0.12 when jump pressed

  // ─── Camera state ───
  const cameraYaw = useRef(0);
  const cameraPitch = useRef(0.5);
  const cameraDist = useRef(12);
  const cameraDistTarget = useRef(12);
  const isRightDragging = useRef(false);
  const lastMouse = useRef<[number, number]>([0, 0]);
  const firstPersonRef = useRef(false);
  const fpBlendRef = useRef(0);  // 0 = third person, 1 = first person (smooth blend)

  // ─── Camera smoothing (spring-damper) ───
  const camPosRef = useRef(new THREE.Vector3(spawnPosition[0] + 10, spawnPosition[1] + 8, spawnPosition[2] + 12));
  const camLookRef = useRef(new THREE.Vector3(...spawnPosition));

  // ─── Camera shake ───
  const shakeAmount = useRef(0);

  // ─── Squash & stretch ───
  const squashRef = useRef(1);  // 1 = normal, >1 = stretched tall, <1 = squashed

  // ─── FOV kick ───
  const currentFOVRef = useRef(50);

  // ─── Reusable vectors (avoid GC pressure) ───
  const _forward = useRef(new THREE.Vector3());
  const _right = useRef(new THREE.Vector3());
  const _desiredCamPos = useRef(new THREE.Vector3());
  const _desiredLook = useRef(new THREE.Vector3());
  const _dir = useRef(new THREE.Vector3());
  const _shake = useRef(new THREE.Vector3());

  const groupRef = useRef<THREE.Group>(null);
  const characterVisibleRef = useRef(true);
  const lastPositionBroadcast = useRef(0);

  // Apply external zoom override
  useEffect(() => {
    if (cameraZoomOverride !== undefined && cameraZoomOverride > 0) {
      cameraDistTarget.current = cameraZoomOverride;
    }
  }, [cameraZoomOverride]);

  // Preload sounds
  useEffect(() => {
    preloadSounds();
  }, []);

  // ─── Input handlers ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      keysDown.current.add(key);
      if (key === 'arrowup') keysDown.current.add('w');
      if (key === 'arrowdown') keysDown.current.add('s');
      if (key === 'arrowleft') keysDown.current.add('a');
      if (key === 'arrowright') keysDown.current.add('d');

      // Jump (with buffer)
      if (e.key === ' ') {
        jumpBufferTimer.current = 0.12;
        e.preventDefault();
      }

      // First-person toggle
      if (key === 'v') {
        firstPersonRef.current = !firstPersonRef.current;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      keysDown.current.delete(key);
      if (key === 'arrowup') keysDown.current.delete('w');
      if (key === 'arrowdown') keysDown.current.delete('s');
      if (key === 'arrowleft') keysDown.current.delete('a');
      if (key === 'arrowright') keysDown.current.delete('d');
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        isRightDragging.current = true;
        lastMouse.current = [e.clientX, e.clientY];
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) isRightDragging.current = false;
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (isRightDragging.current) {
        const dx = e.clientX - lastMouse.current[0];
        const dy = e.clientY - lastMouse.current[1];
        cameraYaw.current -= dx * 0.005;
        cameraPitch.current = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, cameraPitch.current + dy * 0.005));
        lastMouse.current = [e.clientX, e.clientY];
      }
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Scroll all the way in → enter first person
      const newDist = Math.max(2, Math.min(30, cameraDistTarget.current + e.deltaY * 0.01));
      cameraDistTarget.current = newDist;
      if (newDist <= 2.5) firstPersonRef.current = true;
      else if (newDist >= 4) firstPersonRef.current = false;
      if (onCameraZoomChange) onCameraZoomChange(Math.round(newDist * 10) / 10);
    };
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    // Touch camera
    const canvasEl = gl.domElement;
    let cameraTouchId: number | null = null;
    let lastCameraTouch: [number, number] = [0, 0];

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1 && cameraTouchId === null) {
        cameraTouchId = e.touches[0].identifier;
        lastCameraTouch = [e.touches[0].clientX, e.touches[0].clientY];
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === cameraTouchId) {
          const dx = e.changedTouches[i].clientX - lastCameraTouch[0];
          const dy = e.changedTouches[i].clientY - lastCameraTouch[1];
          cameraYaw.current -= dx * 0.006;
          cameraPitch.current = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, cameraPitch.current + dy * 0.006));
          lastCameraTouch = [e.changedTouches[i].clientX, e.changedTouches[i].clientY];
        }
      }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === cameraTouchId) {
          cameraTouchId = null;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('contextmenu', handleContextMenu);
    if (canvasEl) {
      canvasEl.style.touchAction = 'none';
      canvasEl.addEventListener('touchstart', handleTouchStart, { passive: true });
      canvasEl.addEventListener('touchmove', handleTouchMove, { passive: true });
      canvasEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('contextmenu', handleContextMenu);
      if (canvasEl) {
        canvasEl.removeEventListener('touchstart', handleTouchStart);
        canvasEl.removeEventListener('touchmove', handleTouchMove);
        canvasEl.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [gl, onCameraZoomChange]);

  // ─── Main frame loop ───
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const keys = keysDown.current;

    // Mobile jump (with buffer)
    if (mobileInputRef.jump) {
      jumpBufferTimer.current = 0.12;
      mobileInputRef.jump = false;
    }

    // Tick timers
    coyoteTimer.current -= dt;
    jumpBufferTimer.current -= dt;
    if (isGrounded.current) coyoteTimer.current = 0.1;

    // ─── Movement input (camera-relative) ───
    const forward = _forward.current.set(-Math.sin(cameraYaw.current), 0, -Math.cos(cameraYaw.current));
    const right = _right.current.set(-forward.z, 0, forward.x);

    let inputX = 0, inputZ = 0;
    if (keys.has('w')) { inputX += forward.x; inputZ += forward.z; }
    if (keys.has('s')) { inputX -= forward.x; inputZ -= forward.z; }
    if (keys.has('a')) { inputX -= right.x; inputZ -= right.z; }
    if (keys.has('d')) { inputX += right.x; inputZ += right.z; }

    // Mobile joystick
    const mJoyX = mobileInputRef.moveX;
    const mJoyZ = mobileInputRef.moveZ;
    if (Math.abs(mJoyX) > 0.05 || Math.abs(mJoyZ) > 0.05) {
      inputX += right.x * mJoyX + forward.x * mJoyZ;
      inputZ += right.z * mJoyX + forward.z * mJoyZ;
    }

    // Sprint
    const isSprinting = (keys.has('shift') || mobileInputRef.jump === false && keys.has('w')) && (inputX !== 0 || inputZ !== 0) && isGrounded.current;
    const speedMult = keys.has('shift') ? 1.7 : 1.0;

    // Normalize input direction
    const len = Math.sqrt(inputX * inputX + inputZ * inputZ);
    const isWalking = len > 0.01;
    if (isWalking) {
      inputX = (inputX / len) * MOVE_SPEED * speedMult;
      inputZ = (inputZ / len) * MOVE_SPEED * speedMult;
    }

    // ─── Velocity-based movement with momentum + air control ───
    // Ground = slightly slidy (you keep some momentum), air = floaty.
    // 0.28 gives responsive but not instant-stop movement.
    const accelLerp = isGrounded.current ? 0.28 : 0.12;
    const t = 1 - Math.exp(-accelLerp * 30 * dt); // frame-rate independent
    playerVelX.current += (inputX - playerVelX.current) * t;
    playerVelZ.current += (inputZ - playerVelZ.current) * t;

    // Character rotation toward movement
    if (isWalking) {
      const targetRot = Math.atan2(playerVelX.current, playerVelZ.current);
      playerRot.current = lerpAngle(playerRot.current, targetRot, 0.18);
      walkPhase.current += dt * 10 * speedMult;
    } else {
      // Decay walk phase quickly when stopped — combined with the amplitude
      // ramp-down in CharacterPartsRenderer, this gives a smooth stop.
      if (Math.abs(walkPhase.current) < 0.05) walkPhase.current = 0;
      else walkPhase.current *= 0.5; // fast decay so limbs settle quickly
    }

    // ─── Jump (coyote time + jump buffer) ───
    const canJump = isGrounded.current || coyoteTimer.current > 0;
    if (jumpBufferTimer.current > 0 && canJump) {
      playerVelY.current = JUMP_FORCE;
      isGrounded.current = false;
      isJumping.current = true;
      coyoteTimer.current = 0;
      jumpBufferTimer.current = 0;
      squashRef.current = animationsEnabled ? 1.25 : 1; // stretch up on jump
      playSound('jump', 0.4);
    }

    // ─── Gravity ───
    prevVelYRef.current = playerVelY.current;
    playerVelY.current += GRAVITY;

    // ─── Slope sliding (steep slopes push you downhill) ───
    let slopeSlideX = 0, slopeSlideZ = 0;
    // (Will be set after physics resolves — see below)

    // ─── Build collision parts (anchored + physics-synced unanchored + trees) ───
    const collisionParts = buildCollisionParts();

    // ─── Resolve physics against parts + trees ───
    const result = resolvePhysicsV2(
      playerPos.current,
      playerVelX.current,
      playerVelY.current,
      playerVelZ.current,
      collisionParts,
      wasGroundedRef.current,
      prevVelYRef.current,
    );

    playerPos.current = result.newPos;
    playerVelY.current = result.velY;
    let grounded = result.grounded;
    let landedHard = result.landedHard;
    let impactSpeed = result.impactSpeed;

    // ─── Wall slide: zero velocity in blocked direction ───
    // Only zero the component that's moving INTO the wall, not the full
    // velocity. This prevents the character from "sticking" to walls while
    // preserving smooth sliding. We also DON'T zero if the velocity is
    // already very small — this prevents micro-jitter from the wall check
    // flipping on/off at the boundary.
    if (result.blockedX && Math.abs(playerVelX.current) > 0.005) playerVelX.current = 0;
    if (result.blockedZ && Math.abs(playerVelZ.current) > 0.005) playerVelZ.current = 0;

    // ─── Terrain collision ───
    // The terrain is a heightmap, not a box. We sample the terrain surface
    // height at the player's XZ position. If the player is at or below the
    // terrain surface, we snap them up onto it (they're standing on terrain).
    const terrainH = getTerrainHeightAt(playerPos.current[0], playerPos.current[2]);
    if (terrainH !== null) {
      if (playerVelY.current <= 0 && playerPos.current[1] <= terrainH) {
        // Player is at or below terrain surface → land on it
        const wasAirborne = !wasGroundedRef.current;
        if (wasAirborne && prevVelYRef.current < -0.3) {
          landedHard = true;
          impactSpeed = Math.abs(prevVelYRef.current);
        }
        playerPos.current[1] = terrainH;
        playerVelY.current = 0;
        grounded = true;
      } else if (grounded && playerPos.current[1] - terrainH <= GROUND_SKIN && playerPos.current[1] >= terrainH - 0.5) {
        // Ground snap — keep player glued to terrain surface when walking
        playerPos.current[1] = terrainH;
        playerVelY.current = 0;
      }
    }

    const justLanded = !wasGroundedRef.current && grounded;
    wasGroundedRef.current = grounded;
    isGrounded.current = grounded;
    isJumping.current = !grounded && playerVelY.current > 0;

    // ─── Fire WeildCode when_touched on character parts ───
    if (grounded || justLanded) {
      const studioState = useStudioStore.getState();
      studioState.objects.forEach((obj) => {
        if (isPart(obj) && obj.isCharacterPart) {
          weildCodeEngine.handleTouch(obj.id, 'any');
        }
      });
    }

    // ─── Landing feedback ───
    if (justLanded) {
      if (landedHard) {
        shakeAmount.current = animationsEnabled ? Math.min(1, impactSpeed * 2) : 0;
        squashRef.current = animationsEnabled ? 0.75 : 1; // squash on hard land
      } else {
        squashRef.current = animationsEnabled ? 0.9 : 1; // gentle squash on soft land
      }
    }

    // ─── Slope sliding (apply AFTER physics, affects next frame's velocity) ───
    const SLOPE_SLIDE_THRESHOLD = 0.7; // ~40°
    if (result.grounded && result.slopeAngle > SLOPE_SLIDE_THRESHOLD) {
      const slideForce = (result.slopeAngle - SLOPE_SLIDE_THRESHOLD) * 0.08;
      slopeSlideX = result.slopeDirX * slideForce;
      slopeSlideZ = result.slopeDirZ * slideForce;
      playerVelX.current += slopeSlideX;
      playerVelZ.current += slopeSlideZ;
    }

    // ─── Fall off world ───
    if (playerPos.current[1] < -50) {
      playerPos.current = [...spawnPosition];
      playerVelX.current = 0;
      playerVelY.current = 0;
      playerVelZ.current = 0;
    }

    // ─── Footstep sounds ───
    if (isGrounded.current && isWalking) {
      const now = performance.now();
      const interval = isSprinting ? 280 : 400;
      if (now - lastFootstepTime.current > interval) {
        lastFootstepTime.current = now;
        playSound('walk', 0.15);
      }
    }

    // ─── Squash & stretch spring back to 1 ───
    squashRef.current += (1 - squashRef.current) * (1 - Math.exp(-12 * dt));

    // ─── Update character visual ───
    if (groupRef.current) {
      groupRef.current.position.set(playerPos.current[0], playerPos.current[1], playerPos.current[2]);
      groupRef.current.rotation.y = playerRot.current;
      // Squash & stretch (volume-preserving: y = squash, x/z = 2 - squash)
      const s = squashRef.current;
      groupRef.current.scale.set(2 - s, s, 2 - s);
      // Hide character in first person
      characterVisibleRef.current = firstPersonRef.current ? false : true;
      groupRef.current.visible = characterVisibleRef.current;
    }

    // ─── Broadcast position (throttled ~15Hz) ───
    const now = performance.now();
    if (onPositionUpdate && now - lastPositionBroadcast.current > 66) {
      lastPositionBroadcast.current = now;
      onPositionUpdate(playerPos.current, playerRot.current);
    }

    // ═══════════════════════════════════════════════════════════════
    // CAMERA — spring-damper follow + collision + shake + FOV kick
    // ═══════════════════════════════════════════════════════════════

    // Blend first-person toggle
    const fpTarget = firstPersonRef.current ? 1 : 0;
    fpBlendRef.current += (fpTarget - fpBlendRef.current) * (1 - Math.exp(-10 * dt));

    // Character center (look target)
    const charX = playerPos.current[0];
    const charY = playerPos.current[1] + 1.2; // waist height
    const charZ = playerPos.current[2];

    // Smooth zoom (spring toward target distance)
    cameraDist.current += (cameraDistTarget.current - cameraDist.current) * (1 - Math.exp(-10 * dt));

    // Compute desired camera position (third person)
    const sinYaw = Math.sin(cameraYaw.current);
    const cosYaw = Math.cos(cameraYaw.current);
    const cosPitch = Math.cos(cameraPitch.current);
    const sinPitch = Math.sin(cameraPitch.current);
    const thirdDist = cameraDist.current;

    // First-person: camera at head, looking forward
    const headY = playerPos.current[1] + PLAYER_HEIGHT - 0.2;
    const fpForwardX = -sinYaw * cosPitch;
    const fpForwardY = sinPitch;
    const fpForwardZ = -cosYaw * cosPitch;

    // Desired cam pos (blended)
    const tpX = charX + thirdDist * sinYaw * cosPitch;
    const tpY = charY + thirdDist * sinPitch;
    const tpZ = charZ + thirdDist * cosYaw * cosPitch;

    const fpX = charX + fpForwardX * 0.3;
    const fpY = headY + fpForwardY * 0.3;
    const fpZ = charZ + fpForwardZ * 0.3;

    const blend = fpBlendRef.current;
    const desiredX = tpX * (1 - blend) + fpX * blend;
    const desiredY = tpY * (1 - blend) + fpY * blend;
    const desiredZ = tpZ * (1 - blend) + fpZ * blend;

    _desiredCamPos.current.set(desiredX, desiredY, desiredZ);

    // ─── Camera collision (raycast from character to desired cam pos) ───
    if (blend < 0.5) { // only in third person
      const fromX = charX, fromY = charY, fromZ = charZ;
      const dx = desiredX - fromX;
      const dy = desiredY - fromY;
      const dz = desiredZ - fromZ;
      const distToDesired = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distToDesired > 0.01) {
        const ndx = dx / distToDesired;
        const ndy = dy / distToDesired;
        const ndz = dz / distToDesired;
        let hitDist = distToDesired;
        for (const part of collisionParts) {
          const { px, py, pz, hw, hh, hd } = part;
          // Skip the part the player is standing on (otherwise camera snaps to ground)
          if (Math.abs(px - charX) < hw + 1 && Math.abs(pz - charZ) < hd + 1 &&
              py + hh <= charY + 0.5) continue;
          const t = rayVsAABB(
            fromX, fromY, fromZ, ndx, ndy, ndz,
            px - hw, py - hh, pz - hd,
            px + hw, py + hh, pz + hd,
          );
          if (t !== null && t < hitDist && t > 0.5) hitDist = t;
        }
        // Pull camera in if something blocks it (with 0.3 padding)
        const safeDist = Math.max(0.5, hitDist - 0.3);
        if (safeDist < distToDesired) {
          _desiredCamPos.current.set(
            fromX + ndx * safeDist,
            fromY + ndy * safeDist,
            fromZ + ndz * safeDist,
          );
        }
      }
    }

    // ─── Spring-damper toward desired position (smooth, no jitter) ───
    const springT = 1 - Math.exp(-18 * dt);
    camPosRef.current.lerp(_desiredCamPos.current, springT);

    // ─── Look target (blend third-person look at char, first-person look forward) ───
    const tpLookY = charY;
    const fpLookX = charX + fpForwardX * 5;
    const fpLookY = headY + fpForwardY * 5;
    const fpLookZ = charZ + fpForwardZ * 5;
    _desiredLook.current.set(
      charX * (1 - blend) + fpLookX * blend,
      tpLookY * (1 - blend) + fpLookY * blend,
      charZ * (1 - blend) + fpLookZ * blend,
    );
    camLookRef.current.lerp(_desiredLook.current, 1 - Math.exp(-20 * dt));

    // ─── Head bob in first person ───
    let bobX = 0, bobY = 0;
    if (animationsEnabled && blend > 0.1 && isWalking && isGrounded.current) {
      const bobPhase = walkPhase.current * 0.5;
      bobX = Math.cos(bobPhase) * 0.03;
      bobY = Math.abs(Math.sin(bobPhase)) * 0.05;
    }

    // ─── Camera shake (decays exponentially) ───
    if (shakeAmount.current > 0.01) {
      const sx = (Math.random() - 0.5) * shakeAmount.current * 0.3;
      const sy = (Math.random() - 0.5) * shakeAmount.current * 0.3;
      const sz = (Math.random() - 0.5) * shakeAmount.current * 0.3;
      _shake.current.set(sx, sy, sz);
      shakeAmount.current *= Math.exp(-6 * dt);
    } else {
      _shake.current.set(0, 0, 0);
    }

    // ─── Apply to camera ───
    camera.position.set(
      camPosRef.current.x + _shake.current.x + bobX,
      camPosRef.current.y + _shake.current.y + bobY,
      camPosRef.current.z + _shake.current.z,
    );
    camera.lookAt(
      camLookRef.current.x + _shake.current.x * 0.3,
      camLookRef.current.y + _shake.current.y * 0.3,
      camLookRef.current.z + _shake.current.z * 0.3,
    );

    // ─── FOV kick on sprint ───
    const targetFOV = animationsEnabled && keys.has('shift') && isWalking ? 65 : 50;
    currentFOVRef.current += (targetFOV - currentFOVRef.current) * (1 - Math.exp(-6 * dt));
    if ((camera as THREE.PerspectiveCamera).fov !== currentFOVRef.current) {
      (camera as THREE.PerspectiveCamera).fov = currentFOVRef.current;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  });

  return (
    <group ref={groupRef}>
      <CharacterPartsRenderer
        position={[0, 0, 0]}
        rotationY={0}
        walkPhaseRef={walkPhase}
        isJumpingRef={isJumping}
        playMode={true}
      />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Remote players (multiplayer)
// ═══════════════════════════════════════════════════════════════════

function RemotePlayers({
  players,
  chatBubbles,
}: {
  players: RemotePlayerData[];
  chatBubbles: Record<string, string>;
}) {
  return (
    <>
      {players.map((p) => (
        <RemotePlayerCharacter key={p.socketId} player={p} chatBubble={chatBubbles[p.socketId]} />
      ))}
    </>
  );
}

function RemotePlayerCharacter({
  player,
  chatBubble,
}: {
  player: RemotePlayerData;
  chatBubble?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const walkPhaseRef = useRef(0);
  const prevPosRef = useRef<[number, number, number]>(player.position);

  useFrame((_, delta) => {
    const prev = prevPosRef.current;
    const cur = player.position;
    const dx = cur[0] - prev[0];
    const dz = cur[2] - prev[2];
    const moving = Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001;
    if (moving) walkPhaseRef.current += delta * 8;
    else walkPhaseRef.current *= 0.9;
    prevPosRef.current = [...cur] as [number, number, number];
  });

  return (
    <group position={player.position} rotation={[0, player.rotation[1] || 0, 0]}>
      <WeildBuildCharacter
        avatar={player.avatar || DEFAULT_AVATAR}
        animate
        walkPhaseRef={walkPhaseRef}
        isJumpingRef={{ current: false }}
      />
      <Html position={[0, 2.4, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {player.username}
        </div>
      </Html>
      {chatBubble && (
        <Html position={[0, 3.0, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.95)',
              color: '#000',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '13px',
              maxWidth: '200px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {chatBubble}
          </div>
        </Html>
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Play Scene
// ═══════════════════════════════════════════════════════════════════

function PlayScene({
  onPositionUpdate,
  remotePlayers,
  chatBubbles,
  cameraZoomOverride,
  onCameraZoomChange,
  spawnPosition,
  animationsEnabled,
}: {
  onPositionUpdate?: (pos: [number, number, number], rot: number) => void;
  remotePlayers: RemotePlayerData[];
  chatBubbles: Record<string, string>;
  cameraZoomOverride?: number;
  onCameraZoomChange?: (z: number) => void;
  spawnPosition: [number, number, number];
  animationsEnabled: boolean;
}) {
  const objects = useStudioStore((s) => s.objects);

  const parts = useMemo(() => {
    const result: Array<{ id: string }> = [];
    objects.forEach((obj) => {
      if (!isPart(obj)) return;
      // Character parts are rendered by CharacterPartsRenderer, NOT here.
      // If we don't filter them, they appear as a "ghost character" at origin.
      if (obj.isCharacterPart) return;
      // Hidden parts (showInWorld=false) don't render in play mode
      if (obj.showInWorld === false) return;
      result.push({ id: obj.id });
    });
    return result;
  }, [objects]);

  return (
    <>
      <SkySystem />

      <group>
        {parts.map((p) => (
          <PartMesh key={p.id} partId={p.id} isSelected={false} isGroupModeHighlighted={false} />
        ))}
      </group>

      <TerrainMesh />

      {/* Physics for unanchored parts, joints, bodyMovers, explosions */}
      <PhysicsSimulation orbitControlsRef={{ current: null } as any} />

      {/* Local player character + camera (polished controller) */}
      <GamePlayerCharacter
        onPositionUpdate={onPositionUpdate}
        cameraZoomOverride={cameraZoomOverride}
        onCameraZoomChange={onCameraZoomChange}
        spawnPosition={spawnPosition}
        animationsEnabled={animationsEnabled}
      />

      <RemotePlayers players={remotePlayers} chatBubbles={chatBubbles} />

      <JointVisualizer />
      <ExplosionVisuals />
      <NameLabels />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main export
// ═══════════════════════════════════════════════════════════════════

export interface StudioPlayViewportProps {
  onPositionUpdate?: (pos: [number, number, number], rot: number) => void;
  remotePlayers?: RemotePlayerData[];
  chatBubbles?: Record<string, string>;
  cameraZoomOverride?: number;
  onCameraZoomChange?: (z: number) => void;
  onHPChange?: (hp: number, max: number) => void;
  gameVolume?: number;
  spawnPosition?: [number, number, number];
  /** When false, disables camera shake, squash & stretch, FOV kick, head bob. */
  animationsEnabled?: boolean;
}

export function StudioPlayViewport({
  onPositionUpdate,
  remotePlayers = [],
  chatBubbles = {},
  cameraZoomOverride,
  onCameraZoomChange,
  onHPChange,
  gameVolume,
  spawnPosition = [0, 3, 0],
  animationsEnabled = true,
}: StudioPlayViewportProps) {
  useEffect(() => {
    if (onHPChange) onHPChange(100, 100);
  }, [onHPChange]);

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ position: [10, 8, 12], fov: 50, near: 0.01, far: 100000 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#87CEEB'));
        }}
      >
        <PlayScene
          onPositionUpdate={onPositionUpdate}
          remotePlayers={remotePlayers}
          chatBubbles={chatBubbles}
          cameraZoomOverride={cameraZoomOverride}
          onCameraZoomChange={onCameraZoomChange}
          spawnPosition={spawnPosition}
          animationsEnabled={animationsEnabled}
        />
      </Canvas>
      <ScreenMessageOverlay />
    </div>
  );
}

// Re-export MobileControls from GameWorld for backwards compat
export { MobileControls } from '@/components/app/GameWorld';
