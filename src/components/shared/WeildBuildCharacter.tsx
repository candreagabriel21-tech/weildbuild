'use client';

/**
 * Shared WeildBuild 3D Character Component
 * 
 * Used by BOTH the main platform GamePlayer AND the WeildCreate studio.
 * ALL faces are loaded from image files — no procedural canvas rendering.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Body Dimensions (WeildBuild-style blocky character) ───
// Scaled to TOTAL_HEIGHT = 2.0m (scale factor ≈ 0.784 from original 2.55)
const S = 2.0 / 2.55; // ≈ 0.7843
export const TORSO_HEIGHT = 1.0 * S;
export const TORSO_WIDTH = 0.875 * S;
export const TORSO_DEPTH = 0.6 * S;
export const HEAD_WIDTH = 0.625 * S;
export const HEAD_HEIGHT = 0.625 * S;
export const HEAD_DEPTH = 0.6 * S;
export const ARM_WIDTH = 0.4375 * S;
export const ARM_HEIGHT = 0.975 * S;
export const ARM_DEPTH = 0.5 * S;
export const LEG_WIDTH = 0.4375 * S;
export const LEG_HEIGHT = 0.875 * S;
export const LEG_DEPTH = 0.5 * S;
export const ARM_GAP = 0.02 * S;
export const HEAD_GAP = 0.05 * S;
export const LEG_GAP = 0.05 * S;
export const TOTAL_HEIGHT = LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP + HEAD_HEIGHT; // = 2.0m

export const UNEQUIPPED_TORSO_COLOR = '#CC0000';
export const UNEQUIPPED_LEGS_COLOR = '#2196F3';

// ─── Item Color Map ───
// Uses new format: FACE-1, SHIRT-1 (not FACE-01, SHIRT-01)
const ITEM_COLORS: Record<string, string> = {
  'FACE-1': '#FFD700', 'FACE-2': '#87CEEB', 'FACE-3': '#FFD700', 'FACE-4': '#87CEEB',
  'FACE-5': '#7B8794', 'FACE-6': '#00BFFF', 'FACE-7': '#8B4513', 'FACE-8': '#9370DB',
  'FACE-9': '#FF4500', 'FACE-11': '#32CD32', 'FACE-12': '#FF6347', 'FACE-13': '#4169E1',
  'FACE-14': '#FF1493', 'FACE-15': '#00CED1', 'FACE-16': '#FF8C00', 'FACE-17': '#8A2BE2',
  'FACE-18': '#2E8B57', 'FACE-19': '#DC143C', 'FACE-20': '#4B0082', 'FACE-21': '#8B4513',
  'SHIRT-1': '#CC0000', 'SHIRT-2': '#FF4500', 'SHIRT-3': '#228B22', 'SHIRT-4': '#6A0DAD',
  'SHIRT-5': '#FFD700', 'SHIRT-6': '#191970', 'SHIRT-7': '#FFB6C1', 'SHIRT-8': '#006994',
  'PANTS-1': '#2196F3', 'PANTS-2': '#0D1B2A', 'PANTS-3': '#556B2F', 'PANTS-4': '#CC0000',
  'PANTS-5': '#F5F5F5', 'PANTS-6': '#7B2D8E',
};

export function getItemColor(itemId: string): string {
  return ITEM_COLORS[itemId] || '#888';
}

// ─── Avatar Data Interface ───
export interface AvatarData {
  skin: string;
  face: string | null;
  shirt: string | null;
  left_leg: string | null;
  right_leg: string | null;
}

// FACE-1 = Smile Face is the default
export const DEFAULT_AVATAR: AvatarData = {
  skin: '#f8ff6d',
  face: 'FACE-1',
  shirt: 'SHIRT-1',
  left_leg: 'PANTS-1',
  right_leg: 'PANTS-1',
};

// ─── Face Texture Generator ───
// ALL faces are loaded from image files at /items/faces/FACE-N.png
// No procedural canvas rendering — every face has a proper image.
function createFaceTexture(faceId: string): THREE.Texture {
  const imagePath = `/items/faces/${faceId}.png`;

  const loader = new THREE.TextureLoader();
  const texture = loader.load(imagePath, (tex) => {
    tex.needsUpdate = true;
  }, undefined, () => {
    // On local error, try B2 proxy
    const proxyUrl = `/api/storage/download?key=${encodeURIComponent(`items/faces/${faceId}.png`)}`;
    const b2Loader = new THREE.TextureLoader();
    b2Loader.load(proxyUrl, (b2Tex) => {
      (texture as any).image = b2Tex.image;
      texture.needsUpdate = true;
    }, undefined, () => {
      // Both failed — no procedural fallback, face stays blank
    });
  });

  // Pixel art faces use nearest-neighbor filtering
  if (faceId === 'FACE-1') {
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

// ─── Main Character Component ───
export function WeildBuildCharacter({
  avatar,
  animate = false,
  walkPhase,
  isJumping = false,
  walkPhaseRef,
  isJumpingRef,
}: {
  avatar: AvatarData;
  animate?: boolean;
  walkPhase?: number;
  isJumping?: boolean;
  walkPhaseRef?: React.MutableRefObject<number>;
  isJumpingRef?: React.MutableRefObject<boolean>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  const skinColor = avatar.skin || '#f8ff6d';
  const shirtColor = avatar.shirt ? getItemColor(avatar.shirt) : skinColor;
  const pantsColor = avatar.left_leg ? getItemColor(avatar.left_leg) : skinColor;
  const rightLegColor = avatar.right_leg ? getItemColor(avatar.right_leg) : pantsColor;
  const faceTexture = useMemo(() => createFaceTexture(avatar.face || 'FACE-1'), [avatar.face]);

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
  const rightLegMat = useMemo(() => new THREE.MeshStandardMaterial({ color: rightLegColor, roughness: 0.7 }), [rightLegColor]);
  const faceMat = useMemo(() => new THREE.MeshStandardMaterial({ map: faceTexture, transparent: true, roughness: 0.5 }), [faceTexture]);

  // Dispose materials and textures on unmount or dependency change
  useEffect(() => {
    return () => {
      skinMat.dispose();
      shirtMat.dispose();
      pantsMat.dispose();
      rightLegMat.dispose();
      faceMat.dispose();
      if (faceTexture) faceTexture.dispose();
    };
  }, [skinMat, shirtMat, pantsMat, rightLegMat, faceMat, faceTexture]);

  const torsoY = LEG_HEIGHT;
  const headY = LEG_HEIGHT + TORSO_HEIGHT + HEAD_GAP;

  return (
    <group ref={groupRef}>
      {/* Left leg */}
      <group ref={leftLegRef} position={[-(LEG_WIDTH / 2 + LEG_GAP / 2), LEG_HEIGHT, 0]}>
        <mesh position={[0, -LEG_HEIGHT / 2, 0]} material={pantsMat} castShadow>
          <boxGeometry args={[LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH]} />
        </mesh>
      </group>
      {/* Right leg */}
      <group ref={rightLegRef} position={[LEG_WIDTH / 2 + LEG_GAP / 2, LEG_HEIGHT, 0]}>
        <mesh position={[0, -LEG_HEIGHT / 2, 0]} material={rightLegMat} castShadow>
          <boxGeometry args={[LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH]} />
        </mesh>
      </group>
      {/* Torso */}
      <mesh position={[0, torsoY + TORSO_HEIGHT / 2, 0]} material={shirtMat} castShadow>
        <boxGeometry args={[TORSO_WIDTH, TORSO_HEIGHT, TORSO_DEPTH]} />
      </mesh>
      {/* Left arm */}
      <group ref={leftArmRef} position={[-(TORSO_WIDTH / 2 + ARM_WIDTH / 2 + ARM_GAP), torsoY + ARM_HEIGHT, 0]}>
        <mesh position={[0, -ARM_HEIGHT / 2, 0]} material={skinMat} castShadow>
          <boxGeometry args={[ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH]} />
        </mesh>
      </group>
      {/* Right arm */}
      <group ref={rightArmRef} position={[TORSO_WIDTH / 2 + ARM_WIDTH / 2 + ARM_GAP, torsoY + ARM_HEIGHT, 0]}>
        <mesh position={[0, -ARM_HEIGHT / 2, 0]} material={skinMat} castShadow>
          <boxGeometry args={[ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH]} />
        </mesh>
      </group>
      {/* Head */}
      <mesh position={[0, headY + HEAD_HEIGHT / 2, 0]} material={skinMat} castShadow>
        <boxGeometry args={[HEAD_WIDTH, HEAD_HEIGHT, HEAD_DEPTH]} />
      </mesh>
      {/* Face decal — loaded from image file */}
      <mesh position={[0, headY + HEAD_HEIGHT / 2, HEAD_DEPTH / 2 + 0.002]} material={faceMat}>
        <planeGeometry args={[HEAD_WIDTH * 0.95, HEAD_HEIGHT * 0.95]} />
      </mesh>
    </group>
  );
}
