'use client';

import { useStudioStore } from '@/lib/studio-store';
import { Info, AlertTriangle, XCircle, CheckCircle, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

const MAX_VISIBLE_MESSAGES = 200;

export function OutputConsole() {
  const { consoleMessages, clearConsole } = useStudioStore();

  const visibleMessages = useMemo(
    () => consoleMessages.slice(-MAX_VISIBLE_MESSAGES).reverse(),
    [consoleMessages]
  );

  const getIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="w-3 h-3 text-blue-400" />;
      case 'warn': return <AlertTriangle className="w-3 h-3 text-yellow-400" />;
      case 'error': return <XCircle className="w-3 h-3 text-red-400" />;
      case 'success': return <CheckCircle className="w-3 h-3 text-green-400" />;
      default: return <Info className="w-3 h-3 text-white/40" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'info': return 'text-blue-300/80';
      case 'warn': return 'text-yellow-300/80';
      case 'error': return 'text-red-300/80';
      case 'success': return 'text-green-300/80';
      default: return 'text-white/40';
    }
  };

  return (
    <div className="h-full flex flex-col border-t" style={{ background: 'var(--wb-bg-app)', borderColor: 'var(--wb-border-subtle)' }}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
        <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Output</h3>
        <button
          onClick={clearConsole}
          className="text-white/20 hover:text-white/40 transition-colors"
          title="Clear console"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto studio-panel font-mono text-[10px]" style={{ maxHeight: '300px' }}>
        {visibleMessages.length === 0 ? (
          <div className="p-3 text-white/15 text-center">
            Output console ready
          </div>
        ) : (
          visibleMessages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start gap-2 px-3 py-1 hover:bg-white/[0.02] border-b border-white/[0.02]"
            >
              {getIcon(msg.type)}
              <span className={getColor(msg.type)}>{msg.message}</span>
              <span className="text-white/10 ml-auto shrink-0">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
