'use client';

/**
 * CharacterPartsRenderer — Renders the character from StudioParts.
 *
 * Reads character body parts (isCharacterPart === true) from the studio store
 * and renders them as a 3D character. Used in BOTH the editor viewport (as a
 * preview at the spawn point) and the game viewport (following the player).
 *
 * If a part is deleted, it won't render. If a part's color/size/material/
 * transparency is changed, the change is reflected immediately. Effects
 * (Fire, Smoke, Light) and WeildCode rules on character parts also work.
 */

import { useRef, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useStudioStore, isPart, type StudioPart } from '@/lib/studio-store';
import { getMaterialProps } from '@/lib/game-engine/materials';
import { weildCodeEngine } from '@/lib/weildcode-engine';

const PART_ORDER = ['head', 'face', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;

// Stable empty array reference — used when showSelection is false so the
// Zustand selector returns the SAME reference every time (avoids infinite loop).
const EMPTY_ARRAY: string[] = [];

// ─── Avatar override helpers ───
// Item color map (mirrors WeildBuildCharacter.tsx — kept here to avoid a circular import)
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

function getItemColor(itemId: string): string { return ITEM_COLORS[itemId] || '#888'; }

/**
 * Returns the effective color for a character part, applying avatar overrides.
 *  - If the part has avatarItemKey set → use that item's color.
 *  - Else if modifyColorToAvatar is true → use the player's avatar color for
 *    this body region (skin for head/arms, shirt for torso, pants for legs).
 *  - Else → use the part's own color.
 */
function getEffectivePartColor(part: StudioPart, avatar: { skin: string; shirt: string | null; left_leg: string | null; right_leg: string | null; face: string | null }): string {
  // Explicit item key override wins
  if (part.avatarItemKey) {
    return getItemColor(part.avatarItemKey);
  }
  if (!part.modifyColorToAvatar) return part.color;
  switch (part.characterPartType) {
    case 'head': case 'leftArm': case 'rightArm': return avatar.skin;
    case 'torso': return avatar.shirt ? getItemColor(avatar.shirt) : avatar.skin;
    case 'leftLeg': return avatar.left_leg ? getItemColor(avatar.left_leg) : avatar.skin;
    case 'rightLeg': return avatar.right_leg ? getItemColor(avatar.right_leg) : avatar.skin;
    default: return part.color;
  }
}

/** Returns the effective face id (for face parts only). */
function getEffectiveFaceId(part: StudioPart, avatar: { face: string | null }): string | null {
  if (part.avatarItemKey) return part.avatarItemKey;
  if (part.modifyFaceToAvatar) return avatar.face;
  return null; // face parts use their own color when no override
}

interface CharacterPartsRendererProps {
  position: [number, number, number];
  rotationY?: number;
  walkPhaseRef?: React.MutableRefObject<number>;
  isJumpingRef?: React.MutableRefObject<boolean>;
  interactive?: boolean;
  showSelection?: boolean;
  playMode?: boolean;
}

export function CharacterPartsRenderer({
  position,
  rotationY = 0,
  walkPhaseRef,
  isJumpingRef,
  interactive = false,
  showSelection = false,
  playMode = false,
}: CharacterPartsRendererProps) {
  const groupRef = useRef<THREE.Group>(null);
  // Only subscribe to selectedIds when we actually need them (showSelection).
  // When showSelection is false, return a stable empty array reference instead
  // of creating a new [] every render (which would cause an infinite loop).
  const selectedIds = useStudioStore((s) => showSelection ? s.selectedIds : EMPTY_ARRAY);

  // Select the stable objects map, then filter+sort with useMemo.
  // We MUST NOT return a new array from the selector itself — that creates
  // a new reference every render and triggers an infinite useSyncExternalStore loop.
  const objects = useStudioStore((s) => s.objects);
  const storeAvatar = useStudioStore((s) => s.avatar);
  const characterParts = useMemo(() => {
    const parts: StudioPart[] = [];
    objects.forEach((obj) => {
      if (!isPart(obj) || !obj.isCharacterPart) return;
      // Character parts are ALWAYS visible in both editor and play mode.
      // The showInWorld toggle only applies to regular parts — character parts
      // are the player's body and must always render. To remove a body part,
      // delete it (don't toggle showInWorld).
      parts.push(obj);
    });
    parts.sort((a, b) => {
      const ai = PART_ORDER.indexOf((a.characterPartType || '') as typeof PART_ORDER[number]);
      const bi = PART_ORDER.indexOf((b.characterPartType || '') as typeof PART_ORDER[number]);
      return ai - bi;
    });
    return parts;
  }, [objects, playMode]);

  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const phase = walkPhaseRef?.current ?? 0;
    const jumping = isJumpingRef?.current ?? false;
    // Scale amplitude by how much phase remains — this gives a smooth
    // ramp-down when the player stops instead of violent full-amplitude
    // swings that decay in frequency. Without this, the limbs swing at
    // full amplitude until phase hits exactly 0, causing "violent jitter".
    const amplitude = Math.min(Math.abs(phase) / 2, 1); // 0 at phase=0, 1 at phase≥2
    const swing = Math.sin(phase) * 0.4 * amplitude;

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

  if (characterParts.length === 0) return null;

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      {characterParts.map((part) => {
        const isAnimated = part.characterPartType === 'leftArm' || part.characterPartType === 'rightArm'
          || part.characterPartType === 'leftLeg' || part.characterPartType === 'rightLeg';
        const partRef = part.characterPartType === 'leftArm' ? leftArmRef
          : part.characterPartType === 'rightArm' ? rightArmRef
          : part.characterPartType === 'leftLeg' ? leftLegRef
          : part.characterPartType === 'rightLeg' ? rightLegRef
          : null;
        const pivotOffset = isAnimated ? part.size.y / 2 : 0;

        return (
          <CharacterPartMesh
            key={part.id}
            part={part}
            partRef={partRef}
            pivotOffset={pivotOffset}
            isSelected={showSelection && selectedIds.includes(part.id)}
            interactive={interactive}
            playMode={playMode}
            avatar={storeAvatar}
          />
        );
      })}
    </group>
  );
}

