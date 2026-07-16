'use client';

import { useStudioStore, isPart, StudioPart } from '@/lib/studio-store';
import {
  WeildCodeRule,
  WeildCodeAction,
  TriggerType,
  ActionType,
  TRIGGER_DEFINITIONS,
  ACTION_DEFINITIONS,
  createBlankRule,
  createBlankAction,
  ruleToAdvancedCode,
  parseAdvancedCode,
} from '@/lib/weildcode-types';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Play,
  Code,
  MousePointer,
  ToggleLeft,
  ToggleRight,
  Zap,
  Copy,
  GripVertical,
  Hand,
  Clock,
  RefreshCw,
  Sun,
  Cloud,
  Move,
  RotateCcw,
  Maximize2,
  Palette,
  PaintBucket,
  Eye,
  Flame,
  Volume2,
  Sparkles,
  Repeat,
  Timer,
  MessageSquare,
  MousePointerClick,
  Box,
  Circle,
  Triangle,
  Cylinder,
  Type,
  Check,
  Globe,
  MapPin,
  Heart,
  Skull,
  Lightbulb,
  CloudRain,
  Wind,
} from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// ─── Icon helpers — replace emojis with proper Lucide icons ───

function TriggerIcon({ icon, className = 'w-3.5 h-3.5' }: { icon: string; className?: string }) {
  switch (icon) {
    case 'Plus': return <Plus className={className} />;
    case 'MousePointerClick': return <MousePointerClick className={className} />;
    case 'Hand': return <Hand className={className} />;
    case 'Trash2': return <Trash2 className={className} />;
    case 'Clock': return <Clock className={className} />;
    case 'RefreshCw': return <RefreshCw className={className} />;
    case 'Sun': return <Sun className={className} />;
    case 'Cloud': return <Cloud className={className} />;
    case 'Variable': return <Box className={className} />;
    case 'Check': return <Check className={className} />;
    case 'Zap': return <Zap className={className} />;
    default: return <Zap className={className} />;
  }
}

function ActionIcon({ icon, className = 'w-3.5 h-3.5' }: { icon: string; className?: string }) {
  switch (icon) {
    case 'Plus': return <Plus className={className} />;
    case 'Trash2': return <Trash2 className={className} />;
    case 'X': return <Trash2 className={className} />;
    case 'Move': return <Move className={className} />;
    case 'RotateCcw': return <RotateCcw className={className} />;
    case 'Maximize2': return <Maximize2 className={className} />;
    case 'Palette': return <Palette className={className} />;
    case 'PaintBucket': return <PaintBucket className={className} />;
    case 'Eye': return <Eye className={className} />;
    case 'Zap': return <Zap className={className} />;
    case 'Flame': return <Flame className={className} />;
    case 'Clock': return <Clock className={className} />;
    case 'Volume2': return <Volume2 className={className} />;
    case 'Sparkles': return <Sparkles className={className} />;
    case 'Repeat': return <Repeat className={className} />;
    case 'Timer': return <Timer className={className} />;
    case 'MessageSquare': return <MessageSquare className={className} />;
    case 'Type': return <Type className={className} />;
    case 'Variable': return <Box className={className} />;
    case 'Copy': return <Copy className={className} />;
    case 'Globe': return <Globe className={className} />;
    case 'MapPin': return <MapPin className={className} />;
    case 'Heart': return <Heart className={className} />;
    case 'Skull': return <Skull className={className} />;
    case 'Lightbulb': return <Lightbulb className={className} />;
    case 'CloudRain': return <CloudRain className={className} />;
    case 'Wind': return <Wind className={className} />;
    case 'Cloud': return <Cloud className={className} />;
    default: return <Zap className={className} />;
  }
}

