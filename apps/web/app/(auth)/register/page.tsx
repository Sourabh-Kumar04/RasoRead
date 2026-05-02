"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff, BookOpen, ArrowLeft, Check } from "lucide-react";
import { authApi } from "@/lib/api";

const PERKS = [
  "Upload PDF, EPUB, DOCX, TXT",
  "AI audio with word-by-word sync",
  "Highlights, notes & AI Q&A",
  "Reading streaks & analytics",
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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/8 blur-[100px] rounded-full" />
      </div>

      {/* Back */}
      <button
        onClick={() => router.push("/")}
        className="fixed top-6 left-6 flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeft size={14} />
        Home
      </button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px]"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center mb-4 cursor-pointer"
            onClick={() => router.push("/")}
          >
            <BookOpen size={18} className="text-white" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create your account</h1>
          <p className="text-sm text-zinc-500 mt-1">Free during early access. No credit card.</p>
        </div>

        {/* Perks */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {PERKS.map((p) => (
            <div key={p} className="flex items-center gap-2 text-xs text-zinc-400">
              <Check size={11} className="text-emerald-500 shrink-0" />
              {p}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8">
          <form onSubmit={submit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Full name</label>
              <input
                id="register-name"
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="Your name"
                required
                autoComplete="name"
                className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-lg px-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:bg-white/[0.06] transition-all"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Email</label>
              <input
                id="register-email"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-lg px-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:bg-white/[0.06] transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Password</label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Min. 8 characters"
                  required
                  autoComplete="new-password"
                  className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-lg px-3.5 pr-10 text-sm text-white focus:outline-none focus:border-indigo-500/60 focus:bg-white/[0.06] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Confirm password</label>
              <input
                id="register-confirm"
                type="password"
                value={form.confirm}
                onChange={set("confirm")}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-lg px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 focus:bg-white/[0.06] transition-all"
              />
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-lg"
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? "Creating account…" : "Create account"}
            </button>

            <p className="text-xs text-zinc-600 text-center mt-1">
              By signing up you agree to our terms of service.
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-zinc-600 mt-6">
          Already have an account?{" "}
          <button
            onClick={() => router.push("/login")}
            className="text-zinc-300 hover:text-white font-medium transition-colors"
          >
            Sign in
          </button>
        </p>
      </motion.div>
    </div>
  );
}
