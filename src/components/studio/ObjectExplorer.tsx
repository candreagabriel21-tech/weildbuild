'use client';

import { useStudioStore, isPart, StudioObject, StudioPart } from '@/lib/studio-store';
import {
  Box, Circle, Triangle, Cylinder, MapPin,
  FolderTree, FolderClosed, FolderOpen,
  ChevronRight, ChevronDown, Lock, Unlock,
  Trash2, Copy, Group, Ungroup, Zap,
  TreeDeciduous, Waves,
  User, Backpack, Layout, Wrench,
  Eye, EyeOff,
} from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';

function getObjectIcon(obj: StudioObject, expanded?: boolean) {
  if (isPart(obj)) {
    if (obj.isCharacterPart) return <User className="w-3.5 h-3.5 text-pink-400/80" />;
    switch (obj.type) {
      case 'Block': return <Box className="w-3.5 h-3.5" />;
      case 'Sphere': return <Circle className="w-3.5 h-3.5" />;
      case 'Wedge': return <Triangle className="w-3.5 h-3.5" />;
      case 'Cylinder': return <Cylinder className="w-3.5 h-3.5" />;
      case 'Spawn': return <MapPin className="w-3.5 h-3.5 text-blue-400" />;
    }
  }
  return expanded ? <FolderTree className="w-3.5 h-3.5 text-amber-400/70" /> : <FolderClosed className="w-3.5 h-3.5 text-amber-400/70" />;
}

