'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins } from 'lucide-react';

/**
 * WebuyDisplay — Clickable WeBuy currency display with info tooltip.
 *
 * Shows the WeBuy balance with a coin icon. When clicked, toggles a small
 * popup explaining what WeBuy is and how account visibility works.
 *
 * Variants:
 *   - "compact"  : small pill (for top bars), e.g. <WebuyDisplay amount={120} variant="compact" />
 *   - "default"  : larger pill with "WeBuy" label (for shop headers), e.g. <WebuyDisplay amount={120} />
 *   - "stat"     : stat-card style with big number + label (for home/lobby), e.g. <WebuyDisplay amount={120} variant="stat" />
 */

const INFO_TEXT = "This is our currency called WeBuy! It's used to buy items for your avatar in shop! Other people can see your WeBuy balance, but you can toggle account visibility in Settings.";

export function WebuyDisplay({
  amount,
  variant = 'default',
}: {
  amount: number;
  variant?: 'compact' | 'default' | 'stat';
}) {
  const [showInfo, setShowInfo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!showInfo) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInfo]);

  // ─── Stat variant (home/lobby grid card) ───
  if (variant === 'stat') {
    return (
      <div ref={containerRef} className="relative">
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="w-full text-left bg-slate-800/50 border-slate-700/50 rounded-xl p-4 flex items-center gap-3 hover:border-amber-500/40 transition-colors cursor-help"
          title="Click to learn about WeBuy"
        >
          <Coins className="w-8 h-8 text-amber-400 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-white">{amount}</p>
            <p className="text-xs text-slate-400">WeBuy</p>
          </div>
        </button>
        <WebuyInfoPopup show={showInfo} />
      </div>
    );
  }

  // ─── Compact variant (top bar pill) ───
  if (variant === 'compact') {
    return (
      <div ref={containerRef} className="relative">
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="flex items-center gap-1.5 bg-amber-500/20 px-2.5 py-1 rounded-full hover:bg-amber-500/30 transition-colors cursor-help"
          title="Click to learn about WeBuy"
        >
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-amber-300 font-bold text-xs">{amount}</span>
        </button>
        <WebuyInfoPopup show={showInfo} />
      </div>
    );
  }

  // ─── Default variant (shop header pill) ───
  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="flex items-center gap-1.5 bg-amber-500/20 px-4 py-2 rounded-full hover:bg-amber-500/30 transition-colors cursor-help"
        title="Click to learn about WeBuy"
      >
        <Coins className="w-5 h-5 text-amber-400" />
        <span className="text-amber-300 font-bold">{amount} WeBuy</span>
      </button>
      <WebuyInfoPopup show={showInfo} />
    </div>
  );
}

/**
 * The info popup — shared across all variants.
 * Positioned below-right of the parent container.
 */
function WebuyInfoPopup({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-amber-500/30 bg-[#1a1a2e]/95 backdrop-blur-xl shadow-2xl shadow-amber-500/10 p-4 z-50"
        >
          <div className="flex items-start gap-2 mb-2">
            <Coins className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <h4 className="text-white font-semibold text-sm">What is WeBuy?</h4>
          </div>
          <p className="text-white/60 text-xs leading-relaxed">{INFO_TEXT}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
