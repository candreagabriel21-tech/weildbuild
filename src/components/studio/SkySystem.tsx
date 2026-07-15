'use client';

import { useRef, useMemo, useEffect, Suspense } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { useStudioStore } from '@/lib/studio-store';

// ═══════════════════════════════════════════════════════════
//  SkySystem — Roblox-style 2D billboard sky for WeildBuild
// ═══════════════════════════════════════════════════════════

// ─── Helpers ───

function lerpColor(c1: string, c2: string, t: number): string {
  const a = new THREE.Color(c1);
  const b = new THREE.Color(c2);
  a.lerp(b, Math.max(0, Math.min(1, t)));
  return '#' + a.getHexString();
}

/** Returns true if the current timeOfDay qualifies as "night" */
function isNightTime(timeOfDay: number): boolean {
  return timeOfDay < 5.5 || timeOfDay > 20.5;
}

/** Returns 0-1 factor: 1 = full night, 0 = full day, smooth transition at dawn/dusk */
function nightFactor(timeOfDay: number): number {
  if (timeOfDay < 5) return 1;
  if (timeOfDay < 7) return 1 - (timeOfDay - 5) / 2;
  if (timeOfDay < 19) return 0;
  if (timeOfDay < 21) return (timeOfDay - 19) / 2;
  return 1;
}

// ─── Sky dome — gradient sphere ───

function SkyDome() {
  const worldSettings = useStudioStore((s) => s.worldSettings);

  // ALWAYS use timeOfDay for visual state — dayNightEnabled only controls
  // whether time advances automatically, not the visual appearance.
  const skyColors = useMemo(() => {
    const stops: [number, string, string][] = [
      [0, '#06061a', '#0d0d2b'],
      [4, '#080822', '#111133'],
      [5, '#1a1040', '#2a1a4a'],
      [6, '#3a2060', '#ff6633'],
      [7, '#7744aa', '#ff8844'],
      [8, '#4477cc', '#ffaa66'],
      [9, worldSettings.skyColorTop, worldSettings.skyColorBottom],
      [16, worldSettings.skyColorTop, worldSettings.skyColorBottom],
      [17, '#cc6644', '#ff7733'],
      [18, '#993344', '#ff5522'],
      [19, '#442255', '#cc4422'],
      [20, '#1a1040', '#442233'],
      [21, '#0a0820', '#151530'],
      [24, '#06061a', '#0d0d2b'],
    ];

    const t = worldSettings.timeOfDay;
    if (t <= stops[0][0]) return { top: stops[0][1], bottom: stops[0][2] };
    if (t >= stops[stops.length - 1][0]) return { top: stops[stops.length - 1][1], bottom: stops[stops.length - 1][2] };
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t < stops[i + 1][0]) {
        const blend = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
        return {
          top: lerpColor(stops[i][1], stops[i + 1][1], blend),
          bottom: lerpColor(stops[i][2], stops[i + 1][2], blend),
        };
      }
    }
    return { top: worldSettings.skyColorTop, bottom: worldSettings.skyColorBottom };
  }, [worldSettings.skyColorTop, worldSettings.skyColorBottom, worldSettings.timeOfDay]);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(skyColors.top) },
        uBottomColor: { value: new THREE.Color(skyColors.bottom) },
        uExponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        uniform float uExponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float t = max(pow(max(h, 0.0), uExponent), 0.0);
          vec3 col = mix(uBottomColor, uTopColor, t);
          float horizonGlow = exp(-abs(h) * 8.0) * 0.15;
          col += uBottomColor * horizonGlow;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);

  useEffect(() => {
    if (shaderMaterial) {
      shaderMaterial.uniforms.uTopColor.value.set(skyColors.top);
      shaderMaterial.uniforms.uBottomColor.value.set(skyColors.bottom);
    }
  }, [skyColors, shaderMaterial]);

  return (
    <mesh material={shaderMaterial} renderOrder={-1000}>
      <sphereGeometry args={[480, 32, 32]} />
    </mesh>
  );
}

// ─── Billboard helper — always faces the camera ───

function BillboardGroup({ position, children }: { position: [number, number, number]; children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {children}
    </group>
  );
}

