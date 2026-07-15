/**
 * WeildBuild Physics Engine — cannon-es backend
 *
 * Replaces the custom physics with cannon-es for proper collision handling.
 * External API stays identical so Viewport3D doesn't need changes.
 *
 * Features:
 * - cannon-es World with gravity
 * - Per-part properties: Friction, Elasticity, Mass, Anchored, CanCollide
 * - BodyMovers: BodyForce, BodyVelocity, BodyGyro, BodyPosition, BodyThrust, BodyAngularVelocity
 * - Collision groups: canCollide=false bodies use separate group that doesn't interact
 * - Spawn parts (canCollide: false) don't create physics bodies
 * - CharacterController with cannon-es raycasting for ground detection
 */

import * as CANNON from 'cannon-es';
import { StudioPart, BodyMover, Joint, PhysicsSettings, PartType } from '../studio-store';
import { getMaterialProps, calculateMass, combinedFriction, combinedElasticity } from './materials';
import type { TerrainHeightmap } from '../terrain-v2';
import type { TreeInstance, TreeBlock } from '../terrain-v2';
import { generateTreeBlocks } from '../terrain-v2';

// ─── Constants ───

export const GRAVITY = -9.81;
export const DEFAULT_CHARACTER_SPEED = 4.5;
export const DEFAULT_JUMP_FORCE = 7.0;
export const WATER_DRAG = 2.0;
export const AIR_DRAG = 0.01;
export const MAX_VELOCITY = 1000;
export const SLEEP_VELOCITY_THRESHOLD = 0.1;
export const EXPLOSION_IMPULSE_DURATION = 0.15;

// ─── Collision Groups ───
// Group 1: collidable parts (default)
// Group 2: non-collidable parts (sensors, spawn markers) — don't interact with anything
const GROUP_COLLIDABLE = 1;
const GROUP_NON_COLLIDABLE = 2;
const MASK_COLLIDABLE = -1; // interacts with everything
const MASK_NON_COLLIDABLE = 0; // interacts with nothing

// ─── Helper Functions ───

function signedClamp(value: number, maxAbs: number): number {
  if (Math.abs(value) > maxAbs) return Math.sign(value) * maxAbs;
  return value;
}

function effectiveMass(mass: number): number {
  return Math.max(mass, 0.01);
}

// ─── Physics Body (mirrors old interface) ───

export interface AABB {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
}

export interface PhysicsBody {
  id: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  angularVelocity: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  mass: number;
  anchored: boolean;
  canCollide: boolean;
  friction: number;
  elasticity: number;
  isGrounded: boolean;
  isAwake: boolean;
  isInWater: boolean;
  bodyMovers: BodyMover[];
  partType: PartType;
  _impulses: Array<{ force: { x: number; y: number; z: number }; timeLeft: number; applied: boolean }>;
}

// ─── Character State ───

export interface CharacterState {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  isGrounded: boolean;
  isInWater: boolean;
  health: number;
}

// ─── Character Input ───

export interface CharacterInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
}

// ─── Collision Result ───

export interface CollisionResult {
  resolved: boolean;
  normal: { x: number; y: number; z: number };
  penetration: number;
  contactPoint?: { x: number; y: number; z: number };
}

// ─── Character Controller ───

export class CharacterController {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  isGrounded: boolean = false;
  rotationY: number = 0;

  readonly capsuleRadius: number = 0.4;
  readonly capsuleHeight: number = 2.0;
  readonly walkSpeed: number = DEFAULT_CHARACTER_SPEED;
  readonly jumpVelocity: number = DEFAULT_JUMP_FORCE;
  readonly gravity: number = GRAVITY;

  private wasJumpPressed: boolean = false;

  constructor(spawnPosition: { x: number; y: number; z: number }) {
    this.position = { ...spawnPosition };
    this.velocity = { x: 0, y: 0, z: 0 };
  }

  /**
   * Step the character controller forward by deltaTime.
   * Uses simple collision resolution against PhysicsBody list.
   */
  step(dt: number, input: CharacterInput, bodies: PhysicsBody[]): void {
    // 1. Compute desired movement direction in XZ
    let moveX = 0;
    let moveZ = 0;
    if (input.forward) moveZ -= 1;
    if (input.backward) moveZ += 1;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;

    const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveLen > 0.001) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    const desiredVX = moveX * this.walkSpeed;
    const desiredVZ = moveZ * this.walkSpeed;

    if (moveLen > 0.001) {
      this.rotationY = Math.atan2(moveX, moveZ);
    }

    // 2. Apply horizontal velocity
    this.velocity.x = desiredVX;
    this.velocity.z = desiredVZ;

    // 3. Apply gravity
    this.velocity.y += this.gravity * dt;

    // 4. Handle jump
    if (input.jump && this.isGrounded && !this.wasJumpPressed) {
      this.velocity.y = this.jumpVelocity;
      this.isGrounded = false;
    }
    this.wasJumpPressed = input.jump;

    // 5. Integrate position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // 6. Collision detection & resolution
    this.isGrounded = false;

    // NOTE: No hardcoded ground plane at y=0 — the character is grounded only
    // when standing on an actual part (baseplate, terrain block, or other part).
    // If there is no baseplate, the character falls into the void.

