'use client';

import dynamic from 'next/dynamic';

const StudioLayout = dynamic(
  () => import('@/components/studio/StudioLayout').then((mod) => mod.StudioLayout),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen bg-[#1a1a2a] flex items-center justify-center">
        <div className="text-center">
          <img src="/logos/logo.png" alt="WeildBuild" className="w-16 h-16 rounded-2xl mx-auto mb-4 animate-pulse" />
          <h2 className="text-lg font-bold text-white/80 mb-2">Loading WeildBuild Studio</h2>
          <p className="text-sm text-white/30">Initializing 3D engine...</p>
          <div className="mt-4 w-48 h-1 bg-white/5 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    ),
  }
);

export default function StudioPage() {
  return <StudioLayout />;
}