// ─── Sun — flat 2D billboard sprite ───

function Sun() {
  const worldSettings = useStudioStore((s) => s.worldSettings);

  const sunAngle = useMemo(() => {
    return ((worldSettings.timeOfDay - 6) / 12) * Math.PI;
  }, [worldSettings.timeOfDay]);

  const sunDistance = 350;
  const sunX = Math.cos(sunAngle) * sunDistance;
  const sunY = Math.sin(sunAngle) * sunDistance;

  const isVisible = worldSettings.sunEnabled && sunY > -10;

  // Sun texture — disc + glow fully contained within canvas bounds
  // Canvas is 256x256, center at 128. We keep all content within ~100px
  // from center so there's a 28px transparent margin to avoid edge clipping.
  const sunTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Start fully transparent
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2, cy = size / 2, r = size * 0.22;
    const c = new THREE.Color(worldSettings.sunColor);
    const r255 = Math.round(c.r * 255);
    const g255 = Math.round(c.g * 255);
    const b255 = Math.round(c.b * 255);

    // Outer glow — fades to fully transparent, stays within canvas
    const outerGrad = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 2.8);
    outerGrad.addColorStop(0, `rgba(${r255},${g255},${b255},0.3)`);
    outerGrad.addColorStop(0.3, `rgba(${r255},${g255},${b255},0.12)`);
    outerGrad.addColorStop(0.6, `rgba(${r255},${g255},${b255},0.03)`);
    outerGrad.addColorStop(1, `rgba(${r255},${g255},${b255},0)`);
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Sun disc — solid bright circle
    const discGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    discGrad.addColorStop(0, '#ffffff');
    discGrad.addColorStop(0.3, '#fffbe8');
    discGrad.addColorStop(0.7, worldSettings.sunColor);
    discGrad.addColorStop(1, `rgba(${r255},${g255},${b255},0.0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = discGrad;
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [worldSettings.sunColor]);

  if (!isVisible) return null;

  const size = 30 * worldSettings.sunSize;
  const heightFactor = Math.max(0, sunY / sunDistance);

  return (
    <BillboardGroup position={[sunX, sunY, 0]}>
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={sunTexture}
          transparent
          depthWrite={false}
          alphaTest={0.05}
        />
      </mesh>
      {/* Directional light from sun */}
      <directionalLight
        position={[0, 0, 0]}
        intensity={heightFactor * 1.8}
        color={worldSettings.sunColor}
      />
    </BillboardGroup>
  );
}

// ─── Moon — flat 2D billboard sprite using custom PNG texture ───

function MoonInner() {
  const worldSettings = useStudioStore((s) => s.worldSettings);

  const moonAngle = useMemo(() => {
    return ((worldSettings.timeOfDay - 6) / 12) * Math.PI + Math.PI;
  }, [worldSettings.timeOfDay]);

  const moonDistance = 350;
  const moonX = Math.cos(moonAngle) * moonDistance;
  const moonY = Math.sin(moonAngle) * moonDistance;
  const moonZ = 60;

  const isVisible = worldSettings.moonEnabled && moonY > -10;

  // Load the custom moon PNG texture
  const moonTexture = useLoader(THREE.TextureLoader, '/textures/moon.png');

  if (!isVisible) return null;

  const size = 24 * worldSettings.moonSize;
  const heightFactor = Math.max(0, moonY / moonDistance);

  return (
    <BillboardGroup position={[moonX, moonY, moonZ]}>
      {/* Moon sprite — toneMapped={false} so it's always bright regardless of scene lighting */}
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={moonTexture}
          transparent
          depthWrite={false}
          alphaTest={0.05}
          toneMapped={false}
        />
      </mesh>
      {/* Moonlight */}
      <pointLight
        position={[0, 0, 0]}
        intensity={heightFactor * 0.4}
        color="#8899cc"
        distance={600}
      />
    </BillboardGroup>
  );
}

function Moon() {
  return (
    <Suspense fallback={null}>
      <MoonInner />
    </Suspense>
  );
}

// ─── Stars ───

function Stars() {
  const worldSettings = useStudioStore((s) => s.worldSettings);
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, count } = useMemo(() => {
    const count = Math.max(0, Math.floor(worldSettings.starCount));
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random()); // upper hemisphere only
      const r = 450;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return { positions: pos, count };
  }, [worldSettings.starCount]);

  // Stars visibility always based on timeOfDay — whether day/night cycle
  // is on or off. dayNightEnabled only controls time advancement.
  const starOpacity = useMemo(() => {
    if (!worldSettings.starsEnabled) return 0;
    return nightFactor(worldSettings.timeOfDay);
  }, [worldSettings.timeOfDay, worldSettings.starsEnabled]);

  useFrame((state) => {
    if (!pointsRef.current || starOpacity < 0.01) return;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = starOpacity * (0.85 + Math.sin(state.clock.elapsedTime * 0.7) * 0.15);
  });

  if (starOpacity < 0.01 || count === 0) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <float32BufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={1.5}
        color="#ffffff"
        transparent
        opacity={starOpacity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ─── Clouds — 2D billboard sprites like Roblox ───

interface CloudBillboard {
  id: number;
  position: [number, number, number];
  scale: number;
  speed: number;
  textureIndex: number;
}

function Clouds() {
  const worldSettings = useStudioStore((s) => s.worldSettings);
  const groupRef = useRef<THREE.Group>(null);

  const clouds = useMemo(() => {
    const result: CloudBillboard[] = [];
    const count = Math.floor(15 * worldSettings.cloudDensity);
    for (let i = 0; i < count; i++) {
      result.push({
        id: i,
        position: [
          (Math.random() - 0.5) * 500,
          60 + Math.random() * 50,
          (Math.random() - 0.5) * 500,
        ],
        scale: 25 + Math.random() * 40,
        speed: 0.3 + Math.random() * 1.2,
        textureIndex: Math.floor(Math.random() * 4),
      });
    }
    return result;
  }, [worldSettings.cloudDensity]);

  // Generate 4 cloud shape textures — transparent outside the cloud
  const cloudTextures = useMemo(() => {
    const textures: THREE.CanvasTexture[] = [];
    const cloudColor = new THREE.Color(worldSettings.cloudColor);
    const r255 = Math.round(cloudColor.r * 255);
    const g255 = Math.round(cloudColor.g * 255);
    const b255 = Math.round(cloudColor.b * 255);

    const blobSets = [
      // Variant 0: Wide spread
      [
        { x: -40, y: 5, r: 55 },
        { x: 0, y: -10, r: 65 },
        { x: 45, y: 5, r: 50 },
        { x: -15, y: 20, r: 45 },
        { x: 20, y: 20, r: 40 },
      ],
      // Variant 1: Tall puffy
      [
        { x: -20, y: 15, r: 45 },
        { x: 0, y: -5, r: 60 },
        { x: 25, y: 10, r: 50 },
        { x: 5, y: 25, r: 40 },
      ],
      // Variant 2: Long stretched
      [
        { x: -60, y: 5, r: 45 },
        { x: -20, y: -8, r: 55 },
        { x: 20, y: -5, r: 50 },
        { x: 60, y: 5, r: 40 },
        { x: 0, y: 15, r: 50 },
      ],
      // Variant 3: Small puffy
      [
        { x: -15, y: 5, r: 40 },
        { x: 10, y: -5, r: 50 },
        { x: 5, y: 15, r: 35 },
      ],
    ];

    for (let variant = 0; variant < 4; variant++) {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Start fully transparent
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2, cy = size / 2;
      const blobs = blobSets[variant];

      // Draw soft blobs — all fade to transparent at edges
      blobs.forEach(({ x, y, r }) => {
        const grad = ctx.createRadialGradient(cx + x, cy + y, 0, cx + x, cy + y, r);
        grad.addColorStop(0, `rgba(${r255},${g255},${b255},0.9)`);
        grad.addColorStop(0.5, `rgba(${r255},${g255},${b255},0.6)`);
        grad.addColorStop(1, `rgba(${r255},${g255},${b255},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx + x, cy + y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      textures.push(tex);
    }
    return textures;
  }, [worldSettings.cloudColor]);

  // Drift clouds in the wind direction
  const windDirRad = useMemo(() => {
    return (worldSettings.windDirection * Math.PI) / 180;
  }, [worldSettings.windDirection]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Wind vector: 0° = +Z (North), 90° = +X (East), 180° = -Z (South), 270° = -X (West)
    const dx = Math.sin(windDirRad);
    const dz = Math.cos(windDirRad);
    groupRef.current.children.forEach((child, i) => {
      const cloud = clouds[i];
      if (!cloud) return;
      const speed = cloud.speed * worldSettings.cloudSpeed * delta;
      child.position.x += dx * speed;
      child.position.z += dz * speed;
      // Wrap around so clouds loop back
      if (child.position.x > 270) child.position.x = -270;
      if (child.position.x < -270) child.position.x = 270;
      if (child.position.z > 270) child.position.z = -270;
      if (child.position.z < -270) child.position.z = 270;
    });
  });

  if (!worldSettings.cloudsEnabled || worldSettings.cloudDensity <= 0) return null;

  // Cloud opacity always based on timeOfDay
  let opacity = 0.85;
  const nf = nightFactor(worldSettings.timeOfDay);
  if (nf > 0) {
    // At night, clouds become much more transparent (hard to see)
    opacity = 0.85 - nf * 0.7; // 0.85 at day, 0.15 at night
  }
  if (worldSettings.weatherType === 'cloudy' || worldSettings.weatherType === 'rain') {
    opacity = Math.min(1, opacity + worldSettings.weatherIntensity * 0.15);
  }

  return (
    <group ref={groupRef}>
      {clouds.map((cloud) => (
        <BillboardGroup key={cloud.id} position={[cloud.position[0], cloud.position[1], cloud.position[2]]}>
          <mesh>
            <planeGeometry args={[cloud.scale, cloud.scale * 0.5]} />
            <meshBasicMaterial
              map={cloudTextures[cloud.textureIndex]}
              transparent
              opacity={opacity}
              depthWrite={false}
            />
          </mesh>
        </BillboardGroup>
      ))}
    </group>
  );
}

