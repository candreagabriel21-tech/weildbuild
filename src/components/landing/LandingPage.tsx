'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/store';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AuthDialogs } from '@/components/landing/AuthDialogs';
import { DiscordWidget } from '@/components/landing/DiscordWidget';
import {
  Box,
  Gamepad2,
  Users,
  ShoppingBag,
  MessageSquare,
  Bell,
  Shield,
  Cpu,
  Palette,
  Globe,
  Sparkles,
  ArrowRight,
  LogOut,
  Wrench,
  Layers,
  Zap,
  UserPlus,
  Settings,
  Search,
  Hammer,
} from 'lucide-react';

export default function LandingPage() {
  const { isLoggedIn, user, refreshUser, logout } = useAuth();
  const [authSignal, setAuthSignal] = useState(0);

  const triggerAuth = () => setAuthSignal(s => s + 1);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a1a]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a1a]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/logos/logo.png" alt="WeildBuild" className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-500/20" />
              <img src="/logos/text_logo_simple.png" alt="WeildBuild" className="h-7" />
            </div>

            <div className="hidden md:flex items-center gap-6">
              <a href="#how-to-play" className="text-white/60 hover:text-white transition-colors text-sm">How to Play</a>
              <a href="#studio" className="text-white/60 hover:text-white transition-colors text-sm">Studio</a>
              <a href="#roadmap" className="text-white/60 hover:text-white transition-colors text-sm">Roadmap</a>
              <Link href="/devlogs" className="text-white/60 hover:text-white transition-colors text-sm">Devlogs</Link>
            </div>

            <div className="flex items-center gap-3">
              {isLoggedIn && user ? (
                <>
                  <div className="hidden sm:flex items-center gap-2 text-sm text-white/70">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                      {user.username[0].toUpperCase()}
                    </div>
                    <span>{user.username}</span>
                    <span className="text-amber-400 font-semibold">💰 {user.webuy}</span>
                  </div>
                  <Link href="/studio">
                    <Button className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white border-0 shadow-lg shadow-indigo-500/25">
                      <Wrench className="w-4 h-4 mr-2" />
                      Open Studio
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/60 hover:text-white hover:bg-white/10"
                    onClick={logout}
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <AuthDialogs openSignal={authSignal} />
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Background gradient effects */}
          <div className="absolute inset-0">
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
            <div className="absolute top-40 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 left-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
            <div className="text-center">
              {/* Text Logo — thinner version, no overlap */}
              <div className="flex justify-center">
                <img src="/logos/text_logo_simple.png" alt="WeildBuild" className="h-36 sm:h-44 object-contain" />
              </div>

              {/* Main headline */}
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-3 leading-tight">
                Build Anything, <span className="gradient-text">Be Anything.</span>
              </h1>

              <p className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto mb-6 leading-relaxed">
                Join and have fun with people like you! Create your games your way, or play games made by other players.
                <br />
                <span className="text-white/80 font-semibold">The important rule: Have fun!</span>
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {!isLoggedIn ? (
                  <Button
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white border-0 shadow-xl shadow-indigo-500/25 text-base px-8 py-4 h-auto"
                    onClick={triggerAuth}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Join the Fun
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Link href="/studio">
                    <Button className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white border-0 shadow-xl shadow-indigo-500/25 text-base px-8 py-4 h-auto">
                      <Wrench className="w-4 h-4 mr-2" />
                      Open Studio
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* How to Play Section */}
        <section id="how-to-play" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                How to <span className="gradient-text">Play?</span>
              </h2>
              <p className="text-white/50 max-w-2xl mx-auto">
                6 simple steps to start
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StepCard
                step="1"
                title="Create an Account"
                text='Click "Register" or "Join the Fun", create an account, set a strong password or Sign In if you already have one!'
              />
              <StepCard
                step="2"
                title="Choose Your Games"
                text='Search a game name or genre with the search bar, or play one from the "Home" tab!'
              />
              <StepCard
                step="3"
                title="Change Your Avatar"
                text="Search the Shop, buy accessories for your avatar and design your perfect outfit!"
              />
              <StepCard
                step="4"
                title="Make Friends"
                text="Add people you know or met in games, then chat with them via the embedded messenger!"
              />
              <StepCard
                step="5"
                title="Set your Settings"
                text="Modify settings to your likings!"
              />
              <StepCard
                step="6"
                title="Create Something Cool"
                text='Click the "Create" button and start building your small little universe! Your world, your rules!'
              />
            </div>
          </div>
        </section>

        {/* Studio Editor Section */}
        <section id="studio" className="py-24 relative">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                  The <span className="gradient-text">Studio Editor</span>
                </h2>
                <p className="text-white/50 mb-8 leading-relaxed">
                  A simple, embedded editor for easy creation. The main subject of the game.
                  Easily reachable for quick creation, there for everyone and everywhere.
                </p>
                <div className="space-y-4">
                  <FeatureItem icon={<Layers />} text="Ribbon Toolbar with tabs for each part of a game" />
                  <FeatureItem icon={<Box />} text="3D viewport with orbit controls, grid, and gizmos" />
                  <FeatureItem icon={<Cpu />} text="Object Explorer for scene hierarchy management" />
                  <FeatureItem icon={<Palette />} text="Properties panel for editing part attributes" />
                  <FeatureItem icon={<Gamepad2 />} text="Play mode with WASD movement and physics" />
                </div>
                <Link href="/studio">
                  <Button className="mt-8 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white border-0 shadow-lg shadow-indigo-500/25">
                    Try the Studio
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <div className="relative">
                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-indigo-500/10">
                  <div className="bg-[#1e1e2e] p-1">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                      <div className="w-3 h-3 rounded-full bg-red-500/60" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                      <div className="w-3 h-3 rounded-full bg-green-500/60" />
                      <span className="text-xs text-white/30 ml-2">WeildBuild Studio</span>
                    </div>
                    {/* Editor screenshot */}
                    <div className="aspect-video bg-[#1a1a2e] flex items-center justify-center overflow-hidden">
                      <img
                        src="/editor/studio-screenshot.png"
                        alt="WeildBuild Studio Editor"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Current Roadmap Section */}
        <section id="roadmap" className="py-24 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Current <span className="gradient-text">Roadmap</span>
              </h2>
              <p className="text-white/50 max-w-2xl mx-auto">
                Next updates and ideas that are waiting to be implemented until the big launch
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <RoadmapCard version="WBeta 0.0.3" title="Python Test" text="The first ever python test of the app. This version adds a simple avatar system and game loader." status="done" />
              <RoadmapCard version="WeildBeta 1.0.0 to 1.1.0" title="Unstable Python Build" text="The Second ever python test of the app. This version adds full 3D avatars." status="done" />
              <RoadmapCard version="v1.2.0-dev to v1.2.5-dev" title="The Founding Version" text="The first ever version released to the public. This version adds the editor." status="done" />
              <RoadmapCard version="v1.3.0-dev" title="The Editor Update" text="This version adds a much better editor and small tweaks regarding structure, which will help WeildBuild expand much faster." status="current" />
              <RoadmapCard version="v1.4.0-InDev" title="The Fashion Update" text="Better shirts, pants, body parts, hair, accessories, the ability to create custom items and much more!" status="upcoming" />
              <RoadmapCard version="v1.5.0-InDev" title="The Admin Update" text="Lets players get admin commands in their games, easier management, reporting users, games and items and much more!" status="upcoming" />
              <RoadmapCard version="v1.6.0-InDev" title="The Social Update" text='Add forums, "best friends", update voting and more social features to WeildBuild.' status="upcoming" />
              <RoadmapCard version="v1.7.0 BETA" title="Clean-up and Prepare for Launch" text="This version will be focused on adding more features to make WeildBuild more smoother and bug repairing." status="upcoming" />
              <RoadmapCard version="v1.8.0 Alpha" title="Still thinking.." text="Still thinking.." status="upcoming" />
              <RoadmapCard version="v1.9.0 Pre-Release" title="Still thinking.." text="Still thinking.." status="upcoming" />
              <RoadmapCard version="v1.10.0 Release" title="Still thinking.." text="Still thinking.." status="upcoming" />
            </div>
          </div>
        </section>

        {/* Showcase Section */}
        <section className="py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                <span className="gradient-text">Showcase</span>
              </h2>
              <p className="text-white/50 max-w-2xl mx-auto">
                A look at some of the tabs in WeildBuild
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ShowcaseCard label="Home" description="Browse games, check your stats, and see what's featured" color="from-indigo-500/20 to-violet-600/5" />
              <ShowcaseCard label="Shop" description="Buy faces, shirts, and pants with your WeBuy currency" color="from-amber-500/20 to-orange-600/5" />
              <ShowcaseCard label="Avatar" description="Customize your character with skins, faces, and outfits" color="from-pink-500/20 to-rose-600/5" />
              <ShowcaseCard label="Friends" description="Add friends, see who's online, and chat in real-time" color="from-violet-500/20 to-purple-600/5" />
              <ShowcaseCard label="Inventory" description="Manage your items and games all in one place" color="from-cyan-500/20 to-blue-600/5" />
              <ShowcaseCard label="Studio" description="Build 3D games with parts, terrain, physics, and WeildCode" color="from-emerald-500/20 to-green-600/5" />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 relative">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/5 to-transparent" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6">
              Ready to <span className="gradient-text">Start Playing?</span>
            </h2>
            <p className="text-white/50 text-lg mb-10 max-w-2xl mx-auto">
              Join WeildBuild today and have fun!
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {!isLoggedIn ? (
                <Button
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white border-0 shadow-xl shadow-indigo-500/25 text-lg px-10 py-6 h-auto"
                  onClick={triggerAuth}
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Join the Fun
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Link href="/studio">
                  <Button className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white border-0 shadow-xl shadow-indigo-500/25 text-lg px-10 py-6 h-auto">
                    <Wrench className="w-5 h-5 mr-2" />
                    Open WeildBuild Studio
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer — matches info page footers: links + copyright on the left */}
      <footer className="border-t border-white/5 py-6 bg-[#0a0a1a]">
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

function StepCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className="rounded-xl p-6 bg-gradient-to-br from-indigo-500/10 to-violet-600/5 border border-indigo-500/10 hover:border-indigo-500/30 transition-all duration-300 hover:scale-[1.02]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
          {step}
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <p className="text-white/50 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-indigo-400">{icon}</div>
      <span className="text-white/70 text-sm">{text}</span>
    </div>
  );
}

