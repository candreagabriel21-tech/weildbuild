'use client';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { UserData, GameData } from "@/lib/store";
import type { View } from "@/lib/store";
import { moderateText, isTextClean } from "./shared";
import { AvatarIcon } from "./AvatarComponents";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Gamepad2, Coins, Palette, Users, Star, Play, Eye,
  Search, Sparkles, Hammer
} from "lucide-react";

// ==================== LOBBY VIEW ====================
export function LobbyView({ user, games, onPlayGame, onCreateGame, onOpenCreate }: { user: UserData; games: GameData[]; onPlayGame: (game: GameData) => void; onCreateGame: (game: Partial<GameData>) => Promise<GameData | null>; onOpenCreate: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [newMulti, setNewMulti] = useState(false);
  const [creating, setCreating] = useState(false);
  const [gameSearch, setGameSearch] = useState("");
  const [gameSort, setGameSort] = useState<string>("most_played");
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerResults, setPlayerResults] = useState<any[]>([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const { toast } = useToast();

  // Filter & sort games
  let displayGames = games.filter((g) => g.public !== false);
  if (gameSearch.trim()) {
    const q = gameSearch.toLowerCase();
    displayGames = displayGames.filter((g) => g.name.toLowerCase().includes(q) || (g.description || "").toLowerCase().includes(q));
  }
  if (gameSort === "most_played") displayGames = [...displayGames].sort((a, b) => (b.plays || 0) - (a.plays || 0));
  else if (gameSort === "newest") displayGames = [...displayGames].sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime());
  else if (gameSort === "alpha") displayGames = [...displayGames].sort((a, b) => a.name.localeCompare(b.name));
  const featuredGames = displayGames.slice(0, 8);
  const myGames = games.filter((g) => g.creator === user.username);

  const handlePlayerSearch = async () => {
    if (!playerSearch.trim()) return;
    setPlayerSearchLoading(true);
    try {
      const res = await fetch(`/api/friends?search=${encodeURIComponent(playerSearch.trim())}`);
      const data = await res.json();
      setPlayerResults(Array.isArray(data) ? data : []);
    } catch {} setPlayerSearchLoading(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (!isTextClean(newName)) { toast({ title: "Inappropriate name", variant: "destructive" }); return; }
    setCreating(true);
    const result = await onCreateGame({
      name: moderateText(newName.trim()),
      description: moderateText(newDesc.trim()) || "A WeildBuild game",
      public: newPublic,
      multiplayer: newMulti,
      primitives: [],
      sky_color_top: [0.4, 0.6, 0.9],
      sky_color_bottom: [0.7, 0.8, 0.95],
      baseplate_color: [0.24, 0.4, 0.4],
      baseplate_size: 50,
      spawn_point: [0, 0, 0],
      max_players: newMulti ? 10 : 1,
    });
    setCreating(false);
    if (result) {
      setShowCreate(false); setNewName(""); setNewDesc("");
      toast({ title: "Game created!", description: `"${result.name}" is ready to play` });
    } else {
      toast({ title: "Failed to create game", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600/20 via-violet-600/20 to-purple-600/20 border border-indigo-500/20 p-8">
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center justify-center">
            <AvatarIcon avatar={user.avatar} size={112} />
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white">Welcome back, <span className="text-indigo-400">{moderateText(user.username)}</span>!</h2>
            <p className="text-slate-300 mt-2 text-lg">Ready to create something amazing?</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onOpenCreate} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
              <Hammer className="w-4 h-4" /> Create Game
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Quick Create */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>
              <Card className="bg-slate-900 border-indigo-500/30 w-[400px] max-w-[90vw]">
                <CardHeader className="pb-3"><CardTitle className="text-xl text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-400" /> Quick Create</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div><label className="text-sm text-slate-400 mb-1 block">Game Name</label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My awesome game" className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" /></div>
                  <div><label className="text-sm text-slate-400 mb-1 block">Description</label>
                    <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Describe your game..." className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" /></div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
                    <div><p className="text-sm text-white">Public Game</p></div>
                    <button onClick={() => setNewPublic(!newPublic)} className={`w-11 h-6 rounded-full transition-all ${newPublic ? "bg-indigo-500" : "bg-slate-600"}`}>
                      <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: newPublic ? "translateX(22px)" : "translateX(2px)" }} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
                    <div><p className="text-sm text-white">Multiplayer</p></div>
                    <button onClick={() => setNewMulti(!newMulti)} className={`w-11 h-6 rounded-full transition-all ${newMulti ? "bg-indigo-500" : "bg-slate-600"}`}>
                      <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: newMulti ? "translateX(22px)" : "translateX(2px)" }} />
                    </button>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1 border-slate-600 text-slate-300" onClick={() => setShowCreate(false)}>Cancel</Button>
                    <Button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white" onClick={handleCreate} disabled={creating || !newName.trim()}>{creating ? "Creating..." : "Create"}</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "WeBuy", value: user.webuy, icon: Coins, color: "text-amber-400" },
          { label: "Games", value: myGames.length, icon: Gamepad2, color: "text-indigo-400" },
          { label: "Items", value: user.items_owned.length, icon: Palette, color: "text-purple-400" },
          { label: "Friends", value: user.friends.length, icon: Users, color: "text-violet-400" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-2.5 flex items-center gap-2.5">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
              <div><p className="text-lg font-bold text-white leading-tight">{stat.value}</p><p className="text-[11px] text-slate-400 leading-tight">{stat.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2"><Star className="w-5 h-5 text-amber-400" /> Featured Games</h3>
        </div>
        {/* Game Search & Sort */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <Input placeholder="Search games..." value={gameSearch} onChange={(e) => setGameSearch(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white text-sm h-9 pl-8" />
          </div>
          <Select value={gameSort} onValueChange={setGameSort}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm h-9 w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="most_played">Most Played</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="alpha">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {featuredGames.length === 0 ? (
          <Card className="bg-slate-800/30 border-slate-700/50"><CardContent className="p-8 text-center">
            <Gamepad2 className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No games yet! Create one to get started.</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {featuredGames.map((game, i) => (
              <motion.div key={game.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="bg-slate-800/50 border-slate-700/50 hover:border-indigo-500/50 transition-all cursor-pointer group overflow-hidden" onClick={() => onPlayGame(game)}>
                  <div className="h-32 bg-gradient-to-br from-indigo-600/30 to-violet-600/30 flex items-center justify-center relative">
                    <Gamepad2 className="w-10 h-10 text-indigo-400/50" />
                    {game.multiplayer && <Badge className="absolute top-2 right-2 bg-violet-500/80 text-xs"><Users className="w-3 h-3 mr-1" /> Multi</Badge>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Play className="w-12 h-12 text-white" /></div>
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-semibold text-white truncate">{moderateText(game.name)}</h4>
                    <p className="text-xs text-slate-400 mt-1">by {moderateText(game.creator)}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500"><span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {game.plays || 0}</span></div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Find Players */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-violet-400" /> Find Players</h3>
        </div>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <Input placeholder="Search by username..." value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePlayerSearch()}
              className="bg-slate-800 border-slate-700 text-white text-sm h-9 pl-8" />
          </div>
          <Button size="sm" className="bg-indigo-600 h-9" onClick={handlePlayerSearch} disabled={playerSearchLoading}>
            <Search className="w-4 h-4" />
          </Button>
        </div>
        {playerResults.length > 0 && (
          <div className="space-y-2">
            {playerResults.map((u: any) => {
              const isMe = u.username === user.username;
              return (
                <Card key={u.username} className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {u.avatar ? <AvatarIcon avatar={u.avatar} size={28} /> : <div className="w-7 h-7 rounded-full bg-slate-600" />}
                      <span className="text-sm text-slate-200">{moderateText(u.username)}</span>
                      {isMe && <Badge variant="outline" className="text-slate-500 text-[10px]">You</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        {playerResults.length === 0 && playerSearch && !playerSearchLoading && (
          <p className="text-slate-500 text-center py-4 text-sm">Search for players by username</p>
        )}
      </section>
    </div>
  );
}