    // Collide against all physics bodies
    const charCenterY = this.position.y + this.capsuleHeight / 2;

    for (const body of bodies) {
      if (!body.canCollide) continue;
      this.resolveCharacterBodyCollision(body, charCenterY);
    }

    // 7. Terminal velocity clamp
    if (this.velocity.y < -50) this.velocity.y = -50;
    if (this.velocity.y > 50) this.velocity.y = 50;
  }

  private resolveCharacterBodyCollision(body: PhysicsBody, charCenterY: number): void {
    const charHalfW = this.capsuleRadius;
    const charHalfH = this.capsuleHeight / 2;

    const charAABB: AABB = {
      minX: this.position.x - charHalfW,
      minY: this.position.y,
      minZ: this.position.z - charHalfW,
      maxX: this.position.x + charHalfW,
      maxY: this.position.y + this.capsuleHeight,
      maxZ: this.position.z + charHalfW,
    };
    const bodyAABB = computeAABB(body.position, body.size);

    if (!aabbOverlap(charAABB, bodyAABB)) return;

    // Compute MTV for AABB-AABB
    const overlapX1 = charAABB.maxX - bodyAABB.minX;
    const overlapX2 = bodyAABB.maxX - charAABB.minX;
    const overlapY1 = charAABB.maxY - bodyAABB.minY;
    const overlapY2 = bodyAABB.maxY - charAABB.minY;
    const overlapZ1 = charAABB.maxZ - bodyAABB.minZ;
    const overlapZ2 = bodyAABB.maxZ - charAABB.minZ;

    const minOX = Math.min(overlapX1, overlapX2);
    const minOY = Math.min(overlapY1, overlapY2);
    const minOZ = Math.min(overlapZ1, overlapZ2);

    const bodyTopY = body.position.y + body.size.y / 2;
    const charBottomY = this.position.y;

    const isFloorCollision = charBottomY >= bodyTopY - 0.15 && minOY <= minOX && minOY <= minOZ;
    const isWallCollision = minOY > minOX || minOY > minOZ;

    if (isFloorCollision) {
      // Floor collision: resolve upward and mark grounded
      const overlap = minOY;
      if (overlapY2 < overlapY1) {
        // Character is above — push up
        this.position.y += overlap;
        if (this.velocity.y < 0) this.velocity.y = 0;
        this.isGrounded = true;
      } else {
        // Character is below — push down
        this.position.y -= overlap;
        if (this.velocity.y > 0) this.velocity.y = 0;
      }
    } else if (isWallCollision) {
      // Wall/side collision: resolve in XZ only
      if (minOX <= minOZ) {
        const overlap = minOX;
        if (overlapX1 < overlapX2) {
          this.position.x -= overlap;
        } else {
          this.position.x += overlap;
        }
        // Kill horizontal velocity into the wall
        const dir = overlapX1 < overlapX2 ? -1 : 1;
        if (Math.sign(this.velocity.x) === -dir) this.velocity.x = 0;
      } else {
        const overlap = minOZ;
        if (overlapZ1 < overlapZ2) {
          this.position.z -= overlap;
        } else {
          this.position.z += overlap;
        }
        const dir = overlapZ1 < overlapZ2 ? -1 : 1;
        if (Math.sign(this.velocity.z) === -dir) this.velocity.z = 0;
      }
    } else {
      // Diagonal / ceiling — resolve along minimum overlap axis
      if (minOY <= minOX && minOY <= minOZ) {
        const overlap = minOY;
        if (overlapY2 < overlapY1) {
          this.position.y += overlap;
          if (this.velocity.y < 0) this.velocity.y = 0;
          this.isGrounded = true;
        } else {
          this.position.y -= overlap;
          if (this.velocity.y > 0) this.velocity.y = 0;
        }
      } else if (minOX <= minOZ) {
        const overlap = minOX;
        this.position.x += overlapX1 < overlapX2 ? -overlap : overlap;
      } else {
        const overlap = minOZ;
        this.position.z += overlapZ1 < overlapZ2 ? -overlap : overlap;
      }
    }
  }
}

// ─── Physics World (cannon-es backend) ───

export class PhysicsWorld {
  bodies: Map<string, PhysicsBody> = new Map();
  joints: Joint[] = [];
  settings: PhysicsSettings;

  // cannon-es internals
  private world: CANNON.World;
  private cannonBodies: Map<string, CANNON.Body> = new Map();
  private cannonMaterials: Map<string, CANNON.Material> = new Map();

