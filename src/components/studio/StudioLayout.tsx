'use client';

import { useEffect } from 'react';
import { RibbonToolbar } from './RibbonToolbar';
import { Viewport3D } from './Viewport3D';
import { ObjectExplorer } from './ObjectExplorer';
import { PropertiesPanel } from './PropertiesPanel';
import { OutputConsole } from './OutputConsole';
import { useStudioStore } from '@/lib/studio-store';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Box } from 'lucide-react';

export function StudioLayout() {
  const { playState, simulationState, objects, activeTool, addSpawnPoint, addBaseplate, addDefaultCharacterParts, addConsoleMessage, groupModeIds, setActiveTool, setGroupModeIds, groupSelected, selectObject, showExplorer, showProperties, showOutput } = useStudioStore();

  // Group mode keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTool !== 'Group') return;
      if (e.key === 'Enter') {
        // Confirm group
        if (groupModeIds.length >= 2) {
          selectObject(null);
          groupModeIds.forEach((id) => selectObject(id, true));
          groupSelected();
        }
        setActiveTool('Select');
        setGroupModeIds([]);
      } else if (e.key === 'Escape') {
        // Cancel group mode
        setActiveTool('Select');
        setGroupModeIds([]);
        addConsoleMessage('info', 'Group mode cancelled');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, groupModeIds, setActiveTool, setGroupModeIds, groupSelected, selectObject, addConsoleMessage]);

  // Add clean starter map on first load — matches WeildBuild original
  // The baseplate is now a real StudioPart (isBaseplate: true) that can be
  // moved, resized, and colored like any other part. GridLines are rendered
  // on top of it automatically.
  useEffect(() => {
    if (objects.size === 0) {
      addBaseplate();
      addSpawnPoint();
      addDefaultCharacterParts();
      addConsoleMessage('success', 'WeildCreate initialized — insert parts to start building!');
    } else {
      // Ensure character parts exist even when loading an existing project
      const hasCharParts = Array.from(objects.values()).some(
        (obj) => 'isCharacterPart' in obj && (obj as any).isCharacterPart
      );
      if (!hasCharParts) addDefaultCharacterParts();
    }
  }, []);

  const objectCount = objects.size;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: 'var(--wb-bg-app)' }}>
      {/* Top bar with logo */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b" style={{ background: 'var(--wb-bg-sidebar)', borderColor: 'var(--wb-border-subtle)' }}>
        <div className="flex items-center gap-2">
          <img src="/logos/logo.png" alt="WeildBuild" className="w-5 h-5 rounded" title="WeildCreate" />
          <span className="text-xs font-medium text-white/60">WeildCreate</span>
        </div>
        {playState.isPlaying && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[10px] text-indigo-400 font-medium">Playing — Physics active, unanchored parts respond to gravity</span>
          </div>
        )}
        {simulationState.isSimulating && !playState.isPlaying && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] text-amber-400 font-medium">Simulating — physics active, editor available</span>
          </div>
        )}
        {activeTool === 'Group' && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full">
            <span className="text-[10px] text-violet-400 font-medium">Group Mode: {groupModeIds.length} parts selected — Click parts to add, Enter to confirm, Esc to cancel</span>
          </div>
        )}
      </div>

      {/* Ribbon toolbar */}
      <RibbonToolbar />

      {/* Main content area */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Object Explorer */}
          {showExplorer && (
            <>
              <ResizablePanel defaultSize={18} minSize={12} maxSize={30} collapsible collapsedSize={0}>
                <ObjectExplorer />
              </ResizablePanel>
              <ResizableHandle withHandle className="bg-white/5 hover:bg-white/10" />
            </>
          )}

          {/* Center: Viewport + Output */}
          <ResizablePanel defaultSize={showExplorer ? (showProperties ? 60 : 75) : (showProperties ? 75 : 100)} minSize={40}>
            <ResizablePanelGroup direction="vertical">
              {/* 3D Viewport */}
              <ResizablePanel defaultSize={showOutput ? 80 : 100} minSize={50}>
                <Viewport3D />
              </ResizablePanel>

              {showOutput && (
                <>
                  <ResizableHandle withHandle className="bg-white/5 hover:bg-white/10" />
                  <ResizablePanel defaultSize={20} minSize={10} maxSize={40} collapsible collapsedSize={0}>
                    <OutputConsole />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {showProperties && (
            <>
              <ResizableHandle withHandle className="bg-white/5 hover:bg-white/10" />
              <ResizablePanel defaultSize={22} minSize={15} maxSize={35} collapsible collapsedSize={0}>
                <PropertiesPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t" style={{ background: 'var(--wb-bg-sidebar)', borderColor: 'var(--wb-border-subtle)' }}>
        <div className="flex items-center gap-4">
          <span className="text-[10px]" style={{ color: 'var(--wb-text-muted)' }}>
            {objectCount} objects
          </span>
          <span className="text-[10px]" style={{ color: 'var(--wb-text-muted)' }}>
            Tool: {activeTool}
          </span>
          {playState.isPlaying && (
            <span className="text-[10px] text-amber-400/40">
              Physics: Active
            </span>
          )}
          {simulationState.isSimulating && !playState.isPlaying && (
            <span className="text-[10px] text-amber-400/40">
              Physics: Simulating
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {playState.isPlaying && (
            <span className="text-[10px] text-indigo-400/60">
              Play Mode
            </span>
          )}
          {simulationState.isSimulating && !playState.isPlaying && (
            <span className="text-[10px] text-amber-400/60">
              Simulation Mode
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'var(--wb-text-muted)' }}>
            WeildCreate v0.4
          </span>
        </div>
      </div>
    </div>
  );
}
