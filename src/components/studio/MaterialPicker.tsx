'use client';

import { useStudioStore, isPart, MaterialType } from '@/lib/studio-store';
import { MATERIALS, getMaterialProps } from '@/lib/game-engine/materials';

interface MaterialPickerProps {
  onClose: () => void;
}

export function MaterialPicker({ onClose }: MaterialPickerProps) {
  const { selectedIds, updateObject, objects } = useStudioStore();

  const handleMaterialSelect = (materialName: MaterialType) => {
    const props = getMaterialProps(materialName);
    selectedIds.forEach((id) => {
      const obj = objects.get(id);
      if (obj && isPart(obj)) {
        updateObject(id, {
          material: materialName,
          friction: props.friction,
          elasticity: props.elasticity,
        });
      }
    });
    useStudioStore.getState().addConsoleMessage('info', `Material changed to ${materialName}`);
    onClose();
  };

  return (
    <div className="w-64 max-h-80 overflow-y-auto studio-panel">
      <div className="px-1 pb-2 border-b border-white/5 mb-2">
        <span className="text-[10px] text-indigo-400 font-semibold">Materials</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {Object.entries(MATERIALS).map(([name, mat]) => (
          <button
            key={name}
            onClick={() => handleMaterialSelect(name as MaterialType)}
            className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-white/5 transition-colors"
          >
            <div
              className="w-8 h-8 rounded-md border border-white/10"
              style={{
                backgroundColor: mat.color,
                opacity: mat.opacity ?? 1,
                boxShadow: mat.emissive ? `0 0 8px ${mat.emissive}` : 'none',
              }}
            />
            <span className="text-[9px] text-white/50 leading-tight text-center">{name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
