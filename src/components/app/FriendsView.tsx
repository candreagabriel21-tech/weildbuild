'use client';

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import type { UserData } from "@/lib/store";
import { useFriends } from "@/lib/store";
import { moderateText, isTextClean, DEFAULT_AVATAR, getItemColor } from "./shared";
import { AvatarIcon, AvatarIcon3D, UserAvatarIcon, FacePreview } from "./AvatarComponents";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Users, UserPlus, UserMinus, Search, Eye, Send, Ban, X, Check,
  Coins, Palette, Shield, User, Loader2
} from "lucide-react";
import { useLoadingMap } from "@/hooks/use-loading-action";

// ==================== FRIENDS VIEW ====================
export function FriendsView({ user, socket, onUpdate }: { user: UserData; socket: Socket | null; onUpdate: (updates: Partial<UserData>) => Promise<void> }) {
  const [friendTab, setFriendTab] = useState<"friends" | "requests" | "search" | "chat" | "blocked">("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [chatWith, setChatWith] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<{ sender: string; content: string; timestamp: string }[]>([]);
  const [dmInput, setDmInput] = useState("");
  const dmScrollRef = useRef<HTMLDivElement>(null);
  const { unblockUser } = useFriends();
  const { toast } = useToast();
  const { isLoading: isActionLoading, run: runAction } = useLoadingMap();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/friends?search=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {} setSearchLoading(false);
  };

  const handleSendRequest = async (to: string) => {
    try {
      const res = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", from: user.username, to }) });
      const data = await res.json();
      if (data.success) {
        if (data.autoAccepted) {
          toast({ title: `You and ${to} are now friends!` });
          await onUpdate({});
        } else {
          setSentRequests(prev => new Set(prev).add(to));
          if (socket) socket.emit("friend:request", { from: user.username, to });
          toast({ title: "Friend request sent!" });
        }
      }
    } catch {}
  };

  const handleCancelRequest = async (to: string) => {
    try {
      const res = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", from: user.username, to }) });
      const data = await res.json();
      if (data.success) {
        setSentRequests(prev => { const next = new Set(prev); next.delete(to); return next; });
        toast({ title: "Friend request cancelled" });
      }
    } catch {}
  };

  const handleAcceptRequest = async (friend: string) => {
    try {
      const res = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", username: user.username, friend }) });
      const data = await res.json();
      if (data.success && data.user) { await onUpdate(data.user); if (socket) socket.emit("friend:accepted", { username: user.username, friend }); }
    } catch {}
  };

  const handleDeclineRequest = async (friend: string) => {
    try {
      const res = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", username: user.username, friend }) });
      const data = await res.json();
      if (data.success && data.user) await onUpdate(data.user);
    } catch {}
  };

  const handleRemoveFriend = async (friend: string) => {
    try {
      const res = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", username: user.username, friend }) });
      const data = await res.json();
      if (data.success && data.user) await onUpdate(data.user);
    } catch {}
  };

  const handleBlockUser = async (target: string) => {
    try {
      const res = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "block", username: user.username, target }) });
      const data = await res.json();
      if (data.success) { toast({ title: `Blocked ${target}` }); await onUpdate(data.user || {}); }
    } catch {}
  };

  const handleUnblockUser = async (target: string) => {
    try {
      const result = await unblockUser(user.username, target);
      if (result.success) { toast({ title: `Unblocked ${target}` }); await onUpdate({}); }
      else toast({ title: "Failed to unblock", variant: "destructive" });
    } catch {}
  };

  const loadDMs = async (friend: string) => {
    setChatWith(friend);
    try {
      const res = await fetch(`/api/friends?action=get_messages&user1=${user.username}&user2=${friend}`);
      const data = await res.json();
      setDmMessages(Array.isArray(data) ? data : []);
    } catch { setDmMessages([]); }
  };

  const sendDM = async () => {
    if (!dmInput.trim() || !chatWith) return;
    const moderated = moderateText(dmInput.trim());
    if (!isTextClean(dmInput.trim())) { setDmInput(""); return; }
    const msg = { sender: user.username, content: moderated, timestamp: new Date().toISOString() };
    setDmMessages(prev => [...prev, msg]);
    setDmInput("");
    try {
      await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_message", from: user.username, to: chatWith, content: moderated }) });
    } catch {}
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Users className="w-6 h-6 text-violet-400" /> Friends</h2>
      <Tabs value={friendTab} onValueChange={(v) => setFriendTab(v as any)}>
        <TabsList className="bg-slate-800 w-full">
          <TabsTrigger value="friends" className="flex-1 data-[state=active]:bg-indigo-600">Friends ({user.friends.length})</TabsTrigger>
          <TabsTrigger value="requests" className="flex-1 data-[state=active]:bg-indigo-600 relative">
            Requests {(user.friend_requests?.length || 0) > 0 && <Badge className="ml-1 bg-red-500 text-[10px]">{user.friend_requests.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="search" className="flex-1 data-[state=active]:bg-indigo-600">Find</TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 data-[state=active]:bg-indigo-600">Chat</TabsTrigger>
          <TabsTrigger value="blocked" className="flex-1 data-[state=active]:bg-indigo-600">Blocked</TabsTrigger>
        </TabsList>
      </Tabs>

      {friendTab === "friends" && (
        <div className="space-y-2">
          {[...new Set(user.friends)].length === 0 ? <p className="text-slate-500 text-center py-8">No friends yet. Use Find to search for users!</p> : [...new Set(user.friends)].map((f) => (
            <Card key={f} className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewingProfile(f)}>
                  <UserAvatarIcon username={f} size={28} />
                  <span className="text-sm text-slate-200">{moderateText(f)}</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="text-slate-400 h-7 w-7 p-0" onClick={() => setViewingProfile(f)}><Eye className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7 w-7 p-0" disabled={isActionLoading(`rm-${f}`)} onClick={() => runAction(`rm-${f}`, () => handleRemoveFriend(f))}>{isActionLoading(`rm-${f}`) ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}</Button>
                  <Button size="sm" variant="ghost" className="text-slate-500 hover:text-red-400 h-7 w-7 p-0" disabled={isActionLoading(`block-${f}`)} onClick={() => runAction(`block-${f}`, () => handleBlockUser(f))}>{isActionLoading(`block-${f}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {friendTab === "requests" && (
        <div className="space-y-2">
          {(!user.friend_requests || user.friend_requests.length === 0) ? <p className="text-slate-500 text-center py-8">No pending requests</p> : user.friend_requests.map((f) => (
            <Card key={f} className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-violet-400" /><span className="text-sm text-slate-200">{moderateText(f)}</span></div>
                <div className="flex gap-1">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 h-7 text-xs px-2" disabled={isActionLoading(`accept-${f}`)} onClick={() => runAction(`accept-${f}`, () => handleAcceptRequest(f))}>{isActionLoading(`accept-${f}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}</Button>
                  <Button size="sm" variant="ghost" className="text-red-400 h-7 text-xs px-2" disabled={isActionLoading(`decline-${f}`)} onClick={() => runAction(`decline-${f}`, () => handleDeclineRequest(f))}><X className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {friendTab === "search" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Search by username..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="bg-slate-700 border-slate-600 text-white text-sm h-9" />
            <Button size="sm" className="bg-indigo-600 h-9" onClick={handleSearch} disabled={searchLoading}><Search className="w-4 h-4" /></Button>
          </div>
          <div className="space-y-2">
            {searchResults.map((u: any) => {
              const isMe = u.username === user.username;
              const isFriend = user.friends.includes(u.username);
              const isBlocked = (user.blocked_users || []).includes(u.username);
              const isSent = sentRequests.has(u.username) || (user.friend_requests || []).includes(u.username);
              return (
                <Card key={u.username} className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewingProfile(u.username)}>
                      {u.avatar ? <AvatarIcon avatar={u.avatar} size={28} /> : <div className="w-7 h-7 rounded-full bg-slate-600" />}
                      <span className="text-sm text-slate-200">{moderateText(u.username)}</span>
                    </div>
                    {isMe ? <Badge variant="outline" className="text-slate-500 text-[10px]">You</Badge> :
                     isFriend ? <Badge className="bg-indigo-600 text-[10px]">Friends</Badge> :
                     isBlocked ? <Badge className="bg-red-600 text-[10px]">Blocked</Badge> :
                     isSent ? <Button size="sm" variant="ghost" className="text-red-400 h-7 text-xs" disabled={isActionLoading(`cancel-${u.username}`)} onClick={() => runAction(`cancel-${u.username}`, () => handleCancelRequest(u.username))}>{isActionLoading(`cancel-${u.username}`) ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <X className="w-3 h-3 mr-1" />} Cancel</Button> :
                     <div className="flex gap-1">
                       <Button size="sm" className="bg-violet-600 hover:bg-violet-500 h-7 text-xs" disabled={isActionLoading(`add-${u.username}`)} onClick={() => runAction(`add-${u.username}`, () => handleSendRequest(u.username))}>{isActionLoading(`add-${u.username}`) ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <UserPlus className="w-3 h-3 mr-1" />} Add</Button>
                       <Button size="sm" variant="ghost" className="text-slate-500 h-7 w-7 p-0" disabled={isActionLoading(`block-${u.username}`)} onClick={() => runAction(`block-${u.username}`, () => handleBlockUser(u.username))}>{isActionLoading(`block-${u.username}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}</Button>
                     </div>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* DM Chat Tab */}
      {friendTab === "chat" && (
        <div className="flex gap-3 h-[500px]">
          <div className="w-1/3 space-y-1 max-h-full overflow-y-auto">
            <p className="text-sm text-slate-400 mb-2">Friends</p>
            {user.friends.length === 0 ? <p className="text-xs text-slate-500">No friends yet</p> : user.friends.map((f) => (
              <button key={f} onClick={() => loadDMs(f)}
                className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left ${chatWith === f ? "bg-indigo-600/20 ring-1 ring-indigo-500" : "bg-slate-800/50 hover:bg-slate-700/50"}`}>
                <UserAvatarIcon username={f} size={24} />
                <span className="text-xs text-slate-200 truncate">{moderateText(f)}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 flex flex-col border-l border-slate-700/50 pl-3">
            {chatWith ? (
              <>
                <div className="flex items-center gap-2 pb-2 border-b border-slate-700/50 mb-2">
                  <UserAvatarIcon username={chatWith} size={24} />
                  <span className="text-sm font-medium text-white">{moderateText(chatWith)}</span>
                </div>
                <div ref={dmScrollRef} className="flex-1 overflow-y-auto space-y-2 mb-2">
                  {dmMessages.length === 0 && <p className="text-xs text-slate-500 text-center py-8">No messages yet. Say hi!</p>}
                  {dmMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.sender === user.username ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-3 py-1.5 rounded-lg text-xs ${m.sender === user.username ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-200"}`}>
                        {moderateText(m.content)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={dmInput} onChange={(e) => setDmInput(e.target.value)} placeholder="Type a message..." maxLength={500}
                    onKeyDown={(e) => e.key === "Enter" && sendDM()} className="bg-slate-700 border-slate-600 text-white text-xs h-8" />
                  <Button size="sm" className="bg-indigo-600 h-8 w-8 p-0" onClick={sendDM}><Send className="w-3 h-3" /></Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-slate-500">Select a friend to chat</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blocked Users Tab */}
      {friendTab === "blocked" && (
        <div className="space-y-2">
          {(!user.blocked_users || user.blocked_users.length === 0) ? (
            <p className="text-slate-500 text-center py-8">No blocked users</p>
          ) : [...new Set(user.blocked_users)].map((b, i) => (
            <Card key={`${b}-${i}`} className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserAvatarIcon username={b} size={28} />
                  <span className="text-sm text-slate-200">{moderateText(b)}</span>
                </div>
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:text-white hover:bg-indigo-600 h-7 text-xs"
                  disabled={isActionLoading(`unblock-${b}`)} onClick={() => runAction(`unblock-${b}`, () => handleUnblockUser(b))}>
                  <Check className="w-3 h-3 mr-1" /> Unblock
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Profile Modal */}
      <AnimatePresence>
        {viewingProfile && (
          <ViewProfileModal
            targetUsername={viewingProfile}
            currentUser={user}
            onClose={() => setViewingProfile(null)}
            onSendRequest={handleSendRequest}
            onCancelRequest={handleCancelRequest}
            onRemoveFriend={handleRemoveFriend}
            onBlockUser={handleBlockUser}
            sentRequests={sentRequests}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ==================== VIEW PROFILE MODAL ====================
export function ViewProfileModal({ targetUsername, currentUser, onClose, onSendRequest, onCancelRequest, onRemoveFriend, onBlockUser, sentRequests }: {
  targetUsername: string;
  currentUser: UserData;
  onClose: () => void;
  onSendRequest: (to: string) => void;
  onCancelRequest: (to: string) => void;
  onRemoveFriend: (friend: string) => void;
  onBlockUser: (target: string) => void;
  sentRequests: Set<string>;
}) {
  const [targetData, setTargetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/users?username=${encodeURIComponent(targetUsername)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setTargetData(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [targetUsername]);

  const isMe = targetUsername === currentUser.username;
  const isFriend = currentUser.friends.includes(targetUsername);
  const isBlocked = (currentUser.blocked_users || []).includes(targetUsername);
  const isSent = sentRequests.has(targetUsername) || (currentUser.friend_requests || []).includes(targetUsername);
  const profileVisible = targetData?.profile_visible !== false;

  const targetAvatar = targetData?.avatar || DEFAULT_AVATAR;
  const shirtName = targetAvatar.shirt ? targetAvatar.shirt : "None";
  const pantsName = targetAvatar.left_leg ? targetAvatar.left_leg : "None";
  const faceName = targetAvatar.face ? targetAvatar.face : "None";
  const shirtColor = targetAvatar.shirt ? getItemColor(targetAvatar.shirt) : null;
  const pantsColor = targetAvatar.left_leg ? getItemColor(targetAvatar.left_leg) : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <Card className="bg-slate-900 border-indigo-500/30">
          {loading ? (
            <CardContent className="p-8 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </CardContent>
          ) : !targetData || targetData.error ? (
            <CardContent className="p-8 text-center">
              <p className="text-slate-400">User not found</p>
              <Button size="sm" variant="outline" className="mt-4 border-slate-600 text-slate-300" onClick={onClose}>Close</Button>
            </CardContent>
          ) : (!profileVisible && !isMe) ? (
            <>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <AvatarIcon avatar={targetData.avatar || DEFAULT_AVATAR} size={64} />
                  <div>
                    <CardTitle className="text-lg text-white">{moderateText(targetUsername)}</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">{moderateText(targetUsername)}&apos;s profile is disabled</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 text-xs w-full" onClick={onClose}>Close</Button>
              </CardContent>
            </>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-t-xl bg-gradient-to-r from-indigo-600/20 via-violet-600/20 to-purple-600/20 border-b border-indigo-500/20 p-6">
                <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors z-10">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-5">
                  <div className="w-28 h-28 shrink-0">
                    <AvatarIcon3D avatar={targetAvatar} size={112} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-3xl font-bold text-white">{moderateText(targetUsername)}</h2>
                    {targetData.description ? (
                      <p className="text-slate-300 text-sm mt-1 line-clamp-3">{moderateText(targetData.description)}</p>
                    ) : (
                      <p className="text-slate-500 text-sm italic mt-1">No description</p>
                    )}
                    <p className="text-slate-500 text-xs mt-1">Joined {targetData.created ? new Date(targetData.created).toLocaleDateString() : "Unknown"}</p>
                  </div>
                </div>
              </div>

              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "WeBuy", value: targetData.webuy ?? 0, icon: Coins, color: "text-amber-400" },
                    { label: "Items", value: (targetData.items_owned || []).length, icon: Palette, color: "text-purple-400" },
                    { label: "Friends", value: (targetData.friends || []).length, icon: Users, color: "text-violet-400" },
                    { label: "Role", value: targetData.admin_role === "admin" || targetData.admin_role === "top_admin" ? "Admin" : "Player", icon: Shield, color: "text-indigo-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-2">
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                      <div><p className="text-lg font-bold text-white">{stat.value}</p><p className="text-[10px] text-slate-400">{stat.label}</p></div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm text-white flex items-center gap-2"><User className="w-4 h-4 text-indigo-400" /> Account Info</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm px-4 pb-3">
                      <div className="flex justify-between"><span className="text-slate-400">Username</span><span className="text-white font-medium">{moderateText(targetUsername)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Role</span><span className="text-indigo-400 font-medium capitalize">{targetData.admin_role || "player"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Joined</span><span className="text-white">{targetData.created ? new Date(targetData.created).toLocaleDateString() : "Unknown"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Last Login</span><span className="text-white">{targetData.last_login ? new Date(targetData.last_login).toLocaleDateString() : "Today"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Profile Visible</span><span className="text-white">{targetData.profile_visible !== false ? "Yes" : "No"}</span></div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm text-white flex items-center gap-2"><Palette className="w-4 h-4 text-purple-400" /> Avatar Info</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm px-4 pb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Skin Color</span>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: targetAvatar.skin || "#f8ff6d" }} />
                          <span className="text-white">{targetAvatar.skin || "Default"}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Face</span>
                        <div className="flex items-center gap-2">
                          {targetAvatar.face && <FacePreview faceId={targetAvatar.face} size={18} />}
                          <span className="text-white">{faceName}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Shirt</span>
                        <div className="flex items-center gap-2">
                          {shirtColor && <div className="w-4 h-4 rounded" style={{ backgroundColor: shirtColor }} />}
                          <span className="text-white">{shirtName}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Pants</span>
                        <div className="flex items-center gap-2">
                          {pantsColor && <div className="w-4 h-4 rounded" style={{ backgroundColor: pantsColor }} />}
                          <span className="text-white">{pantsName}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {isMe ? (
                    <Badge variant="outline" className="text-slate-500">This is you</Badge>
                  ) : (
                    <>
                      {isFriend && (
                        <Button size="sm" variant="outline" className="border-violet-500/30 text-violet-400 text-xs hover:bg-violet-500/10" onClick={() => { onRemoveFriend(targetUsername); onClose(); }}>
                          <UserMinus className="w-3 h-3 mr-1" /> Remove Friend
                        </Button>
                      )}
                      {!isFriend && isSent && (
                        <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 text-xs hover:bg-red-500/10" onClick={() => { onCancelRequest(targetUsername); onClose(); }}>
                          <X className="w-3 h-3 mr-1" /> Cancel Request
                        </Button>
                      )}
                      {!isFriend && !isSent && !isBlocked && (
                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-xs" onClick={() => { onSendRequest(targetUsername); onClose(); }}>
                          <UserPlus className="w-3 h-3 mr-1" /> Add Friend
                        </Button>
                      )}
                      {!isBlocked && (
                        <Button size="sm" variant="ghost" className="text-red-400 text-xs hover:bg-red-500/10" onClick={() => { onBlockUser(targetUsername); onClose(); }}>
                          <Ban className="w-3 h-3 mr-1" /> Block
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