// ─── Weather particles (rain / snow) ───

function WeatherParticles() {
  const worldSettings = useStudioStore((s) => s.worldSettings);
  const pointsRef = useRef<THREE.Points>(null);
  const velocitiesRef = useRef<Float32Array | null>(null);

  const isRain = worldSettings.weatherType === 'rain';
  const isSnow = worldSettings.weatherType === 'snow';
  const count = isRain || isSnow ? Math.floor(worldSettings.weatherIntensity * 4000) : 0;

  const positions = useMemo(() => {
    if (count === 0) return new Float32Array(0);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 250;
      pos[i * 3 + 1] = Math.random() * 90;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 250;
    }
    velocitiesRef.current = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      velocitiesRef.current[i] = isRain ? (18 + Math.random() * 12) : (0.8 + Math.random() * 2);
    }
    return pos;
  }, [count, isRain, isSnow]);

  useFrame((_, delta) => {
    if (!pointsRef.current || count === 0 || !velocitiesRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const vels = velocitiesRef.current;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] -= vels[i] * delta;
      if (isRain) arr[i * 3] += Math.sin(delta * i * 0.01) * 0.15;
      if (isSnow) {
        const t = Date.now() * 0.001;
        arr[i * 3] += Math.sin(t + i) * 0.03;
        arr[i * 3 + 2] += Math.cos(t + i * 0.5) * 0.03;
      }
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 80 + Math.random() * 10;
        arr[i * 3] = (Math.random() - 0.5) * 250;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 250;
      }
    }
    posAttr.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <float32BufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={isRain ? 0.15 : 0.35}
        color={isRain ? '#aabbdd' : '#ffffff'}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ─── Adaptive lighting ───