  constructor(settings: PhysicsSettings) {
    this.settings = settings;

    // Create cannon-es world
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, settings.gravity, 0),
    });
    this.world.broadphase = new CANNON.NaiveBroadphase();
    (this.world.solver as CANNON.GSSolver).iterations = 10;
    this.world.allowSleep = true;

    // Default contact material
    const defaultMaterial = new CANNON.Material('default');
    this.cannonMaterials.set('default', defaultMaterial);
    this.world.defaultContactMaterial = new CANNON.ContactMaterial(
      defaultMaterial, defaultMaterial,
      { friction: 0.5, restitution: 0.2 }
    );

    // NOTE: No ground plane at y=0 — the ground is defined by the baseplate part
    // (added via addBody when isBaseplate=true) and/or terrain. If there is no
    // baseplate, objects fall into the void, which is the correct behavior.
  }

  // ─── Body Management ───

  addBody(part: StudioPart): PhysicsBody {
    // Skip parts that can't collide — but spawn points ARE collidable now
    // (they're real parts, not visual-only markers).
    if (!part.canCollide) {
      // Still create a PhysicsBody entry for tracking, but no cannon body
      const mass = calculateMass(part.type, part.size, part.material, part.density);
      const material = getMaterialProps(part.material);
      const body: PhysicsBody = {
        id: part.id,
        position: { ...part.position },
        velocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        size: { ...part.size },
        rotation: { ...part.rotation },
        mass,
        anchored: part.anchored,
        canCollide: part.canCollide,
        friction: part.friction ?? material.friction,
        elasticity: part.elasticity ?? material.elasticity,
        isGrounded: false,
        isAwake: true,
        isInWater: false,
        bodyMovers: [...(part.bodyMovers || [])],
        partType: part.type,
        _impulses: [],
      };
      this.bodies.set(part.id, body);
      return body;
    }

    const mass = calculateMass(part.type, part.size, part.material, part.density);
    const material = getMaterialProps(part.material);
    const isAnchored = part.anchored;
    const cannonMass = isAnchored ? 0 : effectiveMass(mass);

    // Create cannon shape based on part type
    let shape: CANNON.Shape;
    switch (part.type) {
      case 'Sphere': {
        const radius = Math.max(part.size.x, part.size.y, part.size.z) / 2;
        shape = new CANNON.Sphere(Math.max(radius, 0.01));
        break;
      }
      case 'Cylinder': {
        const cylRadius = Math.max(part.size.x, part.size.z) / 2;
        const cylHeight = part.size.y;
        shape = new CANNON.Cylinder(Math.max(cylRadius, 0.01), Math.max(cylRadius, 0.01), Math.max(cylHeight, 0.01), 12);
        break;
      }
      default: {
        // Block, Wedge, Spawn — use Box shape
        shape = new CANNON.Box(new CANNON.Vec3(
          Math.max(part.size.x / 2, 0.005),
          Math.max(part.size.y / 2, 0.005),
          Math.max(part.size.z / 2, 0.005)
        ));
        break;
      }
    }

    // Create or get cannon material for this part's friction/elasticity
    const friction = part.friction ?? material.friction;
    const restitution = part.elasticity ?? material.elasticity;
    const matKey = `f${friction.toFixed(2)}_r${restitution.toFixed(2)}`;
    let cannonMat = this.cannonMaterials.get(matKey);
    if (!cannonMat) {
      cannonMat = new CANNON.Material(matKey);
      this.cannonMaterials.set(matKey, cannonMat);

      // Create contact material with the default material
      const defaultMat = this.cannonMaterials.get('default')!;
      this.world.addContactMaterial(new CANNON.ContactMaterial(
        defaultMat, cannonMat,
        { friction, restitution }
      ));
      // Also create contact material with itself
      this.world.addContactMaterial(new CANNON.ContactMaterial(
        cannonMat, cannonMat,
        { friction: combinedFriction(friction, friction), restitution: combinedElasticity(restitution, restitution) }
      ));
    }

    // Create cannon body
    const cannonBody = new CANNON.Body({
      mass: cannonMass,
      shape,
      position: new CANNON.Vec3(part.position.x, part.position.y, part.position.z),
      material: cannonMat,
      collisionFilterGroup: part.canCollide ? GROUP_COLLIDABLE : GROUP_NON_COLLIDABLE,
      collisionFilterMask: part.canCollide ? MASK_COLLIDABLE : MASK_NON_COLLIDABLE,
      linearDamping: 0.01,
      angularDamping: 0.1,
    });

    // Apply rotation if present
    if (part.rotation.x !== 0 || part.rotation.y !== 0 || part.rotation.z !== 0) {
      const euler = new CANNON.Vec3(
        part.rotation.x * Math.PI / 180,
        part.rotation.y * Math.PI / 180,
        part.rotation.z * Math.PI / 180
      );
      cannonBody.quaternion.setFromEuler(euler.x, euler.y, euler.z);
    }

    // For anchored parts with mass > 0, set to kinematic so they can be moved
    if (isAnchored && cannonMass > 0) {
      cannonBody.type = CANNON.Body.KINEMATIC;
    }

    this.world.addBody(cannonBody);
    this.cannonBodies.set(part.id, cannonBody);

    // Create the PhysicsBody entry for external tracking
    const body: PhysicsBody = {
      id: part.id,
      position: { ...part.position },
      velocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      size: { ...part.size },
      rotation: { ...part.rotation },
      mass,
      anchored: isAnchored,
      canCollide: part.canCollide,
      friction,
      elasticity: restitution,
      isGrounded: false,
      isAwake: true,
      isInWater: false,
      bodyMovers: [...(part.bodyMovers || [])],
      partType: part.type,
      _impulses: [],
    };
    this.bodies.set(part.id, body);
    return body;
  }

  removeBody(id: string) {
    const cannonBody = this.cannonBodies.get(id);
    if (cannonBody) {
      this.world.removeBody(cannonBody);
      this.cannonBodies.delete(id);
    }
    this.bodies.delete(id);
    this.joints = this.joints.filter(j => j.partAId !== id && j.partBId !== id);
  }

  // ─── Terrain & Tree Collision ───

  /**
   * Add the terrain heightmap as a collidable surface.
   * Uses cannon-es Heightfield shape so unanchored parts fall, bounce,
   * and rest on the terrain just like on any other part.
   *
   * The heightfield is positioned so its center aligns with world origin,
   * matching how the terrain renderer positions the mesh.
   */
  addTerrain(heightmap: TerrainHeightmap) {
    const { width, length, cellSize, heights } = heightmap;

    // cannon-es Heightfield expects data[xi][yi] = height at that cell.
    // Our heightmap stores heights as heights[x * length + z].
    const data: number[][] = [];
    for (let x = 0; x < width; x++) {
      const row: number[] = [];
      for (let z = 0; z < length; z++) {
        row.push(heights[x * length + z]);
      }
      data.push(row);
    }

    const heightfieldShape = new CANNON.Heightfield(data, {
      elementSize: cellSize,
    });

    const terrainBody = new CANNON.Body({
      mass: 0, // static — terrain doesn't move
      shape: heightfieldShape,
    });

    // Position: the heightfield's local origin is at the corner of the grid.
    // We need to offset it so the terrain center is at world origin.
    // The terrain spans from -halfW to +halfW in X, -halfL to +halfL in Z.
    const halfW = (width * cellSize) / 2;
    const halfL = (length * cellSize) / 2;
    terrainBody.position.set(-halfW, 0, -halfL);

    this.world.addBody(terrainBody);
  }

  /**
   * Add tree blocks as static collidable boxes.
   * Each tree is decomposed into its constituent blocks (trunk + leaves),
   * and each block becomes a static cannon Body. This lets parts rest on
   * tree branches, bounce off trunks, etc.
   */
  addTreeBlocks(blocks: TreeBlock[]) {
    const defaultMat = this.cannonMaterials.get('default')!;
    for (const block of blocks) {
      const shape = new CANNON.Box(new CANNON.Vec3(
        Math.max(block.size.x / 2, 0.005),
        Math.max(block.size.y / 2, 0.005),
        Math.max(block.size.z / 2, 0.005),
      ));
      const body = new CANNON.Body({
        mass: 0, // static — trees don't move
        shape,
        material: defaultMat,
      });
      body.position.set(block.position.x, block.position.y, block.position.z);
      this.world.addBody(body);
    }
  }

  /**
   * Add all trees from the studio store. Generates blocks for each tree
   * and calls addTreeBlocks. This is a convenience method.
   */
  addTrees(trees: TreeInstance[]) {
    for (const tree of trees) {
      const blocks = generateTreeBlocks(tree);
      this.addTreeBlocks(blocks);
    }
  }

  syncFromPart(part: StudioPart) {
    const body = this.bodies.get(part.id);
    const cannonBody = this.cannonBodies.get(part.id);
    if (!body) return;

    const mass = calculateMass(part.type, part.size, part.material, part.density);
    const material = getMaterialProps(part.material);

    body.position = { ...part.position };
    body.size = { ...part.size };
    body.rotation = { ...part.rotation };
    body.anchored = part.anchored;
    body.canCollide = part.canCollide;
    body.friction = part.friction ?? material.friction;
    body.elasticity = part.elasticity ?? material.elasticity;
    body.mass = mass;
    body.bodyMovers = [...(part.bodyMovers || [])];

    // Sync to cannon body if it exists
    if (cannonBody) {
      cannonBody.position.set(part.position.x, part.position.y, part.position.z);
      if (part.rotation.x !== 0 || part.rotation.y !== 0 || part.rotation.z !== 0) {
        cannonBody.quaternion.setFromEuler(
          part.rotation.x * Math.PI / 180,
          part.rotation.y * Math.PI / 180,
          part.rotation.z * Math.PI / 180
        );
      } else {
        cannonBody.quaternion.set(0, 0, 0, 1);
      }
      cannonBody.wakeUp();
    }

    if (!body.anchored) {
      body.isAwake = true;
    }
  }

  syncToPart(part: StudioPart): StudioPart {
    const body = this.bodies.get(part.id);
    if (!body) return part;

    return {
      ...part,
      position: { ...body.position },
      rotation: { ...body.rotation },
    };
  }

  // ─── Simulation Step ───

  step(deltaTime: number): void {
    if (isNaN(deltaTime) || !isFinite(deltaTime)) return;

    const dt = Math.min(deltaTime, 1 / 30);

    // 1. Apply body movers and impulses to cannon bodies
    this.applyBodyMoversAndImpulses(dt);

    // 2. Update gravity from settings (may have changed)
    this.world.gravity.set(0, this.settings.gravity, 0);

    // 3. Step the cannon-es world
    this.world.step(1 / 60, dt, 3);

    // 4. Sync cannon body positions back to PhysicsBody entries
    this.syncCannonToPhysicsBodies();

    // 5. Check water state
    this.checkWaterState();

    // 6. Apply drag
    this.applyDrag(dt);

    // 7. Cap velocities
    this.capVelocities();

    // 8. Tick impulses
    this.tickImpulses(dt);
  }

  // ─── Body Movers & Impulses ───

  private applyBodyMoversAndImpulses(dt: number): void {
    for (const body of this.bodies.values()) {
      if (body.anchored) continue;

      const cannonBody = this.cannonBodies.get(body.id);

      // Apply body movers
      for (const mover of body.bodyMovers) {
        if (!mover.enabled) continue;
        this.applyBodyMover(body, mover, dt, cannonBody);
      }

      // Apply impulses
      const effMass = effectiveMass(body.mass);
      for (const impulse of body._impulses) {
        if (!impulse.applied) {
          if (cannonBody) {
            cannonBody.applyImpulse(
              new CANNON.Vec3(impulse.force.x, impulse.force.y, impulse.force.z)
            );
          } else {
            body.velocity.x += impulse.force.x / effMass;
            body.velocity.y += impulse.force.y / effMass;
            body.velocity.z += impulse.force.z / effMass;
          }
          impulse.applied = true;
        }
      }

      // Auto-remove expired body movers
      const expiredMoverIds: string[] = [];
      for (const mover of body.bodyMovers) {
        if (mover.duration != null && mover.duration > 0) {
          const elapsed = mover._elapsed ?? 0;
          mover._elapsed = elapsed + dt;
          if (mover._elapsed >= mover.duration) {
            expiredMoverIds.push(mover.id);
          }
        }
      }
      if (expiredMoverIds.length > 0) {
        const expiredSet = new Set(expiredMoverIds);
        body.bodyMovers = body.bodyMovers.filter(m => !expiredSet.has(m.id));
      }
    }
  }

  private applyBodyMover(body: PhysicsBody, mover: BodyMover, dt: number, cannonBody: CANNON.Body | undefined): void {
    const effMass = effectiveMass(body.mass);

    switch (mover.type) {
      case 'BodyForce':
        if (mover.force) {
          const fx = (mover.force.x / effMass) * dt;
          const fy = (mover.force.y / effMass) * dt;
          const fz = (mover.force.z / effMass) * dt;
          if (cannonBody) {
            cannonBody.applyForce(
              new CANNON.Vec3(mover.force.x, mover.force.y, mover.force.z)
            );
          } else {
            body.velocity.x += fx;
            body.velocity.y += fy;
            body.velocity.z += fz;
          }
        }
        break;

      case 'BodyVelocity':
        if (mover.velocity) {
          const P = mover.P ?? 5000;
          const maxForce = mover.maxForce ?? { x: Infinity, y: Infinity, z: Infinity };
          for (const axis of ['x', 'y', 'z'] as const) {
            const diff = mover.velocity[axis] - body.velocity[axis];
            const force = signedClamp(diff * P, maxForce[axis]);
            body.velocity[axis] += (force / effMass) * dt;
          }
        }
        break;

      case 'BodyPosition':
        if (mover.position) {
          const P = mover.P ?? 5000;
          const D = mover.D ?? 500;
          const maxForce = mover.maxForce ?? { x: Infinity, y: Infinity, z: Infinity };
          for (const axis of ['x', 'y', 'z'] as const) {
            const diff = mover.position[axis] - body.position[axis];
            const force = signedClamp(diff * P - body.velocity[axis] * D, maxForce[axis]);
            body.velocity[axis] += (force / effMass) * dt;
          }
        }
        break;

      case 'BodyGyro':
        if (mover.cframe) {
          const P = mover.P ?? 5000;
          const maxTorque = mover.maxTorque ?? { x: Infinity, y: Infinity, z: Infinity };
          for (const axis of ['x', 'y', 'z'] as const) {
            const targetRad = (mover.cframe[axis] * Math.PI) / 180;
            const currentRad = (body.rotation[axis] * Math.PI) / 180;
            const diff = targetRad - currentRad;
            const torque = signedClamp(diff * P, maxTorque[axis]);
            body.angularVelocity[axis] += (torque / effMass) * dt * 0.1;
          }
        }
        break;

      case 'BodyThrust':
        if (mover.force) {
          if (cannonBody) {
            cannonBody.applyForce(
              new CANNON.Vec3(mover.force.x, mover.force.y, mover.force.z)
            );
          } else {
            body.velocity.x += (mover.force.x / effMass) * dt;
            body.velocity.y += (mover.force.y / effMass) * dt;
            body.velocity.z += (mover.force.z / effMass) * dt;
          }
        }
        break;

      case 'BodyAngularVelocity':
        if (mover.angularVelocity) {
          const P = mover.P ?? 5000;
          const maxTorque = mover.maxTorque ?? { x: Infinity, y: Infinity, z: Infinity };
          for (const axis of ['x', 'y', 'z'] as const) {
            const diff = mover.angularVelocity[axis] - body.angularVelocity[axis];
            const torque = signedClamp(diff * P, maxTorque[axis]);
            body.angularVelocity[axis] += (torque / effMass) * dt * 0.1;
          }
        }
        break;
    }
  }

  // ─── Sync cannon body → PhysicsBody ───

  private syncCannonToPhysicsBodies(): void {
    for (const body of this.bodies.values()) {
      if (body.anchored) {
        // For anchored bodies, sync FROM store position to cannon body (in case user moved it)
        const cannonBody = this.cannonBodies.get(body.id);
        if (cannonBody) {
          cannonBody.position.set(body.position.x, body.position.y, body.position.z);
        }
        body.isGrounded = body.position.y <= 0.01;
        continue;
      }

      const cannonBody = this.cannonBodies.get(body.id);
      if (!cannonBody) continue;

      // Sync position from cannon
      body.position.x = cannonBody.position.x;
      body.position.y = cannonBody.position.y;
      body.position.z = cannonBody.position.z;

      // Sync velocity from cannon
      body.velocity.x = cannonBody.velocity.x;
      body.velocity.y = cannonBody.velocity.y;
      body.velocity.z = cannonBody.velocity.z;

      // Sync rotation from cannon
      const euler = new CANNON.Vec3();
      cannonBody.quaternion.toEuler(euler);
      body.rotation.x = euler.x * 180 / Math.PI;
      body.rotation.y = euler.y * 180 / Math.PI;
      body.rotation.z = euler.z * 180 / Math.PI;

      // Sync angular velocity
      body.angularVelocity.x = cannonBody.angularVelocity.x;
      body.angularVelocity.y = cannonBody.angularVelocity.y;
      body.angularVelocity.z = cannonBody.angularVelocity.z;

      // Check grounded: raycast downward
      const rayFrom = new CANNON.Vec3(body.position.x, body.position.y, body.position.z);
      const rayTo = new CANNON.Vec3(body.position.x, body.position.y - (body.size.y / 2 + 0.1), body.position.z);
      const rayResult = new CANNON.RaycastResult();
      this.world.raycastClosest(rayFrom, rayTo, {}, rayResult);
      body.isGrounded = rayResult.hasHit;

      body.isAwake = !cannonBody.sleepState;
    }
  }

  // ─── Water Physics ───

  private checkWaterState(): void {
    // Water state is set externally via setWaterState
  }

  setWaterState(bodyId: string, waterHeight: number): void {
    const body = this.bodies.get(bodyId);
    if (!body) return;

    const wasInWater = body.isInWater;
    body.isInWater = body.position.y < waterHeight;

    // If body just entered water, apply buoyancy
    if (body.isInWater && !body.anchored) {
      const cannonBody = this.cannonBodies.get(bodyId);
      const waterBuoyancy = Math.abs(this.settings.gravity) * 0.8;
      if (cannonBody) {
        cannonBody.applyForce(new CANNON.Vec3(0, waterBuoyancy * effectiveMass(body.mass), 0));
        // Water drag
        cannonBody.velocity.x *= (1 - WATER_DRAG * (1 / 60));
        cannonBody.velocity.y *= (1 - WATER_DRAG * (1 / 60));
        cannonBody.velocity.z *= (1 - WATER_DRAG * (1 / 60));
        // Water current
        const forceMultiplier = [0, 0.2, 0.5, 1.0, 2.0][this.settings.waterForce] ?? 0.5;
        cannonBody.applyForce(new CANNON.Vec3(
          this.settings.waterDirection.x * forceMultiplier * effectiveMass(body.mass) * 10,
          0,
          this.settings.waterDirection.z * forceMultiplier * effectiveMass(body.mass) * 10
        ));
      } else {
        body.velocity.y += waterBuoyancy * (1 / 60);
        body.velocity.x *= (1 - WATER_DRAG * (1 / 60));
        body.velocity.y *= (1 - WATER_DRAG * (1 / 60));
        body.velocity.z *= (1 - WATER_DRAG * (1 / 60));
        const forceMultiplier = [0, 0.2, 0.5, 1.0, 2.0][this.settings.waterForce] ?? 0.5;
        body.velocity.x += this.settings.waterDirection.x * forceMultiplier * (1 / 60) * 10;
        body.velocity.z += this.settings.waterDirection.z * forceMultiplier * (1 / 60) * 10;
      }
    }
  }

  // ─── Drag & Velocity Capping ───

  private applyDrag(dt: number): void {
    for (const body of this.bodies.values()) {
      if (body.anchored || !body.isInWater) {
        // Air drag (very small)
        const cannonBody = this.cannonBodies.get(body.id);
        if (cannonBody) {
          // cannon-es has linearDamping for this
        } else {
          body.velocity.x *= (1 - AIR_DRAG * dt);
          body.velocity.z *= (1 - AIR_DRAG * dt);
        }
      }
    }
  }

  private capVelocities(): void {
    for (const body of this.bodies.values()) {
      if (body.anchored) continue;
      const speed = Math.sqrt(
        body.velocity.x * body.velocity.x +
        body.velocity.y * body.velocity.y +
        body.velocity.z * body.velocity.z
      );
      if (speed > MAX_VELOCITY) {
        const scale = MAX_VELOCITY / speed;
        body.velocity.x *= scale;
        body.velocity.y *= scale;
        body.velocity.z *= scale;
        const cannonBody = this.cannonBodies.get(body.id);
        if (cannonBody) {
          cannonBody.velocity.set(body.velocity.x, body.velocity.y, body.velocity.z);
        }
      }

      // NaN guard
      if (isNaN(body.position.x) || isNaN(body.position.y) || isNaN(body.position.z)) {
        body.position = { x: 0, y: 10, z: 0 };
        body.velocity = { x: 0, y: 0, z: 0 };
        const cannonBody = this.cannonBodies.get(body.id);
        if (cannonBody) {
          cannonBody.position.set(0, 10, 0);
          cannonBody.velocity.set(0, 0, 0);
        }
      }
    }
  }

  // ─── Impulse Tracking ───

  private tickImpulses(dt: number): void {
    for (const body of this.bodies.values()) {
      if (body._impulses.length === 0) continue;
      body._impulses = body._impulses.filter(impulse => {
        impulse.timeLeft -= dt;
        return impulse.timeLeft > 0;
      });
    }
  }

  addImpulse(bodyId: string, force: { x: number; y: number; z: number }, duration: number = EXPLOSION_IMPULSE_DURATION): void {
    const body = this.bodies.get(bodyId);
    if (!body) return;
    body._impulses.push({ force, timeLeft: duration, applied: false });
    body.isAwake = true;
    const cannonBody = this.cannonBodies.get(bodyId);
    if (cannonBody) {
      cannonBody.wakeUp();
    }
  }

  // ─── Character Simulation (legacy compatibility) ───

  stepCharacter(
    character: CharacterState,
    keys: Set<string>,
    waterHeight: number | null,
    dt: number
  ): CharacterState {
    const SPEED = DEFAULT_CHARACTER_SPEED;
    const JUMP_FORCE = DEFAULT_JUMP_FORCE;
    const grav = this.settings.gravity;

    // Movement input
    let moveX = 0, moveZ = 0;
    if (keys.has('w') || keys.has('arrowup')) moveZ -= SPEED;
    if (keys.has('s') || keys.has('arrowdown')) moveZ += SPEED;
    if (keys.has('a') || keys.has('arrowleft')) moveX -= SPEED;
    if (keys.has('d') || keys.has('arrowright')) moveX += SPEED;

    character.velocity.x = moveX;
    character.velocity.z = moveZ;

    // Gravity
    character.velocity.y += grav * dt;

    // Water check
    character.isInWater = waterHeight !== null && character.position.y < waterHeight;
    if (character.isInWater) {
      const buoyancy = Math.abs(grav) * 0.85;
      character.velocity.y += buoyancy * dt;
      character.velocity.x *= (1 - WATER_DRAG * dt);
      character.velocity.y *= (1 - WATER_DRAG * dt);
      character.velocity.z *= (1 - WATER_DRAG * dt);
      const forceMultiplier = [0, 0.2, 0.5, 1.0, 2.0][this.settings.waterForce] ?? 0.5;
      character.velocity.x += this.settings.waterDirection.x * forceMultiplier * dt * 10;
      character.velocity.z += this.settings.waterDirection.z * forceMultiplier * dt * 10;
    }

    // Jump
    if (keys.has(' ') && character.isGrounded) {
      character.velocity.y = JUMP_FORCE;
      character.isGrounded = false;
    }

    // Integrate
    character.position.x += character.velocity.x * dt;
    character.position.y += character.velocity.y * dt;
    character.position.z += character.velocity.z * dt;

    // Ground collision
    const charHalfHeight = 1.2475;
    if (character.position.y - charHalfHeight < 0) {
      character.position.y = charHalfHeight;
      if (character.velocity.y < 0) character.velocity.y = 0;
      character.isGrounded = true;
    }

    // Part collision
    for (const body of this.bodies.values()) {
      if (!body.canCollide) continue;
      const aabb = computeAABB(body.position, body.size);
      const charMinX = character.position.x - 0.5;
      const charMaxX = character.position.x + 0.5;
      const charMinY = character.position.y - charHalfHeight;
      const charMaxY = character.position.y + charHalfHeight;
      const charMinZ = character.position.z - 0.5;
      const charMaxZ = character.position.z + 0.5;

      if (
        charMinX < aabb.maxX && charMaxX > aabb.minX &&
        charMinY < aabb.maxY && charMaxY > aabb.minY &&
        charMinZ < aabb.maxZ && charMaxZ > aabb.minZ
      ) {
        const overlapX1 = charMaxX - aabb.minX;
        const overlapX2 = aabb.maxX - charMinX;
        const overlapY1 = charMaxY - aabb.minY;
        const overlapY2 = aabb.maxY - charMinY;
        const overlapZ1 = charMaxZ - aabb.minZ;
        const overlapZ2 = aabb.maxZ - charMinZ;
        const minX = Math.min(overlapX1, overlapX2);
        const minY = Math.min(overlapY1, overlapY2);
        const minZ = Math.min(overlapZ1, overlapZ2);

        if (minY <= minX && minY <= minZ) {
          if (overlapY1 < overlapY2) {
            character.position.y = aabb.minY - charHalfHeight;
          } else {
            character.position.y = aabb.maxY + charHalfHeight;
            character.isGrounded = true;
          }
          if (character.velocity.y < 0 && overlapY1 >= overlapY2) {
            character.velocity.y = 0;
          } else if (character.velocity.y > 0 && overlapY1 < overlapY2) {
            character.velocity.y = 0;
          }
        } else if (minX <= minZ) {
          if (overlapX1 < overlapX2) {
            character.position.x = aabb.minX - 0.5;
          } else {
            character.position.x = aabb.maxX + 0.5;
          }
        } else {
          if (overlapZ1 < overlapZ2) {
            character.position.z = aabb.minZ - 0.5;
          } else {
            character.position.z = aabb.maxZ + 0.5;
          }
        }
      }
    }

    return character;
  }
}