function CharacterPartMesh({
  part,
  partRef,
  pivotOffset,
  isSelected,
  interactive,
  playMode,
  avatar,
}: {
  part: StudioPart;
  partRef: React.MutableRefObject<THREE.Group | null> | null;
  pivotOffset: number;
  isSelected: boolean;
  interactive: boolean;
  playMode: boolean;
  avatar: { skin: string; face: string | null; shirt: string | null; left_leg: string | null; right_leg: string | null };
}) {
  const materialDef = useMemo(() => getMaterialProps(part.material), [part.material]);

  // Apply avatar overrides — only in play mode (so the editor shows the
  // part's own color/face for editing).
  const effectiveColor = useMemo(
    () => playMode ? getEffectivePartColor(part, avatar) : part.color,
    [playMode, part, avatar]
  );
  const partColor = useMemo(() => new THREE.Color(effectiveColor), [effectiveColor]);
  const emissiveColor = useMemo(
    () => materialDef.emissive ? new THREE.Color(materialDef.emissive) : new THREE.Color(0x000000),
    [materialDef.emissive]
  );

  const isFace = part.characterPartType === 'face';

  const faceTexture = useMemo(() => {
    if (!isFace) return null;
    // Determine which face to show
    let faceId: string;
    if (playMode) {
      faceId = getEffectiveFaceId(part, avatar) || 'FACE-1';
    } else {
      faceId = avatar.face || 'FACE-1';
    }
    const imagePath = `/items/faces/${faceId}.png`;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(imagePath, (t) => { t.needsUpdate = true; }, undefined, () => {});
    if (faceId === 'FACE-1') {
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
    } else {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 16;
    }
    tex.needsUpdate = true;
    return tex;
  }, [isFace, playMode, part, avatar]);

  const groupPos: [number, number, number] = [
    part.position.x,
    part.position.y + pivotOffset,
    part.position.z,
  ];
  const meshOffset: [number, number, number] = isFace ? [0, 0, 0] : [0, -pivotOffset, 0];

  return (
    <group ref={partRef || undefined} position={groupPos}>
      <mesh
        position={meshOffset}
        castShadow
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (interactive) {
            e.stopPropagation();
            useStudioStore.getState().selectObject(part.id, e.shiftKey);
          } else if (playMode) {
            e.stopPropagation();
            weildCodeEngine.handleClick(part.id);
          }
        }}
      >
        {isFace ? (
          <planeGeometry args={[part.size.x, part.size.y]} />
        ) : (
          <boxGeometry args={[part.size.x, part.size.y, part.size.z]} />
        )}
        {isFace && faceTexture ? (
          <meshStandardMaterial map={faceTexture} transparent roughness={0.5} toneMapped={false} />
        ) : (
          <meshStandardMaterial
            color={partColor}
            roughness={materialDef.roughness ?? 0.5}
            metalness={materialDef.metalness ?? 0}
            transparent={part.transparency > 0}
            opacity={1 - part.transparency}
            emissive={emissiveColor}
            emissiveIntensity={materialDef.emissive ? 0.5 : 0}
          />
        )}
      </mesh>
      {isSelected && (
        <mesh position={meshOffset}>
          <boxGeometry args={[part.size.x * 1.05, part.size.y * 1.05, part.size.z * 1.05]} />
          <meshBasicMaterial color="#818cf8" wireframe />
        </mesh>
      )}
    </group>
  );
}
