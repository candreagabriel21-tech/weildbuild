'use client';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ItemData } from "@/lib/store";
import { formatPrice, getItemColor } from "./shared";
import { ItemPreview3DLarge } from "./AvatarComponents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins, Palette, User, Calendar, Tag, Copy, X, Check, Info, Shield
} from "lucide-react";

// ==================== ITEM DETAIL POPUP ====================
export function ItemDetailPopup({
  item,
  onClose,
  onBuy,
  owned,
  canAfford,
  buying = false,
}: {
  item: ItemData;
  onClose: () => void;
  onBuy?: (itemId: string) => Promise<void>;
  owned: boolean;
  canAfford: boolean;
  /** When true, the Buy button renders a spinner and is disabled. Set by the
   *  parent (ShopView) which tracks per-item purchase in-flight state. */
  buying?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(item.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = item.id;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const stats = [
    { label: "Price", value: item.price === 0 ? "Free" : `${formatPrice(item.price)} WeBuy`, icon: Coins, color: "text-amber-400" },
    { label: "Type", value: item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1), icon: Tag, color: "text-violet-400" },
    { label: "Creator", value: item.creator || "WeildBuild", icon: User, color: "text-indigo-400" },
    { label: "Created", value: item.date_created ? new Date(item.date_created).toLocaleDateString() : "Unknown", icon: Calendar, color: "text-purple-400" },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <Card className="bg-slate-900 border-indigo-500/30">
            {/* Header with 3D preview and item name */}
            <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-r from-indigo-600/20 via-violet-600/20 to-purple-600/20 border-b border-indigo-500/20 p-6">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex flex-col items-center gap-4">
                <ItemPreview3DLarge item={item} />
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white">{item.display_name}</h2>
                  {owned && (
                    <Badge className="mt-2 bg-indigo-600 text-xs">Owned</Badge>
                  )}
                </div>
              </div>
            </div>

            <CardContent className="p-5 space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-2">
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    <div>
                      <p className="text-sm font-bold text-white">{stat.value}</p>
                      <p className="text-[10px] text-slate-400">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info Card */}
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm text-white flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-400" /> Item Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm px-4 pb-3">
                  {/* Description */}
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400">Description</span>
                    <span className="text-white">{item.description || "No description"}</span>
                  </div>

                  {/* Item Key with copy button */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Item Key</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-slate-700/50 px-2 py-0.5 rounded text-indigo-300 font-mono">{item.id}</code>
                      <button
                        onClick={handleCopyKey}
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="Copy item key"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Type</span>
                    <span className="text-white capitalize">{item.item_type}</span>
                  </div>

                  {/* Date Created */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Date Created</span>
                    <span className="text-white">{item.date_created ? new Date(item.date_created).toLocaleDateString() : "Unknown"}</span>
                  </div>

                  {/* Creator */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Creator</span>
                    <span className="text-white">{item.creator || "WeildBuild"}</span>
                  </div>

                  {/* Price */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Price</span>
                    <div className="flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-amber-300 font-medium">{item.price === 0 ? "Free" : formatPrice(item.price)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Buy button */}
              {onBuy && !owned && (
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-500 text-sm"
                  loading={buying}
                  onClick={() => onBuy(item.id)}
                  disabled={!canAfford}
                >
                  {item.price === 0 ? "Free" : <><Coins className="w-4 h-4 mr-1" /> Buy: {formatPrice(item.price)} WeBuy</>}
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
