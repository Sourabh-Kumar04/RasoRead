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
  const [scrolled, setScrolled] = useState(false);
  const [settings, setSettings] = useState({
    defaultVoice: "edge-en-US-AriaNeural",
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

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [router, session]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await authApi.updateSettings({
        voice_id: settings.defaultVoice,
        tts_speed: settings.defaultSpeed,
      });
      session.updateSettings(settings as any);
      toast.success("Preferences updated");
    } catch {
      toast.error("Failed to save preferences");
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
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <div className="fixed inset-0 bg-grid opacity-10 pointer-events-none" />

      {/* Floating Header */}
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 md:px-12 flex items-center justify-center pt-6",
        scrolled ? "h-20" : "h-24"
      )}>
        <div className={cn(
          "w-full max-w-3xl flex items-center justify-between px-6 h-14 rounded-2xl transition-all duration-300",
          scrolled ? "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl" : "bg-transparent border-transparent"
        )}>
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all">
              <ArrowLeft size={20} />
            </button>
            <span className="text-sm font-bold tracking-widest uppercase text-white/60">Account Identity</span>
          </div>
          <button onClick={logout} className="flex items-center gap-2 h-9 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all text-xs font-bold uppercase tracking-widest">
            <LogOut size={14} />
            Exit
          </button>
        </div>
      </header>

      <main className="pt-32 pb-24 px-6 max-w-2xl mx-auto relative z-10">
        {loading ? (
          <div className="flex justify-center pt-32">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* User Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative group p-8 rounded-[2.5rem] bg-zinc-900/40 border border-white/10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-[60px] -z-10 group-hover:bg-primary/10 transition-all" />
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-[2rem] bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-3xl text-primary shadow-[0_0_30px_rgba(129,140,248,0.25)]">
                  {user?.name ? initials(user.name) : <User size={32} />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">{user?.name || "Member"}</h2>
                  <p className="text-zinc-500 font-medium mb-2">{user?.email}</p>
                  <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest block">
                    Identity Established {user?.created_at ? relativeTime(user.created_at) : "—"}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Reading Preferences Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-10 rounded-[2.5rem] bg-zinc-900/40 border border-white/10 space-y-10"
            >
              <div className="flex items-center gap-3">
                 <div className="w-1 h-4 bg-primary rounded-full" />
                 <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Neural Narrative Tuning</span>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 block ml-1">Preferred Voice Model</label>
                <select
                  value={settings.defaultVoice}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultVoice: e.target.value }))}
                  className="w-full h-14 bg-white/[0.03] border border-white/10 rounded-2xl px-6 text-sm text-zinc-300 focus:outline-none focus:border-primary/50 appearance-none cursor-pointer transition-all"
                >
                  <optgroup label="Microsoft Neural High-Fidelity">
                    {[
                      ["edge-en-US-AriaNeural",        "Aria (American High-Fidelity)"],
                      ["edge-en-US-JennyNeural",       "Jenny (Warm American)"],
                      ["edge-en-US-GuyNeural",         "Guy (Narrative American)"],
                      ["edge-en-US-ChristopherNeural", "Christopher (Clear American)"],
                      ["edge-en-GB-SoniaNeural",       "Sonia (British Scholarly)"],
                      ["edge-en-GB-RyanNeural",        "Ryan (British Narrative)"],
                      ["edge-en-AU-NatashaNeural",     "Natasha (Australian Clear)"],
                    ].map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end ml-1">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Cognitive Speed</label>
                   <span className="text-xl font-bold text-primary">{settings.defaultSpeed}x</span>
                </div>
                <div className="relative h-6 flex items-center">
                   <input
                    type="range"
                    min={0.5}
                    max={3.0}
                    step={0.25}
                    value={settings.defaultSpeed}
                    onChange={(e) => setSettings((s) => ({ ...s, defaultSpeed: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-primary cursor-pointer"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-zinc-800 uppercase tracking-widest px-1">
                  <span>Slow</span><span>Standard</span><span>Hyper</span>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 space-y-6">
                {[
                  { key: "autoResume",           label: "Temporal Auto-Resume", desc: "Instantly returns to your exact mental state." },
                  { key: "voiceCommandsEnabled", label: "Auditory Commands", desc: "Interact with the library via neural voice." },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between group">
                    <div>
                      <p className="text-sm font-bold text-zinc-200">{label}</p>
                      <p className="text-xs font-medium text-zinc-600">{desc}</p>
                    </div>
                    <button
                      onClick={() => setSettings((s) => ({ ...s, [key]: !s[key as keyof typeof s] }))}
                      className={cn(
                        "relative w-12 h-6 rounded-full transition-all duration-500 shadow-inner shrink-0",
                        settings[key as keyof typeof settings] ? "bg-primary" : "bg-zinc-800"
                      )}
                    >
                      <motion.div
                        animate={{ x: settings[key as keyof typeof settings] ? 26 : 2 }}
                        className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow-xl"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full h-14 flex items-center justify-center gap-3 rounded-[2rem] bg-primary text-white font-bold text-sm shadow-[0_12px_32px_rgba(129,140,248,0.25)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Update Neural Preferences
            </button>

            {/* Danger Zone */}
            <div className="p-8 rounded-[2.5rem] border border-red-500/20 bg-red-500/[0.02] space-y-4">
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em] block mb-2">Entropy Zone</span>
              <p className="text-sm font-medium text-zinc-600 leading-relaxed">
                Permanently purge your digital mind. This action removes all books, notes, and metrics from the neural database.
              </p>
              <button
                onClick={async () => {
                  if (!window.confirm("Permanently delete your account? This action is irreversible.")) return;
                  try {
                    await authApi.deleteAccount();
                    localStorage.removeItem("rasoread_access_token");
                    localStorage.removeItem("rasoread_refresh_token");
                    session.clearUser();
                    router.push("/register");
                  } catch {
                    toast.error("Operation failed");
                  }
                }}
                className="text-[10px] font-bold text-red-500/60 hover:text-red-500 transition-all uppercase tracking-widest underline decoration-red-500/20 underline-offset-4"
              >
                Terminate Account Identity
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
