'use client';

import { useStudioStore } from '@/lib/studio-store';
import { useState } from 'react';

interface ColorPickerProps {
  onClose: () => void;
}

const PRESET_COLORS = [
  '#FF0000', '#FF4444', '#FF8888', '#CC0000',
  '#FF8800', '#FFAA44', '#FFBB00', '#FFDD44',
  '#00FF00', '#44FF44', '#88FF88', '#44FF00',
  '#00FFAA', '#00FFFF', '#44FFFF', '#00DDFF',
  '#0000FF', '#4444FF', '#8888FF', '#4400FF',
  '#8800FF', '#AA00FF', '#FF00FF', '#FF44FF',
  '#FFFFFF', '#CCCCCC', '#888888', '#444444',
  '#000000', '#8B4513', '#D2691E', '#F5DEB3',
];

export function ColorPicker({ onClose }: ColorPickerProps) {
  const { selectedIds, updateObject, objects } = useStudioStore();
  const [customColor, setCustomColor] = useState('#4a90d9');

  const handleColorSelect = (color: string) => {
    selectedIds.forEach((id) => {
      const obj = objects.get(id);
      if (obj && 'color' in obj) {
        updateObject(id, { color } as any);
      }
    });
    useStudioStore.getState().addConsoleMessage('info', `Color changed to ${color}`);
    onClose();
  };

  return (
    <div className="w-56">
      <div className="px-1 pb-2 border-b border-white/5 mb-2">
        <span className="text-[10px] text-indigo-400 font-semibold">Color</span>
      </div>

      <div className="grid grid-cols-8 gap-1 mb-3">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => handleColorSelect(color)}
            className="w-6 h-6 rounded border border-white/10 hover:scale-110 transition-transform"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/80"
        />
        <button
          onClick={() => handleColorSelect(customColor)}
          className="px-2 py-1 text-xs bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/30"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
