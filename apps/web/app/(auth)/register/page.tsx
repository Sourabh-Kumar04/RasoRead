"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff, Headphones, Check } from "lucide-react";
import { authApi } from "@/lib/api";

const PERKS = [
  "Upload unlimited books (PDF, EPUB, DOCX, TXT)",
  "20+ human-quality neural voices",
  "AI summaries, Q&A, and highlights",
  "Reading streaks & progress tracking",
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError("Passwords don't match"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await authApi.register(form.email, form.name, form.password);
      localStorage.setItem("rasoread_access_token", res.data.access_token);
      localStorage.setItem("rasoread_refresh_token", res.data.refresh_token);
      router.push("/library");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex selection:bg-primary/30">
      <div className="fixed inset-0 bg-grid opacity-10 pointer-events-none" />
      
      {/* ── Visual Panel ────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[500px] shrink-0 p-16 border-r border-white/5 bg-zinc-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-24 group cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center transition-transform group-hover:rotate-12">
              <BookOpen size={20} weight="bold" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">RasoRead</span>
          </div>

          <div className="space-y-6 mb-16">
             <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Join the Library</span>
             <h1 className="text-5xl font-bold text-white leading-[1.1] tracking-tight">
               Build your<br />Digital Mind.
             </h1>
             <p className="text-zinc-500 font-medium text-lg leading-relaxed max-w-sm italic font-serif">
               "Reading is an act of deep contemplation and synthesis."
             </p>
          </div>

          <div className="space-y-4">
            {PERKS.map((perk, i) => (
              <motion.div 
                key={perk}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <Check size={12} className="text-primary" />
                </div>
                <p className="text-sm font-medium text-zinc-400">{perk}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
           <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">Est. 2024 · Silicon Valley</p>
        </div>
      </div>

      {/* ── Form Panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-[440px] glass-card p-10 rounded-[2.5rem]"
        >
          <header className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Create Account</h2>
            <p className="text-zinc-500 font-medium">Begin your journey into cognitive reading.</p>
          </header>

          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Your name"
                  required
                  className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Identity (Email)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="email@example.com"
                  required
                  className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Passcode</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Min 8 characters"
                    required
                    className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-5 pr-12 text-sm text-white focus:outline-none focus:border-primary/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Confirm Passcode</label>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={set("confirm")}
                  placeholder="Repeat passcode"
                  required
                  className="w-full h-12 bg-white/[0.03] border border-white/10 rounded-2xl px-5 text-sm text-white focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl">
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-primary text-white font-bold text-sm shadow-[0_8px_24px_rgba(129,140,248,0.3)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              Initiate Account
            </button>
          </form>

          <footer className="mt-8 text-center">
            <p className="text-sm font-medium text-zinc-500">
              Already a member?{" "}
              <button onClick={() => router.push("/login")} className="text-white font-bold hover:text-primary transition-colors">
                Sign In
              </button>
            </p>
          </footer>
        </motion.div>
      </div>
    </div>
  );
}
