'use client';

import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, TransformControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStudioStore, isPart, StudioPart, StudioModel, BodyMover, Joint, PartEffect, collectLeafPartIds, computeGroupCenter } from '@/lib/studio-store';
import { getMaterialProps, calculateMass } from '@/lib/game-engine/materials';
import { PhysicsWorld, CharacterController, CharacterInput, PhysicsBody, computeAABB, aabbOverlap } from '@/lib/game-engine/physics';
import { SpawnMarker, GridLines } from '@/components/shared/SpawnMarker';
import { SkySystem } from '@/components/studio/SkySystem';
import { WeildBuildCharacter, DEFAULT_AVATAR, TOTAL_HEIGHT } from '@/components/shared/WeildBuildCharacter';
import { weildCodeEngine } from '@/lib/weildcode-engine';
import { CharacterPartsRenderer } from '@/components/studio/CharacterPartsRenderer';

// ─── Play Mode Input ───
// Exported so StudioPlayViewport can bridge mobile controls → playInput.
export const playInput: CharacterInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
};

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    // Don't capture movement keys when typing in an input/textarea
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': playInput.forward = true; break;
      case 'KeyS': case 'ArrowDown': playInput.backward = true; break;
      case 'KeyA': case 'ArrowLeft': playInput.left = true; break;
      case 'KeyD': case 'ArrowRight': playInput.right = true; break;
      case 'Space': playInput.jump = true; e.preventDefault(); break;
    }
  });
  window.addEventListener('keyup', (e) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': playInput.forward = false; break;
      case 'KeyS': case 'ArrowDown': playInput.backward = false; break;
      case 'KeyA': case 'ArrowLeft': playInput.left = false; break;
      case 'KeyD': case 'ArrowRight': playInput.right = false; break;
      case 'Space': playInput.jump = false; break;
    }
  });
}

// ─── Mesh ref registry for TransformControls to attach to actual meshes ───
const meshRefRegistry = new Map<string, THREE.Object3D>();
export function registerMeshRef(id: string, mesh: THREE.Object3D | null) {
  if (mesh) {
    meshRefRegistry.set(id, mesh);
  } else {
    meshRefRegistry.delete(id);
  }
}

// ─── Part Mesh (visual only) ───

