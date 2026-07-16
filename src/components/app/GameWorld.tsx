'use client';

import { useEffect, useState, useRef, useMemo, useCallback, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarData, GameData, PrimitiveData } from "@/lib/store";
import {
  DEFAULT_AVATAR,
  TORSO_HEIGHT, TORSO_WIDTH, TORSO_DEPTH,
  HEAD_WIDTH, HEAD_HEIGHT, HEAD_DEPTH,
  ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH,
  LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH,
  ARM_GAP, HEAD_GAP, LEG_GAP,
  UNEQUIPPED_TORSO_COLOR, UNEQUIPPED_LEGS_COLOR,
  GRAVITY, JUMP_FORCE, MOVE_SPEED, PLAYER_HEIGHT, PLAYER_RADIUS,
  GROUND_SKIN, STEP_HEIGHT,
  mobileInputRef, DPAD_BTN_SIZE, DPAD_GAP,
  MATERIAL_ROUGHNESS, MATERIAL_EMISSIVE, MATERIAL_METALNESS,
  MATERIAL_COLOR_TINT, MATERIAL_OPACITY, rgbToHex,
  type RemotePlayerData, type ScriptRule,
  moderateText,
} from "./shared";
import {
  WeildBuildCharacter, darkenColor,
} from "./AvatarComponents";
import { playSound, preloadSounds, setMasterVolume } from "@/lib/sounds";


// ==================== LERP ANGLE ====================
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// ==================== MOBILE CONTROLS ====================
export function MobileControls() {
  // Track which direction buttons are actively pressed
  const [pressedDirs, setPressedDirs] = useState<Set<string>>(new Set());

  const setDir = (dir: string, mx: number, mz: number) => {
    mobileInputRef.moveX = mx;
    mobileInputRef.moveZ = mz;
    setPressedDirs(prev => new Set(prev).add(dir));
  };

  const clearDir = (dir: string) => {
    setPressedDirs(prev => {
      const next = new Set(prev);
      next.delete(dir);
      // If any other direction is still pressed, keep that one active
      if (next.has('up')) { mobileInputRef.moveZ = 1; }
      else if (next.has('down')) { mobileInputRef.moveZ = -1; }
      else { mobileInputRef.moveZ = 0; }
      if (next.has('left')) { mobileInputRef.moveX = -1; }
      else if (next.has('right')) { mobileInputRef.moveX = 1; }
      else { mobileInputRef.moveX = 0; }
      return next;
    });
  };

  const handleJump = () => {
    mobileInputRef.jump = true;
    setTimeout(() => { mobileInputRef.jump = false; }, 100);
  };

  // Shared style for a D-pad direction button
  const dpadBtnStyle = (dir: string): React.CSSProperties => ({
    width: DPAD_BTN_SIZE,
    height: DPAD_BTN_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: dir === 'center' ? 8 : 10,
    background: pressedDirs.has(dir)
      ? 'linear-gradient(135deg, rgba(99,102,241,0.7) 0%, rgba(99,102,241,0.5) 100%)'
      : 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
    border: pressedDirs.has(dir)
      ? '2px solid rgba(99,102,241,0.9)'
      : '2px solid rgba(255,255,255,0.2)',
    boxShadow: pressedDirs.has(dir)
      ? '0 0 16px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)'
      : '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'pointer',
    transition: 'background 0.1s, border-color 0.1s, box-shadow 0.1s',
  });

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
      {/* D-pad keypad — bottom-left */}
      <div
        className="absolute pointer-events-auto"
        style={{
          bottom: '20px',
          left: '12px',
          display: 'grid',
          gridTemplateColumns: `${DPAD_BTN_SIZE}px ${DPAD_BTN_SIZE}px ${DPAD_BTN_SIZE}px`,
          gridTemplateRows: `${DPAD_BTN_SIZE}px ${DPAD_BTN_SIZE}px ${DPAD_BTN_SIZE}px`,
          gap: DPAD_GAP,
          padding: '6px',
          borderRadius: 16,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Row 1: empty, UP, empty */}
        <div />
        <div
          style={dpadBtnStyle('up')}
          onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); setDir('up', 0, 1); }}
          onTouchEnd={(e) => { e.stopPropagation(); clearDir('up'); }}
          onMouseDown={() => setDir('up', 0, 1)}
          onMouseUp={() => clearDir('up')}
          onMouseLeave={() => clearDir('up')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
        </div>
        <div />

        {/* Row 2: LEFT, center, RIGHT */}
        <div
          style={dpadBtnStyle('left')}
          onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); setDir('left', -1, 0); }}
          onTouchEnd={(e) => { e.stopPropagation(); clearDir('left'); }}
          onMouseDown={() => setDir('left', -1, 0)}
          onMouseUp={() => clearDir('left')}
          onMouseLeave={() => clearDir('left')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
        </div>
        <div
          style={dpadBtnStyle('center')}
          onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); handleJump(); }}
          onMouseDown={handleJump}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(34,197,94,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
        </div>
        <div
          style={dpadBtnStyle('right')}
          onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); setDir('right', 1, 0); }}
          onTouchEnd={(e) => { e.stopPropagation(); clearDir('right'); }}
          onMouseDown={() => setDir('right', 1, 0)}
          onMouseUp={() => clearDir('right')}
          onMouseLeave={() => clearDir('right')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
        </div>

        {/* Row 3: empty, DOWN, empty */}
        <div />
        <div
          style={dpadBtnStyle('down')}
          onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); setDir('down', 0, -1); }}
          onTouchEnd={(e) => { e.stopPropagation(); clearDir('down'); }}
          onMouseDown={() => setDir('down', 0, -1)}
          onMouseUp={() => clearDir('down')}
          onMouseLeave={() => clearDir('down')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
        </div>
        <div />
      </div>

      {/* Mobile jump button — bottom-right */}
      <div
        className="absolute pointer-events-auto flex flex-col items-center justify-center select-none"
        style={{
          bottom: '30px',
          right: '16px',
          width: '75px',
          height: '75px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,197,94,0.5) 0%, rgba(34,197,94,0.2) 100%)',
          border: '2.5px solid rgba(34,197,94,0.6)',
          touchAction: 'none',
          userSelect: 'none',
          boxShadow: '0 0 15px rgba(34,197,94,0.2)',
        }}
        onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); handleJump(); }}
        onMouseDown={handleJump}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(34,197,94,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
        <span className="text-[8px] text-green-400/70 font-bold mt-0.5">JUMP</span>
      </div>
    </div>
  );
}

// ==================== SKY DOME ====================
function SkyDome({ topColor, bottomColor }: { topColor: string; bottomColor: string }) {
  const uniforms = useMemo(() => ({
    uTopColor: { value: new THREE.Color(topColor) },
    uBottomColor: { value: new THREE.Color(bottomColor) },
  }), [topColor, bottomColor]);

  return (
    <mesh>
      <sphereGeometry args={[500, 32, 32]} />
      <shaderMaterial uniforms={uniforms} side={THREE.BackSide} vertexShader={`
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `} fragmentShader={`
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float t = max(0.0, h * 0.5 + 0.5);
          gl_FragColor = vec4(mix(uBottomColor, uTopColor, t), 1.0);
        }
      `} />
    </mesh>
  );
}

// ==================== BASEPLATE MESH ====================
function BaseplateMesh({ size, color }: { size: number; color: string }) {
  return (
    <mesh position={[0, -0.5, 0]} receiveShadow>
      <boxGeometry args={[size, 1, size]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

// ==================== GRID LINES ====================
function GridLines({ size, y = 0.01 }: { size: number; y?: number }) {
  const halfSize = size / 2;
  const lines = useMemo(() => {
    const pts: number[] = [];
    for (let i = -halfSize; i <= halfSize; i += 2) {
      pts.push(i, y, -halfSize, i, y, halfSize);
      pts.push(-halfSize, y, i, halfSize, y, i);
    }
    return new Float32Array(pts);
  }, [size, halfSize, y]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[lines, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffffff" opacity={0.06} transparent />
    </lineSegments>
  );
}

// ==================== SPAWN MARKER ====================
function SpawnMarker() {
  const glowRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Group>(null);
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
    <>
      {/* Main disk - bright blue, slightly transparent, with height */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.3, 32]} />
        <meshStandardMaterial color="#2288ff" transparent opacity={0.55} emissive="#2288ff" emissiveIntensity={0.25} roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Outer ring - soft glow */}
      <mesh position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.6, 32]} />
        <meshStandardMaterial color="#4499ff" transparent opacity={0.5} emissive="#4499ff" emissiveIntensity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* Inner rotating ring */}
      <mesh ref={innerRingRef} position={[0, 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 0.95, 24]} />
        <meshStandardMaterial color="#66bbff" transparent opacity={0.6} emissive="#4499ff" emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Glowing center circle on top */}
      <mesh ref={glowRef} position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 16]} />
        <meshStandardMaterial color="#4499ff" transparent opacity={0.4} emissive="#4499ff" emissiveIntensity={1.0} side={THREE.DoubleSide} />
      </mesh>
      {/* Orbiting particles */}
      <group ref={particlesRef}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color="#88ccff" emissive="#4499ff" emissiveIntensity={1.5} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
    </>
  );
}

// ==================== ANIMATED PARTICLE HELPERS ====================
// ==================== ANIMATED PARTICLE HELPERS ====================
function StarParticle({ offset, baseY, color, size = 0.08 }: { offset: number; baseY: number; color: string; size?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const cycle = ((t + offset) % 2.0) / 2.0; // 0 to 1 over 2 seconds
    ref.current.position.y = baseY + cycle * 1.5;
    ref.current.rotation.z = t * 2 + offset;
    // Fade out as it goes up
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 1 - cycle * 0.8;
  });
  return <mesh ref={ref} position={[0, baseY, 0]}>
    <octahedronGeometry args={[size, 0]} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={1} />
  </mesh>;
}

function BubbleParticle({ offset, boxSize, color, size = 0.06 }: { offset: number; boxSize: [number, number, number]; color: string; size?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const cycle = ((t + offset) % 3.0) / 3.0; // 0 to 1 over 3 seconds
    const [bw, bh, bd] = boxSize;
    // Move upward inside the box
    ref.current.position.y = -bh / 2 + cycle * bh;
    // Slight horizontal wobble
    ref.current.position.x = Math.sin(t * 2 + offset) * bw * 0.2;
    ref.current.position.z = Math.cos(t * 1.5 + offset) * bd * 0.2;
    // Fade in/out at edges
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.opacity = Math.sin(cycle * Math.PI) * 0.8;
  });
  return <mesh ref={ref}>
    <sphereGeometry args={[size, 8, 8]} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.8} />
  </mesh>;
}

function TeleporterParticle({ offset, boxSize, color, isOutward }: { offset: number; boxSize: [number, number, number]; color: string; isOutward: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const cycle = ((t + offset) % 2.5) / 2.5; // 0 to 1 over 2.5 seconds
    const [bw, bh, bd] = boxSize;
    const r = Math.min(bw, bd) / 2;
    if (isOutward) {
      // Particles move from center outward
      const dist = cycle * r;
      const angle = offset * Math.PI / 3 + t * 0.5;
      ref.current.position.x = Math.cos(angle) * dist;
      ref.current.position.z = Math.sin(angle) * dist;
      ref.current.position.y = (Math.sin(offset + t) * 0.3) * bh * 0.3;
    } else {
      // Particles move from outside inward
      const dist = (1 - cycle) * r;
      const angle = offset * Math.PI / 3 + t * 0.5;
      ref.current.position.x = Math.cos(angle) * dist;
      ref.current.position.z = Math.sin(angle) * dist;
      ref.current.position.y = (Math.sin(offset + t) * 0.3) * bh * 0.3;
    }
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.opacity = Math.sin(cycle * Math.PI) * 0.9;
  });
  return <mesh ref={ref}>
    <sphereGeometry args={[0.05, 6, 6]} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.9} />
  </mesh>;
}

