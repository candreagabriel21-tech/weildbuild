'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DiscordWidget } from './DiscordWidget';

/**
 * InfoPageLayout — Shared layout for static info pages (devlogs, rules, terms, privacy).
 * Uses indigo/violet accent colors (matching the app) instead of green.
 *
 * Footer is minimal: links on the left, copyright on the right.
 */
export function InfoPageLayout({
  title,
  subtitle,
  lastUpdated,
  children,
}: {
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a1a]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a1a]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <img src="/logos/logo.png" alt="WeildBuild" className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-500/20" />
              <img src="/logos/text_logo_simple.png" alt="WeildBuild" className="h-7" />
            </Link>

            <div className="hidden md:flex items-center gap-6">
              <Link href="/devlogs" className="text-white/60 hover:text-white transition-colors text-sm">Devlogs</Link>
              <Link href="/rules" className="text-white/60 hover:text-white transition-colors text-sm">Rules</Link>
              <Link href="/terms" className="text-white/60 hover:text-white transition-colors text-sm">Terms</Link>
              <Link href="/privacy" className="text-white/60 hover:text-white transition-colors text-sm">Privacy</Link>
            </div>

            {/* Spacer to keep logo left-aligned when nav links are hidden on mobile */}
            <div className="md:hidden" />
          </div>
        </div>
      </nav>

      {/* Hero header */}
      <header className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            <span className="gradient-text">{title}</span>
          </h1>
          {subtitle && <p className="text-lg text-white/50 max-w-2xl mx-auto">{subtitle}</p>}
          {lastUpdated && (
            <p className="text-sm text-white/30 mt-4">Last updated: {lastUpdated}</p>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {children}
        </article>
      </main>

      {/* Footer — minimal: ALL content on the left, right side left completely clear */}
      <footer className="border-t border-white/5 py-6 bg-[#0a0a1a] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-5 text-sm text-white/40">
              <Link href="/devlogs" className="hover:text-white/70 transition-colors">Devlogs</Link>
              <Link href="/rules" className="hover:text-white/70 transition-colors">Rules</Link>
              <Link href="/terms" className="hover:text-white/70 transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy</Link>
            </div>
            <span className="text-sm text-white/30">© {new Date().getFullYear()} WeildBuild</span>
          </div>
        </div>
      </footer>

      {/* Floating Discord widget */}
      <DiscordWidget />
    </div>
  );
}
