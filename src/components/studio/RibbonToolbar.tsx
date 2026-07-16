'use client';

import { useStudioStore, StudioTab, ToolMode, PartEffect, isPart, UniverseData, Joint, StudioPart, GlobalTimer } from '@/lib/studio-store';
import { weildCodeEngine } from '@/lib/weildcode-engine';
import { useAuth } from '@/lib/store';
import {
  MousePointer2,
  Move,
  Maximize2,
  RotateCcw,
  Box,
  Circle,
  Triangle,
  Cylinder,
  ClipboardPaste,
  Copy,
  Scissors,
  Files,
  PaintBucket,
  Palette,
  FolderTree,
  TreePine,
  Lock,
  Unlock,
  Play,
  Square,
  Mountain,
  Waves,
  TreeDeciduous,
  Droplets,
  Wind,
  Eraser,
  Eye,
  Grid3X3,
  Magnet,
  Search,
  Wrench,
  Sparkles,
  Flame,
  Cloud,
  Lightbulb,
  MapPin,
  Terminal,
  Merge,
  Split,
  GitBranch,
  Zap,
  ArrowDown,
  ArrowUp,
  Link,
  Unlink,
  Bomb,
  Settings,
  Activity,
  Save,
  FolderOpen,
  Download,
  Upload,
  Globe,
  FilePlus,
  X,
  Trash2,
  Pencil,
  Check,
  Undo2,
  Redo2,
  Compass,
  User,
  Variable,
  Timer,
  PlusCircle,
  MinusCircle,
  RefreshCw,
} from 'lucide-react';
import { MaterialPicker } from './MaterialPicker';
import { ColorPicker } from './ColorPicker';
import { useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  restoreStudioState,
  isValidStudioState,
  type StudioProjectState,
} from '@/lib/studio-project';

function ToolButton({ icon, label, active, onClick, size = 'sm' }: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex flex-col items-center justify-center gap-1 rounded-md px-2 py-1.5 transition-all duration-200 hover:scale-105 ${
        size === 'sm' ? 'min-w-[44px]' : 'min-w-[52px]'
      } ${
        active
          ? 'text-indigo-400 border border-transparent'
          : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      {icon}
      <span className={`text-[11px] leading-tight font-medium ${active ? 'text-indigo-400' : ''}`}>{label}</span>
      {/* Active indicator dot */}
      <div className={`w-1 h-1 rounded-full transition-all duration-200 ${
        active ? 'bg-indigo-400 scale-100' : 'bg-transparent scale-0'
      }`} />
    </button>
  );
}

function PopupCard({ children, className, onClose, triggerRef }: { children: React.ReactNode; className?: string; onClose?: () => void; triggerRef?: React.RefObject<HTMLElement | null> }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Position popup below the trigger element
    const el = triggerRef?.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({ top: rect.bottom, left: rect.left });
    } else {
      // Fallback: position near the toolbar
      const toolbar = document.querySelector('[data-ribbon-toolbar]');
      if (toolbar) {
        const rect = toolbar.getBoundingClientRect();
        setPos({ top: rect.bottom, left: rect.left + 8 });
      }
    }
  }, [triggerRef]);

  // After the popup is rendered, measure its size and clamp it inside the viewport
  // so Vars/Globals/etc. don't get cut off when their trigger button is near the
  // right edge or bottom of the screen.
  useLayoutEffect(() => {
    if (!pos || !cardRef.current) return;
    const card = cardRef.current;
    const cardRect = card.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const PAD = 8; // px of breathing room from the viewport edge

    let nextLeft = pos.left;
    let nextTop = pos.top + 8; // matches the +8 in the inline style below

    // Right-edge overflow → align popup's right edge with viewport right (minus padding).
    // We also keep at least 16px so the caret stays visible.
    if (nextLeft + cardRect.width > vw - PAD) {
      nextLeft = Math.max(PAD, vw - PAD - cardRect.width);
    }
    // Left-edge underflow (rare, but possible for negative offsets) → push right.
    if (nextLeft < PAD) nextLeft = PAD;

    // Bottom-edge overflow → flip popup ABOVE the trigger instead of below it.
    if (nextTop + cardRect.height > vh - PAD) {
      const triggerRect = triggerRef?.current?.getBoundingClientRect();
      if (triggerRect) {
        // Place above the trigger with a small gap; clamp to viewport top.
        nextTop = Math.max(PAD, triggerRect.top - cardRect.height - 8);
      } else {
        nextTop = Math.max(PAD, vh - PAD - cardRect.height);
      }
    }

    // Only update if we actually moved something — avoids extra renders.
    const finalTop = nextTop - 8; // store as "top before +8 offset" to match style below
    if (finalTop !== pos.top || nextLeft !== pos.left) {
      setPos({ top: finalTop, left: nextLeft });
    }
  }, [pos, triggerRef]);

  if (!pos) return null;

  return createPortal(
    <>
      {/* Backdrop overlay — click to close */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
      />
      {/* Popup card */}
      <div
        ref={cardRef}
        className="fixed z-[9999] animate-[popupFadeIn_150ms_ease-out]"
        style={{
          top: `${pos.top + 8}px`,
          left: `${pos.left}px`,
        }}
      >
        {/* Arrow / caret pointing up toward button */}
        <div className="absolute -top-[6px] left-5 w-3 h-3 rotate-45 backdrop-blur-xl bg-[#1e293b]/85 border-l border-t border-white/10" />
        {/* Card body */}
        <div className={`relative backdrop-blur-xl bg-[#1e293b]/85 border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-4 ${className || ''}`}>
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

function Separator() {
  return <div className="w-px h-12 bg-white/10 mx-1" />;
}

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 pb-1">{children}</div>
      <span className="text-[9px] text-white/30 text-center">{label}</span>
    </div>
  );
}

