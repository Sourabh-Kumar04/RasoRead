"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, LogOut, Save, User, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import { initials, relativeTime, cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";

export default function ProfilePage() {
  const router = useRouter();
  const session = useSessionStore();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    defaultVoice: "nova",
    defaultSpeed: 1.0,
    autoResume: true,
    voiceCommandsEnabled: true,
  });

  useEffect(() => {
    const token = localStorage.getItem("rasoread_access_token");
    if (!token) { router.push("/login"); return; }

    authApi.me()
      .then((res) => {
        setUser(res.data);
        session.setUser(res.data.id, res.data.name || "", res.data.email);
        if (res.data.settings) {
          setSettings((s) => ({ ...s, ...res.data.settings }));
        }
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await authApi.updateSettings(settings);
      session.updateSettings(settings as any);
      toast.success("Settings saved");
    } catch {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("rasoread_access_token");
    localStorage.removeItem("rasoread_refresh_token");
    session.clearUser();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-surface pb-24">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6
                         bg-surface/70 glass border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5">
            <ArrowLeft size={16} className="text-secondary" />
          </button>
          <span className="font-headline italic text-lg text-[#dae2fd]">Profile</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/20
                     hover:border-red-500/30 text-outline hover:text-red-400 font-label text-sm transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-6">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Avatar + name */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-5 p-6 rounded-2xl bg-surface-low border border-outline-variant/10"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center
                              font-headline text-2xl text-primary">
                {user?.name ? initials(user.name) : <User size={28} />}
              </div>
              <div>
                <p className="font-headline text-xl text-[#dae2fd]">{user?.name || "Reader"}</p>
                <p className="font-label text-sm text-outline">{user?.email}</p>
                <p className="font-label text-xs text-outline/60 mt-1">
                  Member since {user?.created_at ? relativeTime(user.created_at) : "—"}
                </p>
              </div>
            </motion.div>

            {/* Reading preferences */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-6 rounded-2xl bg-surface-low border border-outline-variant/10 space-y-5"
            >
              <p className="font-label text-xs uppercase tracking-widest text-outline">
                Reading preferences
              </p>

              {/* Default voice */}
              <div>
                <label className="font-label text-sm text-[#dae2fd] block mb-2">Default voice</label>
                <select
                  value={settings.defaultVoice}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultVoice: e.target.value }))}
                  className="w-full bg-surface-high border border-outline-variant/20 rounded-xl
                             px-4 py-2.5 font-label text-sm text-[#dae2fd] focus:outline-none focus:border-primary/50"
                >
                  {["nova", "alloy", "echo", "fable", "onyx", "shimmer"].map((v) => (
                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Default speed */}
              <div>
                <label className="font-label text-sm text-[#dae2fd] block mb-2">
                  Default speed: {settings.defaultSpeed}x
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={3.0}
                  step={0.25}
                  value={settings.defaultSpeed}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultSpeed: Number(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between font-label text-xs text-outline mt-1">
                  <span>0.5x</span><span>3.0x</span>
                </div>
              </div>

              {/* Toggles */}
              {[
                { key: "autoResume", label: "Auto-resume last position" },
                { key: "voiceCommandsEnabled", label: "Enable voice commands" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="font-label text-sm text-[#dae2fd]">{label}</span>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, [key]: !s[key as keyof typeof s] }))}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors",
                      settings[key as keyof typeof settings]
                        ? "bg-primary"
                        : "bg-surface-highest"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm",
                        settings[key as keyof typeof settings] && "translate-x-5"
                      )}
                    />
                  </button>
                </div>
              ))}
            </motion.div>

            {/* Save */}
            <button
              onClick={saveSettings}
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save preferences
            </button>

            {/* Danger zone */}
            <div className="p-5 rounded-2xl border border-red-500/20 space-y-3">
              <p className="font-label text-xs uppercase tracking-widest text-red-400">Danger zone</p>
              <p className="font-label text-sm text-outline">
                Deleting your account permanently removes all books, notes, and highlights.
              </p>
              <button
                onClick={() => toast.error("Account deletion requires email confirmation — not implemented in demo.")}
                className="font-label text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Delete account
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
