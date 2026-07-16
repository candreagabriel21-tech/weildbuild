'use client';

import { useState } from "react";
import { motion } from "framer-motion";
import type { UserData, ItemData, GameData } from "@/lib/store";
import type { View } from "@/lib/store";
import { Item3DPreview, FacePreviewModal } from "./AvatarComponents";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingBag, Palette, Eye, Gamepad2, Play, Users } from "lucide-react";

// ==================== INVENTORY VIEW ====================
export function InventoryView({
  user,
  items,
  games,
  onNavigate,
  onPlayGame,
}: {
  user: UserData;
  items: ItemData[];
  games: GameData[];
  onNavigate: (view: View) => void;
  onPlayGame: (game: GameData) => void;
}) {
  const [tab, setTab] = useState("all");
  const [previewFace, setPreviewFace] = useState<string | null>(null);
  const ownedItems = items.filter((i) => user.items_owned.includes(i.id));
  const filtered = tab === "all" ? ownedItems : ownedItems.filter((i) => i.item_type === tab);

  // My games = games created by this user
  const myGames = games.filter((g) => g.creator === user.username);

  const typeCounts = {
    all: ownedItems.length,
    face: ownedItems.filter(i => i.item_type === "face").length,
    shirt: ownedItems.filter(i => i.item_type === "shirt").length,
    pants: ownedItems.filter(i => i.item_type === "pants").length,
    games: myGames.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Package className="w-6 h-6 text-indigo-400" /> My Inventory</h2>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-indigo-500/50 text-indigo-400 text-sm px-3 py-1">
            {ownedItems.length} items · {myGames.length} games
          </Badge>
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800" onClick={() => onNavigate("shop")}>
            <ShoppingBag className="w-4 h-4 mr-2" /> Shop
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-800">
          <TabsTrigger value="all" className="data-[state=active]:bg-indigo-600">
            All ({typeCounts.all})
          </TabsTrigger>
          <TabsTrigger value="face" className="data-[state=active]:bg-indigo-600">
            Faces ({typeCounts.face})
          </TabsTrigger>
          <TabsTrigger value="shirt" className="data-[state=active]:bg-indigo-600">
            Shirts ({typeCounts.shirt})
          </TabsTrigger>
          <TabsTrigger value="pants" className="data-[state=active]:bg-indigo-600">
            Pants ({typeCounts.pants})
          </TabsTrigger>
          <TabsTrigger value="games" className="data-[state=active]:bg-indigo-600">
            <Gamepad2 className="w-3.5 h-3.5 mr-1.5" />
            Games ({typeCounts.games})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ─── GAMES TAB ─── */}
      {tab === "games" ? (
        myGames.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="py-16 flex flex-col items-center justify-center text-center">
              <Gamepad2 className="w-16 h-16 text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">You haven&apos;t created any games yet</h3>
              <p className="text-sm text-slate-500 mb-4 max-w-sm">Head over to the Studio to build your first game and it will show up here!</p>
              <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => onNavigate("create")}>
                <Palette className="w-4 h-4 mr-2" /> Open Studio
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myGames.map((game, i) => (
              <motion.div key={game.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
                <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden ring-1 ring-indigo-500/30 hover:ring-indigo-500/60 transition-all">
                  {/* Game thumbnail header */}
                  <div
                    className="h-28 flex items-center justify-center relative"
                    style={{
                      background: `linear-gradient(135deg, ${
                        game.sky_color_top
                          ? `rgb(${game.sky_color_top[0] * 255}, ${game.sky_color_top[1] * 255}, ${game.sky_color_top[2] * 255})`
                          : '#1e293b'
                      }, ${
                        game.sky_color_bottom
                          ? `rgb(${game.sky_color_bottom[0] * 255}, ${game.sky_color_bottom[1] * 255}, ${game.sky_color_bottom[2] * 255})`
                          : '#0f172a'
                      })`
                    }}
                  >
                    <Gamepad2 className="w-12 h-12 text-white/70" />
                    {game.public && (
                      <Badge className="absolute top-2 right-2 bg-green-600 text-xs">Published</Badge>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-semibold text-white text-sm truncate">{game.name || 'Untitled Game'}</h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{game.description || 'No description'}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><Play className="w-3 h-3" /> {game.plays || 0} plays</span>
                      {game.multiplayer && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Multiplayer</span>}
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 text-xs"
                      onClick={() => onPlayGame(game)}
                    >
                      <Play className="w-3 h-3 mr-1" /> Play
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )
      ) : (
        /* ─── ITEMS TABS (all / face / shirt / pants) ─── */
        ownedItems.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="py-16 flex flex-col items-center justify-center text-center">
              <Package className="w-16 h-16 text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">Your inventory is empty</h3>
              <p className="text-sm text-slate-500 mb-4 max-w-sm">Head over to the shop to get cool faces, shirts, and pants for your avatar!</p>
              <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => onNavigate("shop")}>
                <ShoppingBag className="w-4 h-4 mr-2" /> Visit Shop
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((item, i) => {
              const isEquipped =
                (item.item_type === "face" && user.avatar?.face === item.id) ||
                (item.item_type === "shirt" && user.avatar?.shirt === item.id) ||
                (item.item_type === "pants" && (user.avatar?.left_leg === item.id || user.avatar?.right_leg === item.id));
              return (
                <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
                  <Card className={`bg-slate-800/50 border-slate-700/50 overflow-hidden ${isEquipped ? "ring-2 ring-green-500/60" : "ring-1 ring-indigo-500/30"}`}>
                    <div className="h-28 flex items-center justify-center relative" style={{ backgroundColor: item.color + "20" }}>
                      <Item3DPreview item={item} />
                      {isEquipped && <Badge className="absolute top-2 right-2 bg-green-600 text-xs">Equipped</Badge>}
                      {item.item_type === "face" && (
                        <button className="absolute bottom-1 right-1 bg-slate-900/70 hover:bg-indigo-600/80 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                          onClick={() => setPreviewFace(item.id)} title="Preview face">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h4 className="font-semibold text-white text-sm truncate">{item.display_name}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{item.description}</p>
                      <div className="mt-2">
                        {isEquipped ? (
                          <Badge className="bg-green-600/20 text-green-400 text-xs border border-green-500/30">Currently Wearing</Badge>
                        ) : (
                          <Button size="sm" variant="outline" className="w-full border-indigo-500/50 text-indigo-400 hover:bg-indigo-600/20 text-xs" onClick={() => onNavigate("avatar")}>
                            <Palette className="w-3 h-3 mr-1" /> Equip in Avatar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )
      )}
      {previewFace && <FacePreviewModal faceId={previewFace} open={!!previewFace} onClose={() => setPreviewFace(null)} />}
    </div>
  );
}
