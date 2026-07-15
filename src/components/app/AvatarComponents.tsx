'use client';

import { useEffect, useState, useRef, useMemo, useCallback, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { AvatarData, ItemData } from "@/lib/store";
import {
  ITEM_COLORS, getItemColor, DEFAULT_AVATAR, getFaceImagePath,
  TORSO_HEIGHT, TORSO_WIDTH, TORSO_DEPTH,
  HEAD_WIDTH, HEAD_HEIGHT, HEAD_DEPTH,
  ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH,
  LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH,
  ARM_GAP, HEAD_GAP, LEG_GAP,
  UNEQUIPPED_TORSO_COLOR, UNEQUIPPED_LEGS_COLOR,
} from "./shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RotateCw } from "lucide-react";

// ==================== FACE IMAGE HELPERS ====================

/**
 * Load a face image from the local filesystem.
 * ALL faces are stored as /items/faces/FACE-N.png (e.g. FACE-1.png, FACE-5.png, FACE-21.png)
 * No procedural fallback — if the image doesn't load, the face plane simply won't render.
 */
function loadFaceImage(faceId: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const localPath = getFaceImagePath(faceId);
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => {
      // Try B2 proxy as fallback — the proxy streams the image directly
      const b2Key = `items/faces/${faceId}.png`;
      const proxyUrl = `/api/storage/download?key=${encodeURIComponent(b2Key)}`;
      const b2Img = new Image();
      b2Img.onload = () => resolve(b2Img);
      b2Img.onerror = () => resolve(null);
      b2Img.src = proxyUrl;
    };
    img.src = localPath;
  });
}

// ==================== FACE PREVIEW COMPONENT ====================
export function FacePreview({ faceId, size = 80 }: { faceId: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);

    let cancelled = false;

    loadFaceImage(faceId).then(img => {
      if (cancelled) return;
      if (img) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, size, size);
      }
      // No procedural fallback — if image doesn't load, canvas stays empty
    });

    return () => { cancelled = true; };
  }, [faceId, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="rounded-lg" />;
}

