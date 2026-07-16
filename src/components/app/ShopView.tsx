'use client';

import { useState } from "react";
import { motion } from "framer-motion";
import type { UserData, ItemData } from "@/lib/store";
import { Item3DPreview } from "./AvatarComponents";
import { ItemDetailPopup } from "./ItemDetailPopup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, Coins, Search, MoreVertical, Check, Loader2 } from "lucide-react";
import { formatPrice } from "./shared";
import { WebuyDisplay } from "./WebuyDisplay";
import { useLoadingMap } from "@/hooks/use-loading-action";

// ==================== SHOP VIEW ====================
export function ShopView({ user, items, onBuy }: { user: UserData; items: ItemData[]; onBuy: (itemId: string) => Promise<void> }) {
  const [tab, setTab] = useState("face");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<string>("default");
  const [detailItem, setDetailItem] = useState<ItemData | null>(null);
  const { isLoading: isBuying, run: runBuy } = useLoadingMap();

  let filtered = items.filter((i) => i.item_type === tab);
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((i) => i.display_name.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q) || (i.creator || "").toLowerCase().includes(q));
  }
  if (sortOption === "price_asc") filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (sortOption === "price_desc") filtered = [...filtered].sort((a, b) => b.price - a.price);
  else if (sortOption === "name_az") filtered = [...filtered].sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><ShoppingBag className="w-6 h-6 text-indigo-400" /> Item Shop</h2>
        <WebuyDisplay amount={user.webuy} />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-800">
          <TabsTrigger value="face" className="data-[state=active]:bg-indigo-600">Faces</TabsTrigger>
          <TabsTrigger value="shirt" className="data-[state=active]:bg-indigo-600">Shirts</TabsTrigger>
          <TabsTrigger value="pants" className="data-[state=active]:bg-indigo-600">Pants</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white text-sm h-9 pl-8" />
        </div>
        <Select value={sortOption} onValueChange={setSortOption}>
          <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm h-9 w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="price_asc">Price: Low → High</SelectItem>
            <SelectItem value="price_desc">Price: High → Low</SelectItem>
            <SelectItem value="name_az">Name: A → Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((item, i) => {
          const owned = user.items_owned.includes(item.id);
          return (
            <motion.div key={item.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
              <Card className={`bg-slate-800/50 border-slate-700/50 overflow-hidden ${owned ? "ring-1 ring-indigo-500/50" : ""}`}>
                <div className="flex items-center justify-center relative" style={{ backgroundColor: "#1a0a2e" }}>
                  <Item3DPreview item={item} />
                  {owned && <Badge className="absolute top-2 right-2 bg-indigo-600 text-xs">Owned</Badge>}
                </div>
                <CardContent className="p-3">
                  <h4 className="font-semibold text-white text-sm truncate">{item.display_name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">By: {item.creator || "WeildBuild"}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {owned ? (
                      <Badge variant="outline" className="border-indigo-500/50 text-indigo-400 text-xs flex-1 justify-center">
                        <Check className="w-3 h-3 mr-1" /> In Inventory
                      </Badge>
                    ) : (
                      <Button size="sm" className="flex-1 bg-amber-600 hover:bg-amber-500 text-xs" onClick={() => runBuy(item.id, () => onBuy(item.id))} disabled={user.webuy < item.price || isBuying(item.id)}>
                        {isBuying(item.id) ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Buying...</> : item.price === 0 ? "Free" : <><Coins className="w-3 h-3 mr-1" /> Buy: {formatPrice(item.price)} WeBuy</>}
                      </Button>
                    )}
                    <button
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
                      onClick={() => setDetailItem(item)}
                      title="Item details"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="text-slate-500 text-center py-8">No items match your search.</p>}
      {detailItem && (
        <ItemDetailPopup
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onBuy={onBuy}
          owned={user.items_owned.includes(detailItem.id)}
          canAfford={user.webuy >= detailItem.price}
        />
      )}
    </div>
  );
}