function TreeNode({ obj, depth }: { obj: StudioObject; depth: number }) {
  const { selectObject, selectedIds, objects, removeObject, duplicateSelected, groupSelected, ungroupSelected } = useStudioStore();
  const [expanded, setExpanded] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const contextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showContext) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) setShowContext(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContext]);

  const isSelected = selectedIds.includes(obj.id);
  const isGroup = !isPart(obj) && 'children' in obj;
  const hasChildren = isGroup && obj.children.length > 0;
  const children = hasChildren ? obj.children.map((cid) => objects.get(cid)).filter(Boolean) as StudioObject[] : [];

  const handleClick = useCallback((e: React.MouseEvent) => { e.stopPropagation(); selectObject(obj.id, e.shiftKey); }, [obj.id, selectObject]);
  const handleContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setShowContext(true); }, []);

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 cursor-pointer group transition-colors ${isSelected ? 'bg-emerald-500/20 text-emerald-300 border-l-2 border-emerald-400' : 'text-white/60 hover:bg-white/5 hover:text-white/80 border-l-2 border-transparent'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="text-white/30 hover:text-white/60">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : <span className="w-3" />}
        <span className="text-white/40">{getObjectIcon(obj, expanded)}</span>
        <span className="text-xs truncate flex-1">{obj.name}</span>
        {isPart(obj) && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {(obj.rules || []).length > 0 && <span className="text-amber-400/60" title={`${(obj.rules || []).length} rule(s)`}><Zap className="w-3 h-3" /></span>}
            <span className="text-[9px] text-white/20">{obj.anchored ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}</span>
            {/* Show in World toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); useStudioStore.getState().updateObject(obj.id, { showInWorld: obj.showInWorld === false ? true : false } as any); }}
              className={`transition-colors ${obj.showInWorld === false ? 'text-white/20 hover:text-white/40' : 'text-emerald-400/70 hover:text-emerald-300'}`}
              title={obj.showInWorld === false ? 'Show in World (currently hidden)' : 'Hide in World (currently visible)'}
            >
              {obj.showInWorld === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
            {/* Delete button */}
            <button
              onClick={(e) => { e.stopPropagation(); useStudioStore.getState().removeObject(obj.id); }}
              className="text-white/30 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      {showContext && (
        <div ref={contextRef} className="absolute z-50 bg-[#252536] border border-white/10 rounded-lg shadow-xl py-1 min-w-[140px]" style={{ marginLeft: `${depth * 16 + 24}px` }}>
          <button onClick={() => { removeObject(obj.id); setShowContext(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-white/5"><Trash2 className="w-3 h-3" /> Delete</button>
          <button onClick={() => { selectObject(obj.id); duplicateSelected(); setShowContext(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-white/60 hover:bg-white/5"><Copy className="w-3 h-3" /> Duplicate</button>
          {isGroup && (<><div className="border-t border-white/5 my-1" /><button onClick={() => { selectObject(obj.id); ungroupSelected(); setShowContext(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-amber-400 hover:bg-white/5"><Ungroup className="w-3 h-3" /> Ungroup</button></>)}
          {isPart(obj) && selectedIds.length > 1 && selectedIds.includes(obj.id) && (<><div className="border-t border-white/5 my-1" /><button onClick={() => { groupSelected(); setShowContext(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-amber-400 hover:bg-white/5"><Group className="w-3 h-3" /> Group Selection</button></>)}
        </div>
      )}
      {expanded && hasChildren && (
        <div className="ml-3 border-l border-white/10">{children.map((child) => <TreeNode key={child.id} obj={child} depth={depth + 1} />)}</div>
      )}
    </div>
  );
}

function CollapsibleFolder({
  label, icon, count, defaultOpen = true, accentColor = 'text-white/40',
  onToggleVisibility, onDelete, children,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  defaultOpen?: boolean;
  accentColor?: string;
  /** When provided, shows an eye toggle button that affects all contents */
  onToggleVisibility?: () => void;
  /** When provided, shows a delete button that affects all contents */
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:bg-white/5 transition-colors select-none group" onClick={() => setOpen(!open)}>
        <span className="text-white/30">{open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
        <span className={accentColor}>{open ? <FolderOpen className="w-3.5 h-3.5" /> : <FolderClosed className="w-3.5 h-3.5" />}</span>
        <span className={`w-3.5 h-3.5 ${accentColor}`}>{icon}</span>
        <span className="text-xs font-medium text-white/70 flex-1">{label}</span>
        <span className="text-[9px] text-white/30">{count}</span>
        {/* Folder-level action buttons (appear on hover) */}
        {(onToggleVisibility || onDelete) && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onToggleVisibility && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
                className="text-white/30 hover:text-emerald-400 transition-colors"
                title="Toggle visibility for all contents"
              >
                <Eye className="w-3 h-3" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-white/30 hover:text-red-400 transition-colors"
                title="Delete all contents"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
      {open && <div className="ml-2 border-l border-white/5">{children}</div>}
    </div>
  );
}

export function ObjectExplorer() {
  const objects = useStudioStore(useCallback((state) => state.objects, []));
  const treeInstances = useStudioStore((s) => s.treeInstances);
  const waterBodies = useStudioStore((s) => s.waterBodies);
  const selectedIds = useStudioStore((s) => s.selectedIds);

  const allObjects = Array.from(objects.values());
  const primitiveObjects = allObjects.filter((obj) => obj.parentId === null && isPart(obj) && !obj.isCharacterPart);
  const characterParts = allObjects.filter((obj) => isPart(obj) && obj.isCharacterPart) as StudioPart[];
  const charPartOrder = ['head', 'face', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
  characterParts.sort((a, b) => charPartOrder.indexOf(a.characterPartType || '') - charPartOrder.indexOf(b.characterPartType || ''));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const active = document.activeElement;
        const explorerEl = document.getElementById('object-explorer-panel');
        if (!explorerEl) return;
        if (!explorerEl.contains(active) && active !== document.body) return;
        e.preventDefault();
        const allIds = Array.from(objects.keys());
        if (allIds.length > 0) { useStudioStore.getState().clearSelection(); allIds.forEach((id) => useStudioStore.getState().selectObject(id, true)); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [objects]);

  const isTreeSelected = (treeId: string) => selectedIds.includes(`tree_${treeId}`);
  const isWaterSelected = (waterId: string) => selectedIds.includes(`water_${waterId}`);
  const selectTree = (treeId: string, additive: boolean) => { const store = useStudioStore.getState(); if (!additive) store.clearSelection(); store.selectObject(`tree_${treeId}`, true); };
  const selectWater = (waterId: string, additive: boolean) => { const store = useStudioStore.getState(); if (!additive) store.clearSelection(); store.selectObject(`water_${waterId}`, true); };
  const selectCharacterPart = (partId: string, additive: boolean) => { const store = useStudioStore.getState(); if (!additive) store.clearSelection(); store.selectObject(partId, true); };
  const isCharacterPartSelected = (partId: string) => selectedIds.includes(partId);

  // ─── Folder-level batch actions ───
  // Toggle showInWorld for all parts in a list
  const toggleVisibilityForParts = (parts: StudioPart[]) => {
    const store = useStudioStore.getState();
    // If any part is hidden, show all. If all are visible, hide all.
    const anyHidden = parts.some((p) => p.showInWorld === false);
    const newState = anyHidden; // if any hidden → show all (true); if all shown → hide all (false)
    parts.forEach((p) => store.updateObject(p.id, { showInWorld: newState } as any));
  };
  // Delete all parts in a list
  const deleteParts = (parts: StudioPart[]) => {
    const store = useStudioStore.getState();
    parts.forEach((p) => store.removeObject(p.id));
  };
  // Delete all trees
  const deleteAllTrees = () => {
    const store = useStudioStore.getState();
    treeInstances.forEach((t) => store.removeTree(t.id));
  };
  // Delete all water bodies
  const deleteAllWater = () => {
    const store = useStudioStore.getState();
    waterBodies.forEach((w) => store.removeWaterBody(w.id));
  };

  return (
    <div id="object-explorer-panel" className="h-full flex flex-col border-r" style={{ background: 'var(--wb-bg-card-solid)', borderColor: 'var(--wb-border-subtle)' }}
      onClick={(e) => { if ((e.target as HTMLElement) === e.currentTarget || (e.target as HTMLElement).closest('.studio-panel')) { const target = e.target as HTMLElement; if (target.tagName !== 'BUTTON' && !target.closest('[data-obj-id]')) useStudioStore.getState().selectObject(null); } }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5"><h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Explorer</h3></div>
      <div className="flex-1 overflow-y-auto studio-panel"><div className="py-1">

        <CollapsibleFolder
          label="Primitives"
          icon={<Box className="w-3.5 h-3.5" />}
          count={primitiveObjects.length + treeInstances.length + waterBodies.length}
          accentColor="text-blue-400/70"
          onToggleVisibility={() => toggleVisibilityForParts(primitiveObjects as StudioPart[])}
          onDelete={() => { deleteParts(primitiveObjects as StudioPart[]); deleteAllTrees(); deleteAllWater(); }}
        >
          {primitiveObjects.length === 0 && treeInstances.length === 0 && waterBodies.length === 0 ? (
            <div className="px-4 py-6 text-center"><Box className="w-6 h-6 text-white/10 mx-auto mb-1" /><p className="text-[10px] text-white/20">No primitives yet</p><p className="text-[10px] text-white/15">Insert a part to begin</p></div>
          ) : (
            <>
              {primitiveObjects.map((obj) => <TreeNode key={obj.id} obj={obj} depth={1} />)}
              {waterBodies.map((water) => (
                <div key={water.id} data-obj-id={water.id} className={`flex items-center gap-1.5 px-3 py-1 cursor-pointer transition-colors ${isWaterSelected(water.id) ? 'bg-cyan-500/15 text-cyan-300' : 'text-white/60 hover:bg-white/5 hover:text-white/80'}`} style={{ paddingLeft: `${1 * 12 + 12}px` }} onClick={(e) => selectWater(water.id, e.shiftKey)}>
                  <Waves className="w-3.5 h-3.5 text-cyan-400/70 shrink-0" /><span className="text-xs flex-1 truncate">{water.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); useStudioStore.getState().removeWaterBody(water.id); }} className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-colors" title="Remove water body"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              {treeInstances.map((tree, i) => (
                <div key={tree.id} data-obj-id={tree.id} className={`flex items-center gap-1.5 px-3 py-1 cursor-pointer transition-colors group ${isTreeSelected(tree.id) ? 'bg-green-500/15 text-green-300' : 'text-white/60 hover:bg-white/5 hover:text-white/80'}`} style={{ paddingLeft: `${1 * 12 + 12}px` }} onClick={(e) => selectTree(tree.id, e.shiftKey)}>
                  <TreeDeciduous className="w-3.5 h-3.5 text-green-400/70 shrink-0" /><span className="text-xs flex-1 truncate capitalize">{tree.variant} Tree {i + 1}</span>
                  <button onClick={(e) => { e.stopPropagation(); useStudioStore.getState().removeTree(tree.id); }} className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-colors" title="Remove tree"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </>
          )}
        </CollapsibleFolder>

        <CollapsibleFolder
          label="Player"
          icon={<User className="w-3.5 h-3.5" />}
          count={characterParts.length}
          accentColor="text-pink-400/70"
          onDelete={() => deleteParts(characterParts)}
        >
          <CollapsibleFolder
            label="Character"
            icon={<User className="w-3.5 h-3.5" />}
            count={characterParts.length}
            accentColor="text-pink-400/60"
            defaultOpen={true}
            onToggleVisibility={() => toggleVisibilityForParts(characterParts)}
            onDelete={() => deleteParts(characterParts)}
          >
            {characterParts.length === 0 ? (
              <div className="px-4 py-3 text-center"><p className="text-[10px] text-white/20">No character parts</p><button onClick={() => useStudioStore.getState().addDefaultCharacterParts()} className="mt-1 text-[10px] text-indigo-400 hover:text-indigo-300">+ Add default parts</button></div>
            ) : (
              characterParts.map((part) => (
                <div key={part.id} data-obj-id={part.id} className={`flex items-center gap-1 py-1 px-2 cursor-pointer group transition-colors ${isCharacterPartSelected(part.id) ? 'bg-emerald-500/20 text-emerald-300 border-l-2 border-emerald-400' : 'text-white/60 hover:bg-white/5 hover:text-white/80 border-l-2 border-transparent'}`} style={{ paddingLeft: '52px' }} onClick={(e) => selectCharacterPart(part.id, e.shiftKey)}>
                  <span className="text-pink-400/60"><User className="w-3 h-3" /></span><span className="text-xs truncate flex-1">{part.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(part.rules || []).length > 0 && <span className="text-amber-400/60" title={`${(part.rules || []).length} rule(s)`}><Zap className="w-3 h-3" /></span>}
                    <button onClick={(e) => { e.stopPropagation(); useStudioStore.getState().updateObject(part.id, { showInWorld: part.showInWorld === false ? true : false } as any); }} className={`transition-colors ${part.showInWorld === false ? 'text-white/20 hover:text-white/40' : 'text-emerald-400/70 hover:text-emerald-300'}`} title={part.showInWorld === false ? 'Show in World' : 'Hide in World'}>{part.showInWorld === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
                    <button onClick={(e) => { e.stopPropagation(); useStudioStore.getState().removeObject(part.id); }} className="text-white/30 hover:text-red-400 transition-colors" title="Delete part"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))
            )}
          </CollapsibleFolder>
          <CollapsibleFolder label="Inventory" icon={<Backpack className="w-3.5 h-3.5" />} count={0} accentColor="text-amber-400/60" defaultOpen={false}>
            <div className="px-4 py-3 text-center"><Backpack className="w-5 h-5 text-white/10 mx-auto mb-1" /><p className="text-[10px] text-white/20">Player inventory items</p><p className="text-[10px] text-white/15">will appear here</p></div>
          </CollapsibleFolder>
        </CollapsibleFolder>

        <CollapsibleFolder label="Interface" icon={<Layout className="w-3.5 h-3.5" />} count={0} accentColor="text-violet-400/70" defaultOpen={false}>
          <CollapsibleFolder label="StarterUI" icon={<Layout className="w-3.5 h-3.5" />} count={0} accentColor="text-violet-400/60" defaultOpen={true}>
            <div className="px-4 py-3 text-center"><Layout className="w-5 h-5 text-white/10 mx-auto mb-1" /><p className="text-[10px] text-white/20">UI elements</p><p className="text-[10px] text-white/15">will appear here</p></div>
          </CollapsibleFolder>
        </CollapsibleFolder>

        <CollapsibleFolder label="OverseerTools" icon={<Wrench className="w-3.5 h-3.5" />} count={0} accentColor="text-cyan-400/70" defaultOpen={false}>
          <div className="px-4 py-3 text-center"><Wrench className="w-5 h-5 text-white/10 mx-auto mb-1" /><p className="text-[10px] text-white/20">Advanced tools</p><p className="text-[10px] text-white/15">will appear here</p></div>
        </CollapsibleFolder>

      </div></div>
    </div>
  );
}
