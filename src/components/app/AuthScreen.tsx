'use client';

import { useState } from "react";
import NextImage from "next/image";
import { motion } from "framer-motion";
import { moderateText } from "./shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ==================== AUTH SCREEN ====================
export function AuthScreen({ onLogin, onRegister }: { onLogin: (u: string, p: string) => Promise<{ success: boolean; error?: string }>; onRegister: (u: string, p: string) => Promise<{ success: boolean; error?: string }> }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const moderatedName = moderateText(username);
    if (moderatedName !== username) { setError("Username contains inappropriate content"); return; }
    setError(""); setLoading(true);
    const result = isLogin ? await onLogin(username, password) : await onRegister(username, password);
    if (!result.success) setError(result.error || "Something went wrong");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(to bottom right, var(--wb-bg-app), var(--wb-bg-app-via), var(--wb-bg-app-to))` }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, type: "spring" }} className="w-full max-w-md">
        <Card className="bg-slate-900/80 backdrop-blur-xl border-indigo-500/20 shadow-2xl shadow-indigo-500/10">
          <CardHeader className="text-center pb-2">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 3, repeatDelay: 2 }} className="flex justify-center mb-1">
              <NextImage src="/logos/logo.png" alt="WeildBuild" width={64} height={64} className="rounded-xl object-contain" unoptimized />
            </motion.div>
            <img src="/logos/text_logo_simple.png" alt="WeildBuild" className="h-20 w-auto object-contain mx-auto" />
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent sr-only">WeildBuild</CardTitle>
            <p className="text-slate-400 text-sm mt-2">Build Anything, Be Anything.</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Tabs value={isLogin ? "login" : "register"} onValueChange={(v) => { setIsLogin(v === "login"); setError(""); }}>
              <TabsList className="w-full bg-slate-800">
                <TabsTrigger value="login" className="flex-1 data-[state=active]:bg-indigo-600">Login</TabsTrigger>
                <TabsTrigger value="register" className="flex-1 data-[state=active]:bg-indigo-600">Register</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="space-y-3">
              <div>
                <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[11px] text-slate-500">3-20 characters, letters, numbers & underscores</p>
                  <p className={`text-[11px] ${username.length > 20 ? 'text-red-400' : username.length > 0 && username.length < 3 ? 'text-amber-400' : 'text-slate-500'}`}>{username.length}/20</p>
                </div>
              </div>
              <div>
                <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={128} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[11px] text-slate-500">Minimum 6 characters</p>
                  <p className={`text-[11px] ${password.length > 0 && password.length < 6 ? 'text-amber-400' : 'text-slate-500'}`}>{password.length}/128</p>
                </div>
              </div>
            </div>
            {error && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-sm text-center bg-red-500/10 py-2 px-3 rounded-lg">{error}</motion.p>}
            <Button onClick={handleSubmit} disabled={loading || !username || !password} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold h-11">
              {loading ? (isLogin ? "Logging in..." : "Creating account...") : (isLogin ? "Login" : "Create Account")}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
