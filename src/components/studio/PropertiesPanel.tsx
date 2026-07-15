'use client';

import { useStudioStore, isPart, StudioPart, StudioModel, MaterialType, BodyMover, BodyMoverType, PartEffect } from '@/lib/studio-store';
import { MATERIALS, getMaterialNames, getMaterialProps, calculateMass } from '@/lib/game-engine/materials';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Box, Circle, Triangle, Cylinder, MapPin, Plus, Trash2, Zap, Link, ChevronDown, ChevronRight, Flame, Cloud, Lightbulb, Globe, Sun, Moon, CloudRain, CloudSnow, Eye, EyeOff, Clock, Star, Wind, FolderTree, Ungroup, Palette, Variable } from 'lucide-react';
import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { LogicPanel } from './LogicPanel';

// ─── Deferred Color Picker ───
// Stores pending color in local state while the user drags the picker.
// Only commits to the store when "Apply" is clicked, preventing lag.

function DeferredColorPicker({
  value,
  onChange,
  label,
  size = 'sm',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const [pending, setPending] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset pending when external value changes (e.g. undo)
  useEffect(() => {
    setPending(null);
  }, [value]);

  const displayValue = pending ?? value;
  const hasPending = pending !== null && pending !== value;

  const sizeClass = size === 'md' ? 'w-8 h-6' : 'w-7 h-5';

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <input
          ref={inputRef}
          type="color"
          value={displayValue}
          onChange={(e) => setPending(e.target.value)}
          className={`${sizeClass} rounded border border-white/10 cursor-pointer bg-transparent`}
        />
      </div>
      {hasPending && (
        <button
          className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors whitespace-nowrap"
          onClick={() => {
            onChange(pending!);
            setPending(null);
          }}
        >
          Apply
        </button>
      )}
      {label && <span className="text-[8px] text-white/20 font-mono">{displayValue}</span>}
    </div>
  );
}

function handleNumberInput(val: string): number | undefined {
  // Allow empty string or just a minus sign during typing
  if (val === '' || val === '-') return undefined;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? undefined : parsed;
}

function Vector3Input({ label, value, onChange }: {
  label: string;
  value: { x: number; y: number; z: number };
  onChange: (v: { x: number; y: number; z: number }) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-white/40 uppercase">{label}</Label>
      <div className="grid grid-cols-3 gap-1">
        <div className="relative">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-red-400 font-mono">X</span>
          <Input
            type="number"
            step={0.1}
            value={value.x}
            onChange={(e) => { const v = handleNumberInput(e.target.value); if (v !== undefined) onChange({ ...value, x: v }); }}
            className="h-6 text-[10px] bg-white/5 border-white/10 text-white pl-5"
          />
        </div>
        <div className="relative">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-green-400 font-mono">Y</span>
          <Input
            type="number"
            step={0.1}
            value={value.y}
            onChange={(e) => { const v = handleNumberInput(e.target.value); if (v !== undefined) onChange({ ...value, y: v }); }}
            className="h-6 text-[10px] bg-white/5 border-white/10 text-white pl-5"
          />
        </div>
        <div className="relative">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-blue-400 font-mono">Z</span>
          <Input
            type="number"
            step={0.1}
            value={value.z}
            onChange={(e) => { const v = handleNumberInput(e.target.value); if (v !== undefined) onChange({ ...value, z: v }); }}
            className="h-6 text-[10px] bg-white/5 border-white/10 text-white pl-5"
          />
        </div>
      </div>
    </div>
  );
}

// ─── BodyMover Editor ───

