'use client';

import { useEffect } from "react";
import type { UserData, NotificationData } from "@/lib/store";
import { moderateText } from "./shared";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, UserPlus, Heart, ShoppingBag, Gamepad2, Info } from "lucide-react";

// ==================== NOTIFICATIONS VIEW ====================
export function NotificationsView({ user, notifications, unreadCount, onMarkRead }: { user: UserData; notifications: NotificationData[]; unreadCount: number; onMarkRead: () => void }) {
  useEffect(() => { if (unreadCount > 0) onMarkRead(); }, []);
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Bell className="w-6 h-6 text-amber-400" /> Notifications</h2>
      {notifications.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700/50"><CardContent className="p-8 text-center">
          <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No notifications yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={`bg-slate-800/50 border-slate-700/50 ${!n.read ? "border-indigo-500/30" : ""}`}>
              <CardContent className="p-4 flex items-start gap-3">
                {n.type === "friend_request" && <UserPlus className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />}
                {n.type === "friend_accepted" && <Heart className="w-5 h-5 text-pink-400 mt-0.5 shrink-0" />}
                {n.type === "item_purchased" && <ShoppingBag className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />}
                {n.type === "game_created" && <Gamepad2 className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />}
                {n.type === "system" && <Info className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm text-slate-200">{moderateText(n.message)}</p>
                  <p className="text-xs text-slate-500 mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