// ─── Utility Functions ───

export function computeAABB(
  position: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number }
): AABB {
  return {
    minX: position.x - size.x / 2,
    minY: position.y - size.y / 2,
    minZ: position.z - size.z / 2,
    maxX: position.x + size.x / 2,
    maxY: position.y + size.y / 2,
    maxZ: position.z + size.z / 2,
  };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX &&
    a.minY <= b.maxY && a.maxY >= b.minY &&
    a.minZ <= b.maxZ && a.maxZ >= b.minZ
  );
}

// Legacy compatibility exports
export function partToPhysicsBody(part: StudioPart): PhysicsBody {
  const mass = calculateMass(part.type, part.size, part.material, part.density);
  const material = getMaterialProps(part.material);
  return {
    id: part.id,
    position: { ...part.position },
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    size: { ...part.size },
    rotation: { ...part.rotation },
    mass,
    anchored: part.anchored,
    canCollide: part.canCollide,
    friction: part.friction ?? material.friction,
    elasticity: part.elasticity ?? material.elasticity,
    isGrounded: false,
    isAwake: true,
    isInWater: false,
    bodyMovers: [...(part.bodyMovers || [])],
    partType: part.type,
    _impulses: [],
  };
}

// Legacy stepPhysics function for backwards compatibility
export function stepPhysics(bodies: PhysicsBody[], deltaTime: number): void {
  const dt = Math.min(deltaTime, 1 / 30);
  for (const body of bodies) {
    body.isGrounded = false;
    if (!body.anchored) {
      body.velocity.y += GRAVITY * dt;
    }
  }
  for (const body of bodies) {
    if (!body.anchored) {
      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
      body.position.z += body.velocity.z * dt;
    }
  }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      if (a.anchored && b.anchored) continue;
      if (!a.canCollide || !b.canCollide) continue;
      const aAABB = computeAABB(a.position, a.size);
      const bAABB = computeAABB(b.position, b.size);
      if (!aabbOverlap(aAABB, bAABB)) continue;
      if (a.anchored) {
        resolveCollision(b, a);
      } else if (b.anchored) {
        resolveCollision(a, b);
      } else {
        resolveCollision(a, b);
      }
    }
  }
}