function RoadmapCard({ version, title, text, status }: { version: string; title: string; text: string; status: 'done' | 'current' | 'upcoming' }) {
  const statusConfig = {
    done: { label: 'Released', color: 'bg-green-500/20 text-green-400 border-green-500/30', dot: 'bg-green-400' },
    current: { label: 'Current', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', dot: 'bg-indigo-400' },
    upcoming: { label: 'Upcoming', color: 'bg-white/5 text-white/40 border-white/10', dot: 'bg-white/30' },
  };
  const config = statusConfig[status];

  return (
    <div className={`rounded-xl p-5 border transition-all duration-300 hover:scale-[1.02] ${
      status === 'current'
        ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg shadow-indigo-500/10'
        : 'bg-white/[0.03] border-white/5 hover:border-white/10'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-white/50">{version}</span>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${config.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
          {config.label}
        </span>
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-white/40 text-xs leading-relaxed">{text}</p>
    </div>
  );
}

function ShowcaseCard({ label, description, color }: { label: string; description: string; color: string }) {
  return (
    <div className={`rounded-xl p-6 bg-gradient-to-br ${color} border border-white/5 hover:border-white/10 transition-all duration-300 hover:scale-[1.02]`}>
      <div className="aspect-video rounded-lg bg-black/30 border border-white/5 flex items-center justify-center mb-4">
        <span className="text-3xl font-bold text-white/20">{label}</span>
      </div>
      <h3 className="text-sm font-semibold text-white mb-1">{label}</h3>
      <p className="text-white/40 text-xs">{description}</p>
    </div>
  );
}