function PartDropdown({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { addPart } = useStudioStore();
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton
        icon={<Box className="w-4 h-4" />}
        label="Part ▾"
        active={open}
        onClick={onToggle}
        size="md"
      />
      {open && (
        <PopupCard className="py-2 min-w-[180px] !p-0" onClose={onClose} triggerRef={triggerRef}>
          <div className="px-4 pb-2 border-b border-white/5">
            <span className="text-[10px] text-indigo-400 font-semibold">Insert Part</span>
          </div>
          {([
            { type: 'Block' as const, icon: <Box className="w-4 h-4" style={{color: '#4ff7f5'}} />, label: 'Block' },
            { type: 'Sphere' as const, icon: <Circle className="w-4 h-4" style={{color: '#f24b4b'}} />, label: 'Sphere' },
            { type: 'Wedge' as const, icon: <Triangle className="w-4 h-4" style={{color: '#f7f54f'}} />, label: 'Wedge' },
            { type: 'Cylinder' as const, icon: <Cylinder className="w-4 h-4" style={{color: '#37e62e'}} />, label: 'Cylinder' },
            { type: 'Spawn' as const, icon: <MapPin className="w-4 h-4" style={{color: '#4a90d9'}} />, label: 'Spawn' },
          ]).map((item) => (
            <button
              key={item.type}
              onClick={() => { addPart(item.type); onClose(); }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </PopupCard>
      )}
    </div>
  );
}

function GravityControl({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { physicsSettings, setPhysicsSettings, addConsoleMessage } = useStudioStore();
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton
        icon={<ArrowDown className="w-4 h-4" />}
        label="Gravity"
        active={open}
        onClick={onToggle}
      />
      {open && (
        <PopupCard className="min-w-[220px]" onClose={onClose} triggerRef={triggerRef}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/60">Gravity</span>
              <span className="text-[10px] text-amber-400/60 font-mono">{physicsSettings.gravity.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={-500}
              max={0}
              value={physicsSettings.gravity}
              onChange={(e) => setPhysicsSettings({ gravity: parseFloat(e.target.value) })}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between">
              <span className="text-[8px] text-white/20">Zero-G</span>
              <span className="text-[8px] text-white/20">-500</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => { setPhysicsSettings({ gravity: -9.81 }); addConsoleMessage('info', 'Gravity set to default: -9.81'); }}
                className="flex-1 text-[9px] px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-white/60 hover:text-white"
              >
                Default (-9.81)
              </button>
              <button
                onClick={() => { setPhysicsSettings({ gravity: 0 }); addConsoleMessage('info', 'Zero gravity enabled'); }}
                className="flex-1 text-[9px] px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 rounded text-blue-400/70 hover:text-blue-400 border border-blue-500/10"
              >
                Zero Gravity
              </button>
            </div>
          </div>
        </PopupCard>
      )}
    </div>
  );
}

function ExplosionControl({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { createExplosion, addConsoleMessage, selectedIds, objects } = useStudioStore();
  const [radius, setRadius] = useState(15);
  const [pressure, setPressure] = useState(500);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleExplode = () => {
    // Explode at selected part or origin
    let pos = { x: 0, y: 5, z: 0 };
    if (selectedIds.length > 0) {
      const obj = objects.get(selectedIds[0]);
      if (obj && 'position' in obj) pos = { ...obj.position };
    }
    createExplosion(pos, radius, pressure);
    addConsoleMessage('info', `Boom! Explosion — radius: ${radius}, pressure: ${pressure}`);
    onClose();
  };

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton
        icon={<Bomb className="w-4 h-4" />}
        label="Explode"
        active={open}
        onClick={onToggle}
      />
      {open && (
        <PopupCard className="min-w-[220px]" onClose={onClose} triggerRef={triggerRef}>
          <div className="space-y-2">
            <span className="text-[10px] text-white/60 font-semibold">Explosion Settings</span>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Blast Radius</span>
                <span className="text-[9px] text-red-400/60 font-mono">{radius}</span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value))}
                className="w-full accent-red-500"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Blast Pressure</span>
                <span className="text-[9px] text-red-400/60 font-mono">{pressure}</span>
              </div>
              <input
                type="range"
                min={100}
                max={2000}
                value={pressure}
                onChange={(e) => setPressure(parseFloat(e.target.value))}
                className="w-full accent-red-500"
              />
            </div>
            <button
              onClick={handleExplode}
              className="w-full text-[10px] px-2 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 font-semibold border border-red-500/20"
            >
              💥 Create Explosion
            </button>
          </div>
        </PopupCard>
      )}
    </div>
  );
}

// ─── Fire Effect Popup ───
function FireControl({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { selectedIds, addEffect, addConsoleMessage } = useStudioStore();
  const [color, setColor] = useState('#ff6600');
  const [size, setSize] = useState(1);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleApply = () => {
    if (selectedIds.length === 0) {
      addConsoleMessage('warn', 'Select a part first to add Fire');
      onClose();
      return;
    }
    selectedIds.forEach((id) => {
      addEffect(id, {
        id: `effect_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'Fire',
        color,
        size,
        enabled: true,
        brightness: 2,
        range: 10,
      });
    });
    onClose();
  };

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton icon={<Flame className="w-4 h-4" />} label="Fire" active={open} onClick={onToggle} />
      {open && (
        <PopupCard className="min-w-[220px]" onClose={onClose} triggerRef={triggerRef}>
          <div className="space-y-2">
            <span className="text-[10px] text-orange-400 font-semibold">Fire Effect</span>
            <div className="space-y-1">
              <span className="text-[9px] text-white/40">Color</span>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-6 rounded border border-white/10 cursor-pointer bg-transparent" />
                <span className="text-[9px] text-white/30 font-mono">{color}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Size</span>
                <span className="text-[9px] text-orange-400/60 font-mono">{size.toFixed(1)}</span>
              </div>
              <input type="range" min={0.1} max={5} step={0.1} value={size} onChange={(e) => setSize(parseFloat(e.target.value))} className="w-full accent-orange-500" />
            </div>
            <button onClick={handleApply} className="w-full text-[10px] px-2 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 rounded text-orange-400 font-semibold border border-orange-500/20">
              Add Fire
            </button>
          </div>
        </PopupCard>
      )}
    </div>
  );
}

// ─── Smoke Effect Popup ───
function SmokeControl({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { selectedIds, addEffect, addConsoleMessage } = useStudioStore();
  const [color, setColor] = useState('#888888');
  const [size, setSize] = useState(1);
  const [opacity, setOpacity] = useState(0.3);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleApply = () => {
    if (selectedIds.length === 0) {
      addConsoleMessage('warn', 'Select a part first to add Smoke');
      onClose();
      return;
    }
    selectedIds.forEach((id) => {
      addEffect(id, {
        id: `effect_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'Smoke',
        color,
        size,
        enabled: true,
        opacity,
      });
    });
    onClose();
  };

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton icon={<Cloud className="w-4 h-4" />} label="Smoke" active={open} onClick={onToggle} />
      {open && (
        <PopupCard className="min-w-[220px]" onClose={onClose} triggerRef={triggerRef}>
          <div className="space-y-2">
            <span className="text-[10px] text-gray-400 font-semibold">Smoke Effect</span>
            <div className="space-y-1">
              <span className="text-[9px] text-white/40">Color</span>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-6 rounded border border-white/10 cursor-pointer bg-transparent" />
                <span className="text-[9px] text-white/30 font-mono">{color}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Size</span>
                <span className="text-[9px] text-gray-400/60 font-mono">{size.toFixed(1)}</span>
              </div>
              <input type="range" min={0.1} max={5} step={0.1} value={size} onChange={(e) => setSize(parseFloat(e.target.value))} className="w-full accent-gray-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Opacity</span>
                <span className="text-[9px] text-gray-400/60 font-mono">{opacity.toFixed(2)}</span>
              </div>
              <input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="w-full accent-gray-500" />
            </div>
            <button onClick={handleApply} className="w-full text-[10px] px-2 py-1.5 bg-gray-500/20 hover:bg-gray-500/30 rounded text-gray-400 font-semibold border border-gray-500/20">
              Add Smoke
            </button>
          </div>
        </PopupCard>
      )}
    </div>
  );
}

// ─── Light Effect Popup ───
function LightControl({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { selectedIds, addEffect, addConsoleMessage } = useStudioStore();
  const [color, setColor] = useState('#ffffff');
  const [brightness, setBrightness] = useState(3);
  const [range, setRange] = useState(15);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleApply = () => {
    if (selectedIds.length === 0) {
      addConsoleMessage('warn', 'Select a part first to add Light');
      onClose();
      return;
    }
    selectedIds.forEach((id) => {
      addEffect(id, {
        id: `effect_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'Light',
        color,
        size: 1,
        enabled: true,
        brightness,
        range,
      });
    });
    onClose();
  };

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton icon={<Lightbulb className="w-4 h-4" />} label="Light" active={open} onClick={onToggle} />
      {open && (
        <PopupCard className="min-w-[220px]" onClose={onClose} triggerRef={triggerRef}>
          <div className="space-y-2">
            <span className="text-[10px] text-yellow-400 font-semibold">Light Effect</span>
            <div className="space-y-1">
              <span className="text-[9px] text-white/40">Color</span>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-6 rounded border border-white/10 cursor-pointer bg-transparent" />
                <span className="text-[9px] text-white/30 font-mono">{color}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Brightness</span>
                <span className="text-[9px] text-yellow-400/60 font-mono">{brightness.toFixed(1)}</span>
              </div>
              <input type="range" min={0.1} max={10} step={0.1} value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} className="w-full accent-yellow-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40">Range</span>
                <span className="text-[9px] text-yellow-400/60 font-mono">{range.toFixed(0)}</span>
              </div>
              <input type="range" min={1} max={60} step={1} value={range} onChange={(e) => setRange(parseFloat(e.target.value))} className="w-full accent-yellow-500" />
            </div>
            <button onClick={handleApply} className="w-full text-[10px] px-2 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 rounded text-yellow-400 font-semibold border border-yellow-500/20">
              Add Light
            </button>
          </div>
        </PopupCard>
      )}
    </div>
  );
}

// ─── Spawn Point Popup ───
function SpawnControl({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { addSpawnPoint, addConsoleMessage } = useStudioStore();
  const [team, setTeam] = useState('Neutral');
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleInsert = () => {
    addSpawnPoint({ team });
    addConsoleMessage('info', `SpawnLocation added (Team: ${team})`);
    onClose();
  };

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton icon={<MapPin className="w-4 h-4" />} label="Spawn" active={open} onClick={onToggle} />
      {open && (
        <PopupCard className="min-w-[220px]" onClose={onClose} triggerRef={triggerRef}>
          <div className="space-y-2">
            <span className="text-[10px] text-green-400 font-semibold">Spawn Location</span>
            <div className="space-y-1">
              <span className="text-[9px] text-white/40">Team</span>
              <div className="flex gap-1">
                {['Neutral', 'Blue', 'Red'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTeam(t)}
                    className={`flex-1 text-[9px] px-2 py-1 rounded border transition-colors ${
                      team === t
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleInsert} className="w-full text-[10px] px-2 py-1.5 bg-green-500/20 hover:bg-green-500/30 rounded text-green-400 font-semibold border border-green-500/20">
              Insert Spawn Point
            </button>
          </div>
        </PopupCard>
      )}
    </div>
  );
}

// ─── Globals Control (Universal Variables & Timers) ───
function GlobalsControl({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { globalVariables, setGlobalVariable, deleteGlobalVariable, globalTimers, addGlobalTimer, updateGlobalTimer, deleteGlobalTimer, addConsoleMessage } = useStudioStore();
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('0');
  const [newTimerName, setNewTimerName] = useState('');
  const [newTimerInterval, setNewTimerInterval] = useState('1');
  const [newTimerRepeat, setNewTimerRepeat] = useState<'once' | 'every'>('every');
  const [tab, setTab] = useState<'variables' | 'timers'>('variables');
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleAddVariable = () => {
    if (!newVarName.trim()) return;
    // Try to parse as number, otherwise treat as string
    const numVal = Number(newVarValue);
    const value = !isNaN(numVal) && newVarValue.trim() !== '' ? numVal : newVarValue;
    setGlobalVariable(newVarName.trim(), value);
    addConsoleMessage('info', `Global variable "${newVarName.trim()}" = ${value}`);
    setNewVarName('');
    setNewVarValue('0');
  };

  const handleAddTimer = () => {
    if (!newTimerName.trim()) return;
    addGlobalTimer({
      id: `timer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: newTimerName.trim(),
      interval: parseFloat(newTimerInterval) || 1,
      repeat: newTimerRepeat,
      enabled: true,
    });
    addConsoleMessage('info', `Global timer "${newTimerName.trim()}" added (${newTimerRepeat}, every ${newTimerInterval}s)`);
    setNewTimerName('');
    setNewTimerInterval('1');
  };

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton icon={<Globe className="w-4 h-4" />} label="Globals" active={open} onClick={onToggle} />
      {open && (
        <PopupCard className="min-w-[300px] max-h-[400px] overflow-y-auto" onClose={onClose} triggerRef={triggerRef}>
          <div className="space-y-3">
            <span className="text-[10px] text-violet-400 font-semibold">Globals — Universal Variables & Timers</span>

            {/* Tab switcher */}
            <div className="flex gap-1 border-b border-white/10 pb-1">
              <button
                onClick={() => setTab('variables')}
                className={`flex-1 text-[9px] px-2 py-1 rounded-t transition-colors ${
                  tab === 'variables' ? 'bg-violet-500/20 text-violet-400 border-b-2 border-violet-400' : 'text-white/40 hover:text-white/60'
                }`}
              >
                Variables ({Object.keys(globalVariables).length})
              </button>
              <button
                onClick={() => setTab('timers')}
                className={`flex-1 text-[9px] px-2 py-1 rounded-t transition-colors ${
                  tab === 'timers' ? 'bg-violet-500/20 text-violet-400 border-b-2 border-violet-400' : 'text-white/40 hover:text-white/60'
                }`}
              >
                Timers ({globalTimers.length})
              </button>
            </div>

            {tab === 'variables' && (
              <>
                {/* Existing variables */}
                {Object.entries(globalVariables).length === 0 && (
                  <div className="text-[9px] text-white/30 text-center py-2">No variables yet</div>
                )}
                {Object.entries(globalVariables).map(([name, value]) => (
                  <div key={name} className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded">
                    <Variable className="w-3 h-3 text-violet-400/60" />
                    <span className="text-[10px] text-white/70 flex-1 font-mono">{name}</span>
                    <span className="text-[10px] text-violet-400 font-mono">= {String(value)}</span>
                    <button
                      onClick={() => { deleteGlobalVariable(name); addConsoleMessage('info', `Deleted variable "${name}"`); }}
                      className="text-white/30 hover:text-red-400 transition-colors"
                    >
                      <MinusCircle className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {/* Add new variable */}
                <div className="space-y-1 pt-1 border-t border-white/10">
                  <span className="text-[9px] text-white/40">Add Variable</span>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      placeholder="Name"
                      className="flex-1 text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70 placeholder:text-white/20"
                    />
                    <input
                      type="text"
                      value={newVarValue}
                      onChange={(e) => setNewVarValue(e.target.value)}
                      placeholder="Value"
                      className="w-16 text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70 placeholder:text-white/20"
                    />
                  </div>
                  <button onClick={handleAddVariable} className="w-full text-[9px] px-2 py-1 bg-violet-500/20 hover:bg-violet-500/30 rounded text-violet-400 font-semibold border border-violet-500/20">
                    + Add Variable
                  </button>
                </div>
              </>
            )}

            {tab === 'timers' && (
              <>
                {/* Existing timers */}
                {globalTimers.length === 0 && (
                  <div className="text-[9px] text-white/30 text-center py-2">No timers yet</div>
                )}
                {globalTimers.map((timer) => (
                  <div key={timer.id} className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded">
                    <Timer className="w-3 h-3 text-violet-400/60" />
                    <span className="text-[10px] text-white/70 flex-1 font-mono">{timer.name}</span>
                    <span className="text-[9px] text-violet-400/60">{timer.repeat === 'every' ? `Every ${timer.interval}s` : `After ${timer.interval}s`}</span>
                    <button
                      onClick={() => updateGlobalTimer(timer.id, { enabled: !timer.enabled })}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${timer.enabled ? 'text-green-400 bg-green-500/10' : 'text-white/30 bg-white/5'}`}
                    >
                      {timer.enabled ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() => { deleteGlobalTimer(timer.id); addConsoleMessage('info', `Deleted timer "${timer.name}"`); }}
                      className="text-white/30 hover:text-red-400 transition-colors"
                    >
                      <MinusCircle className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {/* Add new timer */}
                <div className="space-y-1 pt-1 border-t border-white/10">
                  <span className="text-[9px] text-white/40">Add Timer</span>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newTimerName}
                      onChange={(e) => setNewTimerName(e.target.value)}
                      placeholder="Timer name"
                      className="flex-1 text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70 placeholder:text-white/20"
                    />
                    <input
                      type="number"
                      value={newTimerInterval}
                      onChange={(e) => setNewTimerInterval(e.target.value)}
                      placeholder="Sec"
                      min={0.1}
                      step={0.1}
                      className="w-14 text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70"
                    />
                  </div>
                  <div className="flex gap-1">
                    {(['every', 'once'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setNewTimerRepeat(mode)}
                        className={`flex-1 text-[9px] px-2 py-1 rounded border transition-colors ${
                          newTimerRepeat === mode
                            ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                            : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {mode === 'every' ? 'Repeating' : 'Once'}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleAddTimer} className="w-full text-[9px] px-2 py-1 bg-violet-500/20 hover:bg-violet-500/30 rounded text-violet-400 font-semibold border border-violet-500/20">
                    + Add Timer
                  </button>
                </div>
              </>
            )}
          </div>
        </PopupCard>
      )}
    </div>
  );
}

// ─── Scale Tool ───
// Simple toolbar button — just activates the Scale tool. The interactive
// face handles appear on the selected part in the 3D viewport (see
// FaceScaleHandles in Viewport3D.tsx). No popup needed.
function ScaleControl() {
  const { activeTool, setActiveTool } = useStudioStore();
  const isActive = activeTool === 'Scale';
  return (
    <ToolButton
      icon={<Maximize2 className="w-4 h-4" />}
      label="Scale"
      active={isActive}
      onClick={() => setActiveTool('Scale')}
    />
  );
}

// ─── Script Editor Popup ───
function ScriptControl({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { addConsoleMessage, objects, updateObject, addEffect } = useStudioStore();
  const triggerRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState(`// WeildCreate Script (Read-Only Sandbox)
// API Reference:
// game.findPart(name) - find a part by name (read-only)
// game.getAllParts() - get array of all parts (read-only)
// game.onTouch(partName, callback) - register touch handler
// print(msg) - output to console
// wait(seconds) - pause execution (max 5s total runtime)
// Part properties: .position, .size, .color, .transparency, .anchored, .name

print("Hello from WeildCreate!");

// Example: Find a part
let spawn = game.findPart("SpawnLocation");
if (spawn) {
  print("Found spawn at: " + JSON.stringify(spawn.position));
}

// Example: List all parts
let allParts = game.getAllParts();
print("Total parts: " + allParts.length);

// Example: Delayed action
// wait(2);
// print("2 seconds later!");
`);

  const handleRun = async () => {
    addConsoleMessage('info', '--- Script execution started ---');

    // 5-second timeout for script execution
    const SCRIPT_TIMEOUT_MS = 5000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Script timed out (5s limit)')), SCRIPT_TIMEOUT_MS);
    });

    try {
      // Create a READ-ONLY view of the store — no mutation methods exposed
      const getReadOnlyStore = () => {
        const state = useStudioStore.getState();
        // Build a read-only snapshot of objects (Map → array of plain objects)
        const readOnlyObjects: any[] = [];
        state.objects.forEach((obj) => {
          if (isPart(obj)) {
            readOnlyObjects.push({
              id: obj.id,
              name: obj.name,
              type: obj.type,
              position: { ...obj.position },
              size: { ...obj.size },
              color: obj.color,
              anchored: obj.anchored,
              transparency: obj.transparency,
              material: obj.material,
            });
          }
        });
        return {
          objects: readOnlyObjects,
          selectedIds: [...state.selectedIds],
        };
      };

      const game = {
        findPart: (name: string) => {
          const store = getReadOnlyStore();
          return store.objects.find((obj: any) => obj.name === name) || null;
        },
        getAllParts: () => {
          const store = getReadOnlyStore();
          return store.objects;
        },
        onTouch: (partName: string, callback: (partName: string) => void) => {
          addConsoleMessage('info', `[Script] onTouch registered for "${partName}" - will trigger during play mode`);
          if (!(window as any).__weildTouchHandlers) (window as any).__weildTouchHandlers = {};
          (window as any).__weildTouchHandlers[partName] = callback;
        },
      };

      const print = (msg: any) => addConsoleMessage('info', `[Script] ${String(msg)}`);
      const wait = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

      // Execute as async function with timeout
      const asyncFn = new Function('game', 'print', 'wait', `return (async () => { ${code} })()`);
      await Promise.race([asyncFn(game, print, wait), timeoutPromise]);
      addConsoleMessage('success', '--- Script execution completed ---');
    } catch (e: any) {
      // Try to extract line number from error
      let lineInfo = '';
      if (e.stack) {
        const lineMatch = e.stack.match(/<anonymous>:(\d+):(\d+)/);
        if (lineMatch) {
          // Subtract 2 because the async wrapper adds 2 lines at the top
          const line = parseInt(lineMatch[1]) - 2;
          const col = parseInt(lineMatch[2]);
          lineInfo = ` (line ${line}, col ${col})`;
        }
      }
      addConsoleMessage('error', `Script error: ${e.message}${lineInfo}`);
    } finally {
      clearTimeout(timeoutId);
    }
    onClose();
  };

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton icon={<Terminal className="w-4 h-4" />} label="Script" active={open} onClick={onToggle} />
      {open && (
        <PopupCard className="min-w-[420px]" onClose={onClose} triggerRef={triggerRef}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cyan-400 font-semibold">Script Editor</span>
              <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-3 h-3" /></button>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-56 bg-[#1a1a2a] border border-white/10 rounded p-2 text-[10px] font-mono text-white/80 resize-none focus:outline-none focus:border-cyan-500/30"
              spellCheck={false}
            />
            <div className="flex gap-2">
              <button onClick={handleRun} className="flex-1 text-[10px] px-2 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded text-cyan-400 font-semibold border border-cyan-500/20">
                ▶ Run Script
              </button>
              <button onClick={onClose} className="text-[10px] px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-white/40 border border-white/10">
                Cancel
              </button>
            </div>
          </div>
        </PopupCard>
      )}
    </div>
  );
}

// ─── BodyForce Popup ───
function BodyForceControl({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { selectedIds, addBodyMover, addConsoleMessage } = useStudioStore();
  const [forceX, setForceX] = useState(0);
  const [forceY, setForceY] = useState(9.81);
  const [forceZ, setForceZ] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleApply = () => {
    if (selectedIds.length === 0) {
      addConsoleMessage('warn', 'Select a part first');
      onClose();
      return;
    }
    selectedIds.forEach((id) => {
      addBodyMover(id, {
        id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'BodyForce',
        enabled: true,
        force: { x: forceX, y: forceY, z: forceZ },
      });
    });
    addConsoleMessage('info', `BodyForce added: (${forceX}, ${forceY}, ${forceZ})`);
    onClose();
  };

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton icon={<Zap className="w-4 h-4" />} label="BodyForce" active={open} onClick={onToggle} />
      {open && (
        <PopupCard className="min-w-[220px]" onClose={onClose} triggerRef={triggerRef}>
          <div className="space-y-2">
            <span className="text-[10px] text-red-400 font-semibold">BodyForce</span>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-red-400 w-3">X</span>
                <input type="number" step={1} value={forceX} onChange={(e) => setForceX(parseFloat(e.target.value) || 0)} className="w-full h-5 text-[9px] bg-white/5 border border-white/10 text-white px-1" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-green-400 w-3">Y</span>
                <input type="number" step={1} value={forceY} onChange={(e) => setForceY(parseFloat(e.target.value) || 0)} className="w-full h-5 text-[9px] bg-white/5 border border-white/10 text-white px-1" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-blue-400 w-3">Z</span>
                <input type="number" step={1} value={forceZ} onChange={(e) => setForceZ(parseFloat(e.target.value) || 0)} className="w-full h-5 text-[9px] bg-white/5 border border-white/10 text-white px-1" />
              </div>
            </div>
            <button onClick={handleApply} className="w-full text-[10px] px-2 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 font-semibold border border-red-500/20">
              Apply BodyForce
            </button>
          </div>
        </PopupCard>
      )}
    </div>
  );
}

// ─── Terrain Settings Popup Card ───
// ─── Brush Size / Strength Controls ───
// Inline ribbon controls for adjusting the active brush's size and strength.
// Both render as a small button that opens a tiny popup with a slider.

function BrushSizeControl() {
  const { brushSettings, setBrushSettings } = useStudioStore();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton
        icon={<Maximize2 className="w-4 h-4" />}
        label={`Size ${brushSettings.size.toFixed(0)}`}
        active={open}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <PopupCard className="min-w-[200px]" onClose={() => setOpen(false)} triggerRef={triggerRef}>
          <div className="space-y-2">
            <span className="text-[10px] text-emerald-400 font-semibold">Brush Size</span>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white/40">Radius (world units)</span>
              <span className="text-[9px] text-emerald-400/70 font-mono">{brushSettings.size.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={0.5}
              value={brushSettings.size}
              onChange={(e) => setBrushSettings({ size: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 h-1"
            />
            <div className="flex gap-1 pt-1">
              {([2, 6, 12, 20].map((s) => (
                <button
                  key={s}
                  onClick={() => setBrushSettings({ size: s })}
                  className="flex-1 text-[9px] px-1 py-1 bg-white/5 hover:bg-emerald-500/20 rounded text-white/60 hover:text-emerald-400 border border-white/10 transition-colors"
                >
                  {s}
                </button>
              )))}
            </div>
          </div>
        </PopupCard>
      )}
    </div>
  );
}

function BrushStrengthControl() {
  const { brushSettings, setBrushSettings } = useStudioStore();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton
        icon={<Activity className="w-4 h-4" />}
        label={`Str ${(brushSettings.strength * 100).toFixed(0)}%`}
        active={open}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <PopupCard className="min-w-[200px]" onClose={() => setOpen(false)} triggerRef={triggerRef}>
          <div className="space-y-2">
            <span className="text-[10px] text-emerald-400 font-semibold">Brush Strength</span>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white/40">Per-stroke intensity</span>
              <span className="text-[9px] text-emerald-400/70 font-mono">{(brushSettings.strength * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={brushSettings.strength}
              onChange={(e) => setBrushSettings({ strength: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 h-1"
            />
            <div className="flex gap-1 pt-1">
              {([0.1, 0.3, 0.6, 1.0].map((s) => (
                <button
                  key={s}
                  onClick={() => setBrushSettings({ strength: s })}
                  className="flex-1 text-[9px] px-1 py-1 bg-white/5 hover:bg-emerald-500/20 rounded text-white/60 hover:text-emerald-400 border border-white/10 transition-colors"
                >
                  {(s * 100).toFixed(0)}%
                </button>
              )))}
            </div>
            {/* Flatten target height (only visible when flatten brush is active) */}
            {brushSettings.type === 'flatten' && (
              <div className="pt-2 border-t border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-white/40">Flatten target height</span>
                  <span className="text-[9px] text-emerald-400/70 font-mono">{brushSettings.targetHeight?.toFixed(1) ?? '0'}</span>
                </div>
                <input
                  type="range"
                  min={-10}
                  max={30}
                  step={0.5}
                  value={brushSettings.targetHeight ?? 0}
                  onChange={(e) => setBrushSettings({ targetHeight: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 h-1"
                />
              </div>
            )}
          </div>
        </PopupCard>
      )}
    </div>
  );
}

// ─── Paint Color Control ───
// Inline ribbon control for the Paint brush's color. Shows the current color
// as the button's background; click to open a popup with a color picker.

function PaintColorControl() {
  const { brushPaintColor, setBrushPaintColor, setBrushSettings, brushSettings } = useStudioStore();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Quick-swatch palette
  const swatches = ['#ff6600', '#ff0000', '#00ff00', '#0088ff', '#ffff00', '#ff00ff', '#ffffff', '#000000', '#8b7355', '#4a7c3f'];

  return (
    <div className="relative" ref={triggerRef}>
      {/* Button shows the current paint color as a swatch */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded transition-colors hover:bg-white/5 ${open ? 'bg-white/5' : ''}`}
        title={`Paint color: ${brushPaintColor}`}
      >
        <div
          className="w-6 h-6 rounded border-2 border-white/20"
          style={{ backgroundColor: brushPaintColor }}
        />
        <span className="text-[8px] text-white/40">Color</span>
      </button>
      {open && (
        <PopupCard className="min-w-[240px]" onClose={() => setOpen(false)} triggerRef={triggerRef}>
          <div className="space-y-3">
            <span className="text-[10px] text-violet-400 font-semibold">Paint Color Picker</span>
            {/* Large color picker */}
            <div className="space-y-1">
              <span className="text-[9px] text-white/40">Pick any color:</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brushPaintColor}
                  onChange={(e) => {
                    setBrushPaintColor(e.target.value);
                    if (brushSettings.type === 'paint') {
                      setBrushSettings({ paintColor: e.target.value });
                    }
                  }}
                  className="w-16 h-10 rounded border border-white/10 cursor-pointer bg-transparent"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={brushPaintColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                        setBrushPaintColor(val);
                        if (brushSettings.type === 'paint' && val.length === 7) {
                          setBrushSettings({ paintColor: val });
                        }
                      }
                    }}
                    placeholder="#ff6600"
                    className="w-full text-[10px] px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white/70 font-mono"
                  />
                </div>
              </div>
            </div>
            {/* Quick swatches */}
            <div className="space-y-1">
              <span className="text-[9px] text-white/40">Quick swatches:</span>
              <div className="grid grid-cols-5 gap-1.5">
                {swatches.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setBrushPaintColor(c);
                      if (brushSettings.type === 'paint') {
                        setBrushSettings({ paintColor: c });
                      }
                    }}
                    className={`w-8 h-8 rounded border-2 hover:scale-110 transition-transform ${
                      brushPaintColor === c ? 'border-white' : 'border-white/10'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>
        </PopupCard>
      )}
    </div>
  );
}

// ─── Terrain & Water Settings (v2) ───
// Full settings popup for the rebuilt terrain system. Includes:
//   • Seed input + Generate button (Minecraft-style reproducible worldgen)
//   • Terrain height controls (base, amplitude, frequency, octaves, sea level)
//   • Size & scaling (grid dimensions, cell size)
//   • Global terrain & water color
//   • Per-water-body list with position, size, color, transparency, flow, current

function TerrainWaterSettingsControl({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const {
    terrainConfig, setTerrainConfig,
    terrainColor, setTerrainColor,
    waterColor, setWaterColor,
    waterBodies, addWaterBody, updateWaterBody, removeWaterBody,
    treeInstances, activeTreeVariant, setActiveTreeVariant,
    generateTerrain, scatterTrees, clearTrees,
    terrainLayers, updateTerrainLayer, addTerrainLayer, removeTerrainLayer,
    addConsoleMessage,
  } = useStudioStore();
  const triggerRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'terrain' | 'water' | 'trees'>('terrain');
  const [selectedWaterId, setSelectedWaterId] = useState<string | null>(null);

  const selectedWater = waterBodies.find((w) => w.id === selectedWaterId) ?? waterBodies[0] ?? null;

  return (
    <div className="relative" ref={triggerRef}>
      <ToolButton icon={<Settings className="w-4 h-4" />} label="Settings" active={open} onClick={onToggle} />
      {open && (
        <PopupCard className="min-w-[380px] max-h-[520px] overflow-y-auto" onClose={onClose} triggerRef={triggerRef}>
          <div className="space-y-3">
            <span className="text-[10px] text-emerald-400 font-semibold">Terrain &amp; Water Settings</span>

            {/* Tab switcher */}
            <div className="flex gap-1 border-b border-white/10 pb-1">
              {(['terrain', 'water', 'trees'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 text-[9px] px-2 py-1 rounded-t transition-colors ${
                    tab === t ? 'bg-emerald-500/20 text-emerald-400 border-b-2 border-emerald-400' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {t === 'terrain' ? `Terrain` : t === 'water' ? `Water (${waterBodies.length})` : `Trees (${treeInstances.length})`}
                </button>
              ))}
            </div>

            {/* ── Terrain Tab ── */}
            {tab === 'terrain' && (
              <>
                {/* Seed + Generate */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/40">Seed (reproducible world)</span>
                    <span className="text-[9px] text-emerald-400/70 font-mono">{terrainConfig.seed}</span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={terrainConfig.seed}
                      onChange={(e) => setTerrainConfig({ seed: parseInt(e.target.value) || 1 })}
                      className="flex-1 text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70"
                    />
                    <button
                      onClick={() => setTerrainConfig({ seed: Math.floor(Math.random() * 99999) + 1 })}
                      className="text-[9px] px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 rounded text-emerald-400 border border-emerald-500/20"
                    >
                      Random
                    </button>
                    <button
                      onClick={() => { generateTerrain(); addConsoleMessage('success', `Terrain generated from seed ${terrainConfig.seed}`); }}
                      className="text-[9px] px-2 py-1 bg-emerald-500/30 hover:bg-emerald-500/40 rounded text-emerald-300 border border-emerald-500/30 font-semibold"
                    >
                      Generate
                    </button>
                  </div>
                </div>

                {/* Preset quick-select */}
                <div className="space-y-1">
                  <span className="text-[9px] text-white/40">Preset</span>
                  <div className="flex gap-1">
                    {(['Nature', 'Mountain', 'Island', 'Field', 'Flat'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          // Apply preset defaults, then regenerate
                          const presetConfigs: Record<typeof p, Partial<typeof terrainConfig>> = {
                            Nature: { amplitude: 8, frequency: 0.05, baseHeight: 0, seaLevel: 1, octaves: 4, islandFalloff: 0 },
                            Mountain: { amplitude: 20, frequency: 0.04, baseHeight: 0, seaLevel: 0, octaves: 5, islandFalloff: 0 },
                            Island: { amplitude: 12, frequency: 0.06, baseHeight: -2, seaLevel: 0, octaves: 4, islandFalloff: 1 },
                            Field: { amplitude: 2, frequency: 0.03, baseHeight: 0, seaLevel: -10, octaves: 3, islandFalloff: 0 },
                            Flat: { amplitude: 0, frequency: 0.05, baseHeight: 0, seaLevel: -10, octaves: 1, islandFalloff: 0 },
                          };
                          setTerrainConfig({ preset: p, ...presetConfigs[p] });
                          generateTerrain();
                        }}
                        className={`flex-1 text-[8px] px-1.5 py-1 rounded border transition-colors ${
                          terrainConfig.preset === p
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Height controls */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/40">Base Height</span>
                    <span className="text-[9px] text-emerald-400/70 font-mono">{terrainConfig.baseHeight.toFixed(1)}</span>
                  </div>
                  <input type="range" min={-10} max={20} step={0.5} value={terrainConfig.baseHeight} onChange={(e) => setTerrainConfig({ baseHeight: parseFloat(e.target.value) })} className="w-full accent-emerald-500 h-1" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/40">Amplitude (height variation)</span>
                    <span className="text-[9px] text-emerald-400/70 font-mono">{terrainConfig.amplitude.toFixed(1)}</span>
                  </div>
                  <input type="range" min={0} max={40} step={0.5} value={terrainConfig.amplitude} onChange={(e) => setTerrainConfig({ amplitude: parseFloat(e.target.value) })} className="w-full accent-emerald-500 h-1" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/40">Frequency (noise scale)</span>
                    <span className="text-[9px] text-emerald-400/70 font-mono">{terrainConfig.frequency.toFixed(3)}</span>
                  </div>
                  <input type="range" min={0.01} max={0.3} step={0.005} value={terrainConfig.frequency} onChange={(e) => setTerrainConfig({ frequency: parseFloat(e.target.value) })} className="w-full accent-emerald-500 h-1" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/40">Octaves (detail layers)</span>
                    <span className="text-[9px] text-emerald-400/70 font-mono">{terrainConfig.octaves}</span>
                  </div>
                  <input type="range" min={1} max={6} step={1} value={terrainConfig.octaves} onChange={(e) => setTerrainConfig({ octaves: parseInt(e.target.value) })} className="w-full accent-emerald-500 h-1" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-white/40">Sea Level (water surface Y)</span>
                    <span className="text-[9px] text-cyan-400/70 font-mono">{terrainConfig.seaLevel}</span>
                  </div>
                  <input type="range" min={-10} max={20} step={1} value={terrainConfig.seaLevel} onChange={(e) => setTerrainConfig({ seaLevel: parseInt(e.target.value) })} className="w-full accent-cyan-500 h-1" />
                </div>

                {/* Size & scaling */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <span className="text-[10px] text-amber-400 font-semibold">Size &amp; Scaling</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[9px] text-white/40">Grid Width</span>
                      <input type="number" min={8} max={256} step={4} value={terrainConfig.width} onChange={(e) => setTerrainConfig({ width: Math.max(8, parseInt(e.target.value) || 64) })} className="w-full text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-white/40">Grid Length</span>
                      <input type="number" min={8} max={256} step={4} value={terrainConfig.length} onChange={(e) => setTerrainConfig({ length: Math.max(8, parseInt(e.target.value) || 64) })} className="w-full text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-white/40">Cell Size (units)</span>
                      <input type="number" min={0.5} max={8} step={0.5} value={terrainConfig.cellSize} onChange={(e) => setTerrainConfig({ cellSize: Math.max(0.5, parseFloat(e.target.value) || 2) })} className="w-full text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70" />
                    </div>
                    <div className="space-y-1 flex items-end">
                      <div className="text-[8px] text-white/30 leading-tight">
                        Total: {(terrainConfig.width * terrainConfig.cellSize).toFixed(0)} × {(terrainConfig.length * terrainConfig.cellSize).toFixed(0)} units
                      </div>
                    </div>
                  </div>
                </div>

                {/* Colors */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <span className="text-[10px] text-violet-400 font-semibold">Colors</span>
                  <div className="space-y-1">
                    <span className="text-[9px] text-white/40">Terrain Surface Color</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={terrainColor} onChange={(e) => setTerrainColor(e.target.value)} className="w-8 h-6 rounded border border-white/10 cursor-pointer bg-transparent" />
                      <span className="text-[9px] text-white/30 font-mono">{terrainColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-white/40">Default Water Color (new bodies)</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={waterColor} onChange={(e) => setWaterColor(e.target.value)} className="w-8 h-6 rounded border border-white/10 cursor-pointer bg-transparent" />
                      <span className="text-[9px] text-white/30 font-mono">{waterColor}</span>
                    </div>
                  </div>
                </div>

                {/* Terrain Layers — depth bands below the surface, each with its own color */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-amber-400 font-semibold">Terrain Layers</span>
                    <button
                      onClick={() => addTerrainLayer()}
                      className="text-[9px] px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded text-amber-400 border border-amber-500/20"
                    >
                      + Add Layer
                    </button>
                  </div>
                  <p className="text-[9px] text-white/30 leading-snug">
                    Layers are stacked below the surface. Each layer's color shows through when terrain is cut or viewed from the side.
                  </p>
                  {terrainLayers.map((layer, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded">
                      <input
                        type="color"
                        value={layer.color}
                        onChange={(e) => updateTerrainLayer(i, { color: e.target.value })}
                        className="w-6 h-6 rounded border border-white/10 cursor-pointer bg-transparent shrink-0"
                      />
                      <input
                        type="text"
                        value={layer.name}
                        onChange={(e) => updateTerrainLayer(i, { name: e.target.value })}
                        className="flex-1 min-w-0 text-[10px] px-1.5 py-1 bg-white/5 border border-white/10 rounded text-white/70"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[8px] text-white/40">Thick</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={layer.thickness}
                          onChange={(e) => updateTerrainLayer(i, { thickness: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-10 text-[10px] px-1 py-1 bg-white/5 border border-white/10 rounded text-white/70"
                        />
                      </div>
                      <button
                        onClick={() => removeTerrainLayer(i)}
                        className="text-white/30 hover:text-red-400 transition-colors shrink-0"
                        title="Remove layer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Water Tab ── */}
            {tab === 'water' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-cyan-400 font-semibold">Water Bodies</span>
                  <button
                    onClick={() => {
                      const id = addWaterBody();
                      setSelectedWaterId(id);
                    }}
                    className="text-[9px] px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 rounded text-cyan-400 border border-cyan-500/20"
                  >
                    + Add Water Body
                  </button>
                </div>

                {waterBodies.length === 0 && (
                  <div className="text-[10px] text-white/30 text-center py-4 bg-white/[0.02] rounded border border-white/5">
                    No water bodies yet. Click "Add Water Body" to create one.
                  </div>
                )}

                {/* Water body list */}
                {waterBodies.length > 0 && (
                  <div className="space-y-1 max-h-[80px] overflow-y-auto">
                    {waterBodies.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => setSelectedWaterId(w.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                          selectedWater?.id === w.id ? 'bg-cyan-500/15 border border-cyan-500/30' : 'bg-white/5 hover:bg-white/10 border border-transparent'
                        }`}
                      >
                        <Waves className="w-3 h-3 text-cyan-400/70 shrink-0" />
                        <span className="text-[10px] text-white/70 flex-1 truncate">{w.name}</span>
                        <span className="text-[9px] text-white/30">
                          {w.size.x.toFixed(0)}×{w.size.z.toFixed(0)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected water body editor */}
                {selectedWater && (
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={selectedWater.name}
                        onChange={(e) => updateWaterBody(selectedWater.id, { name: e.target.value })}
                        className="flex-1 text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded text-white/70"
                      />
                      <button
                        onClick={() => { removeWaterBody(selectedWater.id); setSelectedWaterId(null); }}
                        className="text-white/30 hover:text-red-400 transition-colors p-1"
                        title="Remove water body"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Position */}
                    <div className="grid grid-cols-3 gap-1">
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <div key={axis} className="space-y-0.5">
                          <span className="text-[8px] text-white/40 uppercase">Pos {axis}</span>
                          <input
                            type="number"
                            step={0.5}
                            value={selectedWater.position[axis]}
                            onChange={(e) => updateWaterBody(selectedWater.id, { position: { ...selectedWater.position, [axis]: parseFloat(e.target.value) || 0 } })}
                            className="w-full text-[10px] px-1.5 py-1 bg-white/5 border border-white/10 rounded text-white/70"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Size (width, depth, length) */}
                    <div className="grid grid-cols-3 gap-1">
                      {(['x', 'y', 'z'] as const).map((axis) => (
                        <div key={axis} className="space-y-0.5">
                          <span className="text-[8px] text-white/40 uppercase">{axis === 'y' ? 'Depth' : axis === 'x' ? 'Width' : 'Length'}</span>
                          <input
                            type="number"
                            step={0.5}
                            min={0.5}
                            value={selectedWater.size[axis]}
                            onChange={(e) => updateWaterBody(selectedWater.id, { size: { ...selectedWater.size, [axis]: Math.max(0.5, parseFloat(e.target.value) || 1) } })}
                            className="w-full text-[10px] px-1.5 py-1 bg-white/5 border border-white/10 rounded text-white/70"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Color + transparency */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-white/40">Color</span>
                      <div className="flex items-center gap-2">
                        <input type="color" value={selectedWater.color} onChange={(e) => updateWaterBody(selectedWater.id, { color: e.target.value })} className="w-8 h-6 rounded border border-white/10 cursor-pointer bg-transparent" />
                        <span className="text-[9px] text-white/30 font-mono">{selectedWater.color}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-white/40">Transparency (0=solid, 1=invisible)</span>
                        <span className="text-[9px] text-cyan-400/70 font-mono">{selectedWater.transparency.toFixed(2)}</span>
                      </div>
                      <input type="range" min={0} max={0.95} step={0.05} value={selectedWater.transparency} onChange={(e) => updateWaterBody(selectedWater.id, { transparency: parseFloat(e.target.value) })} className="w-full accent-cyan-500 h-1" />
                    </div>

                    {/* Flow direction */}
                    <div className="space-y-1">
                      <span className="text-[9px] text-white/40">Flow Direction</span>
                      <div className="grid grid-cols-4 gap-1">
                        {([
                          { label: '+X', v: { x: 1, y: 0, z: 0 } },
                          { label: '-X', v: { x: -1, y: 0, z: 0 } },
                          { label: '+Z', v: { x: 0, y: 0, z: 1 } },
                          { label: '-Z', v: { x: 0, y: 0, z: -1 } },
                        ]).map(({ label, v }) => {
                          const isActive = selectedWater.flowDirection.x === v.x && selectedWater.flowDirection.z === v.z;
                          return (
                            <button
                              key={label}
                              onClick={() => updateWaterBody(selectedWater.id, { flowDirection: v })}
                              className={`text-[9px] px-1 py-1 rounded border transition-colors ${
                                isActive ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Current strength */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-white/40">Current Strength</span>
                        <span className="text-[9px] text-cyan-400/70 font-mono">{(selectedWater.currentStrength * 100).toFixed(0)}%</span>
                      </div>
                      <input type="range" min={0} max={1} step={0.05} value={selectedWater.currentStrength} onChange={(e) => updateWaterBody(selectedWater.id, { currentStrength: parseFloat(e.target.value) })} className="w-full accent-cyan-500 h-1" />
                    </div>

                    {/* Wave amplitude */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-white/40">Wave Amplitude</span>
                        <span className="text-[9px] text-cyan-400/70 font-mono">{selectedWater.waveAmplitude.toFixed(2)}</span>
                      </div>
                      <input type="range" min={0} max={1} step={0.05} value={selectedWater.waveAmplitude} onChange={(e) => updateWaterBody(selectedWater.id, { waveAmplitude: parseFloat(e.target.value) })} className="w-full accent-cyan-500 h-1" />
                    </div>

                    {/* Enabled toggle */}
                    <button
                      onClick={() => updateWaterBody(selectedWater.id, { enabled: !selectedWater.enabled })}
                      className={`w-full text-[9px] px-2 py-1.5 rounded border transition-colors ${
                        selectedWater.enabled
                          ? 'bg-green-500/15 text-green-400 border-green-500/30'
                          : 'bg-white/5 text-white/40 border-white/10'
                      }`}
                    >
                      {selectedWater.enabled ? 'VISIBLE — click to hide' : 'HIDDEN — click to show'}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Trees Tab ── */}
            {tab === 'trees' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-green-400 font-semibold">Trees (blocky, stylized)</span>
                  <span className="text-[9px] text-white/30">{treeInstances.length} placed</span>
                </div>

                {/* Active variant selector (used by Place Tree tool) */}
                <div className="space-y-1">
                  <span className="text-[9px] text-white/40">Active Variant (for Place Tree tool)</span>
                  <div className="flex gap-1">
                    {(['oak', 'birch', 'pine', 'cactus'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setActiveTreeVariant(v)}
                        className={`flex-1 text-[9px] px-1.5 py-1 rounded border transition-colors capitalize ${
                          activeTreeVariant === v
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bulk actions */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => scatterTrees(20)}
                      className="text-[9px] px-2 py-1.5 bg-green-500/20 hover:bg-green-500/30 rounded text-green-400 border border-green-500/20"
                    >
                      Scatter 20
                    </button>
                    <button
                      onClick={() => scatterTrees(50)}
                      className="text-[9px] px-2 py-1.5 bg-green-500/20 hover:bg-green-500/30 rounded text-green-400 border border-green-500/20"
                    >
                      Scatter 50
                    </button>
                  </div>
                  <button
                    onClick={() => clearTrees()}
                    className="w-full text-[9px] px-2 py-1.5 bg-red-500/15 hover:bg-red-500/25 rounded text-red-400 border border-red-500/20"
                  >
                    Clear All Trees
                  </button>
                </div>

                {/* Tree list */}
                {treeInstances.length > 0 && (
                  <div className="pt-2 border-t border-white/10 space-y-1 max-h-[200px] overflow-y-auto">
                    {treeInstances.slice(0, 50).map((t) => (
                      <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded">
                        <TreeDeciduous className="w-3 h-3 text-green-400/60 shrink-0" />
                        <span className="text-[10px] text-white/70 flex-1 capitalize">{t.variant}</span>
                        <span className="text-[9px] text-white/30">
                          ({t.position.x.toFixed(1)}, {t.position.y.toFixed(1)}, {t.position.z.toFixed(1)})
                        </span>
                        <button
                          onClick={() => useStudioStore.getState().removeTree(t.id)}
                          className="text-white/30 hover:text-red-400 transition-colors"
                          title="Remove tree"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {treeInstances.length > 50 && (
                      <div className="text-[9px] text-white/30 text-center py-1">
                        +{treeInstances.length - 50} more…
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </PopupCard>
      )}
    </div>
  );
}

// ─── Reset Confirmation Dialog ───
function ResetConfirmDialog({ onClose }: { onClose: () => void }) {
  const { clearProject, addConsoleMessage, addBaseplate, addSpawnPoint } = useStudioStore();

  const handleReset = () => {
    clearProject();
    // Rebuild the baseplate and spawn point after clearing
    addBaseplate();
    addSpawnPoint();
    addConsoleMessage('info', 'Project reset — baseplate and spawn point restored');
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-[#1e293b] border border-white/10 rounded-lg shadow-2xl p-4 w-80 space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-400" />
          <h3 className="text-sm font-semibold text-white/90">Reset Universe</h3>
        </div>
        <p className="text-xs text-white/60">Are you sure? This will <strong className="text-red-400">permanently delete</strong> all objects, terrain, universes, scripts, rules, variables, timers, joints, and physics settings in this universe. The editor will return to its default state with only a baseplate and spawn point. <strong className="text-red-400">This action cannot be undone.</strong></p>
        <div className="flex gap-2">
          <button onClick={handleReset} className="flex-1 text-[10px] px-2 py-2 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 font-semibold border border-red-500/20">
            Reset Project
          </button>
          <button onClick={onClose} className="flex-1 text-[10px] px-2 py-2 bg-white/5 hover:bg-white/10 rounded text-white/60 border border-white/10">
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Publish Dialog ───
function PublishDialog({ onClose }: { onClose: () => void }) {
  const { addConsoleMessage } = useStudioStore();
  const [name, setName] = useState('My Game');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      // Use the WeildCreateStudio's onCreateGame callback via a custom event
      const event = new CustomEvent('weildcreate-publish', {
        detail: { name, description, isPublic },
      });
      window.dispatchEvent(event);
      addConsoleMessage('info', `Publishing "${name}"...`);
    } catch (e: any) {
      addConsoleMessage('error', `Publish failed: ${e.message}`);
    }
    setPublishing(false);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1e293b] border border-white/10 rounded-lg shadow-2xl p-4 w-80 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">Publish Game</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] text-white/40">Game Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-7 text-xs bg-white/5 border border-white/10 text-white px-2 rounded" />
        </div>
        <div className="space-y-1">
          <span className="text-[9px] text-white/40">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full h-16 text-xs bg-white/5 border border-white/10 text-white p-2 rounded resize-none" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="accent-indigo-500" />
          <span className="text-[10px] text-white/60">Public</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePublish} disabled={publishing} className="flex-1 text-[10px] px-2 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 rounded text-indigo-400 font-semibold border border-indigo-500/20 disabled:opacity-50">
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
          <button onClick={onClose} className="text-[10px] px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-white/40 border border-white/10">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Universes List (shown in File tab) ───
function UniversesList() {
  const { universes, currentUniverseId, switchUniverse, deleteUniverse, renameUniverse, addConsoleMessage } = useStudioStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const universesList = useMemo(() => {
    const list: UniverseData[] = [];
    universes.forEach((u) => list.push(u));
    return list;
  }, [universes]);

  const handleSwitch = (universeId: string) => {
    if (universeId === currentUniverseId) return;
    switchUniverse(universeId);
    addConsoleMessage('info', `Switched to universe "${universes.get(universeId)?.name}"`);
  };

  const handleStartRename = (universeId: string) => {
    const universe = universes.get(universeId);
    if (!universe) return;
    setEditingId(universeId);
    setEditName(universe.name);
  };

  const handleFinishRename = () => {
    if (editingId && editName.trim()) {
      renameUniverse(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = (universeId: string) => {
    if (universes.size <= 1) {
      addConsoleMessage('warn', 'Cannot delete the last universe');
      return;
    }
    if (universeId === currentUniverseId) {
      addConsoleMessage('warn', 'Cannot delete the active universe — switch to another first');
      return;
    }
    deleteUniverse(universeId);
    addConsoleMessage('info', `Universe deleted`);
  };

  return (
    <div className="flex flex-col gap-1 max-h-[64px] overflow-y-auto min-w-[140px]">
      {universesList.map((universe) => (
        <div
          key={universe.id}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer transition-colors ${
            universe.id === currentUniverseId
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          onClick={() => handleSwitch(universe.id)}
        >
          {editingId === universe.id ? (
            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingId(null); }}
                className="flex-1 h-4 text-[10px] bg-white/5 border border-white/10 text-white px-1 rounded"
                autoFocus
              />
              <button onClick={handleFinishRename} className="text-green-400 hover:text-green-300"><Check className="w-3 h-3" /></button>
            </div>
          ) : (
            <>
              <span className="flex-1 truncate">{universe.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleStartRename(universe.id); }}
                className="text-white/20 hover:text-white/60"
                title="Rename"
              >
                <Pencil className="w-3 h-3" />
              </button>
              {universes.size > 1 && universe.id !== currentUniverseId && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(universe.id); }}
                  className="text-white/20 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── New Universe Dialog ───
function NewUniverseDialog({ onClose }: { onClose: () => void }) {
  const { addUniverse, addBaseplate, addSpawnPoint, addConsoleMessage, universes } = useStudioStore();
  const [name, setName] = useState('New Universe');

  const maxUniverses = 3;
  const canCreate = universes.size < maxUniverses;

  const handleCreate = () => {
    if (!canCreate) {
      addConsoleMessage('warn', `Maximum ${maxUniverses} universes allowed — delete one first`);
      return;
    }
    // Save current scene to its universe, then create a new empty universe
    addUniverse(name);
    // Add a baseplate and spawn point using the proper store functions
    addBaseplate();
    addSpawnPoint();
    addConsoleMessage('success', `New universe "${name}" created — your previous scene has been saved`);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1e293b] border border-white/10 rounded-lg shadow-2xl p-4 w-72 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">New Universe</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] text-white/40">Universe Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-7 text-xs bg-white/5 border border-white/10 text-white px-2 rounded" disabled={!canCreate} />
        </div>
        {!canCreate ? (
          <p className="text-[9px] text-red-400/80">Maximum {maxUniverses} universes reached. Delete an existing universe to create a new one.</p>
        ) : (
          <p className="text-[9px] text-blue-400/70">Creates a new universe within your project ({universes.size}/{maxUniverses}). Your current scene will be saved and you can switch back to it anytime.</p>
        )}
        <div className="flex gap-2">
          <button onClick={handleCreate} disabled={!canCreate} className="flex-1 text-[10px] px-2 py-1.5 bg-violet-500/20 hover:bg-violet-500/30 rounded text-violet-400 font-semibold border border-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
            Create
          </button>
          <button onClick={onClose} className="text-[10px] px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-white/40 border border-white/10">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Load Published Game Dialog ───
function LoadPublishedDialog({ onClose }: { onClose: () => void }) {
  const { addConsoleMessage, loadProject } = useStudioStore();
  const { user } = useAuth();
  const [games, setGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [manualId, setManualId] = useState('');
  const [loadingGame, setLoadingGame] = useState(false);

  useEffect(() => {
    async function fetchGames() {
      try {
        const res = await fetch('/api/games');
        if (!res.ok) throw new Error('Failed to fetch games');
        const data = await res.json();
        const allGames = Array.isArray(data) ? data : [];
        // Filter to current user's games only
        const myGames = user ? allGames.filter((g: any) => g.creator === user.username) : [];
        setGames(myGames);
      } catch (e: any) {
        addConsoleMessage('error', `Failed to fetch games: ${e.message}`);
      }
      setLoadingGames(false);
    }
    fetchGames();
  }, [user]);

  const handleLoadGame = async (gameId: string) => {
    setLoadingGame(true);
    try {
      const res = await fetch(`/api/games?id=${gameId}`);
      if (!res.ok) throw new Error('Game not found');
      const game = await res.json();

      // ─── PRIMARY PATH: full studioState (1:1 restore) ───
      // The studioState snapshot is the SINGLE source of truth — it captures
      // every object (including character parts + baseplate), all joints,
      // world settings, terrain, WeildCode rules, etc. Using restoreStudioState
      // here means the editor reloads EXACTLY what was saved when the game
      // was published, including the Player folder and the baseplate grid.
      if (game.studioState && isValidStudioState(game.studioState as StudioProjectState)) {
        restoreStudioState(game.studioState as StudioProjectState);
        const objCount = (game.studioState as StudioProjectState).objects.length;
        addConsoleMessage('success', `Loaded published game: ${game.name || gameId} (${objCount} objects, full studio state)`);
        setLoadingGame(false);
        onClose();
        return;
      }

      // ─── LEGACY FALLBACK: primitives only (pre-studioState games) ───
      // Old games saved before the studioState fix only have a downgraded
      // `primitives` array. We can't recover character parts, baseplate flag,
      // joints, terrain, or WeildCode rules from this — only basic geometry.
      // We still explicitly skip 'player' shape_type primitives because
      // the legacy converter cannot reconstruct the Player folder structure.
      if (game.primitives) {
        const studioObjects: any[] = [];
        for (const prim of game.primitives) {
          if (prim.shape_type === 'player') continue;
          const color = Array.isArray(prim.color) && prim.color.length >= 3
            ? `#${Math.round(prim.color[0] * 255).toString(16).padStart(2, '0')}${Math.round(prim.color[1] * 255).toString(16).padStart(2, '0')}${Math.round(prim.color[2] * 255).toString(16).padStart(2, '0')}`
            : '#4a90d9';
          studioObjects.push({
            id: prim.id || `obj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: prim.name || 'Part',
            type: ({ block: 'Block', sphere: 'Sphere', wedge: 'Wedge', cylinder: 'Cylinder' } as any)[prim.shape_type] || 'Block',
            position: { x: prim.position?.[0] ?? 0, y: prim.position?.[1] ?? 0, z: prim.position?.[2] ?? 0 },
            size: { x: prim.size?.[0] ?? 4, y: prim.size?.[1] ?? 1, z: prim.size?.[2] ?? 4 },
            rotation: { x: prim.rotation?.[0] ?? 0, y: prim.rotation?.[1] ?? 0, z: prim.rotation?.[2] ?? 0 },
            color,
            material: ({ plastic: 'Plastic', neon: 'Neon', wood: 'Wood', metal: 'Metal', grass: 'Grass', sand: 'Sand', ice: 'Ice', slate: 'Slate' } as any)[prim.material || 'plastic'] || 'Plastic',
            transparency: prim.transparency ?? 0,
            reflectance: prim.reflectance ?? 0,
            anchored: prim.anchored ?? true,
            canCollide: true,
            friction: 0.5,
            elasticity: 0.2,
            density: 1.0,
            children: [],
            parentId: null,
            bodyMovers: [],
            effects: [],
            isSpawnPoint: prim.shape_type === 'spawn_point',
          });
        }
        loadProject({ objects: studioObjects });
        addConsoleMessage('warn', `Loaded legacy game (no studio state): ${game.name || gameId}. Player folder, baseplate grid, joints, terrain, and WeildCode rules are not available. Re-publish this game to capture the full state.`);
      } else {
        addConsoleMessage('warn', 'Game has no objects');
      }
    } catch (e: any) {
      addConsoleMessage('error', `Failed to load game: ${e.message}`);
    }
    setLoadingGame(false);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#1e293b] border border-white/10 rounded-lg shadow-2xl p-4 w-[420px] max-h-[70vh] flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">Load Published Game</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {/* User's published games list */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loadingGames ? (
            <div className="text-center py-6 text-white/40 text-xs">Loading your games...</div>
          ) : games.length === 0 ? (
            <div className="text-center py-6 text-white/40 text-xs">
              <p>No published games found.</p>
              <p className="mt-1 text-white/25">Publish a game from the File tab first!</p>
            </div>
          ) : (
            games.map((game: any) => (
              <div key={game.id} className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => handleLoadGame(game.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/90 truncate">{game.name || 'Untitled'}</p>
                    <p className="text-[10px] text-white/40 truncate">{game.description || 'No description'}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-[9px] text-white/30">{game.plays || 0} plays</span>
                    <button
                      disabled={loadingGame}
                      className="text-[10px] px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 rounded text-indigo-400 font-semibold border border-indigo-500/20 disabled:opacity-50"
                    >
                      {loadingGame ? '...' : 'Load'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Manual game ID fallback */}
        <div className="border-t border-white/10 pt-2 space-y-2">
          <span className="text-[9px] text-white/40">Or enter a Game ID manually:</span>
          <div className="flex gap-2">
            <input value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="Game ID..." className="flex-1 h-7 text-xs bg-white/5 border border-white/10 text-white px-2 rounded" />
            <button onClick={() => handleLoadGame(manualId)} disabled={loadingGame || !manualId.trim()} className="text-[10px] px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 rounded text-indigo-400 font-semibold border border-indigo-500/20 disabled:opacity-50">
              {loadingGame ? '...' : 'Load'}
            </button>
          </div>
        </div>

        <button onClick={onClose} className="text-[10px] px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-white/40 border border-white/10 w-full">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Ribbon Toolbar ───

export function RibbonToolbar() {
  const {
    activeTool, setActiveTool, activeTab, setActiveTab,
    addPart, duplicateSelected, deleteSelected, groupSelected, ungroupSelected,
    selectedIds, playState, showGrid, setShowGrid,
    snapToGrid, setSnapToGrid, addConsoleMessage, objects,
    physicsSettings, setPhysicsSettings, terrainSettings, setTerrainSettings,
    setShowTerrain, groupModeIds, setGroupModeIds, unionModeIds, setUnionModeIds, clearSelection,
    copySelected, cutSelected, pasteClipboard, clipboard,
    simulationState,
    showExplorer, setShowExplorer, showProperties, setShowProperties, showOutput, setShowOutput,
    showAxisGizmo, setShowAxisGizmo, showCharacterPreview, setShowCharacterPreview,
    startPlayMode, stopPlayMode, startTestPlayMode, startSimulationMode, stopSimulationMode,
    // Terrain v2 hooks
    terrainConfig, setTerrainConfig, brushSettings, setBrushSettings,
    brushPaintColor, setBrushPaintColor,
    terrainLayers, updateTerrainLayer, addTerrainLayer, removeTerrainLayer,
  } = useStudioStore();

  const { showTerrain: isTerrainShown } = useStudioStore();

  const anchoredCount = useMemo(() => {
    if (selectedIds.length === 0) return false;
    return selectedIds.every(id => {
      const obj = objects.get(id);
      return obj && 'anchored' in obj && obj.anchored;
    });
  }, [selectedIds, objects]);

  // ─── Mutual-exclusion popup state ───
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const materialTriggerRef = useRef<HTMLDivElement>(null);
  const colorTriggerRef = useRef<HTMLDivElement>(null);

  const openPopup = useCallback((name: string) => {
    setActivePopup((prev) => prev === name ? null : name);
  }, []);

  const closePopup = useCallback(() => {
    setActivePopup(null);
  }, []);

  // Escape key to close any open popup
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activePopup) {
        closePopup();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [activePopup, closePopup]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (playState.isPlaying) return; // Don't intercept during play mode

      const ctrl = e.ctrlKey || e.metaKey;

      // Clipboard shortcuts
      if (ctrl && e.key === 'c') { e.preventDefault(); copySelected(); return; }
      if (ctrl && e.key === 'x') { e.preventDefault(); cutSelected(); return; }
      if (ctrl && e.key === 'v') { e.preventDefault(); pasteClipboard(); return; }
      if (ctrl && e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }

      // Delete — handles both regular parts AND trees/water bodies (selected via explorer)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          // Check if any selected IDs are tree or water body entries (prefixed)
          let deletedSomething = false;
          selectedIds.forEach((id) => {
            if (id.startsWith('tree_')) {
              useStudioStore.getState().removeTree(id.slice(5));
              deletedSomething = true;
            } else if (id.startsWith('water_')) {
              useStudioStore.getState().removeWaterBody(id.slice(6));
              deletedSomething = true;
            }
          });
          // Also delete any regular parts
          const partIds = selectedIds.filter(id => !id.startsWith('tree_') && !id.startsWith('water_'));
          if (partIds.length > 0) {
            deleteSelected();
            deletedSomething = true;
          }
          if (deletedSomething) {
            useStudioStore.getState().clearSelection();
          }
        }
        return;
      }

      // Tool shortcuts (only when no modifier)
      if (!ctrl) {
        // Escape: first cancel Group/Union multi-select modes, then close popups
        if (e.key === 'Escape') {
          const s = useStudioStore.getState();
          if (s.activeTool === 'Group' || s.activeTool === 'Union') {
            s.setActiveTool('Select');
            s.setGroupModeIds([]);
            s.setUnionModeIds([]);
            addConsoleMessage('info', 'Multi-select cancelled');
            return;
          }
          closePopup();
          return;
        }
        // Enter: confirm Group/Union multi-select modes
        if (e.key === 'Enter') {
          const s = useStudioStore.getState();
          if (s.activeTool === 'Group' && s.groupModeIds.length >= 2) {
            // Re-run the Group click to confirm (it's already in Group mode)
            // Use a microtask to avoid React state batching issues with the keydown handler.
            handleGroupClick();
            e.preventDefault();
            return;
          }
          if (s.activeTool === 'Union' && s.unionModeIds.length >= 2) {
            handleUnionClick();
            e.preventDefault();
            return;
          }
        }
        if (e.key === 'q') { setActiveTool('Select'); clearSelection(); return; }
        if (e.key === 'e') { setActiveTool('Move'); return; }
        if (e.key === 'r') { setActiveTool('Rotate'); return; }
        if (e.key === 's' && !ctrl) { setActiveTool('Scale'); return; }
        if (e.key === 'g') { handleGroupClick(); return; }
        if (e.key === 'u') { handleUnionClick(); return; }
        if (e.key === 'f') {
          // Focus on selection
          if (selectedIds.length > 0) {
            const obj = objects.get(selectedIds[0]);
            if (obj && 'position' in obj) {
              addConsoleMessage('info', `Focused on ${'name' in obj ? obj.name : 'object'}`);
            }
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copySelected, cutSelected, pasteClipboard, duplicateSelected, deleteSelected, selectedIds, objects, playState.isPlaying, clearSelection, setActiveTool, addConsoleMessage, closePopup, groupModeIds, unionModeIds, activeTool]);

  // ─── Play / Test / Simulate Handlers ───
  // These use the atomic store functions. The key design principle:
  // On STOP, we call weildCodeEngine.stop() FIRST (synchronous, cancels its rAF),
  // then the store's stopPlayMode()/stopSimulationMode() which sets isPlaying=false
  // BEFORE restoring the snapshot — so no useFrame loop can overwrite restored state.

  const handlePlay = () => {
    if (playState.isPlaying) {
      // Stop play mode — stop engine first, then atomic store stop
      weildCodeEngine.stop();
      stopPlayMode();
      addConsoleMessage('info', 'Stopped play mode — state restored');
    } else {
      // Stop simulation if active before starting play mode (mutual exclusion)
      if (simulationState.isSimulating) {
        stopSimulationMode();
      }

      startPlayMode();
      addConsoleMessage('info', 'Playing — Physics active! Unanchored parts will respond to gravity.');
    }
  };

  const handleTestPlay = () => {
    if (playState.isPlaying) {
      // Stop play mode — stop engine first, then atomic store stop
      weildCodeEngine.stop();
      stopPlayMode();
      addConsoleMessage('info', 'Stopped test play — state restored');
      return;
    }

    // Stop simulation if active before starting test play (mutual exclusion)
    if (simulationState.isSimulating) {
      stopSimulationMode();
    }

    // Find spawn point: check for spawn point parts first, then worldSettings
    const { objects: currentObjects, worldSettings } = useStudioStore.getState();
    let spawnPos = { ...worldSettings.spawnPointPosition };
    currentObjects.forEach((obj) => {
      if (isPart(obj) && obj.isSpawnPoint) {
        spawnPos = { x: obj.position.x, y: obj.position.y + 1, z: obj.position.z };
      }
    });

    startTestPlayMode(spawnPos);
    addConsoleMessage('info', 'Test Play — Physics + Character active! Use WASD to move, Space to jump.');
  };

  const handleSimulate = () => {
    if (simulationState.isSimulating) {
      // Stop simulation — atomic store stop
      stopSimulationMode();
      addConsoleMessage('info', 'Simulation stopped — state restored');
    } else {
      // Stop play mode if active before starting simulation (mutual exclusion)
      if (playState.isPlaying) {
        weildCodeEngine.stop();
        stopPlayMode();
      }

      startSimulationMode();
      addConsoleMessage('info', 'Simulation started — unanchored parts will respond to gravity');
    }
  };

  const handleSaveToComputer = () => {
    const state = useStudioStore.getState();
    const data = {
      version: 1,
      objects: Array.from(state.objects.values()),
      joints: state.joints,
      terrainSettings: state.terrainSettings,
      worldSettings: state.worldSettings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weildcreate-project.json';
    a.click();
    URL.revokeObjectURL(url);
    addConsoleMessage('info', 'Project saved to computer');
  };

  const handleLoadFromComputer = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.objects) {
            useStudioStore.getState().loadProject({ objects: data.objects });
            addConsoleMessage('success', `Loaded project: ${data.objects.length} objects`);
          }
        } catch (err: any) {
          addConsoleMessage('error', `Failed to load: ${err.message}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const tabs: { id: StudioTab; label: string }[] = [
    { id: 'File', label: 'File' },
    { id: 'Home', label: 'Home' },
    { id: 'Model', label: 'Model' },
    { id: 'Terrain', label: 'Terrain' },
    { id: 'Test', label: 'Test' },
    { id: 'View', label: 'View' },
  ];

  const hasSelection = selectedIds.length > 0;
  const multiSelected = selectedIds.length > 1;

  // Handle Group click — if multiple items are selected, group them directly;
  // otherwise enter Group tool mode for incremental selection
  const handleGroupClick = () => {
    if (activeTool === 'Group') {
      // Confirm group
      if (groupModeIds.length >= 2) {
        // Set selection to group mode ids, then group
        const store = useStudioStore.getState();
        store.selectObject(null); // Clear first
        groupModeIds.forEach((id) => store.selectObject(id, true));
        // Now group the selected items
        store.groupSelected();
      }
      setActiveTool('Select');
      setGroupModeIds([]);
    } else if (selectedIds.length >= 2) {
      // Multiple items already selected — group them directly
      groupSelected();
      addConsoleMessage('info', `Grouped ${selectedIds.length} objects`);
    } else {
      // No multi-selection — enter Group tool mode for incremental selection
      setActiveTool('Group');
      // Start with current selection
      setGroupModeIds([...selectedIds]);
      clearSelection();
      addConsoleMessage('info', 'Group mode: Click parts to add, Enter to confirm, Escape to cancel');
    }
  };

  // Perform the actual union operation on an array of part ids.
  // Replaces the parts with a single bounding-box block that visually represents
  // the union. (WeildBuild solid modeling is approximate — we use a bounding box,
  // not true CSG, for performance and to keep the engine simple.)
  const performUnion = useCallback((partIds: string[]) => {
    const state = useStudioStore.getState();
    const parts = partIds
      .map((id) => state.objects.get(id))
      .filter((o): o is StudioPart => !!o && isPart(o));
    if (parts.length < 2) {
      addConsoleMessage('warn', 'Select at least 2 parts to Union');
      return;
    }
    // Compute bounding box of all selected parts
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    parts.forEach((p) => {
      const hw = p.size.x / 2, hh = p.size.y / 2, hd = p.size.z / 2;
      minX = Math.min(minX, p.position.x - hw); maxX = Math.max(maxX, p.position.x + hw);
      minY = Math.min(minY, p.position.y - hh); maxY = Math.max(maxY, p.position.y + hh);
      minZ = Math.min(minZ, p.position.z - hd); maxZ = Math.max(maxZ, p.position.z + hd);
    });
    // Remove original parts, create union block
    partIds.forEach((id) => state.removeObject(id));
    state.addPart('Block');
    const newId = useStudioStore.getState().selectedIds[0];
    if (newId) {
      useStudioStore.getState().updateObject(newId, {
        position: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
        size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
        color: parts[0].color,
        material: parts[0].material,
        name: `Union_${parts.length}`,
      });
      addConsoleMessage('success', `Union created from ${parts.length} parts`);
    }
  }, [addConsoleMessage]);

  // Handle Union click — mirrors handleGroupClick UX: if 2+ parts are selected,
  // union them immediately; otherwise enter Union tool mode for incremental selection.
  const handleUnionClick = () => {
    if (activeTool === 'Union') {
      // Confirm union
      if (unionModeIds.length >= 2) {
        performUnion([...unionModeIds]);
      }
      setActiveTool('Select');
      setUnionModeIds([]);
    } else if (selectedIds.length >= 2) {
      performUnion([...selectedIds]);
    } else {
      // Enter Union tool mode for incremental selection (same UX as Group)
      setActiveTool('Union');
      setUnionModeIds([...selectedIds]);
      clearSelection();
      addConsoleMessage('info', 'Union mode: Click parts to add, Enter to confirm, Escape to cancel');
    }
  };

  return (
    <div className="border-b" style={{ background: 'var(--wb-bg-card-solid)', borderColor: 'var(--wb-border-subtle)' }} data-ribbon-toolbar>
      {/* Tab bar */}
      <div className="flex items-center border-b border-white/5">
        <div className="flex items-center px-2 py-1 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-400 border-b-2 border-indigo-400 bg-white/[0.02]'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {/* Undo/Redo buttons */}
          <div className="ml-auto flex items-center gap-1 px-2">
            <button
              onClick={() => useStudioStore.getState().undo()}
              disabled={useStudioStore.getState().undoStack.length === 0}
              className="p-1.5 rounded hover:bg-white/5 text-white/40 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => useStudioStore.getState().redo()}
              disabled={useStudioStore.getState().redoStack.length === 0}
              className="p-1.5 rounded hover:bg-white/5 text-white/40 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Ribbon content — popups render via fixed positioning above the toolbar */}
      <div className="relative flex items-start px-2 py-2 gap-1 overflow-x-auto">
        {/* File Tab */}
        {activeTab === 'File' && (
          <>
            <RibbonGroup label="Save">
              <ToolButton icon={<Globe className="w-4 h-4" />} label="Publish" onClick={() => openPopup('publish')} />
              <ToolButton icon={<Save className="w-4 h-4" />} label="Save" onClick={handleSaveToComputer} />
              <ToolButton icon={<Upload className="w-4 h-4" />} label="Load" onClick={handleLoadFromComputer} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Project">
              <ToolButton icon={<FilePlus className="w-4 h-4" />} label="New" onClick={() => openPopup('newUniverse')} />
              <ToolButton icon={<Globe className="w-4 h-4" />} label="Published" onClick={() => openPopup('loadPublished')} />
              <ToolButton icon={<Trash2 className="w-4 h-4" />} label="Reset" onClick={() => openPopup('resetConfirm')} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Universes">
              <UniversesList />
            </RibbonGroup>
          </>
        )}

        {/* Home Tab */}
        {activeTab === 'Home' && (
          <>
            <RibbonGroup label="Clipboard">
              <ToolButton icon={<ClipboardPaste className="w-4 h-4" />} label="Paste" active={!!clipboard} onClick={() => pasteClipboard()} />
              <ToolButton icon={<Copy className="w-4 h-4" />} label="Copy" active={false} onClick={() => copySelected()} />
              <ToolButton icon={<Scissors className="w-4 h-4" />} label="Cut" active={false} onClick={() => { if (hasSelection) cutSelected(); }} />
              <ToolButton icon={<Files className="w-4 h-4" />} label="Dupe" active={false} onClick={() => duplicateSelected()} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Tools">
              <ToolButton icon={<MousePointer2 className="w-4 h-4" />} label="Select" active={activeTool === 'Select'} onClick={() => setActiveTool('Select')} />
              <ToolButton icon={<Move className="w-4 h-4" />} label="Move" active={activeTool === 'Move'} onClick={() => setActiveTool('Move')} />
              <ScaleControl />
              <ToolButton icon={<RotateCcw className="w-4 h-4" />} label="Rotate" active={activeTool === 'Rotate'} onClick={() => setActiveTool('Rotate')} />
              <ToolButton icon={<Trash2 className="w-4 h-4" />} label="Delete" active={activeTool === 'Delete'} onClick={() => setActiveTool('Delete')} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Insert">
              <PartDropdown open={activePopup === 'parts'} onToggle={() => openPopup('parts')} onClose={closePopup} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Edit">
              <div className="relative" ref={materialTriggerRef}>
                <ToolButton icon={<PaintBucket className="w-4 h-4" />} label="Material" active={activePopup === 'material'} onClick={() => openPopup('material')} />
                {activePopup === 'material' && (
                  <PopupCard onClose={closePopup} triggerRef={materialTriggerRef}>
                    <MaterialPicker onClose={closePopup} />
                  </PopupCard>
                )}
              </div>
              <div className="relative" ref={colorTriggerRef}>
                <ToolButton icon={<Palette className="w-4 h-4" />} label="Color" active={activePopup === 'color'} onClick={() => openPopup('color')} />
                {activePopup === 'color' && (
                  <PopupCard onClose={closePopup} triggerRef={colorTriggerRef}>
                    <ColorPicker onClose={closePopup} />
                  </PopupCard>
                )}
              </div>
              <ToolButton icon={<FolderTree className="w-4 h-4" />} label="Group" active={activeTool === 'Group'} onClick={handleGroupClick} />
              <ToolButton icon={<TreePine className="w-4 h-4" />} label="Ungroup" onClick={() => {
                // Only ungroup if a group (StudioModel) is selected
                const hasGroupSelected = selectedIds.some(id => {
                  const obj = objects.get(id);
                  return obj && !isPart(obj) && 'children' in obj;
                });
                if (hasGroupSelected) {
                  ungroupSelected();
                  addConsoleMessage('info', 'Ungrouped selection');
                } else {
                  addConsoleMessage('warn', 'Select a group to ungroup');
                }
              }} />
              <ToolButton icon={<Lock className="w-4 h-4" />} label="Anchor" active={anchoredCount} onClick={() => {
                selectedIds.forEach((id) => {
                  const obj = objects.get(id);
                  if (obj && 'anchored' in obj) {
                    useStudioStore.getState().updateObject(id, { anchored: !obj.anchored } as any);
                  }
                });
              }} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Test">
              <ToolButton
                icon={playState.isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                label={playState.isPlaying ? 'Stop' : 'Play'}
                active={playState.isPlaying}
                onClick={handlePlay}
                size="md"
              />
            </RibbonGroup>
          </>
        )}

        {/* Model Tab */}
        {activeTab === 'Model' && (
          <>
            <RibbonGroup label="Tools">
              <ToolButton icon={<MousePointer2 className="w-4 h-4" />} label="Select" active={activeTool === 'Select'} onClick={() => setActiveTool('Select')} />
              <ToolButton icon={<Move className="w-4 h-4" />} label="Move" active={activeTool === 'Move'} onClick={() => setActiveTool('Move')} />
              <ScaleControl />
              <ToolButton icon={<RotateCcw className="w-4 h-4" />} label="Rotate" active={activeTool === 'Rotate'} onClick={() => setActiveTool('Rotate')} />
              <ToolButton icon={<Trash2 className="w-4 h-4" />} label="Delete" active={activeTool === 'Delete'} onClick={() => setActiveTool('Delete')} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Parts">
              <PartDropdown open={activePopup === 'parts'} onToggle={() => openPopup('parts')} onClose={closePopup} />
              <div className="relative" ref={materialTriggerRef}>
                <ToolButton icon={<PaintBucket className="w-4 h-4" />} label="Material" active={activePopup === 'material'} onClick={() => openPopup('material')} />
                {activePopup === 'material' && (
                  <PopupCard onClose={closePopup} triggerRef={materialTriggerRef}>
                    <MaterialPicker onClose={closePopup} />
                  </PopupCard>
                )}
              </div>
              <div className="relative" ref={colorTriggerRef}>
                <ToolButton icon={<Palette className="w-4 h-4" />} label="Color" active={activePopup === 'color'} onClick={() => openPopup('color')} />
                {activePopup === 'color' && (
                  <PopupCard onClose={closePopup} triggerRef={colorTriggerRef}>
                    <ColorPicker onClose={closePopup} />
                  </PopupCard>
                )}
              </div>
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Solid Modeling">
              <ToolButton icon={<Merge className="w-4 h-4" />} label="Union" active={activeTool === 'Union'} onClick={handleUnionClick} />
              <ToolButton icon={<GitBranch className="w-4 h-4" />} label="Negate" onClick={() => {
                if (selectedIds.length !== 1) {
                  addConsoleMessage('warn', 'Select exactly 1 part to negate');
                  return;
                }
                const state = useStudioStore.getState();
                const obj = state.objects.get(selectedIds[0]);
                if (!obj || !('type' in obj)) return;
                const part = obj as StudioPart;
                // Negate: make the part transparent and disable collisions (acts as a cutout).
                // Store the pre-negate color/transparency so De-negate can fully restore them.
                state.updateObject(selectedIds[0], {
                  transparency: 0.8,
                  canCollide: false,
                  color: '#ff0000',
                  negated: true,
                  preNegateColor: part.color,
                  preNegateTransparency: part.transparency,
                } as Partial<StudioPart>);
                addConsoleMessage('info', `Negated "${part.name}" — it now acts as a cutout (transparent, no collision). Use De-negate to revert.`);
              }} />
              <ToolButton icon={<RotateCcw className="w-4 h-4" />} label="De-negate" onClick={() => {
                if (selectedIds.length !== 1) {
                  addConsoleMessage('warn', 'Select exactly 1 part to de-negate');
                  return;
                }
                const state = useStudioStore.getState();
                const obj = state.objects.get(selectedIds[0]);
                if (!obj || !('type' in obj)) return;
                const part = obj as StudioPart;
                if (!part.negated) {
                  addConsoleMessage('warn', `"${part.name}" is not negated — nothing to de-negate`);
                  return;
                }
                // Restore pre-negate state. If pre-negate values are missing (e.g. part was
                // negated before this feature existed), fall back to sensible defaults.
                state.updateObject(selectedIds[0], {
                  transparency: part.preNegateTransparency ?? 0,
                  canCollide: true,
                  color: part.preNegateColor ?? part.color,
                  negated: false,
                  preNegateColor: undefined,
                  preNegateTransparency: undefined,
                } as Partial<StudioPart>);
                addConsoleMessage('success', `De-negated "${part.name}" — restored original color, transparency, and collisions`);
              }} />
              <ToolButton icon={<Split className="w-4 h-4" />} label="Separate" onClick={() => {
                if (selectedIds.length !== 1) {
                  addConsoleMessage('warn', 'Select exactly 1 part to separate');
                  return;
                }
                const state = useStudioStore.getState();
                const obj = state.objects.get(selectedIds[0]);
                if (!obj || !('type' in obj)) return;
                const part = obj as StudioPart;
                // Separate: split a part into 2 halves along the longest axis.
                // Preserves the original part type (Block/Sphere/Wedge/Cylinder) —
                // previously this always created a Block, which dropped the shape.
                const longest = part.size.x >= part.size.y && part.size.x >= part.size.z ? 'x' :
                                part.size.y >= part.size.z ? 'y' : 'z';
                const halfSize = { ...part.size };
                halfSize[longest] = part.size[longest] / 2;
                const offset = part.size[longest] / 4;
                // Update original to half
                state.updateObject(selectedIds[0], { size: halfSize, position: {
                  x: part.position.x + (longest === 'x' ? -offset : 0),
                  y: part.position.y + (longest === 'y' ? -offset : 0),
                  z: part.position.z + (longest === 'z' ? -offset : 0),
                }});
                // Create second half — use the SAME type as the original part so the shape
                // is preserved (was previously hardcoded to 'Block').
                state.addPart(part.type);
                const newPartId = useStudioStore.getState().selectedIds[0];
                if (newPartId) {
                  useStudioStore.getState().updateObject(newPartId, {
                    size: halfSize,
                    position: {
                      x: part.position.x + (longest === 'x' ? offset : 0),
                      y: part.position.y + (longest === 'y' ? offset : 0),
                      z: part.position.z + (longest === 'z' ? offset : 0),
                    },
                    color: part.color,
                    material: part.material,
                  });
                  addConsoleMessage('success', `Separated "${part.name}" into 2 ${part.type} parts along ${longest.toUpperCase()} axis`);
                }
              }} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Constraints">
              <ToolButton icon={<Link className="w-4 h-4" />} label="Weld" onClick={() => {
                if (hasSelection) {
                  selectedIds.forEach(id => useStudioStore.getState().makeJoints(id));
                }
              }} />
              <ToolButton icon={<Activity className="w-4 h-4" />} label="Motor" onClick={() => {
                if (selectedIds.length < 2) {
                  addConsoleMessage('warn', 'Select at least 2 parts to create a motor joint');
                  return;
                }
                // Create motor joints between consecutive selected parts (chain)
                const state = useStudioStore.getState();
                for (let i = 0; i < selectedIds.length - 1; i++) {
                  const partA = state.objects.get(selectedIds[i]);
                  const partB = state.objects.get(selectedIds[i + 1]);
                  if (!partA || !partB) continue;
                  const posA = isPart(partA) ? partA.position : { x: 0, y: 0, z: 0 };
                  const posB = isPart(partB) ? partB.position : { x: 0, y: 0, z: 0 };
                  const joint: Joint = {
                    id: `joint_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    type: 'Motor',
                    partAId: selectedIds[i],
                    partBId: selectedIds[i + 1],
                    enabled: true,
                    C0: { x: 0, y: 0, z: 0 },
                    C1: {
                      x: posB.x - posA.x,
                      y: posB.y - posA.y,
                      z: posB.z - posA.z,
                    },
                    motorSpeed: 5,
                    motorMaxTorque: 10,
                  };
                  state.addJoint(joint);
                }
                addConsoleMessage('success', `Motor joint(s) created for ${selectedIds.length} parts (speed: 5, torque: 10)`);
              }} />
              <ToolButton icon={<Link className="w-4 h-4" />} label="Rope" onClick={() => {
                if (selectedIds.length < 2) {
                  addConsoleMessage('warn', 'Select at least 2 parts to create a rope');
                  return;
                }
                // Create rope joints between consecutive selected parts (chain)
                const state = useStudioStore.getState();
                for (let i = 0; i < selectedIds.length - 1; i++) {
                  const partA = state.objects.get(selectedIds[i]);
                  const partB = state.objects.get(selectedIds[i + 1]);
                  if (!partA || !partB) continue;
                  const posA = isPart(partA) ? partA.position : { x: 0, y: 0, z: 0 };
                  const posB = isPart(partB) ? partB.position : { x: 0, y: 0, z: 0 };
                  const joint: Joint = {
                    id: `joint_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    type: 'Rope',
                    partAId: selectedIds[i],
                    partBId: selectedIds[i + 1],
                    enabled: true,
                    C0: { x: 0, y: 0, z: 0 },
                    C1: {
                      x: posB.x - posA.x,
                      y: posB.y - posA.y,
                      z: posB.z - posA.z,
                    },
                    motorMaxTorque: 5, // Rope length in meters
                  };
                  state.addJoint(joint);
                }
                addConsoleMessage('info', `Rope joint(s) created for ${selectedIds.length} parts (length: 5m)`);
              }} />
              <ToolButton icon={<Unlink className="w-4 h-4" />} label="Untie" onClick={() => {
                // Untie: remove ONLY rope joints attached to the selected parts.
                // (Break removes all joint types — Weld, Motor, Rope, etc. — which is
                // destructive when you just want to detach a rope.)
                if (!hasSelection) {
                  addConsoleMessage('warn', 'Select at least 1 part to untie');
                  return;
                }
                const state = useStudioStore.getState();
                let total = 0;
                selectedIds.forEach((id) => {
                  total += state.removeJointsOfType(id, 'Rope');
                });
                if (total === 0) {
                  addConsoleMessage('info', 'No rope joints found on the selected part(s)');
                } else {
                  addConsoleMessage('success', `Removed ${total} rope joint(s)`);
                }
              }} />
              <ToolButton icon={<Unlink className="w-4 h-4" />} label="Break" onClick={() => {
                if (hasSelection) {
                  selectedIds.forEach(id => useStudioStore.getState().breakJoints(id));
                }
              }} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Gameplay">
              <ExplosionControl open={activePopup === 'explosion'} onToggle={() => openPopup('explosion')} onClose={closePopup} />
              <FireControl open={activePopup === 'fire'} onToggle={() => openPopup('fire')} onClose={closePopup} />
              <SmokeControl open={activePopup === 'smoke'} onToggle={() => openPopup('smoke')} onClose={closePopup} />
              <LightControl open={activePopup === 'light'} onToggle={() => openPopup('light')} onClose={closePopup} />
              <SpawnControl open={activePopup === 'spawn'} onToggle={() => openPopup('spawn')} onClose={closePopup} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Advanced">
              <GlobalsControl open={activePopup === 'globals'} onToggle={() => openPopup('globals')} onClose={closePopup} />
              <ToolButton icon={<Variable className="w-4 h-4" />} label="Vars" onClick={() => openPopup('globals')} />
            </RibbonGroup>
          </>
        )}

        {/* Terrain Tab — fully rebuilt with brush tools, water bodies, and trees */}
        {activeTab === 'Terrain' && (
          <>
            <RibbonGroup label="Terrain">
              <ToolButton
                icon={<Mountain className="w-4 h-4" />}
                label={isTerrainShown ? 'Hide' : 'Generate'}
                active={isTerrainShown}
                onClick={() => {
                  // First click: generate terrain from current config. Subsequent clicks: toggle visibility.
                  const state = useStudioStore.getState();
                  if (!state.terrainHeightmap) {
                    state.generateTerrain();
                  } else {
                    state.setShowTerrain(!isTerrainShown);
                    addConsoleMessage('info', isTerrainShown ? 'Terrain hidden' : 'Terrain shown');
                  }
                }}
              />
              <ToolButton
                icon={<RefreshCw className="w-4 h-4" />}
                label="Regen"
                onClick={() => {
                  // Re-generate from the current config + seed (useful after editing the heightmap)
                  useStudioStore.getState().generateTerrain();
                }}
              />
              <TerrainWaterSettingsControl open={activePopup === 'terrainSettings'} onToggle={() => openPopup('terrainSettings')} onClose={closePopup} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Brushes">
              <ToolButton
                icon={<ArrowUp className="w-4 h-4" />}
                label="Raise"
                active={activeTool === 'BrushRaise'}
                onClick={() => { setActiveTool('BrushRaise'); setBrushSettings({ type: 'raise' }); addConsoleMessage('info', 'Raise brush active — click or drag on terrain'); }}
              />
              <ToolButton
                icon={<ArrowDown className="w-4 h-4" />}
                label="Lower"
                active={activeTool === 'BrushLower'}
                onClick={() => { setActiveTool('BrushLower'); setBrushSettings({ type: 'lower' }); addConsoleMessage('info', 'Lower brush active — click or drag on terrain'); }}
              />
              <ToolButton
                icon={<Waves className="w-4 h-4" />}
                label="Smooth"
                active={activeTool === 'BrushSmooth'}
                onClick={() => { setActiveTool('BrushSmooth'); setBrushSettings({ type: 'smooth' }); addConsoleMessage('info', 'Smooth brush active — click or drag on terrain'); }}
              />
              <ToolButton
                icon={<Grid3X3 className="w-4 h-4" />}
                label="Flatten"
                active={activeTool === 'BrushFlatten'}
                onClick={() => { setActiveTool('BrushFlatten'); setBrushSettings({ type: 'flatten' }); addConsoleMessage('info', 'Flatten brush active — click or drag on terrain'); }}
              />
              <ToolButton
                icon={<Eraser className="w-4 h-4" />}
                label="Erode"
                active={activeTool === 'BrushErode'}
                onClick={() => { setActiveTool('BrushErode'); setBrushSettings({ type: 'erode' }); addConsoleMessage('info', 'Erode brush active — click or drag on terrain'); }}
              />
              <ToolButton
                icon={<Sparkles className="w-4 h-4" />}
                label="Sculpt"
                active={activeTool === 'BrushSculpt'}
                onClick={() => { setActiveTool('BrushSculpt'); setBrushSettings({ type: 'sculpt' }); addConsoleMessage('info', 'Sculpt brush active — sharp detail raise'); }}
              />
              <ToolButton
                icon={<Palette className="w-4 h-4" />}
                label="Paint"
                active={activeTool === 'BrushPaint'}
                onClick={() => {
                  setActiveTool('BrushPaint');
                  setBrushSettings({ type: 'paint', paintColor: brushPaintColor });
                  addConsoleMessage('info', `Paint brush active — painting terrain with ${brushPaintColor}`);
                }}
              />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Brush Size">
              <BrushSizeControl />
              <BrushStrengthControl />
              <PaintColorControl />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Water">
              <ToolButton
                icon={<Waves className="w-4 h-4" />}
                label="Add Water"
                onClick={() => {
                  useStudioStore.getState().addWaterBody();
                }}
              />
              <ToolButton
                icon={<ArrowDown className="w-4 h-4" />}
                label="Flow"
                onClick={() => {
                  // Cycle flow direction on the FIRST water body (the most common case).
                  // Per-body flow is editable in the Terrain & Water Settings popup.
                  const state = useStudioStore.getState();
                  if (state.waterBodies.length === 0) {
                    addConsoleMessage('warn', 'Add a water body first');
                    return;
                  }
                  const body = state.waterBodies[0];
                  const d = body.flowDirection;
                  const next = d.x > 0 ? { x: 0, y: 0, z: 1 } :
                               d.z > 0 ? { x: -1, y: 0, z: 0 } :
                               d.x < 0 ? { x: 0, y: 0, z: -1 } :
                               { x: 1, y: 0, z: 0 };
                  state.updateWaterBody(body.id, { flowDirection: next });
                  addConsoleMessage('info', `Water flow → (${next.x}, ${next.y}, ${next.z})`);
                }}
              />
              <ToolButton
                icon={<Activity className="w-4 h-4" />}
                label="Current"
                onClick={() => {
                  // Cycle current strength on the FIRST water body
                  const state = useStudioStore.getState();
                  if (state.waterBodies.length === 0) {
                    addConsoleMessage('warn', 'Add a water body first');
                    return;
                  }
                  const body = state.waterBodies[0];
                  const next = (body.currentStrength + 0.2) % 1.0;
                  state.updateWaterBody(body.id, { currentStrength: next });
                  addConsoleMessage('info', `Water current strength: ${next.toFixed(2)}`);
                }}
              />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Trees">
              <ToolButton
                icon={<TreeDeciduous className="w-4 h-4" />}
                label="Place Tree"
                active={activeTool === 'PlaceTree'}
                onClick={() => { setActiveTool('PlaceTree'); addConsoleMessage('info', 'Tree placement tool — click on terrain to drop a tree'); }}
              />
              <ToolButton
                icon={<Sparkles className="w-4 h-4" />}
                label="Scatter"
                onClick={() => {
                  // Scatter 20 random trees across the terrain
                  useStudioStore.getState().scatterTrees(20);
                }}
              />
              <ToolButton
                icon={<Trash2 className="w-4 h-4" />}
                label="Clear"
                onClick={() => {
                  useStudioStore.getState().clearTrees();
                }}
              />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Presets">
              <ToolButton icon={<TreeDeciduous className="w-4 h-4" />} label="Nature" active={terrainConfig.preset === 'Nature'} onClick={() => {
                setTerrainConfig({ preset: 'Nature', amplitude: 8, frequency: 0.05, baseHeight: 0, seaLevel: 1, octaves: 4, islandFalloff: 0 });
                useStudioStore.getState().generateTerrain();
                addConsoleMessage('info', 'Nature preset applied — rolling hills');
              }} />
              <ToolButton icon={<Mountain className="w-4 h-4" />} label="Mountain" active={terrainConfig.preset === 'Mountain'} onClick={() => {
                setTerrainConfig({ preset: 'Mountain', amplitude: 20, frequency: 0.04, baseHeight: 0, seaLevel: 0, octaves: 5, islandFalloff: 0 });
                useStudioStore.getState().generateTerrain();
                addConsoleMessage('info', 'Mountain preset applied — tall peaks');
              }} />
              <ToolButton icon={<Waves className="w-4 h-4" />} label="Island" active={terrainConfig.preset === 'Island'} onClick={() => {
                setTerrainConfig({ preset: 'Island', amplitude: 12, frequency: 0.06, baseHeight: -2, seaLevel: 0, octaves: 4, islandFalloff: 1 });
                useStudioStore.getState().generateTerrain();
                addConsoleMessage('info', 'Island preset applied — surrounded by water');
              }} />
              <ToolButton icon={<Grid3X3 className="w-4 h-4" />} label="Field" active={terrainConfig.preset === 'Field'} onClick={() => {
                setTerrainConfig({ preset: 'Field', amplitude: 2, frequency: 0.03, baseHeight: 0, seaLevel: -10, octaves: 3, islandFalloff: 0 });
                useStudioStore.getState().generateTerrain();
                addConsoleMessage('info', 'Field preset applied — nearly flat, good for building');
              }} />
              <ToolButton icon={<Box className="w-4 h-4" />} label="Flat" active={terrainConfig.preset === 'Flat'} onClick={() => {
                setTerrainConfig({ preset: 'Flat', amplitude: 0, frequency: 0.05, baseHeight: 0, seaLevel: -10, octaves: 1, islandFalloff: 0 });
                useStudioStore.getState().generateTerrain();
                addConsoleMessage('info', 'Flat preset applied — completely flat ground');
              }} />
            </RibbonGroup>
          </>
        )}

        {/* Test Tab */}
        {activeTab === 'Test' && (
          <>
            <RibbonGroup label="Play">
              <ToolButton
                icon={playState.isPlaying ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                label={playState.isPlaying ? 'Stop' : 'Play'}
                active={playState.isPlaying}
                onClick={handlePlay}
                size="md"
              />
              <ToolButton
                icon={<Play className="w-4 h-4" />}
                label="Test Play"
                onClick={handleTestPlay}
              />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Physics">
              <GravityControl open={activePopup === 'gravity'} onToggle={() => openPopup('gravity')} onClose={closePopup} />
              <ToolButton
                icon={<Zap className="w-4 h-4" />}
                label="Collisions"
                active={physicsSettings.collisionsEnabled}
                onClick={() => {
                  setPhysicsSettings({ collisionsEnabled: !physicsSettings.collisionsEnabled });
                  addConsoleMessage('info', `Collisions ${!physicsSettings.collisionsEnabled ? 'enabled' : 'disabled'}`);
                }}
              />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Forces">
              <ExplosionControl open={activePopup === 'explosion'} onToggle={() => openPopup('explosion')} onClose={closePopup} />
              <BodyForceControl open={activePopup === 'bodyForce'} onToggle={() => openPopup('bodyForce')} onClose={closePopup} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Info">
              <ToolButton icon={<Wrench className="w-4 h-4" />} label="Stats" onClick={() => {
                const partCount = Array.from(objects.values()).filter(o => 'type' in o).length;
                const unanchored = Array.from(objects.values()).filter(o => 'anchored' in o && !o.anchored).length;
                addConsoleMessage('info', `Physics Stats: ${partCount} parts, ${unanchored} unanchored, Gravity: ${physicsSettings.gravity.toFixed(1)}`);
              }} />
            </RibbonGroup>
          </>
        )}

        {/* View Tab */}
        {activeTab === 'View' && (
          <>
            <RibbonGroup label="Display">
              <ToolButton icon={<Grid3X3 className="w-4 h-4" />} label="Grid" active={showGrid} onClick={() => setShowGrid(!showGrid)} />
              <ToolButton icon={<Magnet className="w-4 h-4" />} label="Snap" active={snapToGrid} onClick={() => setSnapToGrid(!snapToGrid)} />
              <ToolButton icon={<Compass className="w-4 h-4" />} label="Axis" active={showAxisGizmo} onClick={() => setShowAxisGizmo(!showAxisGizmo)} />
              <ToolButton icon={<User className="w-4 h-4" />} label="Character" active={showCharacterPreview} onClick={() => setShowCharacterPreview(!showCharacterPreview)} />
            </RibbonGroup>
            <Separator />
            <RibbonGroup label="Panels">
              <ToolButton icon={<Search className="w-4 h-4" />} label="Explorer" active={showExplorer} onClick={() => setShowExplorer(!showExplorer)} />
              <ToolButton icon={<Palette className="w-4 h-4" />} label="Properties" active={showProperties} onClick={() => setShowProperties(!showProperties)} />
              <ToolButton icon={<Terminal className="w-4 h-4" />} label="Output" active={showOutput} onClick={() => setShowOutput(!showOutput)} />
            </RibbonGroup>
          </>
        )}
      </div>

      {/* Publish dialog */}
      {activePopup === 'publish' && <PublishDialog onClose={closePopup} />}

      {/* Reset confirmation dialog */}
      {activePopup === 'resetConfirm' && <ResetConfirmDialog onClose={closePopup} />}

      {/* New Universe dialog */}
      {activePopup === 'newUniverse' && <NewUniverseDialog onClose={closePopup} />}

      {/* Load Published dialog */}
      {activePopup === 'loadPublished' && <LoadPublishedDialog onClose={closePopup} />}
    </div>
  );
}

