"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Loader2, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      localStorage.setItem("rasoread_access_token", res.data.access_token);
      localStorage.setItem("rasoread_refresh_token", res.data.refresh_token);
      router.push("/library");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen size={20} className="text-primary" />
          </div>
          <span className="font-headline italic text-2xl text-[#dae2fd]">RasoRead</span>
        </div>

        <div className="bg-surface-low rounded-3xl border border-outline-variant/20 p-8 space-y-6">
          <div>
            <h1 className="font-headline text-3xl text-[#dae2fd]">Welcome back</h1>
            <p className="font-label text-sm text-outline mt-1">Sign in to your library</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="font-label text-xs uppercase tracking-widest text-outline mb-2 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-surface-high border border-outline-variant/20 rounded-xl
                           px-4 py-3 font-label text-sm text-[#dae2fd] placeholder:text-outline
                           focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <div>
              <label className="font-label text-xs uppercase tracking-widest text-outline mb-2 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-surface-high border border-outline-variant/20 rounded-xl
                             px-4 py-3 pr-12 font-label text-sm text-[#dae2fd] placeholder:text-outline
                             focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-secondary"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="font-label text-sm text-red-400 bg-red-500/10 px-4 py-3 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Sign in
            </button>
          </form>

          <p className="text-center font-label text-sm text-outline">
            No account?{" "}
            <button
              onClick={() => router.push("/register")}
              className="text-primary hover:underline"
            >
              Create one
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
