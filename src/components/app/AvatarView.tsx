'use client';

import { useState } from "react";
import type { UserData, ItemData, AvatarData } from "@/lib/store";
import { SKIN_COLORS } from "./shared";
import { Avatar3DEditor, FacePreview } from "./AvatarComponents";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Loader2 } from "lucide-react";

// ==================== AVATAR VIEW ====================
export function AvatarView({ user, items, onUpdate }: { user: UserData; items: ItemData[]; onUpdate: (updates: Partial<UserData>) => Promise<void> }) {
  const [avatarTab, setAvatarTab] = useState<string>("skin");
  const [localAvatar, setLocalAvatar] = useState<AvatarData>({ ...user.avatar });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const ownedItems = items.filter((i) => user.items_owned.includes(i.id));

  const hasChanges = JSON.stringify(localAvatar) !== JSON.stringify(user.avatar);

  const equipItem = (itemId: string, slot: string) => {
    const updated = { ...localAvatar };
    if (slot === "face") updated.face = itemId;
    else if (slot === "shirt") updated.shirt = itemId;
    else if (slot === "left_leg" || slot === "right_leg" || slot === "pants") {
      updated.left_leg = itemId; updated.right_leg = itemId;
    }
    setLocalAvatar(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({ avatar: localAvatar });
    setSaving(false);
    toast({ title: "Avatar saved!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><User className="w-6 h-6 text-indigo-400" /> Avatar Editor</h2>
        <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...</> : "Save Changes"}
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Avatar3DEditor avatar={user.avatar} previewAvatar={localAvatar} />
        <div className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-3">
              <Tabs value={avatarTab} onValueChange={setAvatarTab}>
                <TabsList className="bg-slate-800 w-full h-8">
                  <TabsTrigger value="skin" className="flex-1 data-[state=active]:bg-indigo-600 text-xs">Skin</TabsTrigger>
                  <TabsTrigger value="face" className="flex-1 data-[state=active]:bg-indigo-600 text-xs">Faces</TabsTrigger>
                  <TabsTrigger value="shirt" className="flex-1 data-[state=active]:bg-indigo-600 text-xs">Shirts</TabsTrigger>
                  <TabsTrigger value="pants" className="flex-1 data-[state=active]:bg-indigo-600 text-xs">Pants</TabsTrigger>
                </TabsList>
              </Tabs>
              {avatarTab === "skin" && (
                <div className="mt-3 max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-5 gap-2">
                    {SKIN_COLORS.map(({ name, color }) => (
                      <button key={color} onClick={() => setLocalAvatar({ ...localAvatar, skin: color })}
                        className={`flex flex-col items-center p-1.5 rounded transition-all border-2 ${localAvatar.skin === color ? "border-indigo-500 ring-1 ring-indigo-400 bg-indigo-600/20" : "border-transparent hover:border-slate-500 hover:bg-slate-700/30"}`}>
                        <div className="w-8 h-8 rounded" style={{ backgroundColor: color }} />
                        <span className="text-xs text-slate-300 mt-1 truncate w-full text-center leading-tight">{name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {avatarTab === "face" && (
                <div className="mt-3 grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-64 overflow-y-auto">
                  {ownedItems.filter(i => i.item_type === "face").map(item => {
                    const isEquipped = localAvatar.face === item.id;
                    return (
                      <button key={item.id} onClick={() => equipItem(item.id, "face")}
                        className={`p-1.5 rounded text-center transition-all ${isEquipped ? "bg-indigo-600/30 ring-2 ring-indigo-500" : "bg-slate-700/30 hover:bg-slate-700/50"}`}>
                        <div className="flex justify-center"><FacePreview faceId={item.id} size={44} /></div>
                        <p className="text-[9px] text-slate-400 mt-0.5 truncate">{isEquipped ? "✓ " : ""}{item.display_name}</p>
                      </button>
                    );
                  })}
                </div>
              )}
              {avatarTab === "shirt" && (
                <div className="mt-3 grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-64 overflow-y-auto">
                  {ownedItems.filter(i => i.item_type === "shirt").map(item => {
                    const isEquipped = localAvatar.shirt === item.id;
                    return (
                      <button key={item.id} onClick={() => equipItem(item.id, "shirt")}
                        className={`p-1.5 rounded text-center transition-all ${isEquipped ? "bg-indigo-600/30 ring-2 ring-indigo-500" : "bg-slate-700/30 hover:bg-slate-700/50"}`}>
                        <div className="w-8 h-8 rounded mx-auto mb-0.5" style={{ backgroundColor: item.color }} />
                        <p className="text-[9px] text-slate-400 truncate">{isEquipped ? "✓ " : ""}{item.display_name}</p>
                      </button>
                    );
                  })}
                </div>
              )}
              {avatarTab === "pants" && (
                <div className="mt-3 grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-64 overflow-y-auto">
                  {ownedItems.filter(i => i.item_type === "pants").map(item => {
                    const isEquipped = localAvatar.left_leg === item.id;
                    return (
                      <button key={item.id} onClick={() => equipItem(item.id, "pants")}
                        className={`p-1.5 rounded text-center transition-all ${isEquipped ? "bg-indigo-600/30 ring-2 ring-indigo-500" : "bg-slate-700/30 hover:bg-slate-700/50"}`}>
                        <div className="w-8 h-8 rounded mx-auto mb-0.5" style={{ backgroundColor: item.color }} />
                        <p className="text-[9px] text-slate-400 truncate">{isEquipped ? "✓ " : ""}{item.display_name}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