export function PartMesh({ partId, isSelected, isGroupModeHighlighted = false }: { partId: string; isSelected: boolean; isGroupModeHighlighted?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { selectObject, activeTool, updateObject, snapToGrid, gridSize, playState, removeObject, addPart, setActiveTool, showGrid } = useStudioStore();

  // Subscribe directly to the part data from the store for instant reactivity.
  // Using a targeted selector ensures PartMesh re-renders immediately when
  // transparency, reflectance, color, or any other part property changes,
  // without waiting for the parent Scene component to pass updated props.
  const part = useStudioStore((s): StudioPart | null => {
    const obj = s.objects.get(partId);
    return obj && isPart(obj) ? obj : null;
  });

  if (!part) return null;

  const materialDef = getMaterialProps(part.material);

  const geometry = useMemo(() => {
    switch (part.type) {
      case 'Block':
        return new THREE.BoxGeometry(part.size.x, part.size.y, part.size.z);
      case 'Sphere':
        // Use BoxGeometry for the hitbox/mesh so per-axis scaling works.
        // The visual sphere look is achieved by applying a non-uniform scale to a unit sphere,
        // but for the interactive mesh we use a box so TransformControls scale each axis independently.
        return new THREE.SphereGeometry(0.5, 16, 16);
      case 'Cylinder':
        // Use a unit cylinder so per-axis scaling works (radius from x/z, height from y).
        return new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
      case 'Wedge':
        return createWedgeGeometry(part.size);
      case 'Spawn':
        // Spawn block: same box geometry as a Block part
        return new THREE.BoxGeometry(part.size.x, part.size.y, part.size.z);
      default:
        return new THREE.BoxGeometry(part.size.x, part.size.y, part.size.z);
    }
  }, [part.type, part.size.x, part.size.y, part.size.z]);

  // Fix 1: Dispose geometry on unmount or change
  useEffect(() => {
    return () => {
      if (geometry) geometry.dispose();
    };
  }, [geometry]);

  // Memoize colors to avoid per-frame allocation (Fix 6)
  const partColor = useMemo(() => new THREE.Color(part.color), [part.color]);
  const emissiveColor = useMemo(() => materialDef.emissive ? new THREE.Color(materialDef.emissive) : new THREE.Color(0x000000), [materialDef.emissive]);
  const selectionColor = useMemo(() => new THREE.Color('#818cf8'), []);
  const groupModeColor = useMemo(() => new THREE.Color('#c084fc'), []); // Purple for group mode

  // Memoize edgesGeometry for selection highlight
  const edgesGeometry = useMemo(() => (isSelected || isGroupModeHighlighted) ? new THREE.EdgesGeometry(geometry) : null, [isSelected, isGroupModeHighlighted, geometry]);
  useEffect(() => {
    return () => {
      if (edgesGeometry) edgesGeometry.dispose();
    };
  }, [edgesGeometry]);

  // Register mesh ref for transform controls (one-time via callback ref)
  const setMeshRef = useCallback((mesh: THREE.Mesh | null) => {
    if (mesh) {
      (meshRef as React.MutableRefObject<THREE.Mesh | null>).current = mesh;
      registerMeshRef(part.id, mesh);
    }
  }, [part.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      registerMeshRef(part.id, null);
    };
  }, [part.id]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (playState.isPlaying) {
      // In play mode, fire WeildCode click event
      e.stopPropagation();
      weildCodeEngine.handleClick(part.id);
      return;
    }
    e.stopPropagation();

    // Baseplate: clicking with a part tool places a new part on the surface
    if (part.isBaseplate) {
      const partTypes = ['Block', 'Sphere', 'Cylinder', 'Wedge'] as const;
      if (partTypes.includes(activeTool as any)) {
        const point = e.point;
        addPart(activeTool as any);
        const newId = useStudioStore.getState().selectedIds[0];
        if (newId) {
          const { objects } = useStudioStore.getState();
          const obj = objects.get(newId);
          const halfY = obj && 'size' in obj ? obj.size.y / 2 : 0.5;
          const baseplateTopY = part.position.y + part.size.y / 2;
          updateObject(newId, {
            position: { x: Math.round(point.x * 2) / 2, y: baseplateTopY + halfY, z: Math.round(point.z * 2) / 2 }
          });
        }
        setActiveTool('Select');
        return;
      }
    }

    if (activeTool === 'Group') {
      // In group mode, toggle part in/out of group selection
      const { groupModeIds, setGroupModeIds } = useStudioStore.getState();
      if (groupModeIds.includes(part.id)) {
        setGroupModeIds(groupModeIds.filter((id: string) => id !== part.id));
      } else {
        setGroupModeIds([...groupModeIds, part.id]);
      }
      return;
    }
    if (activeTool === 'Union') {
      // In Union mode, toggle part in/out of the union selection — same UX as Group.
      const { unionModeIds, setUnionModeIds } = useStudioStore.getState();
      if (unionModeIds.includes(part.id)) {
        setUnionModeIds(unionModeIds.filter((id: string) => id !== part.id));
      } else {
        setUnionModeIds([...unionModeIds, part.id]);
      }
      return;
    }
    if (activeTool === 'Delete') {
      // Delete tool: click to immediately remove the object
      removeObject(part.id);
      return;
    }
    // Select the part but do NOT auto-switch tool mode
    if (e.shiftKey) {
      selectObject(part.id, true);
    } else {
      selectObject(part.id, false);
    }
  }, [part, activeTool, playState.isPlaying, addPart, updateObject, setActiveTool, selectObject, removeObject]);

  const enabledEffects = (part.effects || []).filter(e => e.enabled);

  // Spawn points: the SpawnMarker IS the spawn point object — no separate block.
  // The marker (glowing disc + ring + particles) is scaled by part.size and uses
  // part.color / part.transparency so all property changes are visible.
  // An invisible mesh at the part's position provides the ref for TransformControls.
  if (part.isSpawnPoint) {
    // Scale factor from part size (default spawn is 3×0.3×3)
    const markerScale = Math.max(part.size.x, part.size.z) / 3;
    return (
      <>
        {/* Invisible mesh for TransformControls ref — provides the attachment point
            for move/rotate/scale gizmos without adding a visible block. */}
        <mesh
          ref={setMeshRef}
          position={[part.position.x, part.position.y, part.position.z]}
          rotation={[part.rotation.x * Math.PI / 180, part.rotation.y * Math.PI / 180, part.rotation.z * Math.PI / 180]}
          scale={[part.size.x, part.size.y, part.size.z]}
          onClick={handlePointerDown}
          onPointerDown={handlePointerDown}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {/* SpawnMarker — THE spawn point visual. Scaled by part.size, uses part.color
            and part.transparency so tools work directly on the spawn point itself. */}
        <group
          position={[part.position.x, part.position.y, part.position.z]}
          scale={[markerScale, markerScale, markerScale]}
        >
          <SpawnMarker color={part.color} transparency={part.transparency} />
          {/* Selection highlight ring */}
          {isSelected && (
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.7, 2.0, 24]} />
              <meshBasicMaterial color={selectionColor} transparent opacity={0.7} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
        {/* Effects on spawn point */}
        {enabledEffects.length > 0 && (
          <group position={[part.position.x, part.position.y, part.position.z]}>
            {enabledEffects.map((effect) => (
              <PartEffectVisual key={effect.id} effect={effect} partSize={part.size} />
            ))}
          </group>
        )}
      </>
    );
  }

  // Baseplate: a real part where the grid is drawn by the material shader.
  // The grid is NOT a separate component — it's injected into MeshStandardMaterial
  // via onBeforeCompile, so we get full PBR lighting + shadows + grid in one pass.
  if (part.isBaseplate) {
    const baseplateMat = useMemo(() => {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(part.color),
        roughness: 0.8,
        metalness: 0,
        transparent: part.transparency > 0,
        opacity: 1 - part.transparency,
      });

      // Inject grid-drawing code into the standard material's fragment shader.
      // We use custom varyings (vBP*) to avoid collisions with Three.js internals,
      // and we only APPEND to shader chunks — never replace them.
      mat.onBeforeCompile = (shader) => {
        // Custom uniforms
        shader.uniforms.uGridSize = { value: new THREE.Vector2(part.size.x, part.size.z) };
        shader.uniforms.uShowGrid = { value: showGrid ? 1.0 : 0.0 };

        // ─── Vertex shader ───
        // Declare our custom varyings (append to <common>)
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
           varying vec3 vBPWorldNormal;
           varying vec2 vBPUv;`
        );
        // Set varyings after projection (all Three.js transforms are done by now)
        // We compute world normal ourselves and pass UV through a custom varying
        // since Three.js's vUv is only available when USE_UV is defined.
        shader.vertexShader = shader.vertexShader.replace(
          '#include <project_vertex>',
          `#include <project_vertex>
           vBPWorldNormal = normalize(mat3(modelMatrix) * normal);
           vBPUv = uv;`
        );

        // ─── Fragment shader ───
        // Declare custom uniforms + varyings (append to <common>)
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
           uniform vec2 uGridSize;
           uniform float uShowGrid;
           varying vec3 vBPWorldNormal;
           varying vec2 vBPUv;`
        );
        // Draw grid lines after Three.js sets diffuseColor (append to <color_fragment>)
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>

           // Draw grid on top face only
           if (uShowGrid > 0.5 && vBPWorldNormal.y > 0.5) {
             float studX = vBPUv.x * uGridSize.x;
             float studZ = vBPUv.y * uGridSize.y;

             // Minor grid: every 2 studs
             float minorX = abs(fract(studX / 2.0 + 0.5) - 0.5);
             float minorZ = abs(fract(studZ / 2.0 + 0.5) - 0.5);
             float minorLine = 1.0 - smoothstep(0.02, 0.06, min(minorX, minorZ) * 2.0);

             // Major grid: every 10 studs
             float majorX = abs(fract(studX / 10.0 + 0.5) - 0.5);
             float majorZ = abs(fract(studZ / 10.0 + 0.5) - 0.5);
             float majorLine = 1.0 - smoothstep(0.01, 0.04, min(majorX, majorZ) * 10.0);

             float minorAlpha = minorLine * 0.05;
             float majorAlpha = majorLine * 0.14;
             float gridAlpha = max(minorAlpha, majorAlpha);
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), gridAlpha);
           }`
        );
      };

      return mat;
    }, [part.color, part.size.x, part.size.z, part.transparency, showGrid]);

    return (
      <mesh
        ref={setMeshRef}
        position={[part.position.x, part.position.y, part.position.z]}
        rotation={[part.rotation.x * Math.PI / 180, part.rotation.y * Math.PI / 180, part.rotation.z * Math.PI / 180]}
        geometry={geometry}
        material={baseplateMat}
        receiveShadow
        onClick={handlePointerDown}
        onPointerDown={handlePointerDown}
      />
    );
  }

  // Compute visual scale for shapes that use unit geometry (Sphere, Cylinder).
  // Block, Wedge, and Spawn embed size in the geometry directly, so their scale is (1,1,1).
  const visualScale = useMemo(() => {
    switch (part.type) {
      case 'Sphere':
        return [part.size.x, part.size.y, part.size.z] as [number, number, number];
      case 'Cylinder':
        return [part.size.x, part.size.y, part.size.z] as [number, number, number];
      default:
        return [1, 1, 1] as [number, number, number];
    }
  }, [part.type, part.size.x, part.size.y, part.size.z]);

  return (
    <mesh
      ref={setMeshRef}
      position={[part.position.x, part.position.y, part.position.z]}
      rotation={[part.rotation.x * Math.PI / 180, part.rotation.y * Math.PI / 180, part.rotation.z * Math.PI / 180]}
      scale={visualScale}
      geometry={geometry}
      onClick={handlePointerDown}
      onPointerDown={handlePointerDown}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={partColor}
        roughness={materialDef.roughness * (1 - part.reflectance * 0.8)}
        metalness={Math.min(1, materialDef.metalness + part.reflectance * 0.8)}
        transparent
        opacity={(1 - part.transparency) * (materialDef.opacity ?? 1)}
        emissive={emissiveColor}
        emissiveIntensity={materialDef.emissiveIntensity ?? 0}
      />
      {(isSelected || isGroupModeHighlighted) && edgesGeometry && (
        <lineSegments>
          <primitive object={edgesGeometry} attach="geometry" />
          <lineBasicMaterial color={isGroupModeHighlighted && !isSelected ? groupModeColor : selectionColor} linewidth={2} />
        </lineSegments>
      )}
      {/* Render effects on this part */}
      {enabledEffects.length > 0 && (
        <group>
          {enabledEffects.map((effect) => (
            <PartEffectVisual key={effect.id} effect={effect} partSize={part.size} />
          ))}
        </group>
      )}
    </mesh>
  );
}

// ─── Effect Visuals (Enhanced) ───

// Individual flickering flame cone
function FireCone({ effectSize, color, index }: { effectSize: number; color: string; index: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  // Each cone has a unique speed/phase offset so they flicker independently
  const speeds = [8, 11, 14];
  const phases = [0, 2.1, 4.3];
  const scales = [1.0, 0.85, 0.7];
  const yOffsets = [0, 0.08, 0.16];
  const radii = [0.22, 0.28, 0.18];
  const heights = [0.9, 0.7, 1.1];

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const speed = speeds[index];
    const phase = phases[index];
    const s = scales[index];
    const flicker = s * (1 + Math.sin(t * speed + phase) * 0.2 + Math.sin(t * speed * 1.7 + phase) * 0.1);
    meshRef.current.scale.set(flicker, flicker * (1 + Math.sin(t * speed * 0.8 + phase) * 0.25), flicker);
    // Slight x/z jitter per cone
    meshRef.current.position.x = Math.sin(t * speed * 0.5 + phase) * 0.03 * effectSize;
    meshRef.current.position.z = Math.cos(t * speed * 0.6 + phase) * 0.03 * effectSize;
  });

  return (
    <mesh ref={meshRef} position={[0, yOffsets[index] * effectSize, 0]}>
      <coneGeometry args={[radii[index] * effectSize, heights[index] * effectSize, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2.5 - index * 0.5}
        transparent
        opacity={0.85 - index * 0.1}
      />
    </mesh>
  );
}

// Individual spark particle that floats upward and fades
function FireSpark({ effectSize, color, index }: { effectSize: number; color: string; index: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const phaseOffset = index * 1.3; // stagger sparks
  const cycleDuration = 1.8; // seconds for one rise cycle

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const cycle = ((t + phaseOffset) % cycleDuration) / cycleDuration; // 0..1 progress

    // Rise upward
    meshRef.current.position.y = cycle * effectSize * 1.5;
    // Small x/z drift
    meshRef.current.position.x = Math.sin(t * 3 + phaseOffset * 2) * 0.05 * effectSize;
    meshRef.current.position.z = Math.cos(t * 4 + phaseOffset * 2) * 0.05 * effectSize;
    // Fade out as rising
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = (1 - cycle) * 0.9;
    // Shrink as fading
    const s = (1 - cycle) * 0.5 + 0.2;
    meshRef.current.scale.set(s, s, s);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[effectSize * 0.06, 4, 4]} />
      <meshStandardMaterial
        color="#ffcc00"
        emissive={color}
        emissiveIntensity={4}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// Individual smoke puff that rises, expands, and fades
function SmokePuff({ effectSize, color, baseOpacity, index }: { effectSize: number; color: string; baseOpacity: number; index: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const phaseOffset = index * 1.5; // stagger puffs
  const cycleDuration = 4.0; // seconds for one rise cycle
  const xDrift = (index - 1.5) * 0.15; // slight horizontal spread per puff
  const zDrift = ((index % 2) - 0.5) * 0.2;

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const cycle = ((t * 0.5 + phaseOffset) % cycleDuration) / cycleDuration; // 0..1 progress

    // Rise upward
    meshRef.current.position.y = cycle * effectSize * 2.5 + effectSize * 0.3;
    // Drift sideways
    meshRef.current.position.x = xDrift + Math.sin(t * 0.3 + phaseOffset) * 0.1;
    meshRef.current.position.z = zDrift + Math.cos(t * 0.25 + phaseOffset) * 0.1;
    // Expand as rising
    const s = 0.6 + cycle * 0.8;
    meshRef.current.scale.set(s, s, s);
    // Fade out as rising
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = baseOpacity * (1 - cycle * 0.8);
    // Slow rotation
    meshRef.current.rotation.y = t * 0.2 + phaseOffset;
    meshRef.current.rotation.x = Math.sin(t * 0.15 + phaseOffset) * 0.1;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[effectSize * 0.5, 8, 8]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={baseOpacity}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

// Individual orbiting particle around light source
function PartEffectVisual({ effect, partSize }: { effect: PartEffect; partSize: { x: number; y: number; z: number } }) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const innerGlowRef = useRef<THREE.Mesh>(null);

  const effectSize = Math.max(0.1, effect.size);

  // Fire effect colors derived from user settings
  const fireColor = effect.color || '#ff6600';
  const fireColorBright = '#ffaa00';
  const fireColorHot = '#ffff66';

  // Smoke color — desaturated version of user color
  const smokeColor = effect.color || '#888888';

  // Light color
  const lightColor = effect.color || '#ffffff';

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (effect.type === 'Fire') {
      // Group jitter for organic movement
      if (groupRef.current) {
        groupRef.current.position.x = Math.sin(time * 5) * 0.02;
        groupRef.current.position.z = Math.cos(time * 7) * 0.02;
      }
      // Inner glow pulsing
      if (innerGlowRef.current) {
        const pulse = 1 + Math.sin(time * 6) * 0.15 + Math.sin(time * 10) * 0.08;
        innerGlowRef.current.scale.set(pulse, pulse * 1.2, pulse);
        const mat = innerGlowRef.current.material as THREE.MeshStandardMaterial;
        mat.opacity = 0.6 + Math.sin(time * 8) * 0.15;
      }
      // Dramatic light flicker
      if (lightRef.current) {
        const baseIntensity = effect.brightness ?? 2;
        lightRef.current.intensity = baseIntensity * (
          0.7 +
          Math.sin(time * 8) * 0.2 +
          Math.sin(time * 13) * 0.1 +
          Math.sin(time * 21) * 0.08 +
          Math.sin(time * 34) * 0.05
        );
      }
    }

    if (effect.type === 'Light') {
      // Light intensity subtle variation
      if (lightRef.current) {
        const baseIntensity = effect.brightness ?? 3;
        lightRef.current.intensity = baseIntensity * (0.95 + Math.sin(time * 2) * 0.05);
      }
    }
  });

  if (effect.type === 'Fire') {
    return (
      <group ref={groupRef} position={[0, partSize.y / 2 + effectSize * 0.5, 0]}>
        {/* Core flame: 3 overlapping cones that flicker independently */}
        <FireCone effectSize={effectSize} color={fireColorHot} index={0} />
        <FireCone effectSize={effectSize} color={fireColorBright} index={1} />
        <FireCone effectSize={effectSize} color={fireColor} index={2} />

        {/* Inner glow: bright emissive sphere with pulsing opacity */}
        <mesh ref={innerGlowRef} position={[0, effectSize * 0.1, 0]}>
          <sphereGeometry args={[effectSize * 0.25, 8, 8]} />
          <meshStandardMaterial
            color={fireColorBright}
            emissive={fireColor}
            emissiveIntensity={4}
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Outer glow: larger, more transparent ambient sphere */}
        <mesh position={[0, effectSize * 0.15, 0]} scale={[1.6, 2.0, 1.6]}>
          <sphereGeometry args={[effectSize * 0.3, 8, 8]} />
          <meshStandardMaterial
            color={'#ff3300'}
            emissive={'#ff2200'}
            emissiveIntensity={1}
            transparent
            opacity={0.15}
          />
        </mesh>

        {/* Spark particles: 5 tiny spheres that float upward and fade */}
        {[0, 1, 2, 3, 4].map((i) => (
          <FireSpark key={i} effectSize={effectSize} color={fireColor} index={i} />
        ))}

        {/* Point light with dramatic flicker */}
        <pointLight
          ref={lightRef}
          color={fireColor}
          intensity={effect.brightness ?? 2}
          distance={effect.range ?? 10}
          position={[0, effectSize * 0.4, 0]}
        />
      </group>
    );
  }

  if (effect.type === 'Smoke') {
    const baseOpacity = effect.opacity ?? 0.3;
    return (
      <group position={[0, partSize.y / 2, 0]}>
        {/* Multiple smoke puffs: 4 spheres at different heights that drift and expand */}
        {[0, 1, 2, 3].map((i) => (
          <SmokePuff key={i} effectSize={effectSize} color={smokeColor} baseOpacity={baseOpacity} index={i} />
        ))}
      </group>
    );
  }

  if (effect.type === 'Light') {
    const effectRange = effect.range ?? 15;
    return (
      <group position={[0, partSize.y / 2 + 0.5, 0]}>
        <pointLight
          ref={lightRef}
          color={lightColor}
          intensity={effect.brightness ?? 3}
          distance={effectRange}
        />

        {/* Tiny indicator dot so you can see where the light source is in the editor */}
        <mesh>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial
            color={lightColor}
            emissive={lightColor}
            emissiveIntensity={1}
            transparent
            opacity={0.6}
          />
        </mesh>
      </group>
    );
  }

  return null;
}

// ─── Wedge Geometry (WeildBuild triangular prism) ───
// A wedge: front face is full height at z=+hd, back edge is zero height at z=-hd
// Slope ramps from top-front down to bottom-back

function createWedgeGeometry(size: { x: number; y: number; z: number }): THREE.BufferGeometry {
  const hw = size.x / 2, hh = size.y / 2, hd = size.z / 2;

  // 6 unique positions
  const p0 = [-hw, -hh,  hd]; // bottom-front-left
  const p1 = [ hw, -hh,  hd]; // bottom-front-right
  const p2 = [ hw,  hh,  hd]; // top-front-right
  const p3 = [-hw,  hh,  hd]; // top-front-left
  const p4 = [-hw, -hh, -hd]; // bottom-back-left
  const p5 = [ hw, -hh, -hd]; // bottom-back-right

  // Non-indexed geometry with correct per-face winding (CCW = outward normal)
  // Each face is duplicated so normals are sharp (no averaging artifacts)
  const verts: number[] = [
    // Front face (2 tris, normal +Z)
    ...p0, ...p1, ...p2,
    ...p0, ...p2, ...p3,
    // Bottom face (2 tris, normal -Y)
    ...p0, ...p5, ...p1,
    ...p0, ...p4, ...p5,
    // Left face (1 tri, normal -X)
    ...p4, ...p0, ...p3,
    // Right face (1 tri, normal +X)
    ...p2, ...p1, ...p5,
    // Slope face (2 tris, normal up-and-back)
    ...p3, ...p2, ...p5,
    ...p3, ...p5, ...p4,
  ];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// ─── Transform Controls (properly working gizmo for all modes + multi-select) ───

function SelectedTransformControls({ orbitControlsRef }: { orbitControlsRef: React.MutableRefObject<any> }) {
  const selectedIds = useStudioStore((s) => s.selectedIds);
  const activeTool = useStudioStore((s) => s.activeTool);
  const playState = useStudioStore((s) => s.playState);
  const simulationState = useStudioStore((s) => s.simulationState);
  const snapToGrid = useStudioStore((s) => s.snapToGrid);
  const gridSize = useStudioStore((s) => s.gridSize);
  const updateObject = useStudioStore((s) => s.updateObject);
  const controlsRef = useRef<any>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<Map<string, { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } }>>(new Map());

  // Camera reference for computing scale anchor direction
  const { camera } = useThree();

  // Scale anchor signs: per-axis, +1 anchors the negative face, -1 anchors
  // the positive face. Computed at drag-start based on camera position so
  // the face AWAY from the camera stays fixed (the visible face moves).
  const scaleAnchorSignRef = useRef<{ x: number; y: number; z: number }>({ x: 1, y: 1, z: 1 });

  // Force re-render to pick up mesh refs and tool changes
  const [forceUpdateKey, forceUpdate] = useState(0);

  // Get all selected parts — expand groups to their leaf parts so we can
  // transform them all together as if they were one object.
  const selectedParts = useMemo(() => {
    const state = useStudioStore.getState();
    const parts: StudioPart[] = [];
    selectedIds.forEach((id) => {
      const obj = state.objects.get(id);
      if (obj && isPart(obj)) {
        parts.push(obj);
      } else if (obj && !isPart(obj) && 'children' in obj) {
        // It's a group (StudioModel) — expand to all leaf parts
        const leafIds = collectLeafPartIds(state.objects, id);
        leafIds.forEach(leafId => {
          const leaf = state.objects.get(leafId);
          if (leaf && isPart(leaf)) parts.push(leaf);
        });
      }
    });
    return parts;
  }, [selectedIds, forceUpdateKey]);

  // Primary part for gizmo position. If we have a group selected,
  // we create a virtual anchor at the group's center instead.
  const isGroupSelection = useMemo(() => {
    const state = useStudioStore.getState();
    return selectedIds.some(id => {
      const obj = state.objects.get(id);
      return obj && !isPart(obj) && 'children' in obj;
    });
  }, [selectedIds, forceUpdateKey]);

  const primaryPart = selectedParts.length > 0 ? selectedParts[0] : null;

  // Determine gizmo mode based on active tool — Move/Rotate/Scale all use TransformControls.
  const mode = activeTool === 'Rotate' ? 'rotate' : activeTool === 'Scale' ? 'scale' : 'translate';

  // Get the actual Three.js mesh for the primary selected part.
  // For group selections, we'll use a virtual anchor mesh instead.
  const targetObject = primaryPart ? meshRefRegistry.get(primaryPart.id) : null;

  // Use stable refs for the callbacks
  const updateObjectRef = useRef(updateObject);
  const selectedPartsRef = useRef(selectedParts);
  const primaryPartRef = useRef(primaryPart);
  const modeRef = useRef(mode);
  const snapToGridRef = useRef(snapToGrid);
  const gridSizeRef = useRef(gridSize);

  // Keep refs in sync
  useEffect(() => {
    updateObjectRef.current = updateObject;
    selectedPartsRef.current = selectedParts;
    primaryPartRef.current = primaryPart;
    modeRef.current = mode;
    snapToGridRef.current = snapToGrid;
    gridSizeRef.current = gridSize;
  });

  // Wait for mesh ref to be available — aggressive retry for gizmo reliability
  useEffect(() => {
    if (primaryPart && !meshRefRegistry.get(primaryPart.id)) {
      let retries = 0;
      const interval = setInterval(() => {
        retries++;
        if (meshRefRegistry.get(primaryPart.id) || retries > 20) {
          clearInterval(interval);
          forceUpdate(n => n + 1);
        }
      }, 10);
      return () => clearInterval(interval);
    }
  }, [primaryPart, forceUpdateKey]);

  // Subscribe to store changes to force re-render when selection, tool, or objects change
  useEffect(() => {
    const unsub = useStudioStore.subscribe(
      (state, prevState) => {
        if (
          state.selectedIds !== prevState.selectedIds ||
          state.activeTool !== prevState.activeTool ||
          state.objects !== prevState.objects
        ) {
          forceUpdate(n => n + 1);
        }
      }
    );
    return unsub;
  }, []);

  // Sync store position → mesh position when NOT dragging.
  // For group selections, position the gizmo at the group center.
  useEffect(() => {
    if (!primaryPart || !targetObject || isDraggingRef.current) return;
    if (isGroupSelection) {
      // Move the primary part's mesh to the group center for the gizmo
      const state = useStudioStore.getState();
      const center = computeGroupCenter(state.objects, selectedIds[0]);
      targetObject.position.set(center.x, center.y, center.z);
      targetObject.rotation.set(0, 0, 0);
      targetObject.scale.set(1, 1, 1);
    } else {
      // For shapes with unit geometry (Sphere, Cylinder), the mesh scale IS the size.
      // For Block/Wedge/Spawn, the geometry embeds the size so scale stays (1,1,1).
      const isScaledType = primaryPart.type === 'Sphere' || primaryPart.type === 'Cylinder';
      if (isScaledType) {
        targetObject.position.set(primaryPart.position.x, primaryPart.position.y, primaryPart.position.z);
        targetObject.rotation.set(
          primaryPart.rotation.x * Math.PI / 180,
          primaryPart.rotation.y * Math.PI / 180,
          primaryPart.rotation.z * Math.PI / 180
        );
        targetObject.scale.set(primaryPart.size.x, primaryPart.size.y, primaryPart.size.z);
      } else {
        targetObject.position.set(primaryPart.position.x, primaryPart.position.y, primaryPart.position.z);
        targetObject.rotation.set(
          primaryPart.rotation.x * Math.PI / 180,
          primaryPart.rotation.y * Math.PI / 180,
          primaryPart.rotation.z * Math.PI / 180
        );
        targetObject.scale.set(1, 1, 1);
      }
    }
  }, [primaryPart, targetObject, isGroupSelection, selectedIds]);

  // Real-time update via onChange/onObjectChange — update primary part in
  // store during drag. For group selections, we apply the delta from the
  // gizmo to ALL parts equally.
  const handleChange = useCallback(() => {
    if (!controlsRef.current || !targetObject) return;
    // Note: we DON'T bail out if isDraggingRef is false here. The
    // onObjectChange event fires BEFORE dragging-changed on the first
    // frame, so bailing would skip the first update. Instead, we check
    // if the controls are actually dragging via the internal property.
    if (!controlsRef.current.dragging && !isDraggingRef.current) return;

    const partId = primaryPartRef.current?.id;
    if (!partId) return;

    // Guard: Never move/resize the baseplate via the gizmo — it's infrastructure
    // that should stay at its fixed position. This prevents a bug where the gizmo
    // accidentally fires during selection transitions and grid-snapping moves the
    // baseplate from y=-0.5 to y=-1 (a 0.5m downward jump).
    const currentPart = primaryPartRef.current;
    if (currentPart?.isBaseplate) return;

    const currentMode = modeRef.current;
    const updateObj = updateObjectRef.current;
    const startMap = dragStartRef.current;
    const start = startMap.get(partId);

    if (currentMode === 'translate') {
      let x = targetObject.position.x;
      let y = targetObject.position.y;
      let z = targetObject.position.z;
      if (snapToGridRef.current) {
        const g = gridSizeRef.current;
        x = Math.round(x / g) * g;
        y = Math.round(y / g) * g;
        z = Math.round(z / g) * g;
      }
      if (start) {
        // Compute the delta from start position and apply to all parts
        const dx = x - start.position.x;
        const dy = y - start.position.y;
        const dz = z - start.position.z;
        const parts = selectedPartsRef.current;
        parts.forEach((part) => {
          const partStart = startMap.get(part.id);
          if (partStart) {
            updateObj(part.id, {
              position: {
                x: partStart.position.x + dx,
                y: partStart.position.y + dy,
                z: partStart.position.z + dz,
              },
            });
          }
        });
      } else {
        updateObj(partId, { position: { x, y, z } });
      }
    } else if (currentMode === 'rotate') {
      const euler = targetObject.rotation;
      updateObj(partId, {
        rotation: {
          x: euler.x * 180 / Math.PI,
          y: euler.y * 180 / Math.PI,
          z: euler.z * 180 / Math.PI,
        },
      });
    } else if (currentMode === 'scale') {
      // Scale mode with CAMERA-AWARE anchored scaling:
      // The face AWAY from the camera stays fixed while the face
      // closest to the camera moves. This is intuitive — the face
      // you're looking at grows toward you, the back stays put.
      const sx = targetObject.scale.x;
      const sy = targetObject.scale.y;
      const sz = targetObject.scale.z;
      // For scaled types (Sphere, Cylinder), the mesh scale IS the size,
      // so the new size is the scale directly (not size * scale).
      // For Block/Wedge/Spawn, the mesh scale is a multiplier on top of
      // geometry that already has the size baked in, so new size = start * scale.
      const isScaledType = primaryPartRef.current?.type === 'Sphere' || primaryPartRef.current?.type === 'Cylinder';
      let newSize: { x: number; y: number; z: number };
      if (isScaledType) {
        newSize = { x: Math.max(0.1, sx), y: Math.max(0.1, sy), z: Math.max(0.1, sz) };
      } else if (start) {
        newSize = {
          x: Math.max(0.1, start.size.x * sx),
          y: Math.max(0.1, start.size.y * sy),
          z: Math.max(0.1, start.size.z * sz),
        };
      } else {
        newSize = { x: Math.max(0.1, sx), y: Math.max(0.1, sy), z: Math.max(0.1, sz) };
      }
      if (snapToGridRef.current) {
        const g = gridSizeRef.current;
        newSize.x = Math.max(0.1, Math.round(newSize.x / g) * g);
        newSize.y = Math.max(0.1, Math.round(newSize.y / g) * g);
        newSize.z = Math.max(0.1, Math.round(newSize.z / g) * g);
      }
      if (start) {
        // Camera-aware anchored position:
        // scaleAnchorSign is +1 if camera is on the positive side of that
        // axis (anchor the negative face), -1 if on the negative side
        // (anchor the positive face). Only shift position for axes that
        // actually changed size.
        const anchor = scaleAnchorSignRef.current;
        const dx = newSize.x - start.size.x;
        const dy = newSize.y - start.size.y;
        const dz = newSize.z - start.size.z;
        const newPosition = {
          x: start.position.x + anchor.x * dx / 2,
          y: start.position.y + anchor.y * dy / 2,
          z: start.position.z + anchor.z * dz / 2,
        };
        updateObj(partId, { size: newSize, position: newPosition });
        // Keep the gizmo mesh position in sync
        targetObject.position.set(newPosition.x, newPosition.y, newPosition.z);
      } else {
        updateObj(partId, { size: newSize });
      }
      // Reset the visual scale — for Block/Wedge/Spawn this is (1,1,1),
      // for Sphere/Cylinder this is the new size (since they use unit geometry).
      if (isScaledType) {
        targetObject.scale.set(newSize.x, newSize.y, newSize.z);
      } else {
        targetObject.scale.set(1, 1, 1);
      }
    }
  }, [targetObject]);

  // Disable orbit controls during drag and handle drag start/end
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const onDraggingChanged = (event: any) => {
      isDraggingRef.current = event.value;
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = !event.value;
      }

      if (event.value) {
        // Drag started — store initial state of all selected parts
        const parts = selectedPartsRef.current;
        const startMap = new Map<string, { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; size: { x: number; y: number; z: number } }>();
        parts.forEach((part) => {
          startMap.set(part.id, {
            position: { ...part.position },
            rotation: { ...part.rotation },
            size: { ...part.size },
          });
        });
        dragStartRef.current = startMap;

        // Compute camera-aware scale anchor signs for anchored scaling.
        // For each axis, determine which side of the object the camera is on.
        // If camera is on the + side, anchor the - face (sign = +1).
        // If camera is on the - side, anchor the + face (sign = -1).
        // This means the face AWAY from the camera stays fixed — the
        // face you're looking at moves toward you.
        if (modeRef.current === 'scale' && parts.length > 0) {
          const primaryP = parts[0];
          const partCenter = new THREE.Vector3(
            primaryP.position.x, primaryP.position.y, primaryP.position.z
          );
          // Camera-to-part vector in world space
          const cameraToPart = camera.position.clone().sub(partCenter);
          // Transform to local space using part's inverse rotation
          const partQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            primaryP.rotation.x * Math.PI / 180,
            primaryP.rotation.y * Math.PI / 180,
            primaryP.rotation.z * Math.PI / 180
          ));
          const localCameraDir = cameraToPart.clone().applyQuaternion(partQuat.clone().invert());
          // If camera is on the + side of an axis, anchor the - face (sign = +1)
          // If camera is on the - side, anchor the + face (sign = -1)
          scaleAnchorSignRef.current = {
            x: localCameraDir.x > 0 ? 1 : -1,
            y: localCameraDir.y > 0 ? 1 : -1,
            z: localCameraDir.z > 0 ? 1 : -1,
          };
        }
      } else {
        // Drag ended — apply deltas to secondary parts (multi-select)
        const parts = selectedPartsRef.current;
        if (parts.length > 1 && dragStartRef.current.size > 0) {
          const startMap = dragStartRef.current;
          const primaryStart = startMap.get(parts[0].id);
          if (primaryStart) {
            const currentPrimary = useStudioStore.getState().objects.get(parts[0].id);
            if (currentPrimary && isPart(currentPrimary)) {
              const posDelta = {
                x: currentPrimary.position.x - primaryStart.position.x,
                y: currentPrimary.position.y - primaryStart.position.y,
                z: currentPrimary.position.z - primaryStart.position.z,
              };
              const rotDelta = {
                x: currentPrimary.rotation.x - primaryStart.rotation.x,
                y: currentPrimary.rotation.y - primaryStart.rotation.y,
                z: currentPrimary.rotation.z - primaryStart.rotation.z,
              };
              const scaleFactor = {
                x: primaryStart.size.x > 0.01 ? currentPrimary.size.x / primaryStart.size.x : 1,
                y: primaryStart.size.y > 0.01 ? currentPrimary.size.y / primaryStart.size.y : 1,
                z: primaryStart.size.z > 0.01 ? currentPrimary.size.z / primaryStart.size.z : 1,
              };

              for (let i = 1; i < parts.length; i++) {
                const partStart = startMap.get(parts[i].id);
                if (!partStart) continue;
                const currentMode = modeRef.current;
                if (currentMode === 'translate') {
                  let newPos = {
                    x: partStart.position.x + posDelta.x,
                    y: partStart.position.y + posDelta.y,
                    z: partStart.position.z + posDelta.z,
                  };
                  if (snapToGridRef.current) {
                    const g = gridSizeRef.current;
                    newPos = {
                      x: Math.round(newPos.x / g) * g,
                      y: Math.round(newPos.y / g) * g,
                      z: Math.round(newPos.z / g) * g,
                    };
                  }
                  updateObjectRef.current(parts[i].id, { position: newPos });
                } else if (currentMode === 'rotate') {
                  // Compute delta as a quaternion (euler addition is incorrect for rotation composition)
                  const startEuler = new THREE.Euler(
                    primaryStart.rotation.x * Math.PI / 180,
                    primaryStart.rotation.y * Math.PI / 180,
                    primaryStart.rotation.z * Math.PI / 180
                  );
                  const startQuat = new THREE.Quaternion().setFromEuler(startEuler);
                  const currentEuler = new THREE.Euler(
                    currentPrimary.rotation.x * Math.PI / 180,
                    currentPrimary.rotation.y * Math.PI / 180,
                    currentPrimary.rotation.z * Math.PI / 180
                  );
                  const currentQuat = new THREE.Quaternion().setFromEuler(currentEuler);
                  // Delta = current * startInverse (relative rotation)
                  const deltaQuat = currentQuat.clone().multiply(startQuat.invert());

                  // Apply delta quaternion to each secondary part
                  const partStartEuler = new THREE.Euler(
                    partStart.rotation.x * Math.PI / 180,
                    partStart.rotation.y * Math.PI / 180,
                    partStart.rotation.z * Math.PI / 180
                  );
                  const partStartQuat = new THREE.Quaternion().setFromEuler(partStartEuler);
                  const newQuat = deltaQuat.clone().multiply(partStartQuat);
                  const newEuler = new THREE.Euler().setFromQuaternion(newQuat);

                  updateObjectRef.current(parts[i].id, {
                    position: {
                      x: partStart.position.x + posDelta.x,
                      y: partStart.position.y + posDelta.y,
                      z: partStart.position.z + posDelta.z,
                    },
                    rotation: {
                      x: newEuler.x * 180 / Math.PI,
                      y: newEuler.y * 180 / Math.PI,
                      z: newEuler.z * 180 / Math.PI,
                    },
                  });
                }
                // Note: 'scale' mode multi-select is not supported via
                // TransformControls — scale mode is handled by the gizmo
                // scaling. Multi-part uniform scaling is available via the
                // Apply Scale button in the ScaleControl popup.
              }
            }
          }
        }

        dragStartRef.current = new Map();
      }
    };

    controls.addEventListener('dragging-changed', onDraggingChanged);
    return () => controls.removeEventListener('dragging-changed', onDraggingChanged);
  }, [orbitControlsRef, targetObject]);

  if (!primaryPart || !targetObject || playState.isPlaying || simulationState.isSimulating) return null;
  // Show gizmo for Move/Rotate/Scale tools, AND for Select tool when a group is selected.
  if (activeTool !== 'Move' && activeTool !== 'Rotate' && activeTool !== 'Scale' && !(activeTool === 'Select' && isGroupSelection)) return null;

  return (
    <TransformControls
      ref={controlsRef}
      object={targetObject}
      mode={mode}
      onChange={handleChange}
      onObjectChange={handleChange}
      translationSnap={snapToGrid ? gridSize : null}
      rotationSnap={snapToGrid ? THREE.MathUtils.degToRad(15) : null}
    />
  );
}

// ─── Face Scale Highlights (visual only — TransformControls handles the drag) ───
//
// Renders 6 face-sized transparent planes over each face of the selected
// part when the Scale tool is active. These are VISUAL ONLY — they show
// which face is being hovered and highlight the face. The actual resize
// gizmo is the Three.js TransformControls in 'scale' mode, which provides
// the standard 3-axis + uniform scale gizmo that works reliably with any
// camera angle.

function FaceScaleHighlights() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const playState = useStudioStore((s) => s.playState);
  const simulationState = useStudioStore((s) => s.simulationState);

  // Subscribe to the primary selected part
  const part = useStudioStore((s): StudioPart | null => {
    if (s.selectedIds.length !== 1) return null;
    const obj = s.objects.get(s.selectedIds[0]);
    return obj && isPart(obj) ? obj : null;
  });

  if (!part || playState.isPlaying || simulationState.isSimulating) return null;
  if (activeTool !== 'Scale') return null;

  const faces: Array<{ axis: 'x' | 'y' | 'z'; sign: 1 | -1; key: string }> = [
    { axis: 'x', sign: 1, key: 'x+' },
    { axis: 'x', sign: -1, key: 'x-' },
    { axis: 'y', sign: 1, key: 'y+' },
    { axis: 'y', sign: -1, key: 'y-' },
    { axis: 'z', sign: 1, key: 'z+' },
    { axis: 'z', sign: -1, key: 'z-' },
  ];

  const faceOffset = 0.005;

  return (
    <group
      position={[part.position.x, part.position.y, part.position.z]}
      rotation={[part.rotation.x * Math.PI / 180, part.rotation.y * Math.PI / 180, part.rotation.z * Math.PI / 180]}
    >
      {faces.map((face) => {
        let planeW: number, planeH: number;
        if (face.axis === 'x') {
          planeW = part.size.z; planeH = part.size.y;
        } else if (face.axis === 'y') {
          planeW = part.size.x; planeH = part.size.z;
        } else {
          planeW = part.size.x; planeH = part.size.y;
        }

        const localPos: [number, number, number] = [0, 0, 0];
        if (face.axis === 'x') localPos[0] = face.sign * (part.size.x / 2 + faceOffset);
        if (face.axis === 'y') localPos[1] = face.sign * (part.size.y / 2 + faceOffset);
        if (face.axis === 'z') localPos[2] = face.sign * (part.size.z / 2 + faceOffset);

        let rot: [number, number, number] = [0, 0, 0];
        if (face.axis === 'x') rot = [0, face.sign * Math.PI / 2, 0];
        else if (face.axis === 'y') rot = [face.sign * -Math.PI / 2, 0, 0];
        else rot = [0, face.sign * Math.PI, 0];

        const color = face.axis === 'x' ? '#ef4444' : face.axis === 'y' ? '#22c55e' : '#3b82f6';

        return (
          <mesh
            key={face.key}
            position={localPos}
            rotation={rot}
            raycast={() => {}}
          >
            <planeGeometry args={[planeW, planeH]} />
            <meshBasicMaterial
              color={color}
              depthTest={false}
              transparent
              opacity={0.06}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Physics Simulation (connected to viewport — physics only, no character) ───

export function PhysicsSimulation({ orbitControlsRef }: { orbitControlsRef: React.MutableRefObject<any> }) {
  const { playState, setPlayState, objects, physicsSettings, joints, terrainSettings, showTerrain, updateObject, addConsoleMessage } = useStudioStore();

  const worldRef = useRef<PhysicsWorld | null>(null);

  // Initialize / rebuild physics world when play mode starts
  useEffect(() => {
    if (!playState.isPlaying) {
      // Safety net: stop the engine if it wasn't stopped already (idempotent)
      weildCodeEngine.stop();

      // Note: State restoration is handled by the store's stopPlayMode(), which
      // sets isPlaying=false BEFORE restoring the snapshot, so no useFrame can
      // overwrite the restored state. We just clean up the physics world here.

      worldRef.current = null;
      (window as any).__weildPhysicsWorld = null; // Clear for PlayCharacter
      return;
    }

    const world = new PhysicsWorld(physicsSettings);
    worldRef.current = world;
    (window as any).__weildPhysicsWorld = world; // Expose for PlayCharacter

    // Add all parts to the physics world — including spawn points (they're real
    // parts now, with collision, so the character can stand on them).
    objects.forEach((obj) => {
      if (isPart(obj) && !obj.isCharacterPart && obj.showInWorld !== false) {
        world.addBody(obj);
      }
    });

    // Add terrain heightmap as a collidable surface (if terrain exists)
    const currentState = useStudioStore.getState();
    if (currentState.terrainHeightmap) {
      world.addTerrain(currentState.terrainHeightmap);
      addConsoleMessage('info', 'Terrain collision added — parts will collide with the heightmap');
    }

    // Add trees as collidable static boxes (if any trees exist)
    if (currentState.treeInstances.length > 0) {
      world.addTrees(currentState.treeInstances);
      addConsoleMessage('info', `Tree collision added — ${currentState.treeInstances.length} tree(s)`);
    }

    // Add joints
    world.joints = [...joints];

    addConsoleMessage('info', 'Physics simulation started — unanchored parts will respond to gravity');

    // Start WeildCode engine — rules only run during play mode
    weildCodeEngine.start();
    addConsoleMessage('info', 'WeildCode engine started — rules are now active');
  }, [playState.isPlaying]);

  // Physics step via useFrame
  useFrame((_, delta) => {
    // Read directly from store to avoid stale closure — critical for proper stop behavior
    const currentPlayState = useStudioStore.getState().playState;
    if (!currentPlayState.isPlaying || !worldRef.current) return;

    const world = worldRef.current;
    const dt = Math.min(delta, 1 / 30);
    const currentObjects = useStudioStore.getState().objects;
    const currentUpdateObject = useStudioStore.getState().updateObject;

    // Sync body movers from store to physics world (handles explosions, etc.)
    currentObjects.forEach((obj) => {
      if (!isPart(obj)) return;
      const body = world.bodies.get(obj.id);
      if (!body) return;

      // Check for new/changed body movers — convert explosion forces to impulses
      const storeMovers = obj.bodyMovers || [];
      const explosionMovers: string[] = [];

      for (const mover of storeMovers) {
        if (mover.id.startsWith('explosion_') && mover.enabled) {
          // Explosion body movers should be applied as impulses, not persistent forces
          if (mover.type === 'BodyForce' && mover.force) {
            world.addImpulse(obj.id, mover.force, 0.15);
          }
          explosionMovers.push(mover.id);
        }
      }

      // Remove processed explosion movers from store
      if (explosionMovers.length > 0) {
        const remaining = storeMovers.filter(m => !explosionMovers.includes(m.id));
        currentUpdateObject(obj.id, { bodyMovers: remaining } as any);
        body.bodyMovers = [...remaining];
      } else {
        // Sync non-explosion body movers if they differ
        if (body.bodyMovers.length !== storeMovers.length) {
          body.bodyMovers = [...storeMovers];
        } else {
          // Check if any movers differ by id
          for (let i = 0; i < storeMovers.length; i++) {
            if (body.bodyMovers[i]?.id !== storeMovers[i]?.id) {
              body.bodyMovers = [...storeMovers];
              break;
            }
          }
        }
      }

      // Sync anchored state changes during play mode
      if (body.anchored !== obj.anchored) {
        body.anchored = obj.anchored;
        if (!obj.anchored) {
          body.isAwake = true;
        }
      }
    });

    // Sync joints from store
    const storeJoints = useStudioStore.getState().joints;
    if (world.joints.length !== storeJoints.length) {
      world.joints = [...storeJoints];
    }

    // Step physics for all bodies (no character — just simulate gravity/collisions)
    world.step(dt);

    // Update water state for all bodies
    const currentTerrainSettings = useStudioStore.getState().terrainSettings;
    const currentShowTerrain = useStudioStore.getState().showTerrain;
    if (currentShowTerrain && currentTerrainSettings.waterHeight) {
      for (const body of world.bodies.values()) {
        world.setWaterState(body.id, currentTerrainSettings.waterHeight);
      }
    }

    // Sync physics back to store (for visual updates)
    // Double-check isPlaying before writing (snapshot restore may have just happened)
    if (!useStudioStore.getState().playState.isPlaying) return;
    currentObjects.forEach((obj) => {
      if (!isPart(obj)) return;
      const body = world.bodies.get(obj.id);
      if (!body || body.anchored) return;

      const dx = Math.abs(body.position.x - obj.position.x);
      const dy = Math.abs(body.position.y - obj.position.y);
      const dz = Math.abs(body.position.z - obj.position.z);

      if (dx > 0.01 || dy > 0.01 || dz > 0.01) {
        currentUpdateObject(obj.id, {
          position: { x: body.position.x, y: body.position.y, z: body.position.z },
          rotation: { x: body.rotation.x, y: body.rotation.y, z: body.rotation.z },
        } as any);
      }
    });

  });

  if (!playState.isPlaying) return null;

  return null; // No character — just physics simulation
}

// ─── Play Character (controllable character during Test Play mode) ───

export function PlayCharacter({ orbitControlsRef }: { orbitControlsRef: React.MutableRefObject<any> }) {
  const { playState, setPlayState, objects, worldSettings, avatar } = useStudioStore();
  const controllerRef = useRef<CharacterController | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const walkPhaseRef = useRef(0);
  const isJumpingRef = useRef(false);

  // Initialize character controller when test play mode starts
  useEffect(() => {
    if (!playState.isPlaying || !playState.isTestPlay) {
      controllerRef.current = null;
      return;
    }

    // Find spawn point: check for spawn point parts first, then fall back to world origin
    let spawnPos: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0 };
    objects.forEach((obj) => {
      if (isPart(obj) && obj.isSpawnPoint) {
        spawnPos = { x: obj.position.x, y: obj.position.y + 1, z: obj.position.z };
      }
    });

    const controller = new CharacterController(spawnPos);
    controllerRef.current = controller;

    // Set initial character position in store
    setPlayState({
      characterPosition: { ...spawnPos },
      characterVelocity: { x: 0, y: 0, z: 0 },
      isGrounded: false,
      characterRotation: 0,
    });
  }, [playState.isPlaying, playState.isTestPlay]);

  // Frame update: step the character controller and sync to store + visual
  useFrame((_, delta) => {
    // Read directly from store to avoid stale closure
    const currentPlayState = useStudioStore.getState().playState;
    if (!currentPlayState.isPlaying || !currentPlayState.isTestPlay || !controllerRef.current) return;

    const controller = controllerRef.current;
    const dt = Math.min(delta, 1 / 30);

    // Get physics bodies from the PhysicsSimulation's world (stored on window)
    const world = (window as any).__weildPhysicsWorld as PhysicsWorld | undefined;
    const bodies: PhysicsBody[] = [];
    if (world) {
      for (const body of world.bodies.values()) {
        bodies.push(body);
      }
    }

    // Step the character controller
    controller.step(dt, playInput, bodies);

    // Safety net: if character falls below y=-50, respawn at spawn point
    if (controller.position.y < -50) {
      const state = useStudioStore.getState();
      let spawnPos = { x: 0, y: 5, z: 0 };
      state.objects.forEach((obj) => {
        if (isPart(obj) && obj.isSpawnPoint) {
          spawnPos = { x: obj.position.x, y: obj.position.y + 2, z: obj.position.z };
        }
      });
      controller.position = { ...spawnPos };
      controller.velocity = { x: 0, y: 0, z: 0 };
    }

    // Update walk animation phase
    const isMoving = playInput.forward || playInput.backward || playInput.left || playInput.right;
    if (isMoving && controller.isGrounded) {
      walkPhaseRef.current += dt * 8; // walking animation speed
    } else {
      walkPhaseRef.current *= 0.9; // slow down to idle
    }

    isJumpingRef.current = !controller.isGrounded;

    // Sync position to store
    setPlayState({
      characterPosition: { ...controller.position },
      characterVelocity: { ...controller.velocity },
      isGrounded: controller.isGrounded,
      characterRotation: controller.rotationY,
    });

    // Update visual position
    if (groupRef.current) {
      groupRef.current.position.set(controller.position.x, controller.position.y, controller.position.z);
      groupRef.current.rotation.y = controller.rotationY;
    }

    // Camera follow: lerp orbit controls target to character
    if (orbitControlsRef.current) {
      const target = new THREE.Vector3(
        controller.position.x,
        controller.position.y + 1.0, // look at character center (waist height)
        controller.position.z
      );
      orbitControlsRef.current.target.lerp(target, 0.1);
      orbitControlsRef.current.update();
    }
  });

  if (!playState.isPlaying) return null;

  // Only render character during Test Play (not regular Play mode)
  if (!playState.isTestPlay) return null;

  return (
    <group ref={groupRef} position={[playState.characterPosition.x, playState.characterPosition.y, playState.characterPosition.z]}>
      <WeildBuildCharacter
        avatar={avatar || DEFAULT_AVATAR}
        animate
        walkPhaseRef={walkPhaseRef}
        isJumpingRef={isJumpingRef}
      />
    </group>
  );
}

// ─── Simulation Only (inline physics, no character, editor stays active) ───

function SimulationOnly() {
  const { simulationState, objects, physicsSettings, joints, terrainSettings, showTerrain, updateObject, addConsoleMessage } = useStudioStore();
  const worldRef = useRef<PhysicsWorld | null>(null);

  // Initialize / rebuild physics world when simulation starts
  useEffect(() => {
    if (!simulationState.isSimulating) {
      worldRef.current = null;
      return;
    }

    const world = new PhysicsWorld(physicsSettings);
    worldRef.current = world;

    // Add all parts to the physics world — including spawn points (they're real
    // parts now, with collision, so the character can stand on them).
    objects.forEach((obj) => {
      if (isPart(obj) && !obj.isCharacterPart && obj.showInWorld !== false) {
        world.addBody(obj);
      }
    });

    // Add terrain heightmap + trees as collidable surfaces (same as play mode)
    const currentState = useStudioStore.getState();
    if (currentState.terrainHeightmap) {
      world.addTerrain(currentState.terrainHeightmap);
    }
    if (currentState.treeInstances.length > 0) {
      world.addTrees(currentState.treeInstances);
    }

    // Add joints
    world.joints = [...joints];

    addConsoleMessage('info', 'Inline simulation active — unanchored parts will fall');
  }, [simulationState.isSimulating]);

  // Physics step via useFrame — only for simulation mode
  useFrame((_, delta) => {
    // Read directly from store to avoid stale closure
    if (!useStudioStore.getState().simulationState.isSimulating || !worldRef.current) return;

    const world = worldRef.current;
    const dt = Math.min(delta, 1 / 30);
    const currentObjects = useStudioStore.getState().objects;
    const currentUpdateObject = useStudioStore.getState().updateObject;

    // Sync body movers from store to physics world (handles explosions, etc.)
    currentObjects.forEach((obj) => {
      if (!isPart(obj)) return;
      const body = world.bodies.get(obj.id);
      if (!body) return;

      // Check for new/changed body movers — convert explosion forces to impulses
      const storeMovers = obj.bodyMovers || [];
      const explosionMovers: string[] = [];

      for (const mover of storeMovers) {
        if (mover.id.startsWith('explosion_') && mover.enabled) {
          if (mover.type === 'BodyForce' && mover.force) {
            world.addImpulse(obj.id, mover.force, 0.15);
          }
          explosionMovers.push(mover.id);
        }
      }

      // Remove processed explosion movers from store
      if (explosionMovers.length > 0) {
        const remaining = storeMovers.filter(m => !explosionMovers.includes(m.id));
        currentUpdateObject(obj.id, { bodyMovers: remaining } as any);
        body.bodyMovers = [...remaining];
      } else {
        // Sync non-explosion body movers if they differ
        if (body.bodyMovers.length !== storeMovers.length) {
          body.bodyMovers = [...storeMovers];
        } else {
          for (let i = 0; i < storeMovers.length; i++) {
            if (body.bodyMovers[i]?.id !== storeMovers[i]?.id) {
              body.bodyMovers = [...storeMovers];
              break;
            }
          }
        }
      }

      // Sync anchored state changes during simulation
      if (body.anchored !== obj.anchored) {
        body.anchored = obj.anchored;
        if (!obj.anchored) {
          body.isAwake = true;
        }
      }

      // For anchored parts, sync position from store (user may have moved them via transform controls)
      if (obj.anchored) {
        body.position.x = obj.position.x;
        body.position.y = obj.position.y;
        body.position.z = obj.position.z;
      }
    });

    // Sync joints from store
    const storeJoints = useStudioStore.getState().joints;
    if (world.joints.length !== storeJoints.length) {
      world.joints = [...storeJoints];
    }

    // Step physics for all bodies (no character)
    world.step(dt);

    // Update water state for all bodies
    const currentTerrainSettings = useStudioStore.getState().terrainSettings;
    const currentShowTerrain = useStudioStore.getState().showTerrain;
    if (currentShowTerrain && currentTerrainSettings.waterHeight) {
      for (const body of world.bodies.values()) {
        world.setWaterState(body.id, currentTerrainSettings.waterHeight);
      }
    }

    // Sync physics back to store — only for unanchored parts
    // Double-check simulation is still active before writing
    if (!useStudioStore.getState().simulationState.isSimulating) return;
    currentObjects.forEach((obj) => {
      if (!isPart(obj)) return;
      const body = world.bodies.get(obj.id);
      if (!body || body.anchored) return;

      const dx = Math.abs(body.position.x - obj.position.x);
      const dy = Math.abs(body.position.y - obj.position.y);
      const dz = Math.abs(body.position.z - obj.position.z);

      if (dx > 0.01 || dy > 0.01 || dz > 0.01) {
        currentUpdateObject(obj.id, {
          position: { x: body.position.x, y: body.position.y, z: body.position.z },
          rotation: { x: body.rotation.x, y: body.rotation.y, z: body.rotation.z },
        } as any);
      }
    });
  });

  return null; // No visual — the editor remains as-is
}

// ─── Terrain Mesh (v2) ───
// New terrain system: seed-driven procedural heightmap + brush-editable surface.
// The heightmap is stored in the studio store (terrainHeightmap). Rendering reads
// from that heightmap and builds an instanced block field — one block per cell,
// sized to match the cell's height. This keeps the world's blocky aesthetic while
// delivering smooth, natural terrain shapes (no harsh spikes).

import {
  generateTreeBlocks,
  getHeightAt as getHeightAtV2,
  terrainWorldSize,
  getCellColor,
} from '@/lib/terrain-v2';
import type { TreeBlock } from '@/lib/terrain-v2';

function TerrainMeshV2() {
  const { showTerrain, terrainHeightmap, terrainConfig, terrainColor, terrainLayers, activeTool, brushSettings, brushPaintColor } = useStudioStore();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null);
  const isPointerDownRef = useRef(false);
  const lastBrushPosRef = useRef<{ x: number; z: number } | null>(null);

  const isBrush = activeTool.startsWith('Brush');
  const isPlaceTree = activeTool === 'PlaceTree';
  const isInteractive = (isBrush || isPlaceTree) && !!terrainHeightmap;

  // Build geometry + color data for the heightmap.
  //
  // Each grid cell produces (1 + terrainLayers.length) block instances:
  //   • 1 surface block (colored by biome/paint)
  //   • 1 block per terrain layer (colored by the layer's color, unless painted)
  //
  // Surface block: spans from (topY - 1) to topY, so it's always 1 block thick.
  // Layer blocks: each layer's thickness determines how many blocks deep it goes,
  //   but we render each layer as a SINGLE scaled block (not N individual blocks)
  //   for performance — so a layer with thickness=3 becomes one block of height 3.
  //
  // Colors use getCellColor() which respects paint overrides → layer colors →
  // biome fallback.
  const buildData = useMemo(() => {
    if (!showTerrain || !terrainHeightmap) return null;

    const { width, length, cellSize, heights } = terrainHeightmap;
    const halfW = (width * cellSize) / 2;
    const halfL = (length * cellSize) / 2;
    const baseY = terrainConfig.baseHeight;
    const seaLevel = terrainConfig.seaLevel;
    const amplitude = terrainConfig.amplitude;

    // Total instances: 1 surface block + 1 block per layer, per cell
    const blocksPerCell = 1 + terrainLayers.length;
    const count = width * length * blocksPerCell;
    const dummy = new THREE.Object3D();
    const matrices = new Float32Array(count * 16);
    // Store color hex strings — we'll convert to THREE.Color in the effect.
    // Using strings avoids color-space double-conversion issues.
    const colorHexes: string[] = new Array(count);

    // Biome fallback colors (used when no paint and no layers)
    const sandHex = '#d9c89a';
    const grassHex = terrainColor;
    const dirtHex = '#8b7355';
    const snowHex = '#f0f0f0';
    const underwaterHex = '#5a7b8a';

    let instanceIdx = 0;

    for (let x = 0; x < width; x++) {
      for (let z = 0; z < length; z++) {
        const gridIdx = x * length + z;
        const h = Math.max(baseY, heights[gridIdx]);
        const worldX = (x + 0.5) * cellSize - halfW;
        const worldZ = (z + 0.5) * cellSize - halfL;
        const topY = Math.round(h);

        // ── Surface block (1 block thick at the top) ──
        // Color: paint override → biome color based on height
        let surfaceHex: string;
        if (topY < seaLevel) {
          surfaceHex = underwaterHex;
        } else if (topY <= seaLevel + 0.5) {
          surfaceHex = sandHex;
        } else if (topY < seaLevel + amplitude * 0.35) {
          surfaceHex = grassHex;
        } else if (topY < seaLevel + amplitude * 0.7) {
          surfaceHex = dirtHex;
        } else {
          surfaceHex = snowHex;
        }
        // If there are layers, the surface block uses layer[0]'s color (or paint)
        const surfaceColor = terrainLayers.length > 0
          ? getCellColor(terrainHeightmap, gridIdx, 0, terrainLayers, surfaceHex)
          : getCellColor(terrainHeightmap, gridIdx, 0, [], surfaceHex);

        const surfaceBottomY = topY - 1;
        dummy.position.set(worldX, (topY + surfaceBottomY) / 2, worldZ);
        dummy.scale.set(cellSize, 1, cellSize);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        matrices.set(dummy.matrix.elements, instanceIdx * 16);
        colorHexes[instanceIdx] = surfaceColor;
        instanceIdx++;

        // ── Layer blocks (one scaled block per layer, stacked below surface) ──
        let currentTop = surfaceBottomY; // bottom of the surface block
        for (let li = 0; li < terrainLayers.length; li++) {
          const layer = terrainLayers[li];
          const layerThickness = Math.max(1, layer.thickness);
          const layerBottom = currentTop - layerThickness;
          const layerColor = getCellColor(
            terrainHeightmap,
            gridIdx,
            1 + li, // depth below surface = 1 for first layer, 2 for second, etc.
            terrainLayers,
            surfaceHex
          );

          dummy.position.set(worldX, (currentTop + layerBottom) / 2, worldZ);
          dummy.scale.set(cellSize, layerThickness, cellSize);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          matrices.set(dummy.matrix.elements, instanceIdx * 16);
          colorHexes[instanceIdx] = layerColor;
          instanceIdx++;

          currentTop = layerBottom;
        }
      }
    }

    return { count: instanceIdx, matrices, colorHexes, cellSize };
  }, [showTerrain, terrainHeightmap, terrainConfig, terrainColor, terrainLayers]);

  // Apply to instanced mesh
  useEffect(() => {
    if (!meshRef.current || !buildData) return;
    const dummy = new THREE.Object3D();
    const colorObj = new THREE.Color();
    for (let i = 0; i < buildData.count; i++) {
      dummy.matrix.fromArray(buildData.matrices, i * 16);
      meshRef.current.setMatrixAt(i, dummy.matrix);
      // Use the hex string directly — THREE.Color handles sRGB→linear conversion
      colorObj.set(buildData.colorHexes[i]);
      meshRef.current.setColorAt(i, colorObj);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
  }, [buildData]);

  // Geometry: 1×1×1 box, scaled per-instance
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // Sync brush type when active tool changes
  useEffect(() => {
    if (isBrush) {
      const brushType = activeTool.slice(5).toLowerCase() as any;
      const updates: any = { type: brushType };
      if (brushType === 'paint') updates.paintColor = useStudioStore.getState().brushPaintColor;
      useStudioStore.getState().setBrushSettings(updates);
    }
  }, [activeTool, isBrush]);

  // Sync paint color
  useEffect(() => {
    if (brushSettings.type === 'paint' && brushPaintColor) {
      useStudioStore.getState().setBrushSettings({ paintColor: brushPaintColor });
    }
  }, [brushPaintColor, brushSettings.type]);

  // Pointer handlers — attached to a transparent plane at ground level.
  // The plane is visible (opacity=0) so R3F raycasts against it. The terrain
  // instancedMesh has no pointer handlers, so R3F propagates events through it
  // to this plane. e.point gives the XZ intersection at y=0, which is correct
  // for brush application (the heightmap is a 2D grid indexed by XZ).
  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isInteractive) return;
    setCursor({ x: e.point.x, z: e.point.z });

    if (isBrush && isPointerDownRef.current && lastBrushPosRef.current) {
      useStudioStore.getState().applyBrushStroke(
        lastBrushPosRef.current.x,
        lastBrushPosRef.current.z,
        e.point.x,
        e.point.z
      );
    }
    if (isBrush) {
      lastBrushPosRef.current = { x: e.point.x, z: e.point.z };
    }
  }, [isInteractive, isBrush]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isInteractive) return;
    e.stopPropagation();
    isPointerDownRef.current = true;
    lastBrushPosRef.current = { x: e.point.x, z: e.point.z };

    if (isBrush) {
      useStudioStore.getState().applyBrushAt(e.point.x, e.point.z);
    } else if (isPlaceTree) {
      const hm = useStudioStore.getState().terrainHeightmap;
      if (hm) {
        // Check if the click is within the terrain bounds — don't place trees
        // off the terrain (above the void).
        const { width, length, cellSize } = hm;
        const halfW = (width * cellSize) / 2;
        const halfL = (length * cellSize) / 2;
        if (Math.abs(e.point.x) > halfW || Math.abs(e.point.z) > halfL) {
          useStudioStore.getState().addConsoleMessage('warn', 'Cannot place tree outside the terrain — click on the terrain surface');
          return;
        }
        const surfaceY = getHeightAtV2(hm, e.point.x, e.point.z);
        useStudioStore.getState().addTree({
          position: { x: e.point.x, y: surfaceY, z: e.point.z },
          variant: useStudioStore.getState().activeTreeVariant,
        });
        useStudioStore.getState().addConsoleMessage(
          'success',
          `Placed ${useStudioStore.getState().activeTreeVariant} tree at (${e.point.x.toFixed(1)}, ${surfaceY.toFixed(1)}, ${e.point.z.toFixed(1)})`
        );
      }
    }
  }, [isInteractive, isBrush, isPlaceTree]);

  const handlePointerUp = useCallback(() => {
    isPointerDownRef.current = false;
    lastBrushPosRef.current = null;
  }, []);

  // Clean up when leaving interactive mode
  useEffect(() => {
    if (!isInteractive) {
      setCursor(null);
      isPointerDownRef.current = false;
      lastBrushPosRef.current = null;
    }
  }, [isInteractive]);

  // Get cursor Y for rendering the ring (sample the heightmap)
  const cursorY = cursor && terrainHeightmap ? getHeightAtV2(terrainHeightmap, cursor.x, cursor.z) : 0;
  const worldSize = terrainHeightmap ? terrainWorldSize(terrainHeightmap) : { width: 0, length: 0 };

  if (!showTerrain || !buildData || !terrainHeightmap) return null;

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[boxGeo, undefined, buildData.count]}
        castShadow
        receiveShadow
      >
        {/* NOTE: Do NOT set vertexColors — that looks for geometry vertex colors (which
            don't exist) and makes everything black. Three.js auto-applies instanceColor
            when setColorAt is used. */}
        <meshStandardMaterial roughness={0.85} metalness={0} />
      </instancedMesh>

      {/* Transparent plane at y=0 — captures pointer events for brushes and tree placement.
          Must be visible=true with opacity=0 (R3F skips raycasting for visible=false objects).
          Positioned at y=0 (ground level); e.point gives XZ at ground level. */}
      {isInteractive && (
        <mesh
          position={[0, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <planeGeometry args={[worldSize.width * 3, worldSize.length * 3]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Brush cursor circle — follows the mouse on the terrain surface */}
      {isBrush && cursor && (
        <mesh position={[cursor.x, cursorY + 0.5, cursor.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[brushSettings.size * 0.7, brushSettings.size, 32]} />
          <meshBasicMaterial
            color={
              brushSettings.type === 'paint'
                ? (brushSettings.paintColor || brushPaintColor)
                : brushSettings.type === 'lower' || brushSettings.type === 'erode'
                ? '#ff5555'
                : '#55ff88'
            }
            transparent
            opacity={0.9}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Tree placement cursor */}
      {isPlaceTree && cursor && (
        <mesh position={[cursor.x, cursorY + 0.5, cursor.z]}>
          <coneGeometry args={[0.3, 1, 6]} />
          <meshBasicMaterial color="#88ff88" transparent opacity={0.7} depthTest={false} />
        </mesh>
      )}
    </>
  );
}

// ─── Water Bodies Renderer (v2) ───
// Each water body is an independent translucent box with wave animation
// and an optional flow-direction arrow visualization.

function WaterBodiesRenderer() {
  const waterBodies = useStudioStore((s) => s.waterBodies);

  if (waterBodies.length === 0) return null;

  return (
    <group>
      {waterBodies.map((body) => (
        <WaterBodyMesh key={body.id} body={body} />
      ))}
    </group>
  );
}

function WaterBodyMesh({ body }: { body: import('@/lib/terrain-v2').WaterBody }) {
  const meshRef = useRef<THREE.Mesh>(null);
  // Slight wave animation on the surface
  useFrame((state) => {
    if (!meshRef.current || !body.enabled) return;
    const t = state.clock.elapsedTime;
    meshRef.current.position.y = body.position.y + Math.sin(t * 0.8) * body.waveAmplitude * 0.3;
  });

  if (!body.enabled) return null;

  // Flow arrow direction (only when current is non-zero)
  const flowLen = Math.sqrt(
    body.flowDirection.x ** 2 + body.flowDirection.y ** 2 + body.flowDirection.z ** 2
  );
  const flowAngle = Math.atan2(body.flowDirection.z, body.flowDirection.x);

  return (
    <group position={[body.position.x, 0, body.position.z]}>
      {/* Water volume — a translucent box centered at body.position.y, depth = body.size.y */}
      <mesh
        ref={meshRef}
        position={[0, body.position.y - body.size.y / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[body.size.x, body.size.y, body.size.z]} />
        <meshStandardMaterial
          color={body.color}
          transparent
          opacity={1 - body.transparency}
          roughness={0.1}
          metalness={0.2}
          depthWrite={false}
        />
      </mesh>
      {/* Flow direction arrow (visible only when currentStrength > 0) */}
      {body.currentStrength > 0 && flowLen > 0 && (
        <group position={[0, body.position.y + 0.5, 0]} rotation={[0, -flowAngle, 0]}>
          <mesh position={[0, 0, 0]}>
            <coneGeometry args={[0.4, 1.2, 4]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={0.3}
              transparent
              opacity={0.7}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ─── Tree Instances Renderer (v2) ───
// Renders all trees in treeInstances. Each tree is composed of blocky cubes
// (trunk + canopy). We collect all blocks across all trees, group by color,
// and render each color group as a single InstancedMesh for performance.

function TreeInstancesRenderer() {
  const treeInstances = useStudioStore((s) => s.treeInstances);

  // Compute all blocks across all trees, grouped by color
  const groupedBlocks = useMemo(() => {
    const byColor = new Map<string, { position: THREE.Vector3; size: THREE.Vector3 }[]>();
    for (const tree of treeInstances) {
      const blocks = generateTreeBlocks(tree);
      for (const b of blocks) {
        const key = b.color;
        let arr = byColor.get(key);
        if (!arr) {
          arr = [];
          byColor.set(key, arr);
        }
        arr.push({
          position: new THREE.Vector3(b.position.x, b.position.y, b.position.z),
          size: new THREE.Vector3(b.size.x, b.size.y, b.size.z),
        });
      }
    }
    return Array.from(byColor.entries()).map(([color, blocks]) => ({ color, blocks }));
  }, [treeInstances]);

  if (groupedBlocks.length === 0) return null;

  return (
    <group>
      {groupedBlocks.map(({ color, blocks }) => (
        <TreeColorGroup key={color} color={color} blocks={blocks} />
      ))}
    </group>
  );
}

function TreeColorGroup({ color, blocks }: { color: string; blocks: { position: THREE.Vector3; size: THREE.Vector3 }[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < blocks.length; i++) {
      dummy.position.copy(blocks[i].position);
      dummy.scale.copy(blocks[i].size);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
  }, [blocks]);

  return (
    <instancedMesh ref={meshRef} args={[boxGeo, undefined, blocks.length]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
    </instancedMesh>
  );
}

// ─── Brush Cursor + Click Handler ───
// Renders a circle on the terrain under the cursor showing where the brush
// will apply. Handles clicks/drags to apply the active brush tool.

function isBrushTool(tool: string): tool is
  | 'BrushRaise' | 'BrushLower' | 'BrushSmooth'
  | 'BrushFlatten' | 'BrushErode' | 'BrushSculpt' | 'BrushPaint' {
  return tool.startsWith('Brush');
}

function brushToolToBrushType(tool: string): import('@/lib/terrain-v2').BrushType {
  // Strip the 'Brush' prefix and lowercase the first char
  const suffix = tool.slice(5); // 'Raise', 'Lower', etc.
  return suffix.toLowerCase() as import('@/lib/terrain-v2').BrushType;
}

function BrushCursor() {
  const { activeTool, terrainHeightmap, brushSettings, brushPaintColor } = useStudioStore();
  const [cursor, setCursor] = useState<{ x: number; y: number; z: number } | null>(null);
  const isPointerDownRef = useRef(false);
  const lastBrushPosRef = useRef<{ x: number; z: number } | null>(null);

  // Show cursor only when a brush tool or PlaceTree tool is active
  const isBrush = isBrushTool(activeTool);
  const isPlaceTree = activeTool === 'PlaceTree';
  const shouldShow = (isBrush || isPlaceTree) && !!terrainHeightmap;

  // Update brush type + paint color on the store when the active tool changes
  useEffect(() => {
    if (isBrush) {
      const brushType = brushToolToBrushType(activeTool);
      useStudioStore.getState().setBrushSettings({
        type: brushType,
        // Include paintColor so the brush engine has it when type='paint'
        ...(brushType === 'paint' ? { paintColor: useStudioStore.getState().brushPaintColor } : {}),
      });
    }
  }, [activeTool, isBrush]);

  // Keep brush paintColor in sync with the store's brushPaintColor
  useEffect(() => {
    if (brushSettings.type === 'paint' && brushPaintColor) {
      useStudioStore.getState().setBrushSettings({ paintColor: brushPaintColor });
    }
  }, [brushPaintColor, brushSettings.type]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!shouldShow) return;
    setCursor({ x: e.point.x, y: e.point.y, z: e.point.z });

    // Drag-paint: if pointer is down and we have a last position, apply a stroke
    if (isBrush && isPointerDownRef.current && lastBrushPosRef.current) {
      useStudioStore.getState().applyBrushStroke(
        lastBrushPosRef.current.x,
        lastBrushPosRef.current.z,
        e.point.x,
        e.point.z
      );
    }
    if (isBrush) {
      lastBrushPosRef.current = { x: e.point.x, z: e.point.z };
    }
  }, [shouldShow, isBrush]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!shouldShow) return;
    e.stopPropagation();
    isPointerDownRef.current = true;
    lastBrushPosRef.current = { x: e.point.x, z: e.point.z };

    if (isBrush) {
      // Apply single-click brush
      useStudioStore.getState().applyBrushAt(e.point.x, e.point.z);
    } else if (isPlaceTree) {
      // Drop a tree at the click location, on the terrain surface
      const hm = useStudioStore.getState().terrainHeightmap;
      if (hm) {
        const surfaceY = getHeightAtV2(hm, e.point.x, e.point.z);
        useStudioStore.getState().addTree({
          position: { x: e.point.x, y: surfaceY, z: e.point.z },
          variant: useStudioStore.getState().activeTreeVariant,
        });
        useStudioStore.getState().addConsoleMessage(
          'success',
          `Placed ${useStudioStore.getState().activeTreeVariant} tree at (${e.point.x.toFixed(1)}, ${surfaceY.toFixed(1)}, ${e.point.z.toFixed(1)})`
        );
      }
    }
  }, [shouldShow, isBrush, isPlaceTree]);

  const handlePointerUp = useCallback(() => {
    isPointerDownRef.current = false;
    lastBrushPosRef.current = null;
  }, []);

  // Clean up when leaving the brush tool
  useEffect(() => {
    if (!shouldShow) {
      setCursor(null);
      isPointerDownRef.current = false;
      lastBrushPosRef.current = null;
    }
  }, [shouldShow]);

  if (!shouldShow || !terrainHeightmap) return null;

  const worldSize = terrainWorldSize(terrainHeightmap);

  return (
    <group>
      {/* Transparent plane at ground level — captures pointer events for brushes.
          Must be visible={true} with opacity=0 because R3F skips raycasting for visible={false} objects.
          The terrain instancedMesh has no pointer handlers, so R3F propagates events through it
          to this plane. e.point gives the world-space intersection on the closest hit (terrain surface),
          which provides accurate XZ coordinates for brush application. */}
      <mesh
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <planeGeometry args={[worldSize.width * 2, worldSize.length * 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Brush cursor circle — follows the mouse */}
      {isBrush && cursor && (
        <mesh position={[cursor.x, cursor.y + 0.05, cursor.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[brushSettings.size * 0.85, brushSettings.size, 32]} />
          <meshBasicMaterial
            color={
              brushSettings.type === 'paint'
                ? (brushSettings.paintColor || '#ff6600')
                : brushSettings.type === 'lower' || brushSettings.type === 'erode'
                ? '#ff5555'
                : '#55ff88'
            }
            transparent
            opacity={0.6}
            depthTest={false}
          />
        </mesh>
      )}

      {/* Tree placement cursor — small marker showing where the tree will go */}
      {isPlaceTree && cursor && (
        <mesh position={[cursor.x, cursor.y + 0.5, cursor.z]}>
          <coneGeometry args={[0.3, 1, 6]} />
          <meshBasicMaterial color="#88ff88" transparent opacity={0.7} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}

// ─── Terrain Router (v2) ───
// Renders the new terrain system: heightmap mesh + water bodies + trees + brush cursor

export function TerrainMesh() {
  return (
    <group>
      <TerrainMeshV2 />
      <WaterBodiesRenderer />
      <TreeInstancesRenderer />
    </group>
  );
}

// ─── Legacy Water Plane (removed — replaced by WaterBodiesRenderer above) ───
// Kept as a no-op so any leftover imports don't break the build.
function WaterPlane() {
  return null;
}

// ─── Joint Visualizer ───

export function JointVisualizer() {
  const { joints, objects } = useStudioStore();

  if (joints.length === 0) return null;

  return (
    <group>
      {joints.map((joint) => {
        if (!joint.enabled) return null;
        const partA = objects.get(joint.partAId);
        const partB = objects.get(joint.partBId);
        if (!partA || !partB || !isPart(partA) || !isPart(partB)) return null;

        const midX = (partA.position.x + partB.position.x) / 2;
        const midY = (partA.position.y + partB.position.y) / 2;
        const midZ = (partA.position.z + partB.position.z) / 2;

        const color = joint.type === 'Weld' ? '#ffaa00' : joint.type === 'Motor' ? '#ff4444' : joint.type === 'Rope' ? '#88ff44' : '#4488ff';

        return (
          <group key={joint.id}>
            {/* Joint indicator sphere */}
            <mesh position={[midX, midY, midZ]}>
              <sphereGeometry args={[0.15, 8, 8]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.5}
                transparent
                opacity={0.6}
              />
            </mesh>
            {/* Rope visual: line between the two parts */}
            {joint.type === 'Rope' && (
              <line>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    args={[new Float32Array([
                      partA.position.x, partA.position.y, partA.position.z,
                      partB.position.x, partB.position.y, partB.position.z,
                    ]), 3]}
                  />
                </bufferGeometry>
                <lineBasicMaterial color={color} transparent opacity={0.7} linewidth={2} />
              </line>
            )}
            {/* Small connector dots at each part */}
            <mesh position={[partA.position.x, partA.position.y, partA.position.z]}>
              <sphereGeometry args={[0.08, 6, 6]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.4} />
            </mesh>
            <mesh position={[partB.position.x, partB.position.y, partB.position.z]}>
              <sphereGeometry args={[0.08, 6, 6]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.4} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ─── Explosion Visual ───

export function ExplosionVisuals() {
  const explosionVisuals = useStudioStore(s => s.explosionVisuals);
  const removeExplosionVisual = useStudioStore(s => s.removeExplosionVisual);
  const groupRef = useRef<THREE.Group>(null);
  const expiredRef = useRef<Set<string>>(new Set());

  useFrame(() => {
    if (!groupRef.current) return;
    const now = Date.now();
    groupRef.current.children.forEach((child, i) => {
      const exp = explosionVisuals[i];
      if (!exp) return;
      const age = (now - exp.startTime) / 1000;
      const scale = 1 + age * exp.radius * 2;
      const opacity = Math.max(0, 1 - age);
      child.scale.setScalar(scale);
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat.opacity !== undefined) {
        mat.opacity = opacity * 0.6;
      }
      if (age > 1.0 && !expiredRef.current.has(exp.id)) {
        expiredRef.current.add(exp.id);
        removeExplosionVisual(exp.id);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {explosionVisuals.map((exp) => (
        <mesh
          key={exp.id}
          position={[exp.position.x, exp.position.y, exp.position.z]}
        >
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial
            color="#ff6600"
            emissive="#ff4400"
            emissiveIntensity={3}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Name Labels (WeildCode show_name action) ───
// Renders floating text above parts when the WeildCode engine has active labels.

export function NameLabels() {
  const playState = useStudioStore((s) => s.playState);
  const [labels, setLabels] = useState<Array<{ partId: string; text: string; color: string; fontSize: number }>>([]);

  useFrame(() => {
    if (!playState.isPlaying) return;
    setLabels(weildCodeEngine.getNameLabels());
  });

  if (!playState.isPlaying || labels.length === 0) return null;

  return (
    <>
      {labels.map((label) => {
        const obj = useStudioStore.getState().objects.get(label.partId);
        if (!obj || !isPart(obj)) return null;
        return (
          <Html
            key={label.partId}
            position={[obj.position.x, obj.position.y + obj.size.y / 2 + 0.8, obj.position.z]}
            center
            distanceFactor={8}
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                color: label.color,
                fontSize: `${Math.min(label.fontSize, 32)}px`,
                fontWeight: 'bold',
                textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {label.text}
            </div>
          </Html>
        );
      })}
    </>
  );
}

// ─── Editor Character Preview ───
// Renders the character body parts at the spawn point so the user can see
// what their character will look like. Parts are selectable in the editor.
// During play mode, this preview is hidden — PlayCharacter renders instead.

function CharacterPreview() {
  const objects = useStudioStore((s) => s.objects);
  const playState = useStudioStore((s) => s.playState);
  const showCharacterPreview = useStudioStore((s) => s.showCharacterPreview);
  // Hide during play mode OR when the user toggled off the character preview
  if (playState.isPlaying || !showCharacterPreview) return null;

  let spawnPos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  let foundSpawn = false;
  objects.forEach((obj) => {
    if (isPart(obj) && obj.isSpawnPoint && !foundSpawn) {
      spawnPos = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
      foundSpawn = true;
    }
  });

  return (
    <CharacterPartsRenderer
      position={[spawnPos.x, spawnPos.y + 0.1, spawnPos.z]}
      interactive={true}
      showSelection={true}
    />
  );
}

// ─── Main Scene ───

function Scene() {
  const { objects, selectObject, playState, physicsSettings } = useStudioStore();
  const selectedIds = useStudioStore((s) => s.selectedIds);
  const groupModeIds = useStudioStore((s) => s.groupModeIds);
  const unionModeIds = useStudioStore((s) => s.unionModeIds);
  const activeTool = useStudioStore((s) => s.activeTool);
  const worldSettings = useStudioStore((s) => s.worldSettings);
  const showAxisGizmo = useStudioStore((s) => s.showAxisGizmo);
  const orbitControlsRef = useRef<any>(null);

  const parts = useMemo(() => {
    const result: StudioPart[] = [];
    const isPlaying = playState.isPlaying;
    objects.forEach((obj) => {
      if (isPart(obj)) {
        if (obj.isCharacterPart) return;
        // During play mode, skip parts with showInWorld=false (they're "deleted")
        if (isPlaying && obj.showInWorld === false) return;
        result.push(obj);
      }
    });
    return result;
  }, [objects, playState.isPlaying]);

  // Expand selection to include children of selected groups.
  // When a group (StudioModel) is selected, its child parts should also
  // appear highlighted in the viewport.
  const expandedSelectedIds = useMemo(() => {
    const ids = new Set(selectedIds);
    selectedIds.forEach(id => {
      const obj = objects.get(id);
      if (obj && !isPart(obj) && 'children' in obj) {
        // It's a group — add all descendant part IDs
        const leafIds = collectLeafPartIds(objects, id);
        leafIds.forEach(leafId => ids.add(leafId));
      }
    });
    return ids;
  }, [selectedIds, objects]);

  // Group mode IDs should also highlight parts
  const groupModeIdSet = useMemo(() => new Set(groupModeIds), [groupModeIds]);
  // Union mode IDs should also highlight parts (same UX as Group mode)
  const unionModeIdSet = useMemo(() => new Set(unionModeIds), [unionModeIds]);

  const handleBackgroundClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    // @ts-ignore — R3F event target comparison
    if (e.target === e.eventObject) {
      selectObject(null);
    }
  }, [selectObject]);

  return (
    <>
      {/* Sky system: background, sun, moon, clouds, weather, adaptive lighting */}
      <SkySystem />

      <group onClick={handleBackgroundClick}>
        {parts.map((part) => {
          // A part is highlighted if it's directly selected, or its parent group is selected,
          // or it's in groupModeIds (Group tool mode) or unionModeIds (Union tool mode)
          const isSelected = expandedSelectedIds.has(part.id);
          const isInGroupMode = groupModeIdSet.has(part.id);
          const isInUnionMode = unionModeIdSet.has(part.id);
          return (
            <PartMesh
              key={part.id}
              partId={part.id}
              isSelected={isSelected}
              isGroupModeHighlighted={isInGroupMode || isInUnionMode}
            />
          );
        })}
      </group>



      <TerrainMesh />
      <WaterPlane />
      <CharacterPreview />
      <SelectedTransformControls orbitControlsRef={orbitControlsRef} />
      <FaceScaleHighlights />
      <PhysicsSimulation orbitControlsRef={orbitControlsRef} />
      <PlayCharacter orbitControlsRef={orbitControlsRef} />
      <SimulationOnly />
      <JointVisualizer />
      <ExplosionVisuals />
      <NameLabels />

      <OrbitControls
        ref={orbitControlsRef}
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        minDistance={0.1}
        maxDistance={Infinity}
        enableDamping
        dampingFactor={0.25}
        zoomSpeed={1.2}
      />

      {showAxisGizmo && (
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="white" axisHeadScale={1} />
        </GizmoHelper>
      )}
    </>
  );
}

// ─── FBM Noise ───

function fbm(x: number, y: number): number {
  // Improved noise with better hash function
  function hash(x: number, y: number): number {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
  }

  function smoothNoise(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    // Smoothstep interpolation
    const ufx = fx * fx * (3 - 2 * fx);
    const ufy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a * (1 - ufx) * (1 - ufy) + b * ufx * (1 - ufy) + c * (1 - ufx) * ufy + d * ufx * ufy;
  }

  let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
  for (let i = 0; i < 6; i++) {
    value += smoothNoise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

// ─── Viewport3D Component ───

// ─── Screen Message Overlay (WeildCode print_message) ───

export function ScreenMessageOverlay() {
  const screenMessages = useStudioStore((s) => s.screenMessages);
  const playState = useStudioStore((s) => s.playState);

  if (!playState.isPlaying || screenMessages.length === 0) return null;

  const topMessages = screenMessages.filter((m) => m.position === 'top');
  const bottomMessages = screenMessages.filter((m) => m.position === 'bottom');

  const renderMessage = (msg: typeof screenMessages[0]) => {
    const fontStyle = msg.fontStyle === 'bold'
      ? 'bold'
      : msg.fontStyle === 'italic'
        ? 'italic'
        : msg.fontStyle === 'bold-italic'
          ? 'italic bold'
          : 'normal';
    const fontWeight = msg.fontStyle === 'bold' || msg.fontStyle === 'bold-italic' ? 'bold' : 'normal';

    return (
      <div
        key={msg.id}
        className="px-4 py-2 rounded-lg animate-fade-in"
        style={{
          backgroundColor: msg.backgroundColor + 'cc',
          color: msg.textColor,
          fontSize: `${Math.min(msg.fontSize, 48)}px`,
          fontWeight,
          fontStyle: msg.fontStyle === 'italic' || msg.fontStyle === 'bold-italic' ? 'italic' : 'normal',
          textAlign: 'center',
          maxWidth: '80vw',
          pointerEvents: 'none',
        }}
      >
        {msg.message}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col">
      {/* Top messages */}
      {topMessages.length > 0 && (
        <div className="flex flex-col items-center pt-4 gap-2">
          {topMessages.map(renderMessage)}
        </div>
      )}
      <div className="flex-1" />
      {/* Bottom messages */}
      {bottomMessages.length > 0 && (
        <div className="flex flex-col items-center pb-4 gap-2">
          {bottomMessages.map(renderMessage)}
        </div>
      )}
    </div>
  );
}

export function Viewport3D() {
  const handlePointerMissed = useCallback(() => {
    const { activeTool, selectObject } = useStudioStore.getState();
    // Click empty space to deselect (but NOT in Group or Union mode where clicks toggle membership)
    if (activeTool !== 'Group' && activeTool !== 'Union') {
      selectObject(null);
    }
  }, []);

  return (
    <div className="w-full h-full canvas-container relative">
      <Canvas
        shadows
        camera={{ position: [20, 15, 20], fov: 60, near: 0.01, far: 100000 }}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={handlePointerMissed}
        onCreated={({ gl }) => {
          // Initial clear color — SceneBackgroundUpdater will set the real background
          gl.setClearColor(new THREE.Color('#87CEEB'));
        }}
      >
        <Scene />
      </Canvas>
      <ScreenMessageOverlay />
    </div>
  );
}