// Color map for trigger/action icon accents
const TRIGGER_ICON_COLOR: Record<string, string> = {
  Plus: 'text-emerald-400/70',
  MousePointerClick: 'text-blue-400/70',
  Hand: 'text-violet-400/70',
  Trash2: 'text-red-400/70',
  Clock: 'text-amber-400/70',
  RefreshCw: 'text-cyan-400/70',
  Sun: 'text-yellow-400/70',
  Cloud: 'text-sky-400/70',
  Variable: 'text-violet-400/70',
  Check: 'text-green-400/70',
  Zap: 'text-yellow-400/70',
};

const ACTION_ICON_COLOR: Record<string, string> = {
  Plus: 'text-emerald-400/70',
  Trash2: 'text-red-400/60',
  X: 'text-red-300/60',
  Move: 'text-blue-400/60',
  RotateCcw: 'text-cyan-400/60',
  Maximize2: 'text-indigo-400/60',
  Palette: 'text-pink-400/60',
  PaintBucket: 'text-orange-400/60',
  Eye: 'text-slate-400/60',
  Zap: 'text-yellow-400/60',
  Flame: 'text-red-400/60',
  Clock: 'text-amber-400/60',
  Volume2: 'text-violet-400/60',
  Sparkles: 'text-amber-300/60',
  Repeat: 'text-teal-400/60',
  Timer: 'text-orange-400/60',
  MessageSquare: 'text-sky-400/60',
  Type: 'text-pink-400/60',
  Variable: 'text-violet-400/60',
  Copy: 'text-cyan-400/60',
  Globe: 'text-blue-400/60',
  MapPin: 'text-emerald-400/60',
  Heart: 'text-rose-400/60',
  Skull: 'text-red-500/60',
  Lightbulb: 'text-yellow-400/60',
  CloudRain: 'text-sky-400/60',
  Wind: 'text-slate-300/60',
  Cloud: 'text-gray-400/60',
};

// ═══════════════════════════════════════════════════════════════════
// LogicPanel — Appears in Properties when a part is selected
// ═══════════════════════════════════════════════════════════════════

