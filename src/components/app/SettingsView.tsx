'use client';

import { useState, useEffect } from "react";
import type { UserData } from "@/lib/store";
import { apiFetch, saveSessionToken } from "@/lib/store";
import { moderateText, isTextClean } from "./shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Bell, Moon, Info, LogOut } from "lucide-react";

// ==================== SETTINGS VIEW ====================
export function SettingsView({ user, onUpdate, onLogout }: { user: UserData; onUpdate: (updates: Partial<UserData>) => Promise<void>; onLogout: () => void }) {
  const [profileVisible, setProfileVisible] = useState(user.profile_visible !== false);
  const [notifyFriends, setNotifyFriends] = useState(user.notify_friends !== false);
  const [notifyPurchases, setNotifyPurchases] = useState(user.notify_purchases !== false);
  const [notifyGames, setNotifyGames] = useState(user.notify_games !== false);
  const [description, setDescription] = useState(user.description || "");
  const [darkMode, setDarkMode] = useState(user.visual_settings?.dark_mode !== false);
  const [animations, setAnimations] = useState(user.visual_settings?.animations !== false);
  const [reduceMotion, setReduceMotion] = useState(user.visual_settings?.reduce_motion === true);
  const [sidebarPosition, setSidebarPosition] = useState<string>(user.visual_settings?.sidebar_position || "right");
  const [volume, setVolume] = useState(80);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [endOtherSessions, setEndOtherSessions] = useState(false);

  useEffect(() => { setProfileVisible(user.profile_visible !== false); }, [user.profile_visible]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { setNotifyFriends(user.notify_friends !== false); }, [user.notify_friends]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { setNotifyPurchases(user.notify_purchases !== false); }, [user.notify_purchases]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { setNotifyGames(user.notify_games !== false); }, [user.notify_games]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { setDarkMode(user.visual_settings?.dark_mode !== false); }, [user.visual_settings?.dark_mode]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { setAnimations(user.visual_settings?.animations !== false); }, [user.visual_settings?.animations]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { setReduceMotion(user.visual_settings?.reduce_motion === true); }, [user.visual_settings?.reduce_motion]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { setSidebarPosition(user.visual_settings?.sidebar_position || "right"); }, [user.visual_settings?.sidebar_position]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { setDescription(user.description || ""); }, [user.description]); // eslint-disable-line react-hooks/set-state-in-effect

  const handleToggle = async (key: string, value: boolean) => { await onUpdate({ [key]: value }); };

  const handleVisualChange = async (key: string, value: any) => {
    try {
      await onUpdate({
        visual_settings: {
          ...(user.visual_settings || { dark_mode: true, ui_scale: 1, animations: true, reduce_motion: false }),
          [key]: value
        }
      });
    } catch {
      setDarkMode(user.visual_settings?.dark_mode !== false);
      setAnimations(user.visual_settings?.animations !== false);
      setReduceMotion(user.visual_settings?.reduce_motion === true);
      setSidebarPosition(user.visual_settings?.sidebar_position || "right");
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword.length < 6) { setPasswordError("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords don't match"); return; }
    try {
      const data = await apiFetch("/auth", {
        method: "POST",
        body: JSON.stringify({
          action: "changePassword",
          username: user.username,
          oldPassword,
          newPassword,
          endOtherSessions,
        }),
      });
      if (data.success) {
        if (data.sessionToken) saveSessionToken(data.sessionToken);
        const sessionMsg = endOtherSessions
          ? "Password changed! All other devices have been signed out."
          : "Password changed successfully!";
        setPasswordSuccess(sessionMsg);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setEndOtherSessions(false);
      } else {
        setPasswordError(data.error || "Failed to change password");
      }
    } catch (e: any) {
      setPasswordError(e.message || "Network error");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Shield className="w-6 h-6 text-indigo-400" /> Settings</h2>

      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-2"><CardTitle className="text-lg text-white flex items-center gap-2"><Shield className="w-5 h-5 text-indigo-400" /> Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><label className="text-sm text-slate-400 mb-1 block">Username</label><Input value={user.username} disabled className="bg-slate-700/50 border-slate-600 text-slate-400" /></div>
          <div><label className="text-sm text-slate-400 mb-1 block">Description</label>
            <textarea value={description} onChange={(e) => { if (isTextClean(e.target.value)) setDescription(e.target.value); }} onBlur={() => onUpdate({ description: moderateText(description) })} maxLength={200}
              placeholder="Tell others about yourself..." className="w-full bg-slate-700 border border-slate-600 text-white p-3 rounded-lg text-sm resize-none h-20 focus:border-indigo-500 focus:outline-none" />
            <p className={`text-[11px] mt-0.5 text-right ${description.length > 180 ? 'text-amber-400' : 'text-slate-500'}`}>{description.length}/200</p>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
            <div><p className="text-sm text-white">Profile Visible</p><p className="text-xs text-slate-400">Let others see your profile</p></div>
            <button onClick={() => { setProfileVisible(!profileVisible); handleToggle("profile_visible", !profileVisible); }}
              className={`w-11 h-6 rounded-full transition-all ${profileVisible ? "bg-indigo-500" : "bg-slate-600"}`}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: profileVisible ? "translateX(22px)" : "translateX(2px)" }} />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-2"><CardTitle className="text-lg text-white flex items-center gap-2"><Bell className="w-5 h-5 text-amber-400" /> Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
            <div><p className="text-sm text-white">Friend Requests</p><p className="text-xs text-slate-400">Get notified about friend activity</p></div>
            <button onClick={() => { setNotifyFriends(!notifyFriends); handleToggle("notify_friends", !notifyFriends); }}
              className={`w-11 h-6 rounded-full transition-all ${notifyFriends ? "bg-indigo-500" : "bg-slate-600"}`}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: notifyFriends ? "translateX(22px)" : "translateX(2px)" }} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
            <div><p className="text-sm text-white">Purchases</p><p className="text-xs text-slate-400">Get notified about transactions</p></div>
            <button onClick={() => { setNotifyPurchases(!notifyPurchases); handleToggle("notify_purchases", !notifyPurchases); }}
              className={`w-11 h-6 rounded-full transition-all ${notifyPurchases ? "bg-indigo-500" : "bg-slate-600"}`}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: notifyPurchases ? "translateX(22px)" : "translateX(2px)" }} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
            <div><p className="text-sm text-white">Game Updates</p><p className="text-xs text-slate-400">Get notified about game activity</p></div>
            <button onClick={() => { setNotifyGames(!notifyGames); handleToggle("notify_games", !notifyGames); }}
              className={`w-11 h-6 rounded-full transition-all ${notifyGames ? "bg-indigo-500" : "bg-slate-600"}`}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: notifyGames ? "translateX(22px)" : "translateX(2px)" }} />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-2"><CardTitle className="text-lg text-white flex items-center gap-2"><Moon className="w-5 h-5 text-violet-400" /> Visual</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
            <div><p className="text-sm text-white">Dark Mode</p><p className="text-xs text-slate-400">Use dark theme</p></div>
            <button onClick={() => { setDarkMode(!darkMode); handleVisualChange("dark_mode", !darkMode); }}
              className={`w-11 h-6 rounded-full transition-all ${darkMode ? "bg-indigo-500" : "bg-slate-600"}`}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: darkMode ? "translateX(22px)" : "translateX(2px)" }} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
            <div><p className="text-sm text-white">Animations</p><p className="text-xs text-slate-400">Enable UI animations</p></div>
            <button onClick={() => { setAnimations(!animations); handleVisualChange("animations", !animations); }}
              className={`w-11 h-6 rounded-full transition-all ${animations ? "bg-indigo-500" : "bg-slate-600"}`}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: animations ? "translateX(22px)" : "translateX(2px)" }} />
            </button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
            <div><p className="text-sm text-white">Reduce Motion</p><p className="text-xs text-slate-400">Minimize movement for accessibility</p></div>
            <button onClick={() => { setReduceMotion(!reduceMotion); handleVisualChange("reduce_motion", !reduceMotion); }}
              className={`w-11 h-6 rounded-full transition-all ${reduceMotion ? "bg-indigo-500" : "bg-slate-600"}`}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: reduceMotion ? "translateX(22px)" : "translateX(2px)" }} />
            </button>
          </div>
          <div className="p-3 rounded-lg bg-slate-700/30">
            <div className="mb-2"><p className="text-sm text-white">Sidebar Position</p><p className="text-xs text-slate-400">Choose where the navigation sidebar appears</p></div>
            <div className="flex gap-2">
              {(["right", "left", "top", "bottom"] as const).map((pos) => (
                <button key={pos} onClick={() => { setSidebarPosition(pos); handleVisualChange("sidebar_position", pos); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${sidebarPosition === pos ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
                  {pos}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-700/30">
            <div className="flex items-center justify-between mb-2"><p className="text-sm text-white">Volume</p><span className="text-xs text-slate-400">{volume}%</span></div>
            <input type="range" min={0} max={100} value={volume} onChange={(e) => { setVolume(Number(e.target.value)); }} className="w-full accent-indigo-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-2"><CardTitle className="text-lg text-white flex items-center gap-2"><Shield className="w-5 h-5 text-indigo-400" /> Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="password" placeholder="Current password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
          <Input type="password" placeholder="New password (min 6 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
          <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input type="checkbox" checked={endOtherSessions} onChange={(e) => setEndOtherSessions(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-600 accent-indigo-600 cursor-pointer" />
            <span className="text-sm text-slate-300">Sign out all other devices</span>
            <span className="text-xs text-slate-500">(uncheck to keep other devices logged in)</span>
          </label>
          {passwordError && <p className="text-red-400 text-xs">{passwordError}</p>}
          {passwordSuccess && <p className="text-green-400 text-xs">{passwordSuccess}</p>}
          <Button onClick={handleChangePassword} disabled={!oldPassword || !newPassword || !confirmPassword} className="w-full bg-indigo-600 hover:bg-indigo-500">Change Password</Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-2"><CardTitle className="text-lg text-white flex items-center gap-2"><Info className="w-5 h-5 text-slate-400" /> About WeildBuild</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="text-slate-300 font-semibold">Version: v1.2.5-dev Browser Edition</p>
            <p className="text-slate-400">WeildBuild&trade; is a platform where users can create, share, and explore worlds with no limits.</p>
            <p className="text-slate-500 text-xs">&copy; 2026 WeildBuild&trade; Team. All Rights Reserved.</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={onLogout} variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 h-12"><LogOut className="w-5 h-5 mr-2" /> Sign Out</Button>
    </div>
  );
}