// ==================== WORLD PRIMITIVE ====================
function WorldPrimitive({ primitive, doorOpen, onClick, runtimeState }: { primitive: PrimitiveData; doorOpen?: boolean; onClick?: () => void; runtimeState?: Partial<PrimitiveData> }) {
  const merged = { ...primitive, ...runtimeState };
  const [x, y, z] = merged.position;
  const [w, h, d] = merged.size;
  const [rx, ry, rz] = merged.rotation;
  const color = `rgb(${Math.round(merged.color[0] * 255)}, ${Math.round(merged.color[1] * 255)}, ${Math.round(merged.color[2] * 255)})`;
  const visible = merged.visible !== false;

  // Material system - apply transparency, reflectivity, and material properties
  const mat = (merged as any).material || "plastic";
  const baseRoughness = MATERIAL_ROUGHNESS[mat] || 0.5;
  const isEmissive = MATERIAL_EMISSIVE[mat];
  const reflectance = (merged as any).reflectance || 0;
  const transparency = (merged as any).transparency || 0;
  const roughness = baseRoughness * (1 - reflectance * 0.8);
  const metalness = (MATERIAL_METALNESS[mat] || 0) + reflectance * (mat === "metal" ? 0.1 : 0.5);
  const matColorTint = MATERIAL_COLOR_TINT[mat];
  const finalColor = matColorTint || color;
  const matOpacity = MATERIAL_OPACITY[mat];
  const isTransparent = transparency > 0 || matOpacity !== undefined || merged.shape_type === "water";
  const baseOpacity = matOpacity !== undefined ? matOpacity : 1;
  const opacity = baseOpacity * (1 - transparency);
  const emissiveColor = (reflectance > 0.5 && !isEmissive) ? finalColor : (isEmissive ? finalColor : "#000000");
  const emissiveIntensity = isEmissive ? 0.5 : (reflectance > 0.5 ? reflectance * 0.3 : 0);

  // Helper to create material props for standard shapes
  const stdMatProps = {
    color: finalColor, roughness, metalness,
    transparent: isTransparent || merged.shape_type === "water",
    opacity: merged.shape_type === "water" ? Math.min(opacity, 0.5) : opacity,
    emissive: emissiveColor, emissiveIntensity,
  };

  // Wedge geometry helper - tall at -X, short at +X
  const wedgeGeo = useMemo(() => {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    // Wedge: tall at -X (left), slopes down to +X (right)
    // Peak edge at x=-hw from z=-hd to z=+hd at y=+hh
    // Ground edge at x=+hw from z=-hd to z=+hd at y=-hh
    const verts = new Float32Array([
      // Left face (-X side, full height rectangle)
      -hw, -hh, -hd,  -hw, -hh, hd,  -hw, hh, hd,
      -hw, -hh, -hd,  -hw, hh, hd,  -hw, hh, -hd,
      // Front face (-Z side, right triangle)
      -hw, -hh, -hd,  hw, -hh, -hd,  -hw, hh, -hd,
      // Back face (+Z side, right triangle)
      -hw, -hh, hd,  -hw, hh, hd,  hw, -hh, hd,
      // Bottom face
      -hw, -hh, -hd,  -hw, -hh, hd,  hw, -hh, hd,
      -hw, -hh, -hd,  hw, -hh, hd,  hw, -hh, -hd,
      // Slope face
      -hw, hh, -hd,  -hw, hh, hd,  hw, -hh, hd,
      -hw, hh, -hd,  hw, -hh, hd,  hw, -hh, -hd,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return g;
  }, [w, h, d]);

  // Ramp geometry helper - starts flat at -Z, slopes up to full height at +Z
  const rampGeo = useMemo(() => {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    // Ramp: starts flat at -Z, slopes up to full height at +Z
    const verts = new Float32Array([
      // Bottom face
      -hw, -hh, -hd,  hw, -hh, -hd,  hw, -hh, hd,  -hw, -hh, -hd,  hw, -hh, hd,  -hw, -hh, hd,
      // Back face (+Z, full height)
      -hw, -hh, hd,  hw, -hh, hd,  hw, hh, hd,  -hw, -hh, hd,  hw, hh, hd,  -hw, hh, hd,
      // Left face (triangle)
      -hw, -hh, -hd,  -hw, -hh, hd,  -hw, hh, hd,
      // Right face (triangle)
      hw, -hh, -hd,  hw, -hh, hd,  hw, hh, hd,
      // Slope face
      -hw, -hh, -hd,  hw, -hh, -hd,  hw, hh, hd,  -hw, -hh, -hd,  hw, hh, hd,  -hw, hh, hd,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return g;
  }, [w, h, d]);

  // Corner wedge: 5 vertices, peak at (-X, -Z) corner
  const cornerWedgeGeo = useMemo(() => {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const verts = new Float32Array([
      // Bottom face (2 triangles)
      -hw, -hh, -hd,  hw, -hh, -hd,  hw, -hh, hd,  -hw, -hh, -hd,  hw, -hh, hd,  -hw, -hh, hd,
      // Front face (-Z): triangle
      -hw, -hh, -hd,  hw, -hh, -hd,  -hw, hh, -hd,
      // Left face (-X): triangle
      -hw, -hh, hd,  -hw, -hh, -hd,  -hw, hh, -hd,
      // Slope face (2 triangles): fixed winding order so normals point outward
      -hw, hh, -hd,  hw, -hh, hd,  hw, -hh, -hd,  -hw, hh, -hd,  -hw, -hh, hd,  hw, -hh, hd,
      // Right face (+X): triangle
      hw, -hh, -hd,  hw, -hh, hd,  -hw, hh, -hd,
      // Back face (+Z): triangle
      -hw, -hh, hd,  hw, -hh, hd,  -hw, hh, -hd,
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return g;
  }, [w, h, d]);

  // Animation refs (must be before any early return - hooks order)
  const itemPickupRef = useRef<THREE.Group>(null);
  const lavaGlowRef = useRef<THREE.Mesh>(null);
  const waterGlowRef = useRef<THREE.Mesh>(null);
  const killBrickRef = useRef<THREE.Group>(null);
  const checkpointFlagRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!visible) return;
    const t = state.clock.elapsedTime;
    if (merged.shape_type === "item_pickup" && itemPickupRef.current) {
      itemPickupRef.current.rotation.y = t * 1.5;
      itemPickupRef.current.position.y = Math.sin(t * 2) * 0.15;
    }
    if (merged.shape_type === "lava" && lavaGlowRef.current) {
      (lavaGlowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.2;
    }
    if (merged.shape_type === "water" && waterGlowRef.current) {
      (waterGlowRef.current.material as THREE.MeshStandardMaterial).opacity = 0.3 + Math.sin(t * 1.5) * 0.05;
    }
    if (merged.shape_type === "kill_brick" && killBrickRef.current) {
      killBrickRef.current.position.y = y + Math.sin(t * 3) * 0.02;
    }
    if (merged.shape_type === "checkpoint" && checkpointFlagRef.current) {
      checkpointFlagRef.current.position.x = 0.3 + Math.sin(t * 3) * 0.05;
    }
  });

  const handleClick = (e: any) => { e.stopPropagation(); onClick?.(); };

  switch (merged.shape_type) {
    case "sphere":
      return <mesh position={[x, y, z]} castShadow onClick={handleClick}><sphereGeometry args={[w / 2, 16, 16]} /><meshStandardMaterial {...stdMatProps} /></mesh>;
    case "cylinder":
      return <mesh position={[x, y, z]} castShadow rotation={[rx, ry, rz]} onClick={handleClick}><cylinderGeometry args={[w / 2, w / 2, h, 16]} /><meshStandardMaterial {...stdMatProps} /></mesh>;
    case "wedge":
      return (
        <group position={[x, y, z]} rotation={[rx, ry, rz]} onClick={handleClick}>
          <mesh castShadow geometry={wedgeGeo}><meshStandardMaterial {...stdMatProps} /></mesh>
        </group>
      );
    case "corner_wedge":
      return <mesh position={[x, y, z]} castShadow rotation={[rx, ry, rz]} onClick={handleClick} geometry={cornerWedgeGeo}><meshStandardMaterial {...stdMatProps} /></mesh>;
    case "spawn_point":
      return <group position={[x, y, z]} onClick={handleClick}><SpawnMarker /></group>;
    case "kill_brick":
      return <group ref={killBrickRef} position={[x, y, z]} rotation={[rx, ry, rz]} onClick={handleClick}>
        {/* Main red cube */}
        <mesh castShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial color="#cc0000" emissive="#ff2200" emissiveIntensity={0.3} roughness={0.4} /></mesh>
        {/* Red star particles floating upward */}
        {[0, 1, 2, 3, 4].map(i => (
          <StarParticle key={`star${i}`} offset={i * 1.3} baseY={h / 2} color="#ff2200" size={0.08 + (i % 3) * 0.03} />
        ))}
        {/* Glowing danger border */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(w + 0.04, h + 0.04, d + 0.04)]} />
          <lineBasicMaterial color="#ff4400" transparent opacity={0.6} />
        </lineSegments>
      </group>;
    case "speed_pad":
      return <group position={[x, y, z]} rotation={[rx, ry, rz]} onClick={handleClick}>
        {/* Road surface - dark asphalt */}
        <mesh castShadow><boxGeometry args={[w, h * 0.2, d]} /><meshStandardMaterial color="#333333" roughness={0.9} /></mesh>
        {/* Road center dashes */}
        {Array.from({ length: Math.max(1, Math.floor(d / 0.8)) }, (_, i) => (
          <mesh key={`dash${i}`} position={[0, h * 0.1 + 0.005, -d / 2 + (i + 0.5) * d / Math.max(1, Math.floor(d / 0.8))]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.1, d * 0.15 / Math.max(1, Math.floor(d / 0.8))]} />
            <meshStandardMaterial color="#ffcc00" emissive="#ffaa00" emissiveIntensity={0.5} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {/* Road edge lines - white */}
        <mesh position={[w / 2 - 0.06, h * 0.1 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, d]} /><meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-w / 2 + 0.06, h * 0.1 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, d]} /><meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
        {/* Speed arrows */}
        {[0, 1, 2].map(i => (
          <group key={`arrow${i}`} position={[0, h * 0.11, -d * 0.3 + i * d * 0.3]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w * 0.12, d * 0.08]} />
              <meshStandardMaterial color="#00ff88" transparent opacity={0.7} emissive="#00ff88" emissiveIntensity={1.0} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
        {/* Neon edge glow */}
        {[[0, 0, d / 2], [0, 0, -d / 2]].map(([ex, ey, ez], i) => (
          <mesh key={`edge${i}`} position={[ex, h * 0.1, ez]}>
            <boxGeometry args={[w, 0.04, 0.06]} />
            <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={2.0} />
          </mesh>
        ))}
      </group>;
    case "checkpoint": {
      return <group position={[x, y, z]} rotation={[rx, ry, rz]} onClick={handleClick} ref={checkpointFlagRef}>
        {/* Base platform - glowing ring */}
        <mesh position={[0, 0, 0]}><cylinderGeometry args={[Math.min(w, d) / 2, Math.min(w, d) / 2, h, 32]} /><meshStandardMaterial color="#111111" emissive="#00ff44" emissiveIntensity={0.3} /></mesh>
        {/* Glowing ring on top */}
        <mesh position={[0, h / 2 + 0.01, 0]}><torusGeometry args={[Math.min(w, d) / 2.2, 0.04, 8, 32]} /><meshStandardMaterial color="#00ff44" emissive="#00ff44" emissiveIntensity={2.0} /></mesh>
        {/* Inner glow disc */}
        <mesh position={[0, h / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[Math.min(w, d) / 2.5, 32]} /><meshStandardMaterial color="#00ff44" emissive="#00ff44" emissiveIntensity={0.8} transparent opacity={0.5} /></mesh>
        {/* Pole */}
        <mesh position={[Math.min(w, d) / 2 - 0.1, h / 2 + 1.25, 0]} castShadow><cylinderGeometry args={[0.04, 0.04, 2.5, 8]} /><meshStandardMaterial color="#cccccc" metalness={0.8} roughness={0.2} /></mesh>
        {/* Flag */}
        <mesh position={[Math.min(w, d) / 2 - 0.1 + 0.25, h / 2 + 2.2, 0.08]}><planeGeometry args={[0.5, 0.35]} /><meshStandardMaterial color="#00cc44" emissive="#00ff44" emissiveIntensity={0.4} side={THREE.DoubleSide} /></mesh>
        {/* Pole top ball */}
        <mesh position={[Math.min(w, d) / 2 - 0.1, h / 2 + 2.55, 0]}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color="#ffdd00" emissive="#ffdd00" emissiveIntensity={0.5} /></mesh>
      </group>;
    }
    case "item_pickup":
      return <group ref={itemPickupRef} position={[x, y, z]} onClick={handleClick}>
        <mesh castShadow><octahedronGeometry args={[Math.min(w, h, d) / 2, 0]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} /></mesh>
        <mesh><sphereGeometry args={[Math.min(w, h, d) / 2 + 0.2, 8, 8]} /><meshStandardMaterial color={color} transparent opacity={0.15} emissive={color} emissiveIntensity={0.8} /></mesh>
        {/* Sparkle particles */}
        {[0, 1, 2, 3].map(i => (
          <mesh key={`sp${i}`} position={[
            Math.cos(i * Math.PI / 2) * Math.min(w, d) * 0.4,
            Math.sin(i * Math.PI / 2) * Math.min(h, d) * 0.4,
            0
          ]}>
            <sphereGeometry args={[0.04, 4, 4]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>;
    case "truss":
      return <group position={[x, y, z]} rotation={[rx, ry, rz]} onClick={handleClick}>
        <mesh><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={color} transparent opacity={0.15} /></mesh>
        {Array.from({ length: Math.floor(h / 0.5) }, (_, i) => (
          <mesh key={`th${i}`} position={[0, -h / 2 + i * 0.5 + 0.25, 0]}><boxGeometry args={[w, 0.08, d]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>
        ))}
        {/* Diagonal X braces */}
        {Array.from({ length: Math.max(0, Math.floor(h / 0.5) - 1) }, (_, i) => {
          const y = -h / 2 + i * 0.5 + 0.5;
          return [
            <mesh key={`td1_${i}`} position={[0, y, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[w * 0.6, 0.06, d * 0.6]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>,
            <mesh key={`td2_${i}`} position={[0, y, 0]} rotation={[0, 0, -Math.PI / 4]}><boxGeometry args={[w * 0.6, 0.06, d * 0.6]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>,
          ];
        })}
      </group>;
    case "ramp":
      return <group position={[x, y, z]} rotation={[rx, ry, rz]} onClick={handleClick}>
        <mesh castShadow receiveShadow geometry={rampGeo}><meshStandardMaterial {...stdMatProps} /></mesh>
      </group>;
    case "door":
      return <group position={[x, y, z]} rotation={[rx, ry, rz]} onClick={handleClick}>
        {/* Door frame */}
        <mesh position={[0, h / 2, 0]}><boxGeometry args={[w + 0.2, 0.15, d + 0.2]} /><meshStandardMaterial color="#3a2a1a" roughness={0.9} /></mesh>
        <mesh position={[-w / 2 - 0.05, 0, 0]}><boxGeometry args={[0.15, h, d + 0.2]} /><meshStandardMaterial color="#3a2a1a" roughness={0.9} /></mesh>
        <mesh position={[w / 2 + 0.05, 0, 0]}><boxGeometry args={[0.15, h, d + 0.2]} /><meshStandardMaterial color="#3a2a1a" roughness={0.9} /></mesh>
        {/* Door panel */}
        <mesh castShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={color} roughness={0.7} transparent={doorOpen} opacity={doorOpen ? 0.2 : 1} /></mesh>
        {/* Handle */}
        <mesh position={[w / 2 - 0.15, 0, d / 2 + 0.02]}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color={doorOpen ? "#4ade80" : "#c0a060"} metalness={0.9} roughness={0.1} /></mesh>
        {/* Keyhole */}
        <mesh position={[w / 2 - 0.15, -0.15, d / 2 + 0.01]}><circleGeometry args={[0.03, 8]} /><meshStandardMaterial color="#222" /></mesh>
      </group>;
    case "teleporter": {
      const primName = (merged.name || "").toLowerCase();
      const isOutTeleporter = primName.includes("out") || primName.includes("exit");
      const teleColor = isOutTeleporter ? "#9333ea" : "#f97316";
      const teleEmissive = isOutTeleporter ? "#7c3aed" : "#ea580c";
      return <group position={[x, y, z]} rotation={[rx, ry, rz]} onClick={handleClick}>
        {/* Disk base */}
        <mesh position={[0, -h / 2 + 0.05, 0]}><cylinderGeometry args={[Math.min(w, d) / 2, Math.min(w, d) / 2, 0.1, 24]} /><meshStandardMaterial color={teleColor} emissive={teleEmissive} emissiveIntensity={0.8} /></mesh>
        {/* Disk top ring */}
        <mesh position={[0, h / 2 - 0.05, 0]}><torusGeometry args={[Math.min(w, d) / 2.2, 0.04, 8, 32]} /><meshStandardMaterial color={teleColor} emissive={teleEmissive} emissiveIntensity={1.2} /></mesh>
        {/* Inner glow disc */}
        <mesh><cylinderGeometry args={[Math.min(w, d) / 3, Math.min(w, d) / 3, h * 0.8, 16]} /><meshStandardMaterial color={teleColor} transparent opacity={0.2} emissive={teleEmissive} emissiveIntensity={1.0} /></mesh>
        {/* Particles */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <TeleporterParticle key={`tp${i}`} offset={i * 1.0} boxSize={[w, h, d]} color={teleColor} isOutward={isOutTeleporter} />
        ))}
      </group>;
    }
    case "lava":
      return <group position={[x, y, z]} rotation={[rx, ry, rz]} onClick={handleClick}>
        {/* Semi-transparent lava body */}
        <mesh ref={lavaGlowRef} castShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial color="#ff4400" transparent opacity={0.6} emissive="#ff2200" emissiveIntensity={0.5} roughness={0.2} /></mesh>
        {/* Bubbles moving inside */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <BubbleParticle key={`lb${i}`} offset={i * 1.1} boxSize={[w, h, d]} color="#ffaa00" size={0.06 + (i % 3) * 0.03} />
        ))}
        {/* Surface glow */}
        <mesh position={[0, h / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#ff6600" transparent opacity={0.4} emissive="#ff4400" emissiveIntensity={0.8} side={THREE.DoubleSide} />
        </mesh>
      </group>;
    case "water":
      return <group position={[x, y, z]} rotation={[rx, ry, rz]} onClick={handleClick}>
        {/* Semi-transparent water body */}
        <mesh ref={waterGlowRef}><boxGeometry args={[w, h, d]} /><meshStandardMaterial color="#1a8aff" transparent opacity={0.35} roughness={0.02} metalness={0.1} /></mesh>
        {/* Bubbles moving inside */}
        {[0, 1, 2, 3, 4].map(i => (
          <BubbleParticle key={`wb${i}`} offset={i * 1.4 + 0.5} boxSize={[w, h, d]} color="#88ccff" size={0.05 + (i % 3) * 0.02} />
        ))}
        {/* Surface shimmer */}
        <mesh position={[0, h / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#44aaff" transparent opacity={0.25} roughness={0.01} side={THREE.DoubleSide} />
        </mesh>
      </group>;
    case "npc": {
      const npcAvatar: AvatarData = { skin: color, face: "FACE-1", shirt: null, left_leg: null, right_leg: null };
      return <group position={[x, y, z]} rotation={[rx, ry, rz]} onClick={handleClick}>
        <Suspense fallback={null}>
          <WeildBuildCharacter avatar={npcAvatar} />
        </Suspense>
        {/* Speech bubble indicator */}
        <mesh position={[0.5, LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT + 0.3, 0]}>
          <sphereGeometry args={[0.08, 6, 6]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.3, LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT + 0.5, 0]}>
          <sphereGeometry args={[0.12, 6, 6]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
        <Html position={[0, LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT + 0.7, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="bg-slate-900/80 text-white px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap">{merged.name || "NPC"}</div>
        </Html>
      </group>;
    }
    case "player":
      return null; // Player is rendered separately by GameWorld
    default:
      return <mesh position={[x, y, z]} castShadow receiveShadow rotation={[rx, ry, rz]} onClick={handleClick}><boxGeometry args={[w, h, d]} /><meshStandardMaterial {...stdMatProps} /></mesh>;
  }
}

// ==================== PLAYER AVATAR 3D ====================
function PlayerAvatar3D({ avatar, position, rotation, walkPhaseRef, isJumpingRef, chatBubble }: { avatar: AvatarData; position: [number, number, number]; rotation: number; walkPhaseRef: React.MutableRefObject<number>; isJumpingRef: React.MutableRefObject<boolean>; chatBubble?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <WeildBuildCharacter avatar={avatar} walkPhaseRef={walkPhaseRef} isJumpingRef={isJumpingRef} />
      {chatBubble && (
        <Html position={[0, LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT + 0.3, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div className="bg-white/95 text-gray-900 px-2 py-1 rounded-lg text-[11px] font-medium max-w-[180px] whitespace-nowrap overflow-hidden text-ellipsis shadow-lg border border-gray-200">
            {chatBubble}
          </div>
        </Html>
      )}
    </group>
  );
}

// ==================== REMOTE PLAYER 3D ====================
// ==================== REMOTE PLAYER (Other players in game) ====================

function RemotePlayer3D({ player, chatBubble }: { player: RemotePlayerData; chatBubble?: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef<THREE.Vector3>(new THREE.Vector3(...player.position));
  const targetRotY = useRef(player.rotation[1] || 0);
  const walkPhase = useRef(0);
  const isJumping = useRef(false);
  const prevY = useRef(player.position[1]);
  const prevPrevY = useRef(player.position[1]);
  const isMovingHorizontallyRef = useRef(false);
  const lastMoveTime = useRef(0);
  // Track previous target XZ position to detect horizontal movement only
  const prevTargetXZ = useRef<[number, number]>([player.position[0], player.position[2]]);

  // Update targets when position/rotation props change
  useEffect(() => {
    const newPos = new THREE.Vector3(...player.position);
    targetPos.current.copy(newPos);
    targetRotY.current = player.rotation[1] || 0;
    // Detect jumping: Y increased significantly
    if (player.position[1] > prevY.current + 0.05) {
      isJumping.current = true;
    }
    prevPrevY.current = prevY.current;
    prevY.current = player.position[1];
  }, [player.position[0], player.position[1], player.position[2], player.rotation[1]]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Detect HORIZONTAL movement only (XZ plane) — ignore Y changes from jumping
    const dx = targetPos.current.x - prevTargetXZ.current[0];
    const dz = targetPos.current.z - prevTargetXZ.current[1];
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    if (horizontalDist > 0.01) {
      isMovingHorizontallyRef.current = true;
      lastMoveTime.current = performance.now();
      prevTargetXZ.current = [targetPos.current.x, targetPos.current.z];
    }

    // Smooth interpolation for position
    groupRef.current.position.lerp(targetPos.current, Math.min(delta * 8, 1));
    // Smooth rotation
    const currentRotY = groupRef.current.rotation.y;
    const diff = targetRotY.current - currentRotY;
    const wrappedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
    groupRef.current.rotation.y += wrappedDiff * Math.min(delta * 10, 1);

    // Walk animation: decay after 300ms without horizontal movement
    if (isMovingHorizontallyRef.current && performance.now() - lastMoveTime.current > 300) {
      isMovingHorizontallyRef.current = false;
    }

    // Only advance walk phase when moving horizontally AND not jumping
    if (isMovingHorizontallyRef.current && !isJumping.current) {
      walkPhase.current += delta * 10;
    } else {
      if (Math.abs(walkPhase.current) < 0.05) {
        walkPhase.current = 0;
      } else {
        walkPhase.current *= 0.85;
      }
    }

    // Jump landing detection: Y stopped decreasing (landed on ground or platform)
    // Compare two previous Y values: if Y was going down and now stabilized, they landed
    if (isJumping.current) {
      const yStable = Math.abs(prevY.current - prevPrevY.current) < 0.02;
      const onGround = targetPos.current.y <= 0.05;
      if (yStable || onGround) {
        isJumping.current = false;
      }
    }
  });

  return (
    <group ref={groupRef} rotation={[0, player.rotation[1] || 0, 0]}>
      <WeildBuildCharacter avatar={player.avatar || DEFAULT_AVATAR} walkPhaseRef={walkPhase} isJumpingRef={isJumping} />
      {/* Username label above head */}
      <Html position={[0, LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT + 0.5, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col items-center gap-1">
          <div className="bg-slate-900/80 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap">
            {moderateText(player.username)}
          </div>
          {chatBubble && (
            <div className="bg-white/95 text-gray-900 px-2 py-1 rounded-lg text-[11px] font-medium max-w-[180px] whitespace-nowrap overflow-hidden text-ellipsis shadow-lg border border-gray-200 animate-bounce">
              {chatBubble}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

// ==================== TELEPORTER CHAIN LINES ====================
// ==================== TELEPORTER CHAIN LINES ====================
function TeleporterChainLines({ primitives }: { primitives: any[] }) {
  const dashOffsetRef = useRef(0);
  const linesGroupRef = useRef<THREE.Group>(null);

  const pairs = useMemo(() => {
    const result: { from: number[]; to: number[] }[] = [];
    const teleporters = primitives.filter(p => p.shape_type === "teleporter");
    for (const tp of teleporters) {
      const target = tp.teleporter_target || (tp as any).teleporter_target;
      if (target) {
        const targetPrim = primitives.find((p: any) => p.id === target || p.name === target);
        if (targetPrim) {
          result.push({ from: tp.position, to: targetPrim.position });
        }
      }
    }
    return result;
  }, [primitives]);

  useEffect(() => {
    if (!linesGroupRef.current) return;
    // Clear previous lines
    while (linesGroupRef.current.children.length) {
      const child = linesGroupRef.current.children[0];
      linesGroupRef.current.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) (child as any).material.dispose();
    }
    // Add new lines
    for (const pair of pairs) {
      const points = [
        new THREE.Vector3(pair.from[0], pair.from[1] + 1, pair.from[2]),
        new THREE.Vector3(pair.to[0], pair.to[1] + 1, pair.to[2]),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 0.5, gapSize: 0.3, transparent: true, opacity: 0.6 });
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      linesGroupRef.current.add(line);
    }
  }, [pairs]);

  useFrame((_, delta) => {
    if (!linesGroupRef.current) return;
    dashOffsetRef.current -= delta * 2;
    for (const child of linesGroupRef.current.children) {
      const mat = (child as any).material;
      if (mat && mat.dashOffset !== undefined) {
        // eslint-disable-next-line react-hooks/immutability
        mat.dashOffset = dashOffsetRef.current;
      }
    }
  });

  if (pairs.length === 0) return null;

  return <group ref={linesGroupRef} />;
}

// ==================== WEATHER EFFECTS ====================
// ==================== WEATHER EFFECTS ====================
function WeatherEffects({ weather, intensity, bounds }: { weather: string; intensity: number; bounds: number }) {
  const particlesRef = useRef<THREE.Points>(null);
  // Use fixed max counts so buffer size never changes (avoids WebGL resize errors)
  const MAX_RAIN = 2000;
  const MAX_SNOW = 1000;
  const maxCount = MAX_RAIN; // Always allocate the larger buffer
  const activeCount = weather === "rain" ? Math.floor(MAX_RAIN * intensity) : weather === "snow" ? Math.floor(MAX_SNOW * intensity) : 0;

  const positions = useMemo(() => {
    const arr = new Float32Array(maxCount * 3);
    for (let i = 0; i < maxCount; i++) {
      arr[i * 3] = (Math.random() - 0.5) * bounds;
      arr[i * 3 + 1] = Math.random() * 30;
      arr[i * 3 + 2] = (Math.random() - 0.5) * bounds;
    }
    return arr;
  }, [bounds]);

  useFrame(() => {
    if (!particlesRef.current) return;
    const pos = particlesRef.current.geometry.attributes.position;
    if (!pos) return;
    const arr = pos.array as Float32Array;
    const speed = weather === "rain" ? 0.5 : weather === "snow" ? 0.05 : 0;
    // Only animate active particles
    for (let i = 0; i < activeCount; i++) {
      arr[i * 3 + 1] -= speed;
      if (weather === "snow") {
        arr[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.01;
      }
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 30;
        arr[i * 3] = (Math.random() - 0.5) * bounds;
        arr[i * 3 + 2] = (Math.random() - 0.5) * bounds;
      }
    }
    pos.needsUpdate = true;
    // Update draw range to only render active particles (no resizing buffer!)
    particlesRef.current.geometry.setDrawRange(0, activeCount);
  });

  if (weather === "fog") return null; // Fog is handled by the <fog> scene element
  if (weather === "none" || activeCount === 0) return null;

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={weather === "rain" ? "#aaccff" : "#ffffff"}
        size={weather === "rain" ? 0.05 : 0.15}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// ==================== COLLISION HELPERS ====================
// Non-solid shape types — these are triggers, not physical barriers
// NOTE: kill_brick and lava ARE solid (you stand on them), they just also kill you
const NON_SOLID_TYPES = new Set([
  "water", "checkpoint", "item_pickup", "teleporter", "npc", "player",
  "spawn_point", "speed_pad",
]);

export function isSolidForCollision(p: PrimitiveData, index: number, doorStates?: Record<number, boolean>): boolean {
  if (NON_SOLID_TYPES.has(p.shape_type)) return false;
  if ((p as any).can_collide === false || (p as any).collision_enabled === false) return false;
  if (p.shape_type === "door" && (doorStates?.[index] || (p as any).door_open)) return false;
  if ((p as any).visible === false) return false;
  return true;
}

// ==================== SHAPE-AWARE SURFACE HEIGHT ====================
// Computes the top surface height at a given XZ position for a single primitive.
// Returns null if the XZ position is outside the primitive's footprint.
// The `footprintPad` parameter expands the footprint check (use PLAYER_RADIUS for ground checks).
// IMPORTANT: Height calculations must match the visual geometry exactly.
export function getShapeSurfaceHeight(px: number, pz: number, prim: PrimitiveData, footprintPad: number = 0): number | null {
  const [primX, primY, primZ] = prim.position;
  const hw = prim.size[0] / 2;
  const hh = prim.size[1] / 2;
  const hd = prim.size[2] / 2;
  const dx = px - primX;
  const dz = pz - primZ;
  const pad = footprintPad;

  switch (prim.shape_type) {
    case "sphere": {
      const radius = hw;
      const distXZ = Math.sqrt(dx * dx + dz * dz);
      if (distXZ > radius + pad) return null;
      return primY + Math.sqrt(Math.max(0, radius * radius - Math.min(distXZ * distXZ, radius * radius)));
    }
    case "cylinder": {
      const radius = hw;
      const distXZ = Math.sqrt(dx * dx + dz * dz);
      if (distXZ > radius + pad) return null;
      return primY + hh;
    }
    case "wedge": {
      // Visual: tall on LEFT (-X) side, slopes down to RIGHT (+X) side
      // Peak at (-hw, +hh), ground at (+hw, -hh)
      // Height varies with X, NOT Z
      if (Math.abs(dx) > hw + pad || Math.abs(dz) > hd + pad) return null;
      const clampedDx = Math.max(-hw, Math.min(hw, dx));
      const xNorm = (clampedDx + hw) / (2 * hw); // 0 at -X (tall), 1 at +X (short)
      return primY - hh + (1 - xNorm) * prim.size[1];
    }
    case "ramp": {
      // Visual: flat at -Z (front), slopes UP to full height at +Z (back)
      // Height varies with Z: 0 at -Z, full at +Z
      if (Math.abs(dx) > hw + pad || Math.abs(dz) > hd + pad) return null;
      const clampedDz = Math.max(-hd, Math.min(hd, dz));
      const zNorm = (clampedDz + hd) / (2 * hd); // 0 at -Z, 1 at +Z
      return primY - hh + zNorm * prim.size[1];
    }
    case "corner_wedge": {
      // Visual: peak at (-X, -Z) corner = (-hw, +hh, -hd)
      // Slopes diagonally down to (+X, +Z) edges
      // Height = full at (-X,-Z), zero at (+X,*) and (*,+Z)
      if (Math.abs(dx) > hw + pad || Math.abs(dz) > hd + pad) return null;
      const clampedDx = Math.max(-hw, Math.min(hw, dx));
      const clampedDz = Math.max(-hd, Math.min(hd, dz));
      const xNorm = (clampedDx + hw) / (2 * hw); // 0 at -X, 1 at +X
      const zNorm = (clampedDz + hd) / (2 * hd); // 0 at -Z, 1 at +Z
      return primY - hh + (1 - Math.max(xNorm, zNorm)) * prim.size[1];
    }
    case "truss": {
      const shrink = 0.15;
      if (Math.abs(dx) > hw * (1 - shrink) + pad || Math.abs(dz) > hd * (1 - shrink) + pad) return null;
      return primY + hh * (1 - shrink);
    }
    default: {
      // Block, door (closed), etc.
      if (Math.abs(dx) > hw + pad || Math.abs(dz) > hd + pad) return null;
      return primY + hh;
    }
  }
}

// ==================== UNIFIED COLLISION RESOLVER ====================
// Single-pass collision resolver. Returns new position + grounded state.
//
// KEY DESIGN DECISIONS:
// - Ground detection uses CENTER-ONLY XZ (no radius padding).
//   This prevents the player from being snapped to the top of blocks
//   they're standing NEXT TO.
// - Surfaces above the player's feet are only considered if the player
//   was grounded last frame (wasGrounded=true) and within STEP_HEIGHT.
//   This handles walking up slopes without teleporting onto nearby walls.
// - Slope walking: when grounded and moving horizontally, player snaps
//   to the new surface height (up or down) within STEP_HEIGHT range.
// - Wall detection uses padded XZ for proper collision.
//
export function resolvePlayerPhysics(
  oldPos: [number, number, number],
  moveX: number,
  moveZ: number,
  velY: number,
  primitives: PrimitiveData[],
  halfBP: number,
  doorStates?: Record<number, boolean>,
  wasGrounded?: boolean
): { newPos: [number, number, number]; grounded: boolean; velY: number } {
  const playerBottom = oldPos[1];
  const PH = LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT;
  const PR = PLAYER_RADIUS;

  // Candidate position after applying movement + velocity
  let cx = oldPos[0] + moveX;
  let cy = playerBottom + velY;
  let cz = oldPos[2] + moveZ;
  let grounded = false;

  // ─── SINGLE PASS: Collect all collision data ───
  let groundSurface: number | null = null;   // Highest surface under player CENTER
  let groundIsSlope = false;                  // Whether highest surface comes from a slope shape
  let ceilHit: number | null = null;          // Lowest ceiling above player
  let blockedX = false;
  let blockedZ = false;

  // Baseplate ground check (always at y=0, center-only)
  if (Math.abs(cx) <= halfBP && Math.abs(cz) <= halfBP) {
    // Only consider baseplate if player could reach it (within step height above it)
    if (playerBottom >= -STEP_HEIGHT) {
      groundSurface = 0;
    }
  }

  for (let i = 0; i < primitives.length; i++) {
    const p = primitives[i];
    if (!isSolidForCollision(p, i, doorStates)) continue;

    const [px, py, pz] = p.position;
    const hw = p.size[0] / 2;
    const hh = p.size[1] / 2;
    const hd = p.size[2] / 2;
    const isSlope = p.shape_type === "wedge" || p.shape_type === "ramp" || p.shape_type === "corner_wedge";

    // ─── Ground surface: CENTER-ONLY XZ (no padding) ───
    // Only consider surfaces that the player could realistically be standing on:
    // - For ALL shapes: surfaces at or below the player's feet (landing/falling)
    // - For SLOPES ONLY: surfaces slightly above the player's feet when grounded
    //   (this allows walking up ramps/wedges without being blocked by walls)
    // - For regular blocks: surfaces above feet are NOT considered as ground —
    //   the wall collision code handles that case instead
    const sh = getShapeSurfaceHeight(cx, cz, p, 0);
    if (sh !== null) {
      const isAtOrBelow = sh <= playerBottom + 0.05;
      const isSlopeStepUp = isSlope && wasGrounded && sh <= playerBottom + STEP_HEIGHT;
      if (isAtOrBelow || isSlopeStepUp) {
        if (groundSurface === null || sh > groundSurface) {
          groundSurface = sh;
          groundIsSlope = isSlope;
        }
      }
    }

    // ─── Ceiling check (padded XZ) ───
    if (cx + PR > px - hw && cx - PR < px + hw &&
        cz + PR > pz - hd && cz - PR < pz + hd) {
      const primBottom = py - hh;
      if (primBottom < cy + PH && primBottom > cy && velY > 0) {
        if (ceilHit === null || primBottom < ceilHit) {
          ceilHit = primBottom;
        }
      }
    }

    // ─── X wall check (padded XZ, using old Z) ───
    if (!blockedX &&
        cx + PR > px - hw && cx - PR < px + hw &&
        oldPos[2] + PR > pz - hd && oldPos[2] - PR < pz + hd &&
        cy < py + hh && cy + PH > py - hh) {
      if (isSlope) {
        // For slopes, only block if player is deep inside the solid part
        // Use PR padding so the footprint extends slightly — this catches
        // the case where the player's center is just outside the footprint
        // but their body is overlapping the slope's solid wall face
        const surfaceHere = getShapeSurfaceHeight(cx, oldPos[2], p, PR);
        if (surfaceHere !== null && cy < surfaceHere - 0.15) {
          blockedX = true;
        }
      } else {
        blockedX = true;
      }
    }

    // ─── Z wall check (padded XZ, using resolved X) ───
    if (!blockedZ) {
      const testX = blockedX ? oldPos[0] : cx;
      if (testX + PR > px - hw && testX - PR < px + hw &&
          cz + PR > pz - hd && cz - PR < pz + hd &&
          cy < py + hh && cy + PH > py - hh) {
        if (isSlope) {
          const surfaceHere = getShapeSurfaceHeight(testX, cz, p, PR);
          if (surfaceHere !== null && cy < surfaceHere - 0.15) {
            blockedZ = true;
          }
        } else {
          blockedZ = true;
        }
      }
    }
  }

  // ─── Y resolution: ground snap ───
  if (groundSurface !== null && velY <= 0) {
    if (cy <= groundSurface) {
      // Player fell to or below the surface → land on it
      cy = groundSurface;
      velY = 0;
      grounded = true;
    } else if (cy - groundSurface <= GROUND_SKIN) {
      // Player is barely above surface (standing still on flat ground) → snap down
      cy = groundSurface;
      velY = 0;
      grounded = true;
    } else if (wasGrounded && groundIsSlope && cy - groundSurface <= STEP_HEIGHT) {
      // Player was grounded last frame on a SLOPE and the surface is within step height
      // below their feet (walking down a slope) → snap to surface
      // Only apply this for slopes — on flat blocks, the player should fall off edges
      cy = groundSurface;
      velY = 0;
      grounded = true;
    }
  }

  // Ceiling hit
  if (ceilHit !== null && velY > 0) {
    cy = ceilHit - PH;
    velY = 0;
  }

  // ─── XZ resolution ───
  if (blockedX) cx = oldPos[0];
  if (blockedZ) cz = oldPos[2];

  // ─── Edge detection after wall resolution ───
  // Re-check ground at the final XZ position (walls may have changed cx/cz)
  if (grounded) {
    let finalSurface: number | null = null;
    let finalIsSlope = false;
    if (Math.abs(cx) <= halfBP && Math.abs(cz) <= halfBP) {
      finalSurface = 0;
      finalIsSlope = false;
    }
    for (let i = 0; i < primitives.length; i++) {
      const p = primitives[i];
      if (!isSolidForCollision(p, i, doorStates)) continue;
      const isSlopeP = p.shape_type === "wedge" || p.shape_type === "ramp" || p.shape_type === "corner_wedge";
      const sh = getShapeSurfaceHeight(cx, cz, p, 0);
      if (sh !== null) {
        if (finalSurface === null || sh > finalSurface) {
          finalSurface = sh;
          finalIsSlope = isSlopeP;
        }
      }
    }
    if (finalSurface === null) {
      // No surface under player center → fall
      grounded = false;
    } else if (cy > finalSurface + STEP_HEIGHT) {
      // Player is way above the surface at final position → fall
      grounded = false;
    } else if (cy < finalSurface) {
      // Walked onto higher ground (ramp or step) → snap up
      cy = finalSurface;
    } else if (finalIsSlope && cy > finalSurface + GROUND_SKIN && cy <= finalSurface + STEP_HEIGHT) {
      // Walking down a slope — snap to lower surface (slopes only)
      cy = finalSurface;
    } else if (!finalIsSlope && cy > finalSurface + GROUND_SKIN) {
      // On flat ground, walked off an edge — fall (don't snap down on flat blocks)
      grounded = false;
    }
  }

  return { newPos: [cx, cy, cz], grounded, velY };
}

// ==================== GAME WORLD ====================
export function GameWorld({ game, avatar, remotePlayers, chatBubbles, onPositionUpdate, useArrowKeys, cameraZoomOverride, onCameraZoomChange, onHPChange, gameVolume }: { game: GameData; avatar: AvatarData; remotePlayers: RemotePlayerData[]; chatBubbles: Record<string, string>; onPositionUpdate: (pos: [number, number, number], rot: number) => void; useArrowKeys?: boolean; cameraZoomOverride?: number; onCameraZoomChange?: (zoom: number) => void; onHPChange?: (hp: number, maxHP: number) => void; gameVolume?: number }) {
  // Script execution state
  const gameVariables = useRef<Record<string, any>>({});
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [scriptMessage, setScriptMessage] = useState<string | null>(null);
  // Runtime primitive state overrides (for script-driven modifications)
  const gamePrimitiveStates = useRef<Record<number, Partial<PrimitiveData>>>({});
  const [runtimeUpdate, setRuntimeUpdate] = useState(0);
  // Player HP tracking
  const [playerHP, setPlayerHP] = useState(100);
  const playerMaxHP = useRef(100);
  // Shared AudioContext to prevent leaks
  const sharedAudioContextRef = useRef<AudioContext | null>(null);
  // Ref to track gameVolume for use in async callbacks
  const gameVolumeRef = useRef(gameVolume ?? 80);
  // Track active animation intervals for cleanup
  const animationIntervalsRef = useRef<NodeJS.Timeout[]>([]);

  // Helper to find primitive index by name or id
  const findPrimIndex = useCallback((prims: PrimitiveData[], target: string) => {
    return prims.findIndex(p => p.name === target || p.id === target);
  }, []);

  const executeScript = useCallback(async (prim: PrimitiveData, event: string, primIndex?: number) => {
    if (!prim.script) return;
    try {
      const scripts: ScriptRule[] = JSON.parse(prim.script);
      for (const rule of scripts) {
        if (!rule.enabled) continue;
        if (rule.event !== event) continue;
        if (rule.condition) {
          const condVar = gameVariables.current[rule.condition.variable || ""];
          if (rule.condition.type === "variable_equals" && String(condVar) !== String(rule.condition.value)) continue;
          if (rule.condition.type === "variable_greater" && Number(condVar) <= Number(rule.condition.value)) continue;
          if (rule.condition.type === "variable_less" && Number(condVar) >= Number(rule.condition.value)) continue;
          if (rule.condition.type === "has_item" && !condVar) continue;
        }
        const p = rule.params || {};
        switch (rule.action) {
          case "wait":
            await new Promise(r => setTimeout(r, (Number(p.duration) || 1) * 1000));
            break;
          case "if_branch": {
            const varVal = gameVariables.current[p.condition_variable || ""];
            const cmpVal = p.condition_value;
            let conditionMet = false;
            if (p.condition_type === "equals") conditionMet = String(varVal) === String(cmpVal);
            else if (p.condition_type === "greater") conditionMet = Number(varVal) > Number(cmpVal);
            else if (p.condition_type === "less") conditionMet = Number(varVal) < Number(cmpVal);
            else if (p.condition_type === "has_item") conditionMet = !!varVal;
            const actionsToRun = conditionMet ? (p.then_actions || []) : (p.else_actions || []);
            for (const subAction of actionsToRun) {
              // Recursively execute sub-actions as mini-rules
              await executeScript({ ...prim, script: JSON.stringify([{ id: "sub", event: "on_start", action: subAction.action || subAction, params: subAction.params || {}, enabled: true }]) }, "on_start", primIndex);
            }
            break;
          }
          case "show_message":
            setScriptMessage(p.message || "Hello!");
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), (p.duration || 3) * 1000);
            break;
          case "set_variable":
            gameVariables.current[p.variable_name || ""] = p.value === "true" ? true : p.value === "false" ? false : isNaN(Number(p.value)) ? p.value : Number(p.value);
            break;
          case "play_sound":
            try {
              // Map script sound names to real sound effect files
              const soundMap: Record<string, string> = {
                coin: 'used_tool',
                powerup: 'used_tool',
                explosion: 'explosion',
                alert: 'scary_laugh',
              };
              const soundName = soundMap[p.sound as string] || 'used_tool';
              playSound(soundName, (gameVolumeRef.current / 100) * 0.5);
            } catch {}
            break;
          case "teleport_player":
            if (p.x !== undefined) {
              playerPos.current = [Number(p.x) || 0, Number(p.y) || 0, Number(p.z) || 0];
            }
            break;
          case "take_damage":
            setPlayerHP(prev => {
              const newHP = Math.max(0, prev - (Number(p.amount) || 10));
              if (newHP <= 0) {
                playSound('death', 0.5);
                // Execute on_player_die for player primitive
                const playerPrimIdx = (game.primitives || []).findIndex(pp => pp.shape_type === "player");
                if (playerPrimIdx !== -1) executeScript((game.primitives || [])[playerPrimIdx], "on_player_die", playerPrimIdx);
                // Respawn player
                setTimeout(() => {
                  playerPos.current = [lastCheckpoint.current[0], lastCheckpoint.current[1], lastCheckpoint.current[2]];
                  playerVel.current = [0, 0, 0];
                  setPlayerHP(playerMaxHP.current);
                }, 500);
                setScriptMessage("You died! Respawning...");
              } else {
                setScriptMessage(`Ouch! -${p.amount || 10} HP (${newHP}/${playerMaxHP.current})`);
              }
              return newHP;
            });
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 2000);
            break;
          case "heal":
            setPlayerHP(prev => {
              const newHP = Math.min(playerMaxHP.current, prev + (Number(p.amount) || 10));
              setScriptMessage(`Healed +${p.amount || 10} HP (${newHP}/${playerMaxHP.current})`);
              return newHP;
            });
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 2000);
            break;
          case "change_color": {
            if (primIndex !== undefined) {
              const hexColor = p.color || "#ff0000";
              const r = parseInt(hexColor.slice(1, 3), 16) / 255;
              const g = parseInt(hexColor.slice(3, 5), 16) / 255;
              const b = parseInt(hexColor.slice(5, 7), 16) / 255;
              gamePrimitiveStates.current[primIndex] = { ...gamePrimitiveStates.current[primIndex], color: [r, g, b] };
              setRuntimeUpdate(u => u + 1);
            }
            setScriptMessage("Color changed!");
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "change_size": {
            if (primIndex !== undefined) {
              gamePrimitiveStates.current[primIndex] = { ...gamePrimitiveStates.current[primIndex], size: [Number(p.size_x) || 2.5, Number(p.size_y) || 2.5, Number(p.size_z) || 2.5] };
              setRuntimeUpdate(u => u + 1);
            }
            setScriptMessage("Size changed!");
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "move_to": {
            if (primIndex !== undefined) {
              gamePrimitiveStates.current[primIndex] = { ...gamePrimitiveStates.current[primIndex], position: [Number(p.x) || 0, Number(p.y) || 0, Number(p.z) || 0] };
              setRuntimeUpdate(u => u + 1);
            }
            setScriptMessage(`Moving to (${p.x}, ${p.y}, ${p.z})`);
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "destroy_self": {
            if (primIndex !== undefined) {
              gamePrimitiveStates.current[primIndex] = { ...gamePrimitiveStates.current[primIndex], visible: false };
              setRuntimeUpdate(u => u + 1);
            }
            setScriptMessage("Object destroyed!");
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "change_transparency": {
            if (primIndex !== undefined) {
              (gamePrimitiveStates.current[primIndex] as any) = { ...gamePrimitiveStates.current[primIndex], transparency: Number(p.transparency) || 0 };
              setRuntimeUpdate(u => u + 1);
            }
            setScriptMessage("Transparency changed!");
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "change_material": {
            if (primIndex !== undefined) {
              (gamePrimitiveStates.current[primIndex] as any) = { ...gamePrimitiveStates.current[primIndex], material: p.material || "plastic" };
              setRuntimeUpdate(u => u + 1);
            }
            setScriptMessage("Material changed!");
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "spawn_object": {
            // Create a new runtime block - use a high index to avoid collision
            const newX = Number(p.x) || 0;
            const newY = Number(p.y) || 5;
            const newZ = Number(p.z) || 0;
            const idx = 10000 + Object.keys(gamePrimitiveStates.current).length;
            gamePrimitiveStates.current[idx] = {
              position: [newX, newY, newZ],
              size: [2.5, 2.5, 2.5],
              color: [0.7, 0.7, 0.7],
              shape_type: "block",
              name: p.object_name || "Spawned Object",
              visible: true,
            } as PrimitiveData;
            setRuntimeUpdate(u => u + 1);
            setScriptMessage(`Spawned ${p.object_name || "object"}!`);
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "destroy_object": {
            // Destroy a target object by name
            const targetName = p.target_name || "";
            const prims = game.primitives || [];
            const targetIdx = prims.findIndex(tp => tp.name === targetName);
            if (targetIdx !== -1) {
              gamePrimitiveStates.current[targetIdx] = { ...gamePrimitiveStates.current[targetIdx], visible: false };
              setRuntimeUpdate(u => u + 1);
              setScriptMessage(`Destroyed ${targetName}!`);
            } else {
              setScriptMessage(`Object "${targetName}" not found`);
            }
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "enable_object": {
            const targetName = p.target_name || "";
            const prims = game.primitives || [];
            const targetIdx = prims.findIndex(tp => tp.name === targetName);
            if (targetIdx !== -1) {
              gamePrimitiveStates.current[targetIdx] = { ...gamePrimitiveStates.current[targetIdx], visible: true };
              setRuntimeUpdate(u => u + 1);
              setScriptMessage(`Enabled ${targetName}!`);
            } else {
              setScriptMessage(`Object "${targetName}" not found`);
            }
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "disable_object": {
            const targetName = p.target_name || "";
            const prims = game.primitives || [];
            const targetIdx = prims.findIndex(tp => tp.name === targetName);
            if (targetIdx !== -1) {
              gamePrimitiveStates.current[targetIdx] = { ...gamePrimitiveStates.current[targetIdx], visible: false };
              setRuntimeUpdate(u => u + 1);
              setScriptMessage(`Disabled ${targetName}!`);
            } else {
              setScriptMessage(`Object "${targetName}" not found`);
            }
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "open_door": {
            const targetName = p.target_name || "";
            const prims = game.primitives || [];
            const targetIdx = prims.findIndex(tp => tp.name === targetName && tp.shape_type === "door");
            if (targetIdx !== -1) {
              doorStatesRef.current[targetIdx] = true;
              setRuntimeUpdate(u => u + 1);
              setScriptMessage(`Opened door ${targetName}!`);
            } else {
              setScriptMessage(`Door "${targetName}" not found`);
            }
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "close_door": {
            const targetName = p.target_name || "";
            const prims = game.primitives || [];
            const targetIdx = prims.findIndex(tp => tp.name === targetName && tp.shape_type === "door");
            if (targetIdx !== -1) {
              doorStatesRef.current[targetIdx] = false;
              setRuntimeUpdate(u => u + 1);
              setScriptMessage(`Closed door ${targetName}!`);
            } else {
              setScriptMessage(`Door "${targetName}" not found`);
            }
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "rotate_to": {
            if (primIndex !== undefined) {
              gamePrimitiveStates.current[primIndex] = { ...gamePrimitiveStates.current[primIndex], rotation: [Number(p.rx) || 0, Number(p.ry) || 0, Number(p.rz) || 0] };
              setRuntimeUpdate(u => u + 1);
            }
            setScriptMessage("Rotation changed!");
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "apply_force": {
            // Apply an impulse to the player
            const fx = Number(p.fx) || 0;
            const fy = Number(p.fy) || 0;
            const fz = Number(p.fz) || 0;
            const strength = Number(p.strength) || 1;
            playerVel.current[0] += fx * strength;
            playerVel.current[1] += fy * strength;
            playerVel.current[2] += fz * strength;
            setScriptMessage("Force applied!");
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "set_timer": {
            const duration = Number(p.duration) || 1;
            const eventName = p.event_name || "on_timer";
            setTimeout(() => {
              const prims = game.primitives || [];
              for (let ti = 0; ti < prims.length; ti++) {
                executeScript(prims[ti], "on_custom_event", ti);
              }
            }, duration * 1000);
            setScriptMessage(`Timer set: ${duration}s → ${eventName}`);
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "trigger_event": {
            const eventName = p.event_name || "";
            const prims = game.primitives || [];
            for (let ti = 0; ti < prims.length; ti++) {
              executeScript(prims[ti], "on_custom_event", ti);
            }
            setScriptMessage(`Event triggered: ${eventName}`);
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "start_animation": {
            // Simple animation: bounce, spin, float, pulse, shake
            if (primIndex !== undefined) {
              const animType = p.animation_type || "bounce";
              const basePos = [...(game.primitives || [])[primIndex]?.position || [0, 0, 0]];
              const baseRot = [...(game.primitives || [])[primIndex]?.rotation || [0, 0, 0]];
              let animFrame = 0;
              const animInterval = setInterval(() => {
                animFrame++;
                const t = animFrame * 0.05;
                let newPos = [...basePos] as number[];
                let newRot = [...baseRot] as number[];
                switch (animType) {
                  case "bounce":
                    newPos[1] = basePos[1] + Math.abs(Math.sin(t * 3)) * 0.5;
                    break;
                  case "spin":
                    newRot[1] = baseRot[1] + t * 2;
                    break;
                  case "float":
                    newPos[1] = basePos[1] + Math.sin(t * 2) * 0.3;
                    break;
                  case "pulse": {
                    const scale = 1 + Math.sin(t * 4) * 0.1;
                    const origSize = (game.primitives || [])[primIndex]?.size || [2.5, 2.5, 2.5];
                    gamePrimitiveStates.current[primIndex] = { ...gamePrimitiveStates.current[primIndex], size: [origSize[0] * scale, origSize[1] * scale, origSize[2] * scale] };
                    setRuntimeUpdate(u => u + 1);
                    break;
                  }
                  case "shake":
                    newPos[0] = basePos[0] + Math.sin(t * 20) * 0.05;
                    newPos[2] = basePos[2] + Math.cos(t * 20) * 0.05;
                    break;
                }
                if (animType !== "pulse") {
                  gamePrimitiveStates.current[primIndex] = { ...gamePrimitiveStates.current[primIndex], position: newPos, rotation: newRot };
                  setRuntimeUpdate(u => u + 1);
                }
                if (animFrame > 200) {
                  clearInterval(animInterval);
                  // Remove from tracking array
                  const idx = animationIntervalsRef.current.indexOf(animInterval);
                  if (idx !== -1) animationIntervalsRef.current.splice(idx, 1);
                }
              }, 50);
              animationIntervalsRef.current.push(animInterval);
            }
            setScriptMessage(`Animation started: ${p.animation_type || "bounce"}`);
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 1500);
            break;
          }
          case "show_dialog": {
            const lines = (p.dialog_lines || "Hello!").split(",");
            setScriptMessage(lines.join("\n"));
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 5000);
            break;
          }
          case "give_item": {
            const itemType = p.item_type || "coin";
            const amount = Number(p.amount) || 1;
            gameVariables.current[`has_${itemType}`] = (gameVariables.current[`has_${itemType}`] || 0) + amount;
            setScriptMessage(`Got ${amount}x ${itemType}!`);
            if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
            messageTimeoutRef.current = setTimeout(() => setScriptMessage(null), 2000);
            break;
          }
          default:
            break;
        }
      }
    } catch {}
  }, []);

  // Execute on_start scripts when game begins
  useEffect(() => {
    const prims = game.primitives || [];
    for (let i = 0; i < prims.length; i++) {
      executeScript(prims[i], "on_start", i);
    }
    // Execute on_player_join for player primitive
    const playerPrimIndex = prims.findIndex(p => p.shape_type === "player");
    if (playerPrimIndex !== -1) {
      executeScript(prims[playerPrimIndex], "on_player_join", playerPrimIndex);
    }
  }, []);
  // Sync HP changes to parent
  useEffect(() => {
    if (onHPChange) onHPChange(playerHP, playerMaxHP.current);
  }, [playerHP, onHPChange]);

  // Read player HP from game data (search unfiltered list since player is filtered out of primitives)
  useEffect(() => {
    const playerPrim = (game.primitives || []).find(p => p.shape_type === "player");
    if (playerPrim) {
      const hp = (playerPrim as any).player_hp || 100;
      setPlayerHP(hp);
      playerMaxHP.current = hp;
    }
  }, [game.primitives]);
  const playerPos = useRef<[number, number, number]>([
    game.spawn_point?.[0] || 0,
    game.spawn_point?.[1] || 0,
    game.spawn_point?.[2] || 0,
  ]);
  const playerVel = useRef<[number, number, number]>([0, 0, 0]);
  const playerRot = useRef(0);
  const isGrounded = useRef(true);
  const isJumping = useRef(false);
  const walkPhase = useRef(0);
  const keysDown = useRef<Set<string>>(new Set());
  const cameraYaw = useRef(0);
  const cameraPitch = useRef(0.5);
  const cameraDist = useRef(12);
  // Reusable Vector3s to avoid allocations in useFrame (GC pressure)
  const _forward = useRef(new THREE.Vector3());
  const _right = useRef(new THREE.Vector3());
  const _camPos = useRef(new THREE.Vector3());
  // Apply camera zoom override
  useEffect(() => {
    if (cameraZoomOverride !== undefined && cameraZoomOverride > 0) {
      cameraDist.current = cameraZoomOverride;
    }
  }, [cameraZoomOverride]);
  const isRightDragging = useRef(false);
  const lastMouse = useRef<[number, number]>([0, 0]);
  const isClimbing = useRef(false);
  const lastPositionBroadcast = useRef(0);
  const lastCheckpoint = useRef<[number, number, number]>([
    game.spawn_point?.[0] || 0,
    game.spawn_point?.[1] || 0,
    game.spawn_point?.[2] || 0,
  ]);
  // Door interaction state: track which doors are open during gameplay
  const doorStatesRef = useRef<Record<number, boolean>>({});
  const nearDoorRef = useRef<number | null>(null); // index of door player is near
  const doorPromptRef = useRef<string | null>(null); // tracks current prompt to avoid unnecessary re-renders
  const touchCooldowns = useRef<Record<number, number>>({}); // primitive index -> last touch timestamp
  const [doorPrompt, setDoorPrompt] = useState<string | null>(null);

  // Sync gameVolume prop to ref for use in async callbacks
  useEffect(() => {
    gameVolumeRef.current = gameVolume ?? 80;
    setMasterVolume(gameVolume ?? 80);
  }, [gameVolume]);

  // Preload sound effects on mount
  useEffect(() => {
    preloadSounds();
  }, []);

  // Cleanup: clear animation intervals and close shared AudioContext on unmount
  useEffect(() => {
    return () => {
      animationIntervalsRef.current.forEach(id => clearInterval(id));
      animationIntervalsRef.current = [];
      if (sharedAudioContextRef.current && sharedAudioContextRef.current.state !== 'closed') {
        sharedAudioContextRef.current.close();
        sharedAudioContextRef.current = null;
      }
    };
  }, []);

  // Helper to get or create shared AudioContext
  const getSharedAudioContext = useCallback((): AudioContext => {
    if (!sharedAudioContextRef.current || sharedAudioContextRef.current.state === 'closed') {
      sharedAudioContextRef.current = new AudioContext();
    }
    return sharedAudioContextRef.current;
  }, []);

  const baseplateSize = game.baseplate_size || 50;
  const halfBP = baseplateSize / 2;
  // Filter out editor-only objects (player, baseplate) that shouldn't exist in gameplay
  const primitives = (game.primitives || []).filter(p => p.shape_type !== "player");

  const topColor = game.sky_color_top ? `rgb(${Math.round(game.sky_color_top[0]*255)}, ${Math.round(game.sky_color_top[1]*255)}, ${Math.round(game.sky_color_top[2]*255)})` : "#6699cc";
  const bottomColor = game.sky_color_bottom ? `rgb(${Math.round(game.sky_color_bottom[0]*255)}, ${Math.round(game.sky_color_bottom[1]*255)}, ${Math.round(game.sky_color_bottom[2]*255)})` : "#aaccee";
  const bpColor = game.baseplate_color ? `rgb(${Math.round(game.baseplate_color[0]*255)}, ${Math.round(game.baseplate_color[1]*255)}, ${Math.round(game.baseplate_color[2]*255)})` : "#3d6666";

  // Get canvas element for touch camera handling
  const { gl } = useThree();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip game input if chat input is focused
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      keysDown.current.add(key);
      // Arrow key support: map arrow keys to WASD
      if (useArrowKeys) {
        if (key === "arrowup") keysDown.current.add("w");
        if (key === "arrowdown") keysDown.current.add("s");
        if (key === "arrowleft") keysDown.current.add("a");
        if (key === "arrowright") keysDown.current.add("d");
      }
      if (e.key === " " && isGrounded.current) { playerVel.current[1] = JUMP_FORCE; isGrounded.current = false; isJumping.current = true; playSound('jump', 0.4); }
      // Door interaction: press E to toggle nearby door
      if (key === "e" && nearDoorRef.current !== null) {
        const doorIdx = nearDoorRef.current;
        doorStatesRef.current[doorIdx] = !doorStatesRef.current[doorIdx];
        const isOpen = doorStatesRef.current[doorIdx];
        setDoorPrompt(isOpen ? "Door opened" : "Door closed");
        // Auto-close door after 3 seconds if it has auto_close enabled
        const prim = primitives[doorIdx];
        if (isOpen && prim && (prim as any).door_auto_close) {
          setTimeout(() => {
            doorStatesRef.current[doorIdx] = false;
            setDoorPrompt("Door closed");
            setTimeout(() => setDoorPrompt(null), 1000);
          }, 3000);
        }
        setTimeout(() => setDoorPrompt(null), 1000);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      // Skip game input if chat input is focused
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      keysDown.current.delete(key);
      if (key === "arrowup") keysDown.current.delete("w");
      if (key === "arrowdown") keysDown.current.delete("s");
      if (key === "arrowleft") keysDown.current.delete("a");
      if (key === "arrowright") keysDown.current.delete("d");
    };
    const handleMouseDown = (e: MouseEvent) => { if (e.button === 2) { isRightDragging.current = true; lastMouse.current = [e.clientX, e.clientY]; } };
    const handleMouseUp = (e: MouseEvent) => { if (e.button === 2) isRightDragging.current = false; };
    const handleMouseMove = (e: MouseEvent) => {
      if (isRightDragging.current) {
        const dx = e.clientX - lastMouse.current[0];
        const dy = e.clientY - lastMouse.current[1];
        cameraYaw.current -= dx * 0.005;
        cameraPitch.current = Math.max(-0.2, Math.min(1.4, cameraPitch.current + dy * 0.005));
        lastMouse.current = [e.clientX, e.clientY];
      }
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDist.current = Math.max(4, Math.min(30, cameraDist.current + e.deltaY * 0.01));
      if (onCameraZoomChange) onCameraZoomChange(Math.round(cameraDist.current * 10) / 10);
    };
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    // Touch camera handling — attached to canvas so it doesn't block UI buttons
    const canvasEl = gl.domElement;
    let cameraTouchId: number | null = null;
    let lastCameraTouch: [number, number] = [0, 0];

    const handleTouchStart = (e: TouchEvent) => {
      // Only handle single-finger touches for camera orbit
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
          cameraPitch.current = Math.max(-0.2, Math.min(1.4, cameraPitch.current + dy * 0.006));
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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("contextmenu", handleContextMenu);
    if (canvasEl) {
      canvasEl.style.touchAction = 'none';
      canvasEl.addEventListener("touchstart", handleTouchStart, { passive: true });
      canvasEl.addEventListener("touchmove", handleTouchMove, { passive: true });
      canvasEl.addEventListener("touchend", handleTouchEnd, { passive: true });
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("contextmenu", handleContextMenu);
      if (canvasEl) {
        canvasEl.removeEventListener("touchstart", handleTouchStart);
        canvasEl.removeEventListener("touchmove", handleTouchMove);
        canvasEl.removeEventListener("touchend", handleTouchEnd);
      }
    };
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const keys = keysDown.current;

    // Apply mobile camera input (from overlay buttons — camera orbit is now handled on canvas directly)
    // Mobile jump
    if (mobileInputRef.jump && isGrounded.current) {
      playerVel.current[1] = JUMP_FORCE;
      isGrounded.current = false;
      isJumping.current = true;
      mobileInputRef.jump = false;
      playSound('jump', 0.4);
    }

    const forward = _forward.current.set(-Math.sin(cameraYaw.current), 0, -Math.cos(cameraYaw.current));
    const right = _right.current.set(-forward.z, 0, forward.x);

    let moveX = 0, moveZ = 0;
    if (keys.has("w")) { moveX += forward.x; moveZ += forward.z; }
    if (keys.has("s")) { moveX -= forward.x; moveZ -= forward.z; }
    if (keys.has("a")) { moveX -= right.x; moveZ -= right.z; }
    if (keys.has("d")) { moveX += right.x; moveZ += right.z; }

    // Add mobile joystick input
    const mJoyX = mobileInputRef.moveX;
    const mJoyZ = mobileInputRef.moveZ;
    if (Math.abs(mJoyX) > 0.05 || Math.abs(mJoyZ) > 0.05) {
      moveX += right.x * mJoyX + forward.x * mJoyZ;
      moveZ += right.z * mJoyX + forward.z * mJoyZ;
    }

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    const isWalking = len > 0.01;
    if (isWalking) {
      moveX = (moveX / len) * MOVE_SPEED;
      moveZ = (moveZ / len) * MOVE_SPEED;
      const targetRot = Math.atan2(moveX, moveZ);
      playerRot.current = lerpAngle(playerRot.current, targetRot, 0.15);
      walkPhase.current += delta * 10;
    } else {
      if (Math.abs(walkPhase.current) < 0.05) {
        walkPhase.current = 0;
      } else {
        walkPhase.current *= 0.85;
      }
    }

    // Truss climbing check
    isClimbing.current = false;
    for (const p of primitives) {
      if (p.shape_type !== "truss") continue;
      const [px, py, pz] = p.position;
      const [hw, hh, hd] = [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2];
      const dx = playerPos.current[0] - px;
      const dz = playerPos.current[2] - pz;
      if (Math.abs(dx) < hw + PLAYER_RADIUS + 0.1 && Math.abs(dz) < hd + PLAYER_RADIUS + 0.1 &&
          playerPos.current[1] >= py - hh && playerPos.current[1] < py + hh) {
        if (isWalking || keys.has("w") || keys.has(" ") || Math.abs(mJoyZ) > 0.3) {
          isClimbing.current = true;
          break;
        }
      }
    }

    // Apply gravity (reduced if climbing)
    if (isClimbing.current) {
      playerVel.current[1] = Math.max(playerVel.current[1], 0);
      playerVel.current[1] += 0.012; // climb up speed
      if (keys.has("s")) playerVel.current[1] -= 0.02; // climb down
    } else {
      playerVel.current[1] += GRAVITY;
    }

    // Pre-pass: detect speed pads and water BEFORE physics (prevents wall-clipping and jitter)
    let preSpeedBoost = 1.0;
    let preInWater = false;
    for (let ti = 0; ti < primitives.length; ti++) {
      const p = primitives[ti];
      const [px, py, pz] = p.position;
      const [hw, hh, hd] = [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2];
      const playerBottom = playerPos.current[1];
      const playerTop = playerPos.current[1] + PLAYER_HEIGHT;
      const inside = playerPos.current[0] + PLAYER_RADIUS > px - hw && playerPos.current[0] - PLAYER_RADIUS < px + hw &&
        playerPos.current[2] + PLAYER_RADIUS > pz - hd && playerPos.current[2] - PLAYER_RADIUS < pz + hd &&
        playerBottom < py + hh && playerTop > py - hh;
      if (!inside) continue;
      if (p.shape_type === "speed_pad") {
        const boost = (p as any).speed_pad_speed || 2;
        preSpeedBoost = Math.max(preSpeedBoost, boost);
      }
      if (p.shape_type === "water") {
        preInWater = true;
      }
    }
    if (preSpeedBoost > 1 && isWalking) {
      moveX *= preSpeedBoost;
      moveZ *= preSpeedBoost;
    }

    // Water swimming: apply buoyancy and reduce gravity BEFORE physics resolution
    // This prevents jitter caused by fighting the physics resolver after the fact
    if (preInWater) {
      // Counteract most of gravity and apply upward buoyancy
      playerVel.current[1] -= GRAVITY * 0.85; // Reduce gravity effect by 85%
      playerVel.current[1] += 0.003; // Buoyancy force upward
      // Swim up when pressing space
      if (keysDown.current.has(" ")) playerVel.current[1] += 0.015;
      // Clamp vertical velocity to reasonable swim speed
      playerVel.current[1] = Math.max(playerVel.current[1], -0.02);
      playerVel.current[1] = Math.min(playerVel.current[1], 0.04);
    }

    // ─── Unified physics resolution ───
    const oldPos = playerPos.current;
    const result = resolvePlayerPhysics(
      oldPos, moveX, moveZ, playerVel.current[1],
      primitives, halfBP, doorStatesRef.current, isGrounded.current
    );
    const newPos: [number, number, number] = result.newPos;
    playerVel.current[1] = result.velY;
    isGrounded.current = result.grounded;
    isJumping.current = !result.grounded && playerVel.current[1] > 0;

    // Trigger detection for gameplay objects (single pass)
    let inWater = false;
    for (let ti = 0; ti < primitives.length; ti++) {
      const p = primitives[ti];
      const [px, py, pz] = p.position;
      const [hw, hh, hd] = [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2];
      const playerBottom = newPos[1];
      const playerTop = newPos[1] + PLAYER_HEIGHT;
      const inside = newPos[0] + PLAYER_RADIUS > px - hw && newPos[0] - PLAYER_RADIUS < px + hw &&
        newPos[2] + PLAYER_RADIUS > pz - hd && newPos[2] - PLAYER_RADIUS < pz + hd &&
        playerBottom < py + hh && playerTop > py - hh;

      if (inside) {
        if (p.shape_type === "kill_brick" || p.shape_type === "lava") {
          newPos[0] = lastCheckpoint.current[0];
          newPos[1] = lastCheckpoint.current[1];
          newPos[2] = lastCheckpoint.current[2];
          playerVel.current = [0, 0, 0];
          executeScript(p, "on_touch", ti);
          continue;
        }
        if (p.shape_type === "speed_pad") {
          executeScript(p, "on_touch", ti);
          continue;
        }
        if (p.shape_type === "checkpoint") {
          lastCheckpoint.current = [px, py + hh, pz];
          executeScript(p, "on_touch", ti);
          continue;
        }
        if (p.shape_type === "water") {
          inWater = true;
        }
        if (p.shape_type === "item_pickup") {
          executeScript(p, "on_item_collect", ti);
        }
        if (p.shape_type === "teleporter") {
          const target = (p as any).teleporter_target;
          if (target) {
            const targetPrim = primitives.find(tp => tp.shape_type === "teleporter" && tp.name === target);
            if (targetPrim) {
              newPos[0] = targetPrim.position[0];
              newPos[1] = targetPrim.position[1] + targetPrim.size[1] / 2;
              newPos[2] = targetPrim.position[2];
            }
          }
          executeScript(p, "on_touch", ti);
          continue;
        }
        // Execute on_touch for any primitive with scripts (throttled: 1 sec cooldown per primitive)
        const touchNow = performance.now();
        if (!touchCooldowns.current[ti] || touchNow - touchCooldowns.current[ti] > 1000) {
          touchCooldowns.current[ti] = touchNow;
          executeScript(p, "on_touch", ti);
        }
      }
    }

    // Door proximity detection - check if player is near any door
    nearDoorRef.current = null;
    for (let i = 0; i < primitives.length; i++) {
      const p = primitives[i];
      if (p.shape_type !== "door") continue;
      const [px, py, pz] = p.position;
      const [hw, hh, hd] = [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2];
      const dx = newPos[0] - px;
      const dz = newPos[2] - pz;
      const distXZ = Math.sqrt(dx * dx + dz * dz);
      if (distXZ < Math.max(hw, hd) + PLAYER_RADIUS + 1.5 &&
          newPos[1] >= py - hh - 0.5 && newPos[1] < py + hh + 0.5) {
        nearDoorRef.current = i;
        break;
      }
    }
    // Show/hide door prompt — use ref to avoid React re-renders in useFrame
    const desiredPrompt = nearDoorRef.current !== null ? "Press E to open door" : null;
    if (desiredPrompt !== doorPromptRef.current) {
      doorPromptRef.current = desiredPrompt;
      setDoorPrompt(desiredPrompt);
    }

    // Fall off world - respawn at last checkpoint or spawn point
    if (newPos[1] < -500) {
      const respawnPoint = lastCheckpoint.current[1] > -500
        ? [lastCheckpoint.current[0], lastCheckpoint.current[1], lastCheckpoint.current[2]] as [number, number, number]
        : [game.spawn_point?.[0] || 0, game.spawn_point?.[1] || 0.15, game.spawn_point?.[2] || 0] as [number, number, number];
      newPos[0] = respawnPoint[0];
      newPos[1] = respawnPoint[1];
      newPos[2] = respawnPoint[2];
      playerVel.current = [0, 0, 0];
    }

    playerPos.current = newPos;

    // Update player group
    if (groupRef.current) {
      groupRef.current.position.set(newPos[0], newPos[1], newPos[2]);
      groupRef.current.rotation.y = playerRot.current;
    }

    // Broadcast position to server (throttled to ~15 times/sec)
    const now = performance.now();
    if (now - lastPositionBroadcast.current > 66) {
      lastPositionBroadcast.current = now;
      onPositionUpdate(newPos, playerRot.current);
    }

    // Update camera — reuse Vector3 to avoid GC pressure
    const cam = state.camera;
    const charCenter = newPos[1] + 1.2;
    _camPos.current.set(
      newPos[0] + cameraDist.current * Math.sin(cameraYaw.current) * Math.cos(cameraPitch.current),
      charCenter + cameraDist.current * Math.sin(cameraPitch.current),
      newPos[2] + cameraDist.current * Math.cos(cameraYaw.current) * Math.cos(cameraPitch.current),
    );
    cam.position.copy(_camPos.current);
    cam.lookAt(newPos[0], charCenter, newPos[2]);
  });

  return (
    <>
      <SkyDome topColor={topColor} bottomColor={bottomColor} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[30, 50, 30]} intensity={0.8} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-far={300} shadow-camera-left={-100} shadow-camera-right={100} shadow-camera-top={100} shadow-camera-bottom={-100} />
      <directionalLight position={[-20, 30, -20]} intensity={0.3} />
      {(() => { const env = (game as any).environment; return env?.fog_enabled ? <fog attach="fog" args={[rgbToHex(env.fog_color?.[0] ?? 0.7, env.fog_color?.[1] ?? 0.7, env.fog_color?.[2] ?? 0.7), 30, 30 + (1 - (env.fog_density ?? 0.02)) * 100]} /> : null; })()}
      <BaseplateMesh size={baseplateSize} color={bpColor} />
      <GridLines size={baseplateSize} />
      <TeleporterChainLines primitives={primitives} />
      {primitives.map((p, i) => <WorldPrimitive key={i} primitive={p} doorOpen={doorStatesRef.current[i]} runtimeState={gamePrimitiveStates.current[i]} onClick={() => executeScript(p, "on_click", i)} />)}
      {!primitives.find(p => p.shape_type === "spawn_point") && (
        <group position={(game.spawn_point || [0, 0.15, 0]) as [number, number, number]}><SpawnMarker /></group>
      )}
      <group ref={groupRef}>
        <PlayerAvatar3D avatar={avatar} position={[0, 0, 0]} rotation={0} walkPhaseRef={walkPhase} isJumpingRef={isJumping} />
      </group>
      {/* Render other players */}
      {remotePlayers.map((rp) => (
        <RemotePlayer3D key={rp.socketId} player={rp} chatBubble={chatBubbles[rp.socketId]} />
      ))}
      {/* Weather effects */}
      <WeatherEffects weather={(game as any).environment?.weather || "none"} intensity={(game as any).environment?.weather_intensity || 0.5} bounds={baseplateSize} />
      {/* Door prompt */}
      {doorPrompt && (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', bottom: '25%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', color: '#a5b4fc', padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', textAlign: 'center', pointerEvents: 'none', border: '1px solid rgba(99,102,241,0.3)' }}>
            {doorPrompt}
          </div>
        </Html>
      )}
      {/* Script message overlay */}
      {scriptMessage && (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', color: 'white', padding: '12px 24px', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center', maxWidth: '400px', pointerEvents: 'none' }}>
            {scriptMessage}
          </div>
        </Html>
      )}
    </>
  );
}