function resolveCollision(moving: PhysicsBody, static_: PhysicsBody): { resolved: boolean; normal: { x: number; y: number; z: number } } {
  if (moving.anchored || !static_.canCollide || !moving.canCollide) {
    return { resolved: false, normal: { x: 0, y: 0, z: 0 } };
  }
  const movingAABB = computeAABB(moving.position, moving.size);
  const staticAABB = computeAABB(static_.position, static_.size);
  if (!aabbOverlap(movingAABB, staticAABB)) {
    return { resolved: false, normal: { x: 0, y: 0, z: 0 } };
  }
  const overlapX1 = movingAABB.maxX - staticAABB.minX;
  const overlapX2 = staticAABB.maxX - movingAABB.minX;
  const overlapY1 = movingAABB.maxY - staticAABB.minY;
  const overlapY2 = staticAABB.maxY - movingAABB.minY;
  const overlapZ1 = movingAABB.maxZ - staticAABB.minZ;
  const overlapZ2 = staticAABB.maxZ - movingAABB.minZ;
  const minOverlapX = Math.min(overlapX1, overlapX2);
  const minOverlapY = Math.min(overlapY1, overlapY2);
  const minOverlapZ = Math.min(overlapZ1, overlapZ2);
  const normal = { x: 0, y: 0, z: 0 };
  if (minOverlapY <= minOverlapX && minOverlapY <= minOverlapZ) {
    if (overlapY1 < overlapY2) {
      moving.position.y -= minOverlapY;
      normal.y = -1;
    } else {
      moving.position.y += minOverlapY;
      normal.y = 1;
      moving.isGrounded = true;
    }
    moving.velocity.y = 0;
  } else if (minOverlapX <= minOverlapZ) {
    if (overlapX1 < overlapX2) {
      moving.position.x -= minOverlapX;
      normal.x = -1;
    } else {
      moving.position.x += minOverlapX;
      normal.x = 1;
    }
    moving.velocity.x = 0;
  } else {
    if (overlapZ1 < overlapZ2) {
      moving.position.z -= minOverlapZ;
      normal.z = -1;
    } else {
      moving.position.z += minOverlapZ;
      normal.z = 1;
    }
    moving.velocity.z = 0;
  }
  return { resolved: true, normal };
}
