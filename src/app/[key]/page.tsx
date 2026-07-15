'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { ItemData, UserData, AvatarData } from "@/lib/store";
import { useAuth } from "@/lib/store";
import { formatPrice, getItemColor, DEFAULT_AVATAR, moderateText, getFaceImagePath } from "@/components/app/shared";
import { ItemPreview3DLarge, AvatarIcon3D, FacePreview } from "@/components/app/AvatarComponents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins, Tag, User, Calendar, Copy, Check, Info, ArrowLeft, Shield,
  Palette, Users, UserPlus, UserMinus, Ban
} from "lucide-react";

// Truncate strings to maxLen + "..."
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

// ==================== ITEM PAGE ====================
function ItemPage({ itemKey }: { itemKey: string }) {
  const [item, setItem] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user, isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/items?id=${encodeURIComponent(itemKey)}`)
      .then(r => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(data => {
        if (cancelled) return;
        if (data && data.id) {
          setItem(data);
          setLoading(false);
        } else {
          setNotFound(true);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [itemKey]);

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(itemKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a]">
        <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a1a] gap-6 p-8">
        <img src="/404-image.png" alt="Page not found" className="w-64 h-64 object-contain" />
        <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
        <p className="text-slate-400">The item &quot;{truncate(itemKey, 10)}&quot; doesn&apos;t exist or has been removed.</p>
        <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white" onClick={() => router.push("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Home
        </Button>
      </div>
    );
  }

  const owned = user?.items_owned?.includes(item.id) ?? false;
  const canAfford = (user?.webuy ?? 0) >= item.price;

  return (
    <div className="min-h-screen bg-[#0a0a1a] p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" className="text-slate-400 hover:text-white mb-6" onClick={() => router.push("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <Card className="bg-slate-900 border-indigo-500/30 overflow-hidden">
          {/* Header with 3D preview and item name */}
          <div className="bg-gradient-to-r from-indigo-600/20 via-violet-600/20 to-purple-600/20 border-b border-indigo-500/20 p-6">
            <div className="flex flex-col items-center gap-4">
              <ItemPreview3DLarge item={item} />
              <div className="text-center">
                <h1 className="text-3xl font-bold text-white">{item.display_name}</h1>
                {owned && <Badge className="mt-2 bg-indigo-600">Owned</Badge>}
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Price", value: item.price === 0 ? "Free" : `${formatPrice(item.price)} WeBuy`, icon: Coins, color: "text-amber-400" },
                { label: "Type", value: item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1), icon: Tag, color: "text-violet-400" },
                { label: "Creator", value: item.creator || "WeildBuild", icon: User, color: "text-indigo-400" },
                { label: "Created", value: item.date_created ? new Date(item.date_created).toLocaleDateString() : "Unknown", icon: Calendar, color: "text-purple-400" },
              ].map((stat) => (
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
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400">Description</span>
                  <span className="text-white">{item.description || "No description"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Item Key</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-slate-700/50 px-2 py-0.5 rounded text-indigo-300 font-mono">{item.id}</code>
                    <button onClick={handleCopyKey} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Copy item key">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Type</span>
                  <span className="text-white capitalize">{item.item_type}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Date Created</span>
                  <span className="text-white">{item.date_created ? new Date(item.date_created).toLocaleDateString() : "Unknown"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Creator</span>
                  <span className="text-white">{item.creator || "WeildBuild"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Price</span>
                  <div className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300 font-medium">{item.price === 0 ? "Free" : formatPrice(item.price)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Buy button — requires login */}
            {!owned && isLoggedIn && (
              <Button
                className="w-full bg-amber-600 hover:bg-amber-500 text-sm"
                disabled={!canAfford}
                onClick={() => router.push("/")}
              >
                {item.price === 0 ? "Free" : <><Coins className="w-4 h-4 mr-1" /> Buy: {formatPrice(item.price)} WeBuy</>}
              </Button>
            )}
            {!owned && !isLoggedIn && (
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-sm" onClick={() => router.push("/")}>
                Log in to buy
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==================== USER PROFILE PAGE ====================
function UserProfilePage({ userKey }: { userKey: string }) {
  const [targetData, setTargetData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { user: currentUser, isLoggedIn } = useAuth();
  const router = useRouter();

  // ─── KEY-PROTOCOL: Fetch user by Object Key (USER-01gT476g, etc.) ───
  // The API looks up by user_key (random 8-char), not username.
  // This means the URL /USER-01gT476g will always find the right user
  // even if they rename their account.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users?key=${encodeURIComponent(userKey)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data && data.username) {
          setTargetData(data);
          setLoading(false);
        } else {
          setNotFound(true);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [userKey]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a]">
        <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !targetData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a1a] gap-6 p-8">
        <img src="/404-image.png" alt="Page not found" className="w-64 h-64 object-contain" />
        <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
        <p className="text-slate-400">User &quot;{truncate(userKey, 12)}&quot; doesn&apos;t exist.</p>
        <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white" onClick={() => router.push("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Home
        </Button>
      </div>
    );
  }

  // Check if profile is public (or own profile)
  const profileVisible = targetData.profile_visible !== false;
  const isMe = currentUser?.username === targetData.username;

  // Non-logged-in users can see public profiles but not interact
  if (!isLoggedIn && !profileVisible) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a1a] gap-6 p-8">
        <img src="/404-image.png" alt="Page not found" className="w-64 h-64 object-contain" />
        <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
        <p className="text-slate-400">This profile is private.</p>
        <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white" onClick={() => router.push("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Home
        </Button>
      </div>
    );
  }

  const targetAvatar = targetData.avatar || DEFAULT_AVATAR;

  return (
    <div className="min-h-screen bg-[#0a0a1a] p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" className="text-slate-400 hover:text-white mb-6" onClick={() => router.push("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <Card className="bg-slate-900 border-indigo-500/30 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600/20 via-violet-600/20 to-purple-600/20 border-b border-indigo-500/20 p-6">
            <div className="flex items-center gap-5">
              <div className="w-28 h-28 shrink-0">
                <AvatarIcon3D avatar={targetAvatar} size={112} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold text-white">{moderateText(targetData.username)}</h1>
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
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "WeBuy", value: targetData.webuy ?? 0, icon: Coins, color: "text-amber-400" },
                { label: "Items", value: (targetData.items_owned || []).length, icon: Palette, color: "text-purple-400" },
                { label: "Friends", value: (targetData.friends || []).length, icon: Users, color: "text-violet-400" },
                { label: "Role", value: targetData.admin_role === "admin" || targetData.admin_role === "top_admin" ? "Admin" : "Player", icon: Shield, color: "text-indigo-400" },
              ].map((stat) => (
                <div key={stat.label} className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-2">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  <div><p className="text-lg font-bold text-white">{stat.value}</p><p className="text-[10px] text-slate-400">{stat.label}</p></div>
                </div>
              ))}
            </div>

            {/* Account Info */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-white flex items-center gap-2"><User className="w-4 h-4 text-indigo-400" /> Account Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm px-4 pb-3">
                <div className="flex justify-between"><span className="text-slate-400">Username</span><span className="text-white font-medium">{moderateText(targetData.username)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Role</span><span className="text-indigo-400 font-medium capitalize">{targetData.admin_role || "player"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Joined</span><span className="text-white">{targetData.created ? new Date(targetData.created).toLocaleDateString() : "Unknown"}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Last Login</span><span className="text-white">{targetData.last_login ? new Date(targetData.last_login).toLocaleDateString() : "Today"}</span></div>
              </CardContent>
            </Card>

            {/* Avatar Info */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-white flex items-center gap-2"><Palette className="w-4 h-4 text-purple-400" /> Avatar Info</CardTitle>
              </CardHeader>
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
                    <span className="text-white">{targetAvatar.face || "None"}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Shirt</span>
                  <div className="flex items-center gap-2">
                    {targetAvatar.shirt && <div className="w-4 h-4 rounded" style={{ backgroundColor: getItemColor(targetAvatar.shirt) }} />}
                    <span className="text-white">{targetAvatar.shirt || "None"}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Pants</span>
                  <div className="flex items-center gap-2">
                    {targetAvatar.left_leg && <div className="w-4 h-4 rounded" style={{ backgroundColor: getItemColor(targetAvatar.left_leg) }} />}
                    <span className="text-white">{targetAvatar.left_leg || "None"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action buttons — only shown when logged in */}
            {isLoggedIn && !isMe && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-xs">
                  <UserPlus className="w-3 h-3 mr-1" /> Add Friend
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400 text-xs hover:bg-red-500/10">
                  <Ban className="w-3 h-3 mr-1" /> Block
                </Button>
              </div>
            )}
            {!isLoggedIn && (
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-sm" onClick={() => router.push("/")}>
                Log in to interact
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==================== DYNAMIC KEY ROUTE PAGE ====================
export default function KeyPage() {
  const params = useParams();
  const key = params.key as string;

  // Route based on prefix
  if (key.startsWith("USER-")) {
    return <UserProfilePage userKey={key} />;
  }

  // Default: treat as item key (FACE-*, SHIRT-*, PANTS-*)
  return <ItemPage itemKey={key} />;
}
