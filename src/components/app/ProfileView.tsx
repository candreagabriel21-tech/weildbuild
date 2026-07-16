'use client';

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { UserData } from "@/lib/store";
import type { View } from "@/lib/store";
import { moderateText, isTextClean } from "./shared";
import { AvatarIcon3D } from "./AvatarComponents";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Palette, Users, Shield, Gamepad2, Pencil, User } from "lucide-react";

// ==================== PROFILE VIEW ====================
export function ProfileView({ user, onNavigate, onUpdate }: { user: UserData; onNavigate: (v: View) => void; onUpdate: (updates: Partial<UserData>) => Promise<void> }) {
  const [editingDesc, setEditingDesc] = useState(false);
  const [descText, setDescText] = useState(user.description || "");
  const { toast } = useToast();

  useEffect(() => { setDescText(user.description || ""); }, [user.description]); // eslint-disable-line react-hooks/set-state-in-effect

  const handleSaveDesc = async () => {
    if (!isTextClean(descText)) { toast({ title: "Inappropriate content", variant: "destructive" }); return; }
    try {
      await onUpdate({ description: moderateText(descText) });
      setEditingDesc(false);
      toast({ title: "Description updated!" });
    } catch {
      toast({ title: "Failed to update description", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600/20 via-violet-600/20 to-purple-600/20 border border-indigo-500/20 p-8">
        <div className="flex items-center gap-6">
          <div className="w-28 h-28 shrink-0">
            <AvatarIcon3D avatar={user.avatar} size={112} />
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white">{moderateText(user.username)}</h2>
            {editingDesc ? (
              <div className="mt-1 flex gap-2">
                <div className="flex-1">
                  <Input value={descText} onChange={(e) => setDescText(e.target.value)} maxLength={200} className="bg-slate-800/50 border-slate-700 text-white text-sm h-8" />
                  <p className="text-[11px] text-slate-500 mt-0.5">{descText.length}/200</p>
                </div>
                <Button size="sm" className="bg-indigo-600" onClick={handleSaveDesc}>Save</Button>
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={() => { setEditingDesc(false); setDescText(user.description || ""); }}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-start gap-2 mt-1">
                <p className="text-slate-300 text-sm line-clamp-2 flex-1">{user.description || "No description yet"}</p>
                <button onClick={() => setEditingDesc(true)} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "WeBuy", value: user.webuy, icon: Coins, color: "text-amber-400" },
          { label: "Games", value: (user as any).games_created?.length || 0, icon: Gamepad2, color: "text-indigo-400" },
          { label: "Items", value: user.items_owned.length, icon: Palette, color: "text-purple-400" },
          { label: "Friends", value: user.friends.length, icon: Users, color: "text-violet-400" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
              <div><p className="text-2xl font-bold text-white">{stat.value}</p><p className="text-xs text-slate-400">{stat.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm text-white flex items-center gap-2"><User className="w-4 h-4 text-indigo-400" /> Account Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm px-4 pb-3">
            <div className="flex justify-between"><span className="text-slate-400">Username</span><span className="text-white font-medium">{moderateText(user.username)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Role</span><span className="text-indigo-400 font-medium capitalize">{user.admin_role || "player"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Joined</span><span className="text-white">{user.created ? new Date(user.created).toLocaleDateString() : "Unknown"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Status</span><Badge variant="outline" className="border-green-500/50 text-green-400 text-[10px]">Online</Badge></div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm text-white flex items-center gap-2"><Shield className="w-4 h-4 text-violet-400" /> Badges</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {user.admin_role === "admin" || user.admin_role === "top_admin" ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Admin</Badge> : null}
              {user.items_owned.length > 0 && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Collector</Badge>}
              {user.friends.length >= 5 && <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">Social</Badge>}
              <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30">Member</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "avatar" as View, icon: Palette, label: "Edit Avatar" },
          { key: "shop" as View, icon: Coins, label: "Visit Shop" },
          { key: "friends" as View, icon: Users, label: "Friends" },
          { key: "settings" as View, icon: Shield, label: "Settings" },
        ].map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => onNavigate(key)}
            className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-indigo-500/50 transition-all flex flex-col items-center gap-2">
            <Icon className="w-6 h-6 text-indigo-400" />
            <span className="text-xs text-slate-300">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