// ==================== FACE 3D PREVIEW MODAL ====================
export function FacePreviewModal({ faceId, open, onClose }: { faceId: string; open: boolean; onClose: () => void }) {
  const previewAvatar: AvatarData = { skin: "#f8ff6d", face: faceId, shirt: null, left_leg: null, right_leg: null };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-slate-900 border-indigo-500/30 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white text-center">Face Preview</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center" style={{ height: 250 }}>
          <Canvas camera={{ position: [0, 2.2, 3.5], fov: 35 }} shadows gl={{ preserveDrawingBuffer: true, antialias: true }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
            <directionalLight position={[-3, 5, -3]} intensity={0.4} />
            <Suspense fallback={null}>
              <WeildBuildCharacter avatar={previewAvatar} />
            </Suspense>
            <OrbitControls enablePan={false} enableZoom={true} minDistance={2} maxDistance={6}
              autoRotate autoRotateSpeed={2}
              maxPolarAngle={Math.PI / 1.8} minPolarAngle={Math.PI / 6} target={[0, 2.2, 0]} />
          </Canvas>
        </div>
        <DialogFooter>
          <Button variant="outline" className="w-full border-slate-600 text-slate-300" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== FACE TEXTURE GENERATOR ====================
/**
 * Creates a THREE.Texture for the given face ID by loading the image.
 * ALL faces use image files at /items/faces/FACE-N.png — no procedural rendering.
 */
function createFaceTexture(faceId: string): THREE.Texture {
  const localPath = getFaceImagePath(faceId);

  const loader = new THREE.TextureLoader();
  const texture = loader.load(localPath, (tex) => {
    tex.needsUpdate = true;
  }, undefined, () => {
    // On error loading local file, try B2 proxy
    const b2Key = `items/faces/${faceId}.png`;
    const proxyUrl = `/api/storage/download?key=${encodeURIComponent(b2Key)}`;
    const b2Loader = new THREE.TextureLoader();
    b2Loader.load(proxyUrl, (b2Tex) => {
      (texture as any).image = b2Tex.image;
      texture.needsUpdate = true;
    }, undefined, () => {
      // Both failed — texture will remain blank, no procedural fallback
    });
  });

  // Pixel-art faces (like Smile Face FACE-1) should use nearest-neighbor filtering
  if (faceId === "FACE-1") {
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
  } else {
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 16;
  }
  texture.needsUpdate = true;
  return texture;
}

// ==================== 3D CHARACTER ====================
export function WeildBuildCharacter({ avatar, animate = false, walkPhase, isJumping = false, walkPhaseRef, isJumpingRef }: { avatar: AvatarData; animate?: boolean; walkPhase?: number; isJumping?: boolean; walkPhaseRef?: React.MutableRefObject<number>; isJumpingRef?: React.MutableRefObject<boolean> }) {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const skinColor = avatar.skin || "#f8ff6d";
  const shirtEquipped = !!avatar.shirt;
  const pantsEquipped = !!(avatar.left_leg || avatar.right_leg);
  const shirtColor = avatar.shirt ? getItemColor(avatar.shirt) : (shirtEquipped ? skinColor : UNEQUIPPED_TORSO_COLOR);
  const pantsColor = avatar.left_leg ? getItemColor(avatar.left_leg) : (pantsEquipped ? skinColor : UNEQUIPPED_LEGS_COLOR);

  // Face texture — createFaceTexture returns a texture synchronously;
  // the image loads asynchronously and the texture self-updates.
  const faceTexture = useMemo(() => createFaceTexture(avatar.face || "FACE-1"), [avatar.face]);

  useFrame(() => {
    const phase = walkPhaseRef ? walkPhaseRef.current : (walkPhase || 0);
    const jumping = isJumpingRef ? isJumpingRef.current : isJumping;

    const amplitude = Math.abs(phase) < 0.01 ? 0 : Math.min(Math.abs(Math.sin(phase)), 1);
    const swing = Math.sin(phase) * 0.4 * (phase !== 0 ? 1 : 0);

    if (jumping) {
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0.3;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0.3;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -0.8;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.8;
    } else if (Math.abs(phase) < 0.01) {
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
    } else {
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing;
    }
  });

  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 }), [skinColor]);
  const shirtMat = useMemo(() => new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 }), [shirtColor]);
  const pantsMat = useMemo(() => new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 }), [pantsColor]);
  const faceMat = useMemo(() => faceTexture
    ? new THREE.MeshStandardMaterial({ map: faceTexture, transparent: true, roughness: 0.5 })
    : null, [faceTexture]);

  const torsoY = LEG_HEIGHT;
  const headY = LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP;

  return (
    <group ref={groupRef}>
      <group ref={leftLegRef} position={[-(LEG_WIDTH / 2 + LEG_GAP / 2), LEG_HEIGHT, 0]}>
        <mesh position={[0, -LEG_HEIGHT / 2, 0]} material={pantsMat} castShadow>
          <boxGeometry args={[LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH]} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[LEG_WIDTH / 2 + LEG_GAP / 2, LEG_HEIGHT, 0]}>
        <mesh position={[0, -LEG_HEIGHT / 2, 0]} material={pantsMat} castShadow>
          <boxGeometry args={[LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH]} />
        </mesh>
      </group>
      <mesh position={[0, torsoY + TORSO_HEIGHT / 2, 0]} material={shirtMat} castShadow>
        <boxGeometry args={[TORSO_WIDTH, TORSO_HEIGHT, TORSO_DEPTH]} />
      </mesh>
      <group ref={leftArmRef} position={[-(TORSO_WIDTH / 2 + ARM_WIDTH / 2 + ARM_GAP), torsoY + ARM_HEIGHT, 0]}>
        <mesh position={[0, -ARM_HEIGHT / 2, 0]} material={skinMat} castShadow>
          <boxGeometry args={[ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH]} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[TORSO_WIDTH / 2 + ARM_WIDTH / 2 + ARM_GAP, torsoY + ARM_HEIGHT, 0]}>
        <mesh position={[0, -ARM_HEIGHT / 2, 0]} material={skinMat} castShadow>
          <boxGeometry args={[ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH]} />
        </mesh>
      </group>
      <mesh position={[0, headY + HEAD_HEIGHT / 2, 0]} material={skinMat} castShadow>
        <boxGeometry args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_DEPTH]} />
      </mesh>
      {faceMat && (
        <mesh position={[0, headY + HEAD_HEIGHT / 2, HEAD_DEPTH / 2 + 0.002]} material={faceMat}>
          <planeGeometry args={[HEAD_WIDTH * 0.95, HEAD_HEIGHT * 0.95]} />
        </mesh>
      )}
    </group>
  );
}