function BodyMoverEditor({ partId, mover }: { partId: string; mover: BodyMover }) {
  const { updateBodyMover, removeBodyMover } = useStudioStore();
  const [expanded, setExpanded] = useState(false);

  const handleUpdate = useCallback((updates: Partial<BodyMover>) => {
    updateBodyMover(partId, mover.id, updates);
  }, [partId, mover.id, updateBodyMover]);

  const typeColors: Record<BodyMoverType, string> = {
    BodyForce: 'text-red-400',
    BodyVelocity: 'text-blue-400',
    BodyGyro: 'text-purple-400',
    BodyPosition: 'text-green-400',
    BodyThrust: 'text-orange-400',
    BodyAngularVelocity: 'text-cyan-400',
  };

  return (
    <div className="border border-white/10 rounded-md overflow-hidden">
      <div
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-white/40" /> : <ChevronRight className="w-3 h-3 text-white/40" />}
        <Zap className={`w-3 h-3 ${typeColors[mover.type]}`} />
        <span className="text-[10px] text-white/60 flex-1 text-left">{mover.type}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); removeBodyMover(partId, mover.id); }}
          className="text-white/30 hover:text-red-400 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-2 space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={mover.enabled}
              onCheckedChange={(v) => handleUpdate({ enabled: !!v })}
              className="border-white/20 data-[state=checked]:bg-indigo-500/20 data-[state=checked]:border-indigo-500/50"
            />
            <Label className="text-[10px] text-white/60">Enabled</Label>
          </div>

          {(mover.type === 'BodyForce' || mover.type === 'BodyThrust') && (
            <Vector3Input
              label="Force"
              value={mover.force ?? { x: 0, y: 0, z: 0 }}
              onChange={(v) => handleUpdate({ force: v })}
            />
          )}

          {mover.type === 'BodyVelocity' && (
            <>
              <Vector3Input
                label="Target Velocity"
                value={mover.velocity ?? { x: 0, y: 0, z: 0 }}
                onChange={(v) => handleUpdate({ velocity: v })}
              />
              <Vector3Input
                label="Max Force"
                value={mover.maxForce ?? { x: 10000, y: 10000, z: 10000 }}
                onChange={(v) => handleUpdate({ maxForce: v })}
              />
            </>
          )}

          {mover.type === 'BodyPosition' && (
            <>
              <Vector3Input
                label="Target Position"
                value={mover.position ?? { x: 0, y: 0, z: 0 }}
                onChange={(v) => handleUpdate({ position: v })}
              />
              <Vector3Input
                label="Max Force"
                value={mover.maxForce ?? { x: 10000, y: 10000, z: 10000 }}
                onChange={(v) => handleUpdate({ maxForce: v })}
              />
            </>
          )}

          {mover.type === 'BodyGyro' && (
            <>
              <Vector3Input
                label="Target Orientation (deg)"
                value={mover.cframe ?? { x: 0, y: 0, z: 0 }}
                onChange={(v) => handleUpdate({ cframe: v })}
              />
              <Vector3Input
                label="Max Torque"
                value={mover.maxTorque ?? { x: 10000, y: 10000, z: 10000 }}
                onChange={(v) => handleUpdate({ maxTorque: v })}
              />
            </>
          )}

          {mover.type === 'BodyAngularVelocity' && (
            <>
              <Vector3Input
                label="Angular Velocity"
                value={mover.angularVelocity ?? { x: 0, y: 0, z: 0 }}
                onChange={(v) => handleUpdate({ angularVelocity: v })}
              />
              <Vector3Input
                label="Max Torque"
                value={mover.maxTorque ?? { x: 10000, y: 10000, z: 10000 }}
                onChange={(v) => handleUpdate({ maxTorque: v })}
              />
            </>
          )}

          {mover.type === 'BodyThrust' && (
            <Vector3Input
              label="Location"
              value={mover.location ?? { x: 0, y: 0, z: 0 }}
              onChange={(v) => handleUpdate({ location: v })}
            />
          )}

          {(mover.type === 'BodyPosition' || mover.type === 'BodyVelocity' || mover.type === 'BodyGyro') && (
            <div className="grid grid-cols-2 gap-1">
              <div className="space-y-0.5">
                <Label className="text-[9px] text-white/30">P (Power)</Label>
                <Input
                  type="number"
                  value={mover.P ?? 5000}
                  onChange={(e) => handleUpdate({ P: parseFloat(e.target.value) || 0 })}
                  className="h-5 text-[9px] bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[9px] text-white/30">D (Dampen)</Label>
                <Input
                  type="number"
                  value={mover.D ?? 500}
                  onChange={(e) => handleUpdate({ D: parseFloat(e.target.value) || 0 })}
                  className="h-5 text-[9px] bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Effect Editor ───

function EffectEditor({ partId, effect }: { partId: string; effect: PartEffect }) {
  const { updateEffect, removeEffect } = useStudioStore();
  const [expanded, setExpanded] = useState(false);

  const typeIcons: Record<string, React.ReactNode> = {
    Fire: <Flame className="w-3 h-3 text-orange-400" />,
    Smoke: <Cloud className="w-3 h-3 text-gray-400" />,
    Light: <Lightbulb className="w-3 h-3 text-yellow-400" />,
  };

  return (
    <div className="border border-white/10 rounded-md overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded); } }}
      >
        {expanded ? <ChevronDown className="w-3 h-3 text-white/40" /> : <ChevronRight className="w-3 h-3 text-white/40" />}
        {typeIcons[effect.type]}
        <span className="text-[10px] text-white/60 flex-1 text-left">{effect.type}</span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); removeEffect(partId, effect.id); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); removeEffect(partId, effect.id); } }}
          className="text-white/30 hover:text-red-400 transition-colors cursor-pointer p-0 inline-flex items-center"
        >
          <Trash2 className="w-3 h-3" />
        </span>
      </div>
      {expanded && (
        <div className="px-2 pb-2 space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={effect.enabled}
              onCheckedChange={(v) => updateEffect(partId, effect.id, { enabled: !!v })}
              className="border-white/20 data-[state=checked]:bg-indigo-500/20 data-[state=checked]:border-indigo-500/50"
            />
            <Label className="text-[10px] text-white/60">Enabled</Label>
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] text-white/30">Color</Label>
            <DeferredColorPicker
              value={effect.color}
              onChange={(v) => updateEffect(partId, effect.id, { color: v })}
              label={effect.color}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[9px] text-white/30">Size</Label>
              <span className="text-[9px] text-white/30 font-mono">{effect.size.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={effect.size}
              onChange={(e) => updateEffect(partId, effect.id, { size: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>
          {effect.type === 'Light' && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] text-white/30">Brightness</Label>
                  <span className="text-[9px] text-white/30 font-mono">{(effect.brightness ?? 3).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={effect.brightness ?? 3}
                  onChange={(e) => updateEffect(partId, effect.id, { brightness: parseFloat(e.target.value) })}
                  className="w-full accent-yellow-500"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] text-white/30">Range</Label>
                  <span className="text-[9px] text-white/30 font-mono">{(effect.range ?? 15).toFixed(0)}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={60}
                  step={1}
                  value={effect.range ?? 15}
                  onChange={(e) => updateEffect(partId, effect.id, { range: parseFloat(e.target.value) })}
                  className="w-full accent-yellow-500"
                />
              </div>
            </>
          )}
          {effect.type === 'Smoke' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[9px] text-white/30">Opacity</Label>
                <span className="text-[9px] text-white/30 font-mono">{(effect.opacity ?? 0.3).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={effect.opacity ?? 0.3}
                onChange={(e) => updateEffect(partId, effect.id, { opacity: parseFloat(e.target.value) })}
                className="w-full accent-gray-500"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── World Settings Panel ───

function WorldSettingsPanel() {
  const { worldSettings, setWorldSettings } = useStudioStore();
  const [skyExpanded, setSkyExpanded] = useState(true);
  const [celestialExpanded, setCelestialExpanded] = useState(true);
  const [weatherExpanded, setWeatherExpanded] = useState(false);

  const timeLabel = useMemo(() => {
    const h = Math.floor(worldSettings.timeOfDay);
    const m = Math.floor((worldSettings.timeOfDay - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }, [worldSettings.timeOfDay]);

  // Determine current time period for display
  const timePeriod = useMemo(() => {
    const t = worldSettings.timeOfDay;
    if (t < 5) return { label: 'Night', color: 'text-indigo-300' };
    if (t < 7) return { label: 'Dawn', color: 'text-orange-300' };
    if (t < 12) return { label: 'Morning', color: 'text-amber-300' };
    if (t < 14) return { label: 'Noon', color: 'text-yellow-300' };
    if (t < 17) return { label: 'Afternoon', color: 'text-amber-300' };
    if (t < 19) return { label: 'Dusk', color: 'text-orange-300' };
    if (t < 21) return { label: 'Evening', color: 'text-purple-300' };
    return { label: 'Night', color: 'text-indigo-300' };
  }, [worldSettings.timeOfDay]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-indigo-400" />
        <span className="text-xs text-indigo-400 font-semibold">World Settings</span>
      </div>

      <Separator className="bg-white/5" />

      {/* ─── Sky Colors ─── */}
      <div>
        <button
          className="flex items-center gap-2 w-full text-left"
          onClick={() => setSkyExpanded(!skyExpanded)}
        >
          {skyExpanded ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRight className="w-3 h-3 text-white/30" />}
          <Cloud className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[10px] text-white/50 uppercase font-semibold tracking-wider">Sky &amp; Clouds</span>
        </button>
        {skyExpanded && (
          <div className="mt-2 space-y-2 pl-1">
            {/* Sky color preview bar */}
            <div
              className="h-4 rounded border border-white/10"
              style={{
                background: `linear-gradient(to bottom, ${worldSettings.skyColorTop}, ${worldSettings.skyColorBottom})`,
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[9px] text-white/30 uppercase">Top Color</Label>
                <DeferredColorPicker
                  value={worldSettings.skyColorTop}
                  onChange={(v) => setWorldSettings({ skyColorTop: v })}
                  label={worldSettings.skyColorTop}
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[9px] text-white/30 uppercase">Bottom Color</Label>
                <DeferredColorPicker
                  value={worldSettings.skyColorBottom}
                  onChange={(v) => setWorldSettings({ skyColorBottom: v })}
                  label={worldSettings.skyColorBottom}
                />
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Clouds */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cloud className="w-3 h-3 text-gray-300" />
                <Label className="text-[10px] text-white/40">Clouds</Label>
              </div>
              <button
                className={`text-xs px-1.5 py-0.5 rounded border ${worldSettings.cloudsEnabled ? 'bg-blue-500/20 text-blue-400 border-blue-500/20' : 'bg-white/5 text-white/30 border-white/10'}`}
                onClick={() => setWorldSettings({ cloudsEnabled: !worldSettings.cloudsEnabled })}
              >
                {worldSettings.cloudsEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {worldSettings.cloudsEnabled && (
              <>
                <div className="space-y-1">
                  <Label className="text-[9px] text-white/30 uppercase">Cloud Color</Label>
                  <DeferredColorPicker
                    value={worldSettings.cloudColor}
                    onChange={(v) => setWorldSettings({ cloudColor: v })}
                    label={worldSettings.cloudColor}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] text-white/30 uppercase">Cloud Density</Label>
                    <span className="text-[9px] text-white/25 font-mono">{worldSettings.cloudDensity.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[worldSettings.cloudDensity]}
                    onValueChange={([v]) => setWorldSettings({ cloudDensity: v })}
                    min={0}
                    max={5}
                    step={0.1}
                    className="py-0.5"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Wind className="w-2.5 h-2.5 text-white/25" />
                      <Label className="text-[9px] text-white/30 uppercase">Wind Speed</Label>
                    </div>
                    <span className="text-[9px] text-white/25 font-mono">{worldSettings.cloudSpeed.toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={[worldSettings.cloudSpeed]}
                    onValueChange={([v]) => setWorldSettings({ cloudSpeed: v })}
                    min={0}
                    max={10}
                    step={0.1}
                    className="py-0.5"
                  />
                </div>
                {/* Wind Direction — compass dial */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] text-white/30 uppercase">Wind Direction</Label>
                    <span className="text-[9px] text-white/25 font-mono">{worldSettings.windDirection}°</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[worldSettings.windDirection]}
                      onValueChange={([v]) => setWorldSettings({ windDirection: v })}
                      min={0}
                      max={360}
                      step={5}
                      className="flex-1 py-0.5"
                    />
                    {/* Mini compass indicator */}
                    <div className="relative w-7 h-7 rounded-full border border-white/15 bg-white/5 flex-shrink-0">
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ transform: `rotate(${worldSettings.windDirection}deg)` }}
                      >
                        <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[8px] border-b-cyan-400" />
                      </div>
                      <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[6px] text-white/40 font-bold">N</span>
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[6px] text-white/25">S</span>
                      <span className="absolute top-1/2 -right-0.5 -translate-y-1/2 text-[6px] text-white/25">E</span>
                      <span className="absolute top-1/2 -left-0.5 -translate-y-1/2 text-[6px] text-white/25">W</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <Separator className="bg-white/5" />

      {/* ─── Celestial section (Sun / Moon / Stars / Day-Night) ─── */}
      <div>
        <button
          className="flex items-center gap-2 w-full text-left"
          onClick={() => setCelestialExpanded(!celestialExpanded)}
        >
          {celestialExpanded ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRight className="w-3 h-3 text-white/30" />}
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] text-white/50 uppercase font-semibold tracking-wider">Sun, Moon &amp; Stars</span>
        </button>
        {celestialExpanded && (
          <div className="mt-2 space-y-2 pl-1">
            {/* Sun */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sun className="w-3 h-3 text-amber-400" />
                <Label className="text-[10px] text-white/40">Sun</Label>
              </div>
              <button
                className={`text-xs px-1.5 py-0.5 rounded border ${worldSettings.sunEnabled ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : 'bg-white/5 text-white/30 border-white/10'}`}
                onClick={() => setWorldSettings({ sunEnabled: !worldSettings.sunEnabled })}
              >
                {worldSettings.sunEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {worldSettings.sunEnabled && (
              <>
                <div className="space-y-1">
                  <Label className="text-[9px] text-white/30 uppercase">Sun Color</Label>
                  <DeferredColorPicker
                    value={worldSettings.sunColor}
                    onChange={(v) => setWorldSettings({ sunColor: v })}
                    label={worldSettings.sunColor}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] text-white/30 uppercase">Sun Size</Label>
                    <span className="text-[9px] text-white/25 font-mono">{worldSettings.sunSize.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[worldSettings.sunSize]}
                    onValueChange={([v]) => setWorldSettings({ sunSize: v })}
                    min={0.3}
                    max={3}
                    step={0.1}
                    className="py-0.5"
                  />
                </div>
              </>
            )}

            {/* Moon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Moon className="w-3 h-3 text-blue-300" />
                <Label className="text-[10px] text-white/40">Moon</Label>
              </div>
              <button
                className={`text-xs px-1.5 py-0.5 rounded border ${worldSettings.moonEnabled ? 'bg-blue-500/20 text-blue-400 border-blue-500/20' : 'bg-white/5 text-white/30 border-white/10'}`}
                onClick={() => setWorldSettings({ moonEnabled: !worldSettings.moonEnabled })}
              >
                {worldSettings.moonEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {worldSettings.moonEnabled && (
              <>
                <div className="space-y-1">
                  <Label className="text-[9px] text-white/30 uppercase">Moon Color</Label>
                  <DeferredColorPicker
                    value={worldSettings.moonColor}
                    onChange={(v) => setWorldSettings({ moonColor: v })}
                    label={worldSettings.moonColor}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] text-white/30 uppercase">Moon Size</Label>
                    <span className="text-[9px] text-white/25 font-mono">{worldSettings.moonSize.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[worldSettings.moonSize]}
                    onValueChange={([v]) => setWorldSettings({ moonSize: v })}
                    min={0.3}
                    max={3}
                    step={0.1}
                    className="py-0.5"
                  />
                </div>
              </>
            )}

            {/* Stars */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Star className="w-3 h-3 text-yellow-200" />
                <Label className="text-[10px] text-white/40">Stars</Label>
              </div>
              <button
                className={`text-xs px-1.5 py-0.5 rounded border ${worldSettings.starsEnabled ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-white/5 text-white/30 border-white/10'}`}
                onClick={() => setWorldSettings({ starsEnabled: !worldSettings.starsEnabled })}
              >
                {worldSettings.starsEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {worldSettings.starsEnabled && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] text-white/30 uppercase">Star Count</Label>
                  <span className="text-[9px] text-white/25 font-mono">{worldSettings.starCount}</span>
                </div>
                <Slider
                  value={[worldSettings.starCount]}
                  onValueChange={([v]) => setWorldSettings({ starCount: v })}
                  min={0}
                  max={5000}
                  step={100}
                  className="py-0.5"
                />
              </div>
            )}

            {/* Time of Day — always visible, controls sun/moon/sky position */}
            <Separator className="bg-white/5" />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[9px] text-white/30 uppercase">Time of Day</Label>
                <span className={`text-[9px] font-mono ${timePeriod.color}`}>{timeLabel} — {timePeriod.label}</span>
              </div>
              <Slider
                value={[worldSettings.timeOfDay]}
                onValueChange={([v]) => setWorldSettings({ timeOfDay: v })}
                min={0}
                max={24}
                step={0.25}
                className="py-0.5"
              />
            </div>
            {/* Day / Night Cycle — auto-advances time */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-purple-400" />
                <Label className="text-[10px] text-white/40">Auto Cycle</Label>
              </div>
              <button
                className={`text-xs px-1.5 py-0.5 rounded border ${worldSettings.dayNightEnabled ? 'bg-purple-500/20 text-purple-400 border-purple-500/20' : 'bg-white/5 text-white/30 border-white/10'}`}
                onClick={() => setWorldSettings({ dayNightEnabled: !worldSettings.dayNightEnabled })}
              >
                {worldSettings.dayNightEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {worldSettings.dayNightEnabled && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] text-white/30 uppercase">Day Length (sec)</Label>
                  <span className="text-[9px] text-white/25 font-mono">{worldSettings.dayLength}s</span>
                </div>
                <Slider
                  value={[worldSettings.dayLength]}
                  onValueChange={([v]) => setWorldSettings({ dayLength: v })}
                  min={30}
                  max={600}
                  step={10}
                  className="py-0.5"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <Separator className="bg-white/5" />

      {/* ─── Weather section ─── */}
      <div>
        <button
          className="flex items-center gap-2 w-full text-left"
          onClick={() => setWeatherExpanded(!weatherExpanded)}
        >
          {weatherExpanded ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRight className="w-3 h-3 text-white/30" />}
          <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] text-white/50 uppercase font-semibold tracking-wider">Weather</span>
        </button>
        {weatherExpanded && (
          <div className="mt-2 space-y-2 pl-1">
            <div className="space-y-1">
              <Label className="text-[9px] text-white/30 uppercase">Weather Type</Label>
              <Select value={worldSettings.weatherType} onValueChange={(v: any) => setWorldSettings({ weatherType: v })}>
                <SelectTrigger className="h-6 text-[10px] bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear"><span className="flex items-center gap-1"><Sun className="w-3 h-3" /> Clear</span></SelectItem>
                  <SelectItem value="cloudy"><span className="flex items-center gap-1"><Cloud className="w-3 h-3" /> Cloudy</span></SelectItem>
                  <SelectItem value="rain"><span className="flex items-center gap-1"><CloudRain className="w-3 h-3" /> Rain</span></SelectItem>
                  <SelectItem value="snow"><span className="flex items-center gap-1"><CloudSnow className="w-3 h-3" /> Snow</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            {worldSettings.weatherType !== 'clear' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] text-white/30 uppercase">Intensity</Label>
                  <span className="text-[9px] text-white/25 font-mono">{worldSettings.weatherIntensity.toFixed(1)}</span>
                </div>
                <Slider
                  value={[worldSettings.weatherIntensity]}
                  onValueChange={([v]) => setWorldSettings({ weatherIntensity: v })}
                  min={0.1}
                  max={1}
                  step={0.1}
                  className="py-0.5"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <Separator className="bg-white/5" />

      {/* Ambient Light */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-white/40 uppercase">Ambient Light</Label>
          <span className="text-[10px] text-white/30 font-mono">{worldSettings.ambientLightIntensity.toFixed(2)}</span>
        </div>
        <Slider
          value={[worldSettings.ambientLightIntensity]}
          onValueChange={([v]) => setWorldSettings({ ambientLightIntensity: v })}
          min={0}
          max={2}
          step={0.05}
          className="py-1"
        />
      </div>

      {/* Baseplate Size */}
      <div className="space-y-1">
        <Label className="text-[10px] text-white/40 uppercase">Baseplate Size</Label>
        <Input
          type="number"
          value={worldSettings.baseplateSize}
          onChange={(e) => setWorldSettings({ baseplateSize: parseFloat(e.target.value) || 512 })}
          className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
        />
      </div>

      {/* Gravity */}
      <div className="space-y-1">
        <Label className="text-[10px] text-white/40 uppercase">Gravity</Label>
        <Input
          type="number"
          value={worldSettings.gravity}
          onChange={(e) => { const v = handleNumberInput(e.target.value); if (v !== undefined) setWorldSettings({ gravity: v }); }}
          className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
        />
      </div>

      {/* Max Players */}
      <div className="space-y-1">
        <Label className="text-[10px] text-white/40 uppercase">Max Players</Label>
        <Input
          type="number"
          value={worldSettings.maxPlayers}
          onChange={(e) => setWorldSettings({ maxPlayers: parseInt(e.target.value) || 10 })}
          className="h-6 text-[10px] bg-white/5 border-white/10 text-white"
        />
      </div>

      {/* Spawn Point Position */}
      <Vector3Input
        label="Spawn Point"
        value={worldSettings.spawnPointPosition}
        onChange={(v) => setWorldSettings({ spawnPointPosition: v })}
      />
    </div>
  );
}

// ─── Object Variables Editor ───
// Per-object variable manager. Variables are stored on the part itself
// (part.objectVariables) so they're scoped to that part only. They can be
// read/written from WeildCode using the existing set_variable / change_variable
// actions and when_variable_equals / when_variable_changes triggers with the
// new scope="object" param.

function ObjectVariablesEditor({ partId }: { partId: string }) {
  const { objects, setObjectVariable, deleteObjectVariable, addConsoleMessage } = useStudioStore();
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('0');

  const part = useMemo(() => objects.get(partId), [objects, partId]);
  if (!part || !isPart(part)) return null;

  const vars = part.objectVariables || {};
  const entries = Object.entries(vars);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const numVal = Number(newValue);
    const value: number | string = !isNaN(numVal) && newValue.trim() !== '' ? numVal : newValue;
    setObjectVariable(partId, name, value);
    addConsoleMessage('info', `Object variable "${name}" = ${value} (on ${part.name})`);
    setNewName('');
    setNewValue('0');
  };

  return (
    <div className="space-y-1.5">
      {/* Existing variables */}
      {entries.length === 0 && (
        <div className="text-[9px] text-white/25 text-center py-1.5 bg-white/[0.02] rounded border border-white/5">
          No object variables
        </div>
      )}
      {entries.map(([name, value]) => (
        <div key={name} className="flex items-center gap-1.5 px-1.5 py-1 bg-white/5 rounded">
          <Variable className="w-2.5 h-2.5 text-violet-400/60 shrink-0" />
          <span className="text-[10px] text-white/70 flex-1 font-mono truncate">{name}</span>
          <span className="text-[10px] text-violet-400 font-mono truncate max-w-[60px]">= {String(value)}</span>
          <button
            onClick={() => { deleteObjectVariable(partId, name); addConsoleMessage('info', `Deleted object variable "${name}"`); }}
            className="text-white/30 hover:text-red-400 transition-colors shrink-0"
            title="Delete variable"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      ))}

      {/* Add new variable */}
      <div className="flex gap-1 pt-1 border-t border-white/5">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="name"
          className="flex-1 min-w-0 text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-400/40"
        />
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="value"
          className="w-14 text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-400/40"
        />
        <button
          onClick={handleAdd}
          className="px-2 py-1 bg-violet-500/15 hover:bg-violet-500/25 rounded text-violet-400 border border-violet-500/20 transition-colors"
          title="Add variable"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Properties Panel ───

export function PropertiesPanel() {
  const { selectedIds, objects, updateObject, addBodyMover, addConsoleMessage, ungroupSelected, deleteSelected } = useStudioStore();

  const selectedPart = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const obj = objects.get(selectedIds[0]);
    if (obj && isPart(obj)) return obj;
    return null;
  }, [selectedIds, objects]);

  const handleUpdate = useCallback((updates: Partial<StudioPart>) => {
    if (!selectedPart) return;
    updateObject(selectedPart.id, updates as any);
  }, [selectedPart, updateObject]);

  // Calculate mass from part properties
  const computedMass = useMemo(() => {
    if (!selectedPart) return 0;
    return calculateMass(selectedPart.type, selectedPart.size, selectedPart.material, selectedPart.density);
  }, [selectedPart]);

  const handleAddBodyMover = useCallback((type: BodyMoverType) => {
    if (!selectedPart) return;
    const mover: BodyMover = {
      id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      enabled: true,
      force: type === 'BodyForce' ? { x: 0, y: 9.81, z: 0 } : undefined,
      velocity: type === 'BodyVelocity' ? { x: 0, y: 0, z: 0 } : undefined,
      maxForce: type === 'BodyVelocity' || type === 'BodyPosition' ? { x: 10000, y: 10000, z: 10000 } : undefined,
      P: 5000,
      D: 500,
      position: type === 'BodyPosition' ? { x: 0, y: 10, z: 0 } : undefined,
      cframe: type === 'BodyGyro' ? { x: 0, y: 0, z: 0 } : undefined,
      maxTorque: type === 'BodyGyro' || type === 'BodyAngularVelocity' ? { x: 10000, y: 10000, z: 10000 } : undefined,
      angularVelocity: type === 'BodyAngularVelocity' ? { x: 0, y: 1, z: 0 } : undefined,
      location: type === 'BodyThrust' ? { x: 0, y: 0, z: 0 } : undefined,
    };
    addBodyMover(selectedPart.id, mover);
    addConsoleMessage('info', `Added ${type} to ${selectedPart.name}`);
  }, [selectedPart, addBodyMover, addConsoleMessage]);

  if (selectedIds.length === 0) {
    return (
      <div className="h-full flex flex-col border-l" style={{ background: 'var(--wb-bg-card-solid)', borderColor: 'var(--wb-border-subtle)' }}>
        <div className="flex items-center px-3 py-2 border-b border-white/5">
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Properties</h3>
        </div>
        <div className="flex-1 overflow-y-auto studio-panel p-3">
          <WorldSettingsPanel />
        </div>
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div className="h-full flex flex-col border-l" style={{ background: 'var(--wb-bg-card-solid)', borderColor: 'var(--wb-border-subtle)' }}>
        <div className="flex items-center px-3 py-2 border-b border-white/5">
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-[10px] text-white/20 text-center">{selectedIds.length} objects selected</p>
        </div>
      </div>
    );
  }

  if (!selectedPart) {
    // A group (StudioModel) is selected — show group properties
    const selectedModel = selectedIds.length === 1
      ? objects.get(selectedIds[0]) as StudioModel | undefined
      : undefined;

    if (selectedModel && 'children' in selectedModel) {
      const childCount = selectedModel.children.length;
      return (
        <div className="h-full flex flex-col border-l" style={{ background: 'var(--wb-bg-card-solid)', borderColor: 'var(--wb-border-subtle)' }}>
          <div className="flex items-center px-3 py-2 border-b border-white/5">
            <FolderTree className="w-3.5 h-3.5 text-amber-400/70 mr-2" />
            <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Group</h3>
          </div>
          <div className="flex-1 overflow-y-auto studio-panel p-3 space-y-4">
            {/* Group name */}
            <div className="space-y-1.5">
              <Label className="text-[9px] text-white/40 uppercase tracking-wider">Name</Label>
              <Input
                value={selectedModel.name}
                onChange={(e) => updateObject(selectedModel.id, { name: e.target.value })}
                className="h-6 text-[10px] bg-white/5 border-white/10 text-white/80"
              />
            </div>

            {/* Child count */}
            <div className="space-y-1.5">
              <Label className="text-[9px] text-white/40 uppercase tracking-wider">Objects</Label>
              <p className="text-[10px] text-white/60">{childCount} object{childCount !== 1 ? 's' : ''} in group</p>
            </div>

            <Separator className="bg-white/5" />

            {/* Group-level color — applies to all children */}
            <div className="space-y-1.5">
              <Label className="text-[9px] text-white/40 uppercase tracking-wider flex items-center gap-1">
                <Palette className="w-3 h-3" /> Color All
              </Label>
              <DeferredColorPicker
                value="#4a90d9"
                onChange={(color) => {
                  selectedModel.children.forEach(childId => {
                    updateObject(childId, { color });
                  });
                }}
                label="Apply to all"
              />
            </div>

            {/* Group-level material — applies to all children */}
            <div className="space-y-1.5">
              <Label className="text-[9px] text-white/40 uppercase tracking-wider">Material All</Label>
              <Select
                value="Plastic"
                onValueChange={(material) => {
                  selectedModel.children.forEach(childId => {
                    updateObject(childId, { material: material as MaterialType });
                  });
                }}
              >
                <SelectTrigger className="h-6 text-[10px] bg-white/5 border-white/10 text-white/60">
                  <SelectValue placeholder="Apply to all" />
                </SelectTrigger>
                <SelectContent>
                  {getMaterialNames().map((name) => (
                    <SelectItem key={name} value={name} className="text-[10px]">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-white/5" />

            {/* Ungroup button */}
            <button
              onClick={() => ungroupSelected()}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[10px] bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <Ungroup className="w-3 h-3" /> Ungroup
            </button>

            {/* Delete group + children */}
            <button
              onClick={() => deleteSelected()}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Delete Group
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col border-l" style={{ background: 'var(--wb-bg-card-solid)', borderColor: 'var(--wb-border-subtle)' }}>
        <div className="flex items-center px-3 py-2 border-b border-white/5">
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-[10px] text-white/20 text-center">No properties available</p>
        </div>
      </div>
    );
  }

  const partIcon = (() => {
    switch (selectedPart.type) {
      case 'Block': return <Box className="w-4 h-4" />;
      case 'Sphere': return <Circle className="w-4 h-4" />;
      case 'Wedge': return <Triangle className="w-4 h-4" />;
      case 'Cylinder': return <Cylinder className="w-4 h-4" />;
      case 'Spawn': return <MapPin className="w-4 h-4" />;
    }
  })();

  const bodyMoverTypes: { type: BodyMoverType; label: string; color: string }[] = [
    { type: 'BodyForce', label: 'Force', color: 'text-red-400' },
    { type: 'BodyVelocity', label: 'Velocity', color: 'text-blue-400' },
    { type: 'BodyPosition', label: 'Position', color: 'text-green-400' },
    { type: 'BodyGyro', label: 'Gyro', color: 'text-purple-400' },
    { type: 'BodyThrust', label: 'Thrust', color: 'text-orange-400' },
    { type: 'BodyAngularVelocity', label: 'AngVel', color: 'text-cyan-400' },
  ];

  return (
    <div className="h-full flex flex-col border-l" style={{ background: 'var(--wb-bg-card-solid)', borderColor: 'var(--wb-border-subtle)' }}>
      <div className="flex items-center px-3 py-2 border-b border-white/5">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Properties</h3>
      </div>
      <div className="flex-1 overflow-y-auto studio-panel p-3 space-y-3">
        {/* Name & Type */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-indigo-400">{partIcon}</span>
            <span className="text-xs text-white/60">{selectedPart.type}</span>
            {selectedPart.isSpawnPoint && (
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/20">Spawn</span>
            )}
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-white/40">Name</Label>
            <Input
              value={selectedPart.name}
              onChange={(e) => handleUpdate({ name: e.target.value })}
              className="h-6 text-xs bg-white/5 border-white/10 text-white"
            />
          </div>
        </div>

        <Separator className="bg-white/5" />

        {/* Position */}
        <Vector3Input
          label="Position"
          value={selectedPart.position}
          onChange={(v) => handleUpdate({ position: v })}
        />

        {/* Size */}
        <Vector3Input
          label="Size"
          value={selectedPart.size}
          onChange={(v) => handleUpdate({ size: v })}
        />

        {/* Rotation */}
        <Vector3Input
          label="Rotation"
          value={selectedPart.rotation}
          onChange={(v) => handleUpdate({ rotation: v })}
        />

        <Separator className="bg-white/5" />

        {/* Color */}
        <div className="space-y-1">
          <Label className="text-[10px] text-white/40 uppercase">Color</Label>
          <div className="flex items-center gap-2">
            <DeferredColorPicker
              value={selectedPart.color}
              onChange={(v) => handleUpdate({ color: v })}
              size="md"
            />
            <Input
              value={selectedPart.color}
              onChange={(e) => handleUpdate({ color: e.target.value })}
              className="h-6 text-[10px] bg-white/5 border-white/10 text-white font-mono flex-1"
            />
          </div>
        </div>

        {/* Material */}
        <div className="space-y-1">
          <Label className="text-[10px] text-white/40 uppercase">Material</Label>
          <Select
            value={selectedPart.material}
            onValueChange={(v) => {
              const mat = getMaterialProps(v);
              handleUpdate({ material: v as MaterialType, friction: mat.friction, elasticity: mat.elasticity });
            }}
          >
            <SelectTrigger className="h-6 text-[10px] bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#252536] border-white/10 max-h-48">
              {getMaterialNames().map((name) => (
                <SelectItem key={name} value={name} className="text-[10px] text-white/70 focus:text-white focus:bg-white/5">
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Transparency */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-white/40 uppercase">Transparency</Label>
            <span className="text-[10px] text-white/30 font-mono">{selectedPart.transparency.toFixed(2)}</span>
          </div>
          <Slider
            value={[selectedPart.transparency]}
            onValueChange={([v]) => handleUpdate({ transparency: v })}
            min={0}
            max={1}
            step={0.01}
            className="py-1"
          />
        </div>

        {/* Reflectance */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-white/40 uppercase">Reflectance</Label>
            <span className="text-[10px] text-white/30 font-mono">{selectedPart.reflectance.toFixed(2)}</span>
          </div>
          <Slider
            value={[selectedPart.reflectance]}
            onValueChange={([v]) => handleUpdate({ reflectance: v })}
            min={0}
            max={1}
            step={0.01}
            className="py-1"
          />
        </div>

        <Separator className="bg-white/5" />

        {/* ─── Physics Properties ─── */}

        <div className="space-y-1">
          <Label className="text-[10px] text-amber-400/60 uppercase font-semibold tracking-wider">Physics</Label>
        </div>

        {/* Mass (read-only, computed) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-white/40 uppercase">Mass</Label>
            <span className="text-[10px] text-amber-400/60 font-mono">{computedMass.toFixed(1)} kg</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full">
            <div
              className="h-full bg-amber-500/30 rounded-full"
              style={{ width: `${Math.min(100, (computedMass / 500) * 100)}%` }}
            />
          </div>
        </div>

        {/* Friction */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-white/40 uppercase">Friction</Label>
            <span className="text-[10px] text-white/30 font-mono">{(selectedPart.friction ?? 0.5).toFixed(2)}</span>
          </div>
          <Slider
            value={[selectedPart.friction ?? 0.5]}
            onValueChange={([v]) => handleUpdate({ friction: v })}
            min={0}
            max={1}
            step={0.01}
            className="py-1"
          />
        </div>

        {/* Elasticity */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-white/40 uppercase">Elasticity</Label>
            <span className="text-[10px] text-white/30 font-mono">{(selectedPart.elasticity ?? 0.2).toFixed(2)}</span>
          </div>
          <Slider
            value={[selectedPart.elasticity ?? 0.2]}
            onValueChange={([v]) => handleUpdate({ elasticity: v })}
            min={0}
            max={1}
            step={0.01}
            className="py-1"
          />
        </div>

        {/* Density */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-white/40 uppercase">Density</Label>
            <span className="text-[10px] text-white/30 font-mono">{(selectedPart.density ?? 1.0).toFixed(2)}</span>
          </div>
          <Slider
            value={[selectedPart.density ?? 1.0]}
            onValueChange={([v]) => handleUpdate({ density: v })}
            min={0.1}
            max={10}
            step={0.1}
            className="py-1"
          />
        </div>

        {/* Boolean physics properties */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedPart.anchored}
              onCheckedChange={(v) => handleUpdate({ anchored: !!v })}
              className="border-white/20 data-[state=checked]:bg-amber-500/20 data-[state=checked]:border-amber-500/50"
            />
            <Label className="text-[10px] text-white/60">Anchored</Label>
            <span className="text-[8px] text-white/20 ml-auto">Immune to physics</span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedPart.canCollide}
              onCheckedChange={(v) => handleUpdate({ canCollide: !!v })}
              className="border-white/20 data-[state=checked]:bg-indigo-500/20 data-[state=checked]:border-indigo-500/50"
            />
            <Label className="text-[10px] text-white/60">CanCollide</Label>
            <span className="text-[8px] text-white/20 ml-auto">Physical collision</span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedPart.showInWorld !== false}
              onCheckedChange={(v) => handleUpdate({ showInWorld: !!v })}
              className="border-white/20 data-[state=checked]:bg-emerald-500/20 data-[state=checked]:border-emerald-500/50"
            />
            <Label className="text-[10px] text-white/60">Show in World</Label>
            <span className="text-[8px] text-white/20 ml-auto">Render + physics + code</span>
          </div>
        </div>

        {/* ─── Avatar Modification (character parts only) ─── */}
        {selectedPart.isCharacterPart && (
          <>
            <Separator className="bg-white/5" />
            <div className="space-y-1">
              <Label className="text-[10px] text-pink-400/60 uppercase font-semibold tracking-wider">Avatar Modification</Label>
              <p className="text-[8px] text-white/30">Override this part's properties with each player's avatar at runtime</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!selectedPart.modifyColorToAvatar}
                  onCheckedChange={(v) => handleUpdate({ modifyColorToAvatar: !!v })}
                  className="border-white/20 data-[state=checked]:bg-pink-500/20 data-[state=checked]:border-pink-500/50"
                />
                <Label className="text-[10px] text-white/60">Modify Color to Player's Avatar</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!selectedPart.modifySizeToAvatar}
                  onCheckedChange={(v) => handleUpdate({ modifySizeToAvatar: !!v })}
                  className="border-white/20 data-[state=checked]:bg-pink-500/20 data-[state=checked]:border-pink-500/50"
                />
                <Label className="text-[10px] text-white/60">Modify Size to Player's Avatar</Label>
              </div>
              {(selectedPart.characterPartType === 'face') && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={!!selectedPart.modifyFaceToAvatar}
                    onCheckedChange={(v) => handleUpdate({ modifyFaceToAvatar: !!v })}
                    className="border-white/20 data-[state=checked]:bg-pink-500/20 data-[state=checked]:border-pink-500/50"
                  />
                  <Label className="text-[10px] text-white/60">Modify Face to Player's Avatar</Label>
                </div>
              )}
              {/* Item key override field — for face/torso/legs */}
              {(selectedPart.characterPartType === 'face' || selectedPart.characterPartType === 'torso' ||
                selectedPart.characterPartType === 'leftLeg' || selectedPart.characterPartType === 'rightLeg') && (
                <div className="space-y-1">
                  <Label className="text-[9px] text-white/40">Avatar Item Key (optional)</Label>
                  <input
                    type="text"
                    value={selectedPart.avatarItemKey || ''}
                    onChange={(e) => handleUpdate({ avatarItemKey: e.target.value })}
                    placeholder={selectedPart.characterPartType === 'face' ? 'e.g. FACE-1' : selectedPart.characterPartType === 'torso' ? 'e.g. SHIRT-3' : 'e.g. PANTS-2'}
                    className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-[10px] text-white/80 placeholder-white/20 focus:outline-none focus:border-pink-500/50"
                  />
                </div>
              )}
            </div>
          </>
        )}

        <Separator className="bg-white/5" />

        {/* ─── Effects ─── */}

        <div className="space-y-1">
          <Label className="text-[10px] text-orange-400/60 uppercase font-semibold tracking-wider">Effects</Label>
        </div>

        {(selectedPart.effects || []).map((effect) => (
          <EffectEditor key={effect.id} partId={selectedPart.id} effect={effect} />
        ))}

        <Separator className="bg-white/5" />

        {/* ─── BodyMovers ─── */}

        <div className="space-y-1">
          <Label className="text-[10px] text-blue-400/60 uppercase font-semibold tracking-wider">BodyMovers</Label>
        </div>

        {/* Existing body movers */}
        {(selectedPart.bodyMovers ?? []).map((mover) => (
          <BodyMoverEditor key={mover.id} partId={selectedPart.id} mover={mover} />
        ))}

        {/* Add BodyMover dropdown */}
        <div className="flex flex-wrap gap-1">
          {bodyMoverTypes.map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => handleAddBodyMover(type)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors"
            >
              <Plus className={`w-2.5 h-2.5 ${color}`} />
              <span className={color}>{label}</span>
            </button>
          ))}
        </div>

        {/* Joint actions */}
        <Separator className="bg-white/5" />
        <div className="space-y-1">
          <Label className="text-[10px] text-purple-400/60 uppercase font-semibold tracking-wider">Joints</Label>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => useStudioStore.getState().makeJoints(selectedPart.id)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] bg-white/5 hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/20 transition-colors text-purple-400/70"
          >
            <Link className="w-3 h-3" />
            Make Joints
          </button>
          <button
            onClick={() => useStudioStore.getState().breakJoints(selectedPart.id)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-colors text-red-400/70"
          >
            <Trash2 className="w-3 h-3" />
            Break Joints
          </button>
        </div>

        {/* ─── Object Variables ─── */}
        {/* Per-object variables: scoped to this part only (vs Globals which are universal).
            Use them in WeildCode via set_variable / when_variable_equals with scope="object". */}
        <Separator className="bg-white/5" />
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Variable className="w-3 h-3 text-violet-400/70" />
            <Label className="text-[10px] text-violet-400/70 uppercase font-semibold tracking-wider">Object Variables</Label>
          </div>
          <p className="text-[9px] text-white/30 leading-snug">
            Scoped to this object only. In WeildCode, use <code className="text-violet-400/70">scope=&quot;object&quot;</code> with <code className="text-violet-400/70">set_variable</code> / <code className="text-violet-400/70">when_variable_equals</code>.
          </p>
          <ObjectVariablesEditor partId={selectedPart.id} />
        </div>

        {/* ─── WeildCode Logic ─── */}

        <Separator className="bg-white/5" />

        <LogicPanel partId={selectedPart.id} />
      </div>
    </div>
  );
}
