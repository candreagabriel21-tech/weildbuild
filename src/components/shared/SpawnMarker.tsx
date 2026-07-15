'use client';

/**
 * Shared Spawn Marker — the gorgeous glowing spawn point indicator.
 * Used by BOTH the GamePlayer and the WeildCreate studio editor.
 * Replaces the old "green cone on top of a block" that looked nothing like the real game.
 * Supports team-based colors: Blue, Red, or Neutral (default cyan/blue).
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type TeamColor = 'Neutral' | 'Blue' | 'Red';

function getTeamPalette(team: TeamColor) {
  switch (team) {
    case 'Blue':
      return {
        disk: '#2255cc',
        outerRing: '#3366dd',
        innerRing: '#5588ee',
        glow: '#3366dd',
        particle: '#77aaee',
      };
    case 'Red':
      return {
        disk: '#cc2222',
        outerRing: '#dd3344',
        innerRing: '#ee5566',
        glow: '#dd3344',
        particle: '#ee7788',
      };
    default: // Neutral
      return {
        disk: '#2288ff',
        outerRing: '#4499ff',
        innerRing: '#66bbff',
        glow: '#4499ff',
        particle: '#88ccff',
      };
  }
}

export function SpawnMarker({ position = [0, 0, 0], team = 'Neutral', color, transparency = 0 }: {
  position?: [number, number, number];
  team?: TeamColor;
  color?: string; // Custom color override — used when user colors the spawn point
  transparency?: number; // 0–1, makes the spawn point partially transparent
}) {
  const glowRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Group>(null);

  // If a custom color is provided, use it for everything; otherwise use team palette
  const palette = color
    ? { disk: color, outerRing: color, innerRing: color, glow: color, particle: color }
    : getTeamPalette(team);

  // Overall opacity multiplier from transparency property (0 = full opacity, 1 = invisible)
  const opacityMul = 1 - transparency;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (glowRef.current) {
      const pulse = 0.35 + Math.sin(t * 2) * 0.15;
      (glowRef.current.material as THREE.MeshStandardMaterial).opacity = pulse;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.y = t * 0.5;
    }
    if (particlesRef.current) {
      particlesRef.current.children.forEach((child, i) => {
        const angle = (i / 6) * Math.PI * 2 + t * 0.5;
        const r = 1.2 + Math.sin(t * 1.5 + i) * 0.3;
        child.position.x = Math.cos(angle) * r;
        child.position.z = Math.sin(angle) * r;
        child.position.y = 0.3 + Math.sin(t * 2 + i * 1.2) * 0.4;
      });
    }
  });

  return (
    <group position={position}>
      {/* Main disk — team-colored, slightly transparent, with height */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.3, 32]} />
        <meshStandardMaterial color={palette.disk} transparent opacity={0.55 * opacityMul} emissive={palette.disk} emissiveIntensity={0.25} roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Outer ring — soft glow */}
      <mesh position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.6, 32]} />
        <meshStandardMaterial color={palette.outerRing} transparent opacity={0.5 * opacityMul} emissive={palette.outerRing} emissiveIntensity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* Inner rotating ring */}
      <mesh ref={innerRingRef} position={[0, 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 0.95, 24]} />
        <meshStandardMaterial color={palette.innerRing} transparent opacity={0.6 * opacityMul} emissive={palette.outerRing} emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Glowing center circle on top */}
      <mesh ref={glowRef} position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 16]} />
        <meshStandardMaterial color={palette.glow} transparent opacity={0.4 * opacityMul} emissive={palette.glow} emissiveIntensity={1.0} side={THREE.DoubleSide} />
      </mesh>
      {/* Orbiting particles */}
      <group ref={particlesRef}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color={palette.particle} emissive={palette.glow} emissiveIntensity={1.5} transparent opacity={0.8 * opacityMul} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Grid Lines — the baseplate's top texture, rendered directly on the surface.
 * Produces a Roblox-style grid with minor (every 1 stud) and major (every 10 studs) lines.
 * Properly sized to match the baseplate dimensions.
 */
export function GridLines({ size, y = 0.005 }: { size: number; y?: number }) {
  const halfSize = size / 2;
  const { minorLines, majorLines } = useMemo(() => {
    const minor: number[] = [];
    const major: number[] = [];
    for (let i = -halfSize; i <= halfSize; i += 2) {
      const isMajor = i % 10 === 0;
      const target = isMajor ? major : minor;
      // Vertical lines (along Z)
      target.push(i, y, -halfSize, i, y, halfSize);
      // Horizontal lines (along X)
      target.push(-halfSize, y, i, halfSize, y, i);
    }
    return {
      minorLines: new Float32Array(minor),
      majorLines: new Float32Array(major),
    };
  }, [size, y]);

  return (
    <group>
      {/* Minor grid lines — every 2 studs, subtle */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[minorLines, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" opacity={0.05} transparent />
      </lineSegments>
      {/* Major grid lines — every 10 studs, more visible */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[majorLines, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" opacity={0.14} transparent />
      </lineSegments>
    </group>
  );
}