// ==================== 3D AVATAR CANVAS ====================
export function Avatar3D({ avatar, size = 300 }: { avatar: AvatarData; size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="rounded-xl overflow-hidden">
      <Canvas camera={{ position: [0, 1.5, 5], fov: 30 }} shadows gl={{ preserveDrawingBuffer: true, antialias: true }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 8, 5]} intensity={1} castShadow />
        <directionalLight position={[-3, 5, -3]} intensity={0.3} />
        <Suspense fallback={null}>
          <WeildBuildCharacter avatar={avatar} animate />
        </Suspense>
        <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={2}
          maxPolarAngle={Math.PI / 1.8} minPolarAngle={Math.PI / 4} target={[0, 1, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <circleGeometry args={[2, 32]} />
          <meshStandardMaterial color="#1a1a2e" transparent opacity={0.3} />
        </mesh>
      </Canvas>
    </div>
  );
}

// ==================== 3D AVATAR EDITOR ====================
export function Avatar3DEditor({ avatar, previewAvatar }: { avatar: AvatarData; previewAvatar: AvatarData }) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="w-full">
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-slate-800/50 to-slate-900/80 border border-slate-700/50" style={{ height: "400px" }}>
        <Canvas camera={{ position: [0, 1.5, 5], fov: 30 }} shadows gl={{ preserveDrawingBuffer: true, antialias: true }}
          onPointerDown={() => { setIsDragging(true); setAutoRotate(false); }}
          onPointerUp={() => { setIsDragging(false); setTimeout(() => setAutoRotate(true), 2000); }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
          <directionalLight position={[-3, 5, -3]} intensity={0.4} />
          <pointLight position={[0, 6, 4]} intensity={0.3} color="#818cf8" />
          <Suspense fallback={null}>
            <WeildBuildCharacter avatar={previewAvatar} />
          </Suspense>
          <OrbitControls enablePan={false} enableZoom={true} minDistance={2} maxDistance={10}
            autoRotate={autoRotate} autoRotateSpeed={1.5}
            maxPolarAngle={Math.PI * 0.98} minPolarAngle={Math.PI * 0.02} target={[0, 1, 0]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <circleGeometry args={[3, 64]} />
            <meshStandardMaterial color="#1a1a2e" transparent opacity={0.4} />
          </mesh>
        </Canvas>
        <div className="absolute top-3 left-3 bg-slate-900/70 backdrop-blur-sm rounded-lg px-3 py-1.5 pointer-events-none">
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <RotateCw className="w-3 h-3" /> Drag to rotate &bull; Scroll to zoom
          </p>
        </div>
      </div>
    </div>
  );
}

// ==================== AVATAR ICON 3D ====================
const _avatarRendererRef = { current: null as THREE.WebGLRenderer | null, renderSize: 0 };
const _avatarRenderQueue: (() => void)[] = [];
let _avatarRendering = false;

function _processAvatarQueue() {
  if (_avatarRendering || _avatarRenderQueue.length === 0) return;
  _avatarRendering = true;
  const next = _avatarRenderQueue.shift();
  if (next) next();
}

export function AvatarIcon3D({ avatar, size = 28 }: { avatar: AvatarData; size?: number }) {
  const [imgSrc, setImgSrc] = useState<string>("");
  const avatarKey = JSON.stringify(avatar);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const renderSize = Math.max(size * 4, 128);

    const doRender = () => {
      if (cancelledRef.current) { _avatarRendering = false; _processAvatarQueue(); return; }

      if (!_avatarRendererRef.current || _avatarRendererRef.renderSize !== renderSize) {
        if (_avatarRendererRef.current) _avatarRendererRef.current.dispose();
        _avatarRendererRef.current = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        _avatarRendererRef.current.setSize(renderSize, renderSize);
        _avatarRendererRef.current.setClearColor(0x000000, 0);
        _avatarRendererRef.renderSize = renderSize;
      }
      const renderer = _avatarRendererRef.current;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100);
      camera.position.set(0, 0.15, 3.2);
      camera.lookAt(0, -0.15, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(3, 5, 4);
      scene.add(dirLight);
      const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
      backLight.position.set(-2, 3, -3);
      scene.add(backLight);

      const group = new THREE.Group();
      group.position.y = -2.2375;

      const skinColor = avatar.skin || "#f8ff6d";
      const shirtColor = avatar.shirt ? getItemColor(avatar.shirt) : UNEQUIPPED_TORSO_COLOR;
      const pantsColor = avatar.left_leg ? getItemColor(avatar.left_leg) : UNEQUIPPED_LEGS_COLOR;

      const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 });

      const head = new THREE.Mesh(new THREE.BoxGeometry(HEAD_WIDTH, HEAD_HEIGHT, HEAD_DEPTH), skinMat);
      head.position.set(0, LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT / 2, 0);
      group.add(head);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(TORSO_WIDTH, TORSO_HEIGHT, TORSO_DEPTH), shirtMat);
      torso.position.set(0, LEG_HEIGHT + TORSO_HEIGHT / 2, 0);
      group.add(torso);

      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH), skinMat);
      leftArm.position.set(-(TORSO_WIDTH / 2 + ARM_WIDTH / 2 + ARM_GAP), LEG_HEIGHT + ARM_HEIGHT / 2, 0);
      group.add(leftArm);

      const rightArm = new THREE.Mesh(new THREE.BoxGeometry(ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH), skinMat);
      rightArm.position.set(TORSO_WIDTH / 2 + ARM_WIDTH / 2 + ARM_GAP, LEG_HEIGHT + ARM_HEIGHT / 2, 0);
      group.add(rightArm);

      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH), pantsMat);
      leftLeg.position.set(-(LEG_WIDTH / 2 + LEG_GAP / 2), LEG_HEIGHT / 2, 0);
      group.add(leftLeg);

      const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH), pantsMat);
      rightLeg.position.set(LEG_WIDTH / 2 + LEG_GAP / 2, LEG_HEIGHT / 2, 0);
      group.add(rightLeg);

      scene.add(group);

      const faceId = avatar.face || "FACE-1";

      const finishRender = () => {
        if (cancelledRef.current) {
          scene.clear(); group.clear();
          _avatarRendering = false; _processAvatarQueue();
          return;
        }
        renderer.render(scene, camera);

        const srcCanvas = renderer.domElement;
        const outCanvas = document.createElement("canvas");
        outCanvas.width = renderSize;
        outCanvas.height = renderSize;
        const outCtx = outCanvas.getContext("2d")!;
        outCtx.beginPath();
        outCtx.arc(renderSize / 2, renderSize / 2, renderSize / 2, 0, Math.PI * 2);
        outCtx.clip();
        outCtx.fillStyle = "#1e293b";
        outCtx.fillRect(0, 0, renderSize, renderSize);
        outCtx.drawImage(srcCanvas, 0, 0);

        if (!cancelledRef.current) {
          setImgSrc(outCanvas.toDataURL());
        }

        scene.clear();
        group.clear();
        _avatarRendering = false;
        _processAvatarQueue();
      };

      // Load face image — all faces use image files, no procedural fallback
      loadFaceImage(faceId).then(img => {
        if (cancelledRef.current) {
          scene.clear(); group.clear();
          _avatarRendering = false; _processAvatarQueue();
          return;
        }
        if (img) {
          const tex = new THREE.Texture(img);
          tex.needsUpdate = true;
          if (faceId === "FACE-1") {
            tex.minFilter = THREE.NearestFilter;
            tex.magFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
          } else {
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
          }
          const faceMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 });
          const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(HEAD_WIDTH * 0.95, HEAD_HEIGHT * 0.95), faceMat);
          facePlane.position.set(0, LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT / 2, HEAD_DEPTH / 2 + 0.002);
          group.add(facePlane);
          finishRender();
        } else {
          // No procedural fallback — render without face decal
          finishRender();
        }
      });
    };

    _avatarRenderQueue.push(doRender);
    _processAvatarQueue();

    return () => {
      cancelledRef.current = true;
    };
  }, [avatarKey, size]);

  if (imgSrc) {
    return <img src={imgSrc} className="rounded-full ring-2 ring-indigo-500/30" style={{ width: size, height: size }} alt="" />;
  }
  return <div className="rounded-full ring-2 ring-indigo-500/30 bg-slate-800" style={{ width: size, height: size }} />;
}