export function LogicPanel({ partId }: { partId: string }) {
  const part = useStudioStore((s) => {
    const obj = s.objects.get(partId);
    return obj && isPart(obj) ? obj : null;
  });
  const { addRule, removeRule, updateRule, addConsoleMessage } = useStudioStore();
  const [showModePicker, setShowModePicker] = useState(false);

  if (!part) return null;

  const rules = part.rules || [];

  const handleAddRule = (mode: 'simple' | 'advanced') => {
    const rule = createBlankRule(mode);
    addRule(partId, rule);
    setShowModePicker(false);
    addConsoleMessage('info', `Added new ${mode === 'simple' ? 'Simple' : 'Advanced'} rule to ${part.name}`);
  };

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider">Logic</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowModePicker(!showModePicker)}
            className="flex items-center gap-1 px-2 py-1 text-[9px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded border border-amber-500/20 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Rule
          </button>
          {showModePicker && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-[#252536] border border-white/10 rounded-lg shadow-xl py-1 min-w-[180px]">
              <button
                onClick={() => handleAddRule('simple')}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/70 hover:bg-white/5"
              >
                <MousePointer className="w-3.5 h-3.5 text-blue-400" />
                <div className="text-left">
                  <div className="font-medium text-white/90">Simple</div>
                  <div className="text-[9px] text-white/40">Click to build rules</div>
                </div>
              </button>
              <button
                onClick={() => handleAddRule('advanced')}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/70 hover:bg-white/5"
              >
                <Code className="w-3.5 h-3.5 text-green-400" />
                <div className="text-left">
                  <div className="font-medium text-white/90">Advanced</div>
                  <div className="text-[9px] text-white/40">Type WeildCode manually</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="text-center py-4 px-2">
          <Zap className="w-6 h-6 text-white/10 mx-auto mb-1.5" />
          <p className="text-[9px] text-white/25">No rules yet</p>
          <p className="text-[9px] text-white/15">Add a rule to bring this object to life!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rules.map((rule) => (
            <RuleCard key={rule.id} partId={partId} rule={rule} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RuleCard — A single rule with trigger + actions
// ═══════════════════════════════════════════════════════════════════

function RuleCard({ partId, rule }: { partId: string; rule: WeildCodeRule }) {
  const { removeRule, updateRule } = useStudioStore();
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(rule.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const triggerDef = TRIGGER_DEFINITIONS.find((d) => d.type === rule.trigger.type);

  const handleToggleEnabled = () => {
    updateRule(partId, rule.id, { enabled: !rule.enabled });
  };

  const handleDelete = () => {
    removeRule(partId, rule.id);
  };

  const handleNameSubmit = () => {
    updateRule(partId, rule.id, { name: nameValue.trim() || 'Rule' });
    setEditingName(false);
  };

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  return (
    <div className={`rounded-lg border transition-colors ${
      rule.enabled
        ? 'bg-white/[0.02] border-white/[0.06]'
        : 'bg-white/[0.01] border-white/[0.03] opacity-50'
    }`}>
      {/* Rule header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        {editingName ? (
          <input
            ref={nameInputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit(); }}
            className="flex-1 text-[10px] bg-white/5 border border-white/10 text-white px-1 py-0.5 rounded min-w-0"
          />
        ) : (
          <button
            onDoubleClick={() => { setEditingName(true); setNameValue(rule.name); }}
            className="flex-1 text-[10px] font-medium text-white/70 text-left truncate"
          >
            {rule.name}
          </button>
        )}

        {/* Mode badge */}
        <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${
          rule.mode === 'simple'
            ? 'bg-blue-500/15 text-blue-400/80'
            : 'bg-green-500/15 text-green-400/80'
        }`}>
          {rule.mode === 'simple' ? 'UI' : '</>'}
        </span>

        <button onClick={handleToggleEnabled} className="text-white/30 hover:text-white/60">
          {rule.enabled
            ? <ToggleRight className="w-4 h-4 text-emerald-400/70" />
            : <ToggleLeft className="w-4 h-4" />
          }
        </button>
        <button onClick={handleDelete} className="text-white/20 hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Rule body */}
      {expanded && (
        <div className="px-2 pb-2 space-y-2">
          {/* Trigger */}
          {rule.mode === 'simple' ? (
            <SimpleRuleEditor partId={partId} rule={rule} />
          ) : (
            <AdvancedRuleEditor partId={partId} rule={rule} />
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Simple Rule Editor — Dropdown-based trigger + action builder
// ═══════════════════════════════════════════════════════════════════

function SimpleRuleEditor({ partId, rule }: { partId: string; rule: WeildCodeRule }) {
  const { updateRule } = useStudioStore();
  const [showTriggerPicker, setShowTriggerPicker] = useState(false);
  const [showActionPicker, setShowActionPicker] = useState(false);

  const triggerDef = TRIGGER_DEFINITIONS.find((d) => d.type === rule.trigger.type);

  const handleTriggerChange = (type: TriggerType) => {
    const def = TRIGGER_DEFINITIONS.find((d) => d.type === type);
    const params: Record<string, any> = {};
    if (def) {
      for (const p of def.params) {
        params[p.key] = p.default ?? '';
      }
    }
    updateRule(partId, rule.id, {
      trigger: { type, params },
    });
    setShowTriggerPicker(false);
  };

  const handleAddAction = (type: ActionType) => {
    const action = createBlankAction(type);
    updateRule(partId, rule.id, {
      actions: [...rule.actions, action],
    });
    setShowActionPicker(false);
  };

  const handleRemoveAction = (actionId: string) => {
    updateRule(partId, rule.id, {
      actions: rule.actions.filter((a) => a.id !== actionId),
    });
  };

  const handleUpdateAction = (actionId: string, updates: Partial<WeildCodeAction>) => {
    updateRule(partId, rule.id, {
      actions: rule.actions.map((a) =>
        a.id === actionId ? { ...a, ...updates } : a
      ),
    });
  };

  const handleUpdateActionParam = (actionId: string, key: string, value: any) => {
    const action = rule.actions.find((a) => a.id === actionId);
    if (!action) return;
    handleUpdateAction(actionId, {
      params: { ...action.params, [key]: value },
    });
  };

  return (
    <div className="space-y-2">
      {/* Trigger selector */}
      <div>
        <div className="text-[8px] text-white/30 uppercase tracking-wider mb-1">Trigger</div>
        <div className="relative">
          <button
            onClick={() => { setShowTriggerPicker(!showTriggerPicker); setShowActionPicker(false); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 rounded text-left transition-colors"
          >
            <span className={TRIGGER_ICON_COLOR[triggerDef?.icon || ''] || 'text-amber-400/70'}>
              <TriggerIcon icon={triggerDef?.icon || ''} />
            </span>
            <span className="text-[10px] text-amber-300/80 flex-1">{triggerDef?.label || 'Choose trigger'}</span>
            <ChevronDown className="w-3 h-3 text-amber-400/40" />
          </button>
          {showTriggerPicker && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-[#1e1e2e] border border-white/10 rounded-lg shadow-xl py-1 min-w-[220px] max-h-[200px] overflow-y-auto">
              {TRIGGER_DEFINITIONS.map((def) => (
                <button
                  key={def.type}
                  onClick={() => handleTriggerChange(def.type)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-white/5 transition-colors ${
                    rule.trigger.type === def.type ? 'text-amber-300' : 'text-white/60'
                  }`}
                >
                  <span className={`w-4 flex justify-center ${TRIGGER_ICON_COLOR[def.icon] || 'text-white/50'}`}>
                    <TriggerIcon icon={def.icon} className="w-3.5 h-3.5" />
                  </span>
                  <div className="text-left">
                    <div className="font-medium">{def.label}</div>
                    <div className="text-[8px] text-white/30">{def.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Trigger params */}
        {triggerDef && triggerDef.params.length > 0 && (
          <div className="mt-1.5 space-y-1 pl-2 border-l border-amber-500/10">
            {triggerDef.params.map((param) => (
              <ParamInput
                key={param.key}
                param={param}
                value={rule.trigger.params[param.key]}
                onChange={(value) => {
                  updateRule(partId, rule.id, {
                    trigger: { ...rule.trigger, params: { ...rule.trigger.params, [param.key]: value } },
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <span className="text-amber-400/30"><ChevronDown className="w-3 h-3" /></span>
      </div>

      {/* Actions */}
      <div>
        <div className="text-[8px] text-white/30 uppercase tracking-wider mb-1">Actions</div>
        <div className="space-y-1.5">
          {rule.actions.map((action, idx) => {
            const actionDef = ACTION_DEFINITIONS.find((d) => d.type === action.type);
            return (
              <div key={action.id} className="group relative">
                <ActionCard
                  action={action}
                  depth={0}
                  onUpdate={(updates) => handleUpdateAction(action.id, updates)}
                  onRemove={() => handleRemoveAction(action.id)}
                  onParamChange={(key, value) => handleUpdateActionParam(action.id, key, value)}
                  onAddChild={(childAction) => {
                    const currentChildren = action.children || [];
                    handleUpdateAction(action.id, {
                      children: [...currentChildren, childAction],
                    });
                  }}
                  onRemoveChild={(childId) => {
                    handleUpdateAction(action.id, {
                      children: (action.children || []).filter((c) => c.id !== childId),
                    });
                  }}
                  onUpdateChild={(childId, updates) => {
                    handleUpdateAction(action.id, {
                      children: (action.children || []).map((c) =>
                        c.id === childId ? { ...c, ...updates } : c
                      ),
                    });
                  }}
                  onChildParamChange={(childId, key, value) => {
                    const child = (action.children || []).find((c) => c.id === childId);
                    if (!child) return;
                    handleUpdateAction(action.id, {
                      children: (action.children || []).map((c) =>
                        c.id === childId ? { ...c, params: { ...c.params, [key]: value } } : c
                      ),
                    });
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Add action button */}
        <div className="relative mt-1.5">
          <button
            onClick={() => { setShowActionPicker(!showActionPicker); setShowTriggerPicker(false); }}
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-white/[0.02] hover:bg-white/[0.05] border border-dashed border-white/10 rounded text-white/30 hover:text-white/50 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span className="text-[9px]">Add action</span>
          </button>
          {showActionPicker && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-[#1e1e2e] border border-white/10 rounded-lg shadow-xl py-1 min-w-[220px] max-h-[240px] overflow-y-auto">
              {ACTION_DEFINITIONS.map((def) => (
                <button
                  key={def.type}
                  onClick={() => handleAddAction(def.type)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 transition-colors"
                >
                  <span className={`w-4 flex justify-center ${ACTION_ICON_COLOR[def.icon] || 'text-white/50'}`}>
                    <ActionIcon icon={def.icon} className="w-3.5 h-3.5" />
                  </span>
                  <div className="text-left">
                    <div className="font-medium text-white/80">{def.label}</div>
                    <div className="text-[8px] text-white/30">{def.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ActionCard — Visual representation of a single action
// ═══════════════════════════════════════════════════════════════════

function ActionCard({
  action,
  depth,
  onUpdate,
  onRemove,
  onParamChange,
  onAddChild,
  onRemoveChild,
  onUpdateChild,
  onChildParamChange,
}: {
  action: WeildCodeAction;
  depth: number;
  onUpdate: (updates: Partial<WeildCodeAction>) => void;
  onRemove: () => void;
  onParamChange: (key: string, value: any) => void;
  onAddChild: (child: WeildCodeAction) => void;
  onRemoveChild: (childId: string) => void;
  onUpdateChild: (childId: string, updates: Partial<WeildCodeAction>) => void;
  onChildParamChange: (childId: string, key: string, value: any) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showChildActionPicker, setShowChildActionPicker] = useState(false);
  const actionDef = ACTION_DEFINITIONS.find((d) => d.type === action.type);

  const indent = depth * 12;

  return (
    <div style={{ paddingLeft: `${indent}px` }}>
      <div className={`flex items-start gap-1.5 px-2 py-1.5 rounded border transition-colors ${
        action.enabled
          ? 'bg-violet-500/[0.04] border-violet-500/10'
          : 'bg-white/[0.01] border-white/5 opacity-40'
      }`}>
        <div className="flex-1 space-y-1 min-w-0">
          {/* Action header */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-medium text-violet-300/70 truncate">{actionDef?.label || action.type}</span>
            <button onClick={() => onUpdate({ enabled: !action.enabled })} className="text-white/20 hover:text-white/50">
              {action.enabled
                ? <ToggleRight className="w-3 h-3 text-emerald-400/60" />
                : <ToggleLeft className="w-3 h-3" />
              }
            </button>
          </div>

          {/* Action params */}
          {actionDef && actionDef.params.filter(p => {
            // Hide conditional params
            if (action.type === ('on_timer' as ActionType) || action.type === ('repeat_every' as ActionType)) return true;
            // Only hide targetName for delete_part (where target selects between self/named)
            if (p.key === 'targetName' && action.type === 'delete_part' && action.params.target !== 'named') return false;
            if (p.key === 'period' && action.params.timeMode !== 'period') return false;
            return true;
          }).map((param) => (
            <ParamInput
              key={param.key}
              param={param}
              value={action.params[param.key]}
              onChange={(value) => onParamChange(param.key, value)}
              compact
            />
          ))}

          {/* Nested children (for repeat/tell_object) */}
          {actionDef?.hasChildren && (
            <div className="mt-1 space-y-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-white/30 hover:text-white/50"
                >
                  {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                <span className="text-[8px] text-violet-400/40 uppercase">{actionDef.childLabel || 'Actions'}</span>
              </div>

              {expanded && (
                <div className="pl-2 border-l border-violet-500/10 space-y-1">
                  {(action.children || []).map((child) => {
                    const childDef = ACTION_DEFINITIONS.find((d) => d.type === child.type);
                    return (
                      <div key={child.id} className="group">
                        <div className="flex items-start gap-1 px-1.5 py-1 bg-violet-500/[0.03] border border-violet-500/8 rounded">
                          <div className="flex-1 space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-medium text-violet-300/60">{childDef?.label || child.type}</span>
                              <button onClick={() => onUpdateChild(child.id, { enabled: !child.enabled })} className="text-white/20 hover:text-white/40">
                                {child.enabled ? <ToggleRight className="w-2.5 h-2.5 text-emerald-400/50" /> : <ToggleLeft className="w-2.5 h-2.5" />}
                              </button>
                            </div>
                            {childDef && childDef.params.map((param) => (
                              <ParamInput
                                key={param.key}
                                param={param}
                                value={child.params[param.key]}
                                onChange={(value) => onChildParamChange(child.id, param.key, value)}
                                compact
                              />
                            ))}
                          </div>
                          <button onClick={() => onRemoveChild(child.id)} className="text-white/15 hover:text-red-400 mt-0.5">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add child action */}
                  <div className="relative">
                    <button
                      onClick={() => setShowChildActionPicker(!showChildActionPicker)}
                      className="w-full flex items-center justify-center gap-1 px-1.5 py-1 bg-white/[0.01] hover:bg-white/[0.03] border border-dashed border-white/8 rounded text-white/20 hover:text-white/40 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span className="text-[8px]">Add</span>
                    </button>
                    {showChildActionPicker && (
                      <div className="absolute left-0 top-full mt-1 z-50 bg-[#1e1e2e] border border-white/10 rounded-lg shadow-xl py-1 min-w-[200px] max-h-[180px] overflow-y-auto">
                        {ACTION_DEFINITIONS.map((def) => (
                          <button
                            key={def.type}
                            onClick={() => {
                              onAddChild(createBlankAction(def.type));
                              setShowChildActionPicker(false);
                            }}
                            className="flex items-center gap-2 w-full px-2 py-1 text-[10px] text-white/60 hover:bg-white/5"
                          >
                            <span className="font-medium text-white/80">{def.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Remove action */}
        <button onClick={onRemove} className="text-white/15 hover:text-red-400 mt-0.5 shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ParamInput — Generic input for action/trigger parameters
// ═══════════════════════════════════════════════════════════════════

function ParamInput({
  param,
  value,
  onChange,
  compact = false,
}: {
  param: { key: string; label: string; type: string; options?: { label: string; value: string }[] };
  value: any;
  onChange: (value: any) => void;
  compact?: boolean;
}) {
  const sizeClass = compact ? 'text-[8px]' : 'text-[9px]';

  if (param.type === 'select' && param.options) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`${sizeClass} text-white/30 w-16 shrink-0`}>{param.label}</span>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`flex-1 ${sizeClass} bg-[#1e1e2e] border border-white/10 text-white/80 px-1 py-0.5 rounded cursor-pointer hover:border-white/20 focus:border-violet-500/30 focus:outline-none transition-colors`}
          style={{ colorScheme: 'dark' }}
        >
          {param.options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: '#1e1e2e', color: '#e2e8f0' }}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (param.type === 'color') {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`${sizeClass} text-white/30 w-16 shrink-0`}>{param.label}</span>
        <input
          type="color"
          value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="w-5 h-5 rounded cursor-pointer border border-white/10"
        />
        <span className={`${sizeClass} text-white/40`}>{value}</span>
      </div>
    );
  }

  if (param.type === 'boolean') {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`${sizeClass} text-white/30 w-16 shrink-0`}>{param.label}</span>
        <button
          onClick={() => onChange(!value)}
          className={`flex items-center gap-1 ${sizeClass} px-1.5 py-0.5 rounded border transition-colors ${
            value
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
          }`}
        >
          {value
            ? <ToggleRight className="w-3 h-3" />
            : <ToggleLeft className="w-3 h-3" />
          }
          <span>{value ? 'Yes' : 'No'}</span>
        </button>
      </div>
    );
  }

  if (param.type === 'vector3') {
    const v = value || { x: 0, y: 0, z: 0 };
    return (
      <div className="flex items-center gap-1">
        <span className={`${sizeClass} text-white/30 w-16 shrink-0`}>{param.label}</span>
        {['x', 'y', 'z'].map((axis) => (
          <div key={axis} className="flex items-center gap-0.5">
            <span className={`${sizeClass} text-white/20`}>{axis.toUpperCase()}</span>
            <input
              type="number"
              value={v[axis] ?? 0}
              step={0.5}
              onChange={(e) => onChange({ ...v, [axis]: parseFloat(e.target.value) || 0 })}
              className={`w-10 ${sizeClass} bg-white/5 border border-white/10 text-white/80 px-1 py-0.5 rounded`}
            />
          </div>
        ))}
      </div>
    );
  }

  if (param.type === 'vector3_relative') {
    // A vector3 where each axis has its own "relative" checkbox.
    // When relative is true, the value is ADDED to the current position;
    // when false, it REPLACES it.
    const v = value || { x: 0, y: 0, z: 0, relativeX: false, relativeY: false, relativeZ: false };
    return (
      <div className="space-y-0.5">
        <span className={`${sizeClass} text-white/30`}>{param.label}</span>
        {(['x', 'y', 'z'] as const).map((axis) => {
          const relKey = `relative${axis.toUpperCase()}` as 'relativeX' | 'relativeY' | 'relativeZ';
          return (
            <div key={axis} className="flex items-center gap-1">
              <span className={`${sizeClass} text-white/20 w-3`}>{axis.toUpperCase()}</span>
              <input
                type="number"
                value={v[axis] ?? 0}
                step={0.5}
                onChange={(e) => onChange({ ...v, [axis]: parseFloat(e.target.value) || 0 })}
                className={`w-12 ${sizeClass} bg-white/5 border border-white/10 text-white/80 px-1 py-0.5 rounded`}
              />
              <button
                onClick={() => onChange({ ...v, [relKey]: !v[relKey] })}
                className={`flex items-center gap-0.5 ${sizeClass} px-1 py-0.5 rounded border transition-colors ${
                  v[relKey]
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                }`}
                title={v[relKey] ? 'Relative (adds to current position)' : 'Absolute (replaces current position)'}
              >
                {v[relKey] ? 'Rel' : 'Abs'}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  if (param.type === 'number') {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`${sizeClass} text-white/30 w-16 shrink-0`}>{param.label}</span>
        <input
          type="number"
          value={value ?? 0}
          step={param.key === 'transparency' || param.key === 'opacity' ? 0.1 : 1}
          min={param.key === 'transparency' || param.key === 'opacity' ? 0 : undefined}
          max={param.key === 'transparency' || param.key === 'opacity' ? 1 : undefined}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`w-16 ${sizeClass} bg-white/5 border border-white/10 text-white/80 px-1 py-0.5 rounded`}
        />
      </div>
    );
  }

  // string
  return (
    <div className="flex items-center gap-1.5">
      <span className={`${sizeClass} text-white/30 w-16 shrink-0`}>{param.label}</span>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 ${sizeClass} bg-white/5 border border-white/10 text-white/80 px-1 py-0.5 rounded min-w-0`}
        placeholder={param.label}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Advanced Rule Editor — Terminal-style code editor
// ═══════════════════════════════════════════════════════════════════

function AdvancedRuleEditor({ partId, rule }: { partId: string; rule: WeildCodeRule }) {
  const { updateRule } = useStudioStore();
  const [code, setCode] = useState(rule.advancedCode || ruleToAdvancedCode(rule));
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync code when rule changes externally
  useEffect(() => {
    if (rule.advancedCode) {
      setCode(rule.advancedCode);
    }
  }, [rule.advancedCode]);

  const handleApply = () => {
    const parsed = parseAdvancedCode(code);
    if (parsed) {
      updateRule(partId, rule.id, {
        trigger: parsed.trigger,
        actions: parsed.actions,
        advancedCode: code,
      });
      setError(null);
    } else {
      setError('Syntax error — check your WeildCode');
    }
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Trigger keyword reference
  const triggerKeywords = TRIGGER_DEFINITIONS.map((d) => d.type).join(', ');
  const actionKeywords = ACTION_DEFINITIONS.map((d) => d.type).join(', ');

  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="w-[700px] h-[500px] bg-[#0d0d1a] border border-green-500/20 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-2 bg-[#111122] border-b border-green-500/10">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            </div>
            <span className="text-[10px] font-mono text-green-400/60">WeildCode — Advanced Editor</span>
            <div className="flex-1" />
            <button
              onClick={handleToggleFullscreen}
              className="text-white/30 hover:text-white/60 text-xs"
            >
              ✕
            </button>
          </div>

          {/* Code area */}
          <div className="flex-1 overflow-hidden">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-full bg-transparent text-green-300/90 font-mono text-xs p-4 resize-none outline-none leading-relaxed"
              placeholder={`when_created {\n  create_part partType="Block" name="Wall" color="#4ff7f5"\n  wait seconds="2"\n  change_color color="#ff0000"\n}`}
              spellCheck={false}
            />
          </div>

          {/* Reference footer */}
          <div className="px-4 py-2 bg-[#111122] border-t border-green-500/10">
            <div className="text-[8px] text-white/20 font-mono">
              Triggers: {triggerKeywords}
            </div>
            <div className="text-[8px] text-white/20 font-mono mt-0.5">
              Actions: {actionKeywords}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#111122] border-t border-green-500/10">
            {error && (
              <span className="text-[9px] text-red-400 font-mono flex-1">{error}</span>
            )}
            {!error && (
              <span className="text-[9px] text-green-400/40 font-mono flex-1">Ready</span>
            )}
            <button
              onClick={handleApply}
              className="text-[10px] px-3 py-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded border border-green-500/20 font-medium transition-colors"
            >
              Apply Code
            </button>
            <button
              onClick={handleToggleFullscreen}
              className="text-[10px] px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 rounded border border-white/10 transition-colors"
            >
              Minimize
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Compact inline editor
  return (
    <div className="space-y-1.5">
      {/* Mini code preview */}
      <div
        onClick={handleToggleFullscreen}
        className="relative cursor-pointer bg-[#0d0d1a] border border-green-500/10 rounded p-2 hover:border-green-500/20 transition-colors"
      >
        <pre className="text-[9px] font-mono text-green-300/70 whitespace-pre-wrap leading-relaxed max-h-[100px] overflow-hidden">
          {code || '// Click to write WeildCode...'}
        </pre>
        <div className="absolute top-1 right-1">
          <Code className="w-3 h-3 text-green-500/30" />
        </div>
      </div>

      {error && (
        <div className="text-[8px] text-red-400 font-mono px-1">{error}</div>
      )}

      {/* Mini controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleApply}
          className="text-[8px] px-2 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400/80 rounded border border-green-500/15 transition-colors"
        >
          Apply
        </button>
        <button
          onClick={handleToggleFullscreen}
          className="text-[8px] px-2 py-1 bg-white/5 hover:bg-white/10 text-white/40 rounded border border-white/10 transition-colors"
        >
          Expand
        </button>
      </div>
    </div>
  );
}