function AdaptiveLighting() {
  const worldSettings = useStudioStore((s) => s.worldSettings);

  const sunAngle = useMemo(() => {
    return ((worldSettings.timeOfDay - 6) / 12) * Math.PI;
  }, [worldSettings.timeOfDay]);

  const sunUp = Math.sin(sunAngle);
  // Always use timeOfDay for day/night determination — dayNightEnabled
  // only controls time advancement, not the visual state.
  const isDaytime = sunUp > 0;

  const sunIntensity = isDaytime ? Math.max(0.15, sunUp * sunUp) * 1.5 : 0.03;
  const ambientIntensity = worldSettings.ambientLightIntensity * (isDaytime ? 1 : 0.12);

  const lightColor = useMemo(() => {
    const t = worldSettings.timeOfDay;
    if (t < 5 || t > 21) return '#223366';
    if (t < 6) return lerpColor('#223366', '#ff8844', t - 5);
    if (t < 7) return lerpColor('#ff8844', '#ffcc88', t - 6);
    if (t < 9) return lerpColor('#ffcc88', '#ffffff', (t - 7) / 2);
    if (t < 16) return '#ffffff';
    if (t < 18) return lerpColor('#ffffff', '#ff9955', (t - 16) / 2);
    if (t < 19) return lerpColor('#ff9955', '#ff6633', t - 18);
    if (t < 20) return lerpColor('#ff6633', '#442255', t - 19);
    return lerpColor('#442255', '#223366', t - 20);
  }, [worldSettings.timeOfDay]);

  const lightPos = useMemo(() => {
    const dist = 120;
    return [
      Math.cos(sunAngle) * dist,
      Math.max(8, Math.sin(sunAngle) * dist),
      40,
    ] as [number, number, number];
  }, [sunAngle]);

  const hemiSkyColor = useMemo(() => {
    const t = worldSettings.timeOfDay;
    if (t < 5 || t > 21) return '#0a0a2e';
    if (t < 7) return lerpColor('#1a1a4a', worldSettings.skyColorTop, (t - 5) / 2);
    if (t > 19) return lerpColor(worldSettings.skyColorTop, '#0a0a2e', (t - 19) / 2);
    return worldSettings.skyColorTop;
  }, [worldSettings.timeOfDay, worldSettings.skyColorTop]);

  const hemiGroundColor = useMemo(() => {
    const t = worldSettings.timeOfDay;
    if (t < 5 || t > 21) return '#080818';
    if (t < 7) return lerpColor('#111122', worldSettings.skyColorBottom, (t - 5) / 2);
    if (t > 19) return lerpColor(worldSettings.skyColorBottom, '#111122', (t - 19) / 2);
    return worldSettings.skyColorBottom;
  }, [worldSettings.timeOfDay, worldSettings.skyColorBottom]);

  return (
    <>
      <ambientLight intensity={ambientIntensity * 0.6} color={isDaytime ? '#ffffff' : '#334466'} />
      <directionalLight
        position={lightPos}
        intensity={sunIntensity}
        color={lightColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      <directionalLight
        position={[-lightPos[0] * 0.5, lightPos[1] * 0.6, -lightPos[2]]}
        intensity={isDaytime ? 0.25 : 0.03}
        color="#667799"
      />
      <hemisphereLight args={[hemiSkyColor, hemiGroundColor, isDaytime ? 0.35 : 0.04]} />
    </>
  );
}

// ─── Day/Night cycle time updater ───

function DayNightCycle() {
  const worldSettings = useStudioStore((s) => s.worldSettings);
  const accumRef = useRef(0);

  useFrame((_, delta) => {
    if (!worldSettings.dayNightEnabled) return;
    accumRef.current += delta;
    if (accumRef.current > 0.3) {
      accumRef.current = 0;
      const hoursPerSecond = 24 / worldSettings.dayLength;
      const newTime = (worldSettings.timeOfDay + 0.3 * hoursPerSecond) % 24;
      useStudioStore.getState().setWorldSettings({ timeOfDay: parseFloat(newTime.toFixed(2)) });
    }
  });

  return null;
}

// ─── Scene background ───

function SceneBackgroundUpdater() {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color('#000000');
    return () => { scene.background = null; };
  }, [scene]);

  return null;
}

// ─── Main SkySystem export ───

export function SkySystem() {
  return (
    <>
      <SceneBackgroundUpdater />
      <SkyDome />
      <Stars />
      <AdaptiveLighting />
      <Sun />
      <Moon />
      <Clouds />
      <WeatherParticles />
      <DayNightCycle />
    </>
  );
}