// Keep AvatarIcon as alias for backward compatibility
export const AvatarIcon = AvatarIcon3D;

// Fetches a user's avatar from the API and renders their AvatarIcon
export function UserAvatarIcon({ username, size = 28 }: { username: string; size?: number }) {
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  useEffect(() => {
    fetch(`/api/users?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(data => { if (data.avatar) setAvatar(data.avatar); })
      .catch(() => {});
  }, [username]);
  return <AvatarIcon avatar={avatar || DEFAULT_AVATAR} size={size} />;
}

export function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.round(r * factor).toString(16).padStart(2, "0")}${Math.round(g * factor).toString(16).padStart(2, "0")}${Math.round(b * factor).toString(16).padStart(2, "0")}`;
}

// ==================== ITEM 3D PREVIEW ====================

// Compute camera config for item previews — camera looks at the right body part
function getItemCameraConfig(itemType: string) {
  const headY = LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT / 2;
  const torsoY = LEG_HEIGHT + TORSO_HEIGHT / 2;
  const legsY = LEG_HEIGHT / 2 + 0.15;
  if (itemType === "face") {
    return {
      position: [0.5, headY + 0.05, 2.5] as [number, number, number],
      target: [0, headY, 0] as [number, number, number],
      fov: 28,
    };
  } else if (itemType === "shirt") {
    return {
      position: [0.5, torsoY + 0.1, 3.0] as [number, number, number],
      target: [0, torsoY, 0] as [number, number, number],
      fov: 26,
    };
  } else {
    return {
      position: [0.5, legsY + 0.15, 2.6] as [number, number, number],
      target: [0, legsY, 0] as [number, number, number],
      fov: 26,
    };
  }
}

// Build a preview avatar with the item equipped
function buildPreviewAvatar(item: ItemData): AvatarData {
  const base: AvatarData = { skin: "#f8ff6d", face: "FACE-1", shirt: null, left_leg: null, right_leg: null };
  if (item.item_type === "face") {
    base.face = item.id;
  } else if (item.item_type === "shirt") {
    base.shirt = item.id;
  } else if (item.item_type === "pants") {
    base.left_leg = item.id;
    base.right_leg = item.id;
  }
  return base;
}

// ==================== ITEM 3D PREVIEW — 2D SNAPSHOT APPROACH ====================

const _itemRendererRef = { current: null as THREE.WebGLRenderer | null };
const _itemRenderQueue: (() => void)[] = [];
let _itemRendering = false;

function _processItemQueue() {
  if (_itemRendering || _itemRenderQueue.length === 0) return;
  _itemRendering = true;
  const next = _itemRenderQueue.shift();
  if (next) next();
}

function renderItemImage(item: ItemData, renderSize: number, callback: (dataUrl: string) => void, cancelled: () => boolean) {
  const doRender = () => {
    if (cancelled()) { _itemRendering = false; _processItemQueue(); return; }

    if (!_itemRendererRef.current) {
      _itemRendererRef.current = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      _itemRendererRef.current.setClearColor(0x000000, 0);
    }
    const renderer = _itemRendererRef.current;
    renderer.setSize(renderSize, renderSize);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1a0a2e");

    const cameraConfig = getItemCameraConfig(item.item_type);
    const camera = new THREE.PerspectiveCamera(cameraConfig.fov, 1, 0.1, 100);
    camera.position.set(cameraConfig.position[0], cameraConfig.position[1], cameraConfig.position[2]);
    camera.lookAt(cameraConfig.target[0], cameraConfig.target[1], cameraConfig.target[2]);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 8, 5);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(-3, 5, -3);
    scene.add(backLight);

    const group = new THREE.Group();
    group.rotation.y = -0.5;

    const previewAvatar = buildPreviewAvatar(item);
    const skinColor = previewAvatar.skin || "#f8ff6d";
    const shirtColor = previewAvatar.shirt ? getItemColor(previewAvatar.shirt) : UNEQUIPPED_TORSO_COLOR;
    const pantsColor = previewAvatar.left_leg ? getItemColor(previewAvatar.left_leg) : UNEQUIPPED_LEGS_COLOR;

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 });

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(HEAD_WIDTH, HEAD_HEIGHT, HEAD_DEPTH), skinMat);
    head.position.set(0, LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT / 2, 0);
    group.add(head);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(TORSO_WIDTH, TORSO_HEIGHT, TORSO_DEPTH), shirtMat);
    torso.position.set(0, LEG_HEIGHT + TORSO_HEIGHT / 2, 0);
    group.add(torso);

    // Arms
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH), skinMat);
    leftArm.position.set(-(TORSO_WIDTH / 2 + ARM_WIDTH / 2 + ARM_GAP), LEG_HEIGHT + ARM_HEIGHT / 2, 0);
    group.add(leftArm);
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH), skinMat);
    rightArm.position.set(TORSO_WIDTH / 2 + ARM_WIDTH / 2 + ARM_GAP, LEG_HEIGHT + ARM_HEIGHT / 2, 0);
    group.add(rightArm);

    // Legs
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH), pantsMat);
    leftLeg.position.set(-(LEG_WIDTH / 2 + LEG_GAP / 2), LEG_HEIGHT / 2, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH), pantsMat);
    rightLeg.position.set(LEG_WIDTH / 2 + LEG_GAP / 2, LEG_HEIGHT / 2, 0);
    group.add(rightLeg);

    scene.add(group);

    const finishRender = () => {
      if (cancelled()) { scene.clear(); group.clear(); _itemRendering = false; _processItemQueue(); return; }
      renderer.render(scene, camera);
      if (!cancelled()) callback(renderer.domElement.toDataURL());
      scene.clear(); group.clear();
      _itemRendering = false;
      _processItemQueue();
    };

    // Add face texture — image-based for all face types, no procedural fallback
    const faceId = previewAvatar.face || "FACE-1";
    if (faceId) {
      loadFaceImage(faceId).then(img => {
        if (cancelled()) { scene.clear(); group.clear(); _itemRendering = false; _processItemQueue(); return; }
        if (img) {
          const tex = new THREE.Texture(img);
          tex.needsUpdate = true;
          if (faceId === "FACE-1") {
            tex.minFilter = THREE.NearestFilter;
            tex.magFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
          } else {
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
          }
          const faceMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 });
          const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(HEAD_WIDTH * 0.95, HEAD_HEIGHT * 0.95), faceMat);
          facePlane.position.set(0, LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT / 2, HEAD_DEPTH / 2 + 0.002);
          group.add(facePlane);
          finishRender();
        } else {
          // No procedural fallback — render without face decal
          finishRender();
        }
      });
    } else {
      finishRender();
    }
  };

  _itemRenderQueue.push(doRender);
  _processItemQueue();
}

// Small thumbnail preview for shop cards (112x112) — 2D snapshot
export function Item3DPreview({ item }: { item: ItemData }) {
  const [imgSrc, setImgSrc] = useState<string>("");
  const cancelledRef = useRef(false);
  const itemKey = `${item.id}-${item.item_type}`;

  useEffect(() => {
    cancelledRef.current = false;
    const renderSize = 224;
    renderItemImage(item, renderSize, (dataUrl) => {
      if (!cancelledRef.current) setImgSrc(dataUrl);
    }, () => cancelledRef.current);
    return () => { cancelledRef.current = true; };
  }, [itemKey]);

  if (imgSrc) {
    return <img src={imgSrc} alt={item.display_name} className="w-full h-full object-contain" style={{ width: 112, height: 112 }} />;
  }
  return <div style={{ width: 112, height: 112, backgroundColor: "#1a0a2e" }} className="rounded-lg flex items-center justify-center">
    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
  </div>;
}

// Larger preview for item detail popup (200x200) — 2D snapshot
export function ItemPreview3DLarge({ item }: { item: ItemData }) {
  const [imgSrc, setImgSrc] = useState<string>("");
  const cancelledRef = useRef(false);
  const itemKey = `${item.id}-${item.item_type}`;

  useEffect(() => {
    cancelledRef.current = false;
    const renderSize = 400;
    renderItemImage(item, renderSize, (dataUrl) => {
      if (!cancelledRef.current) setImgSrc(dataUrl);
    }, () => cancelledRef.current);
    return () => { cancelledRef.current = true; };
  }, [itemKey]);

  if (imgSrc) {
    return <img src={imgSrc} alt={item.display_name} className="rounded-xl mx-auto" style={{ width: 200, height: 200 }} />;
  }
  return <div style={{ width: 200, height: 200, backgroundColor: "#1a0a2e" }} className="rounded-xl mx-auto flex items-center justify-center">
    <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
  </div>;
}
