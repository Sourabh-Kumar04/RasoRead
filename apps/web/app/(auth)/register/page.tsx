"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Headphones } from "lucide-react";
import { authApi } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
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
      setError(err?.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/5 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Headphones size={22} className="text-primary" />
          </div>
          <h1 className="font-headline italic text-2xl text-white tracking-tight">RasoRead</h1>
          <p className="font-label text-xs text-zinc-600 mt-1 uppercase tracking-widest">Your books, now in motion</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-7 space-y-5">
          <div>
            <h2 className="font-headline text-2xl text-white font-medium">Create account</h2>
            <p className="font-label text-sm text-zinc-600 mt-1">Start your audio reading journey</p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {[
              { label: "Name", key: "name", type: "text", placeholder: "Your name" },
              { label: "Email", key: "email", type: "email", placeholder: "you@example.com" },
              { label: "Password", key: "password", type: "password", placeholder: "Min 8 characters" },
              { label: "Confirm password", key: "confirm", type: "password", placeholder: "Repeat password" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="font-label text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5 block">{label}</label>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={set(key as keyof typeof form)}
                  placeholder={placeholder}
                  required
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 font-label text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all"
                />
              </div>
            ))}

            {error && (
              <p className="font-label text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-on-primary font-label text-sm font-semibold hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(128,131,255,0.2)] disabled:opacity-60 mt-1"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Create account
            </button>
          </form>

          <p className="text-center font-label text-xs text-zinc-600">
            Already have an account?{" "}
            <button onClick={() => router.push("/login")} className="text-primary hover:text-primary/80 transition-colors">
              Sign in
            </button>
          </p>
        </div>

        {/* Social proof */}
        <p className="text-center font-label text-[10px] text-zinc-700 mt-6 uppercase tracking-widest">
          Free · No credit card · 20+ neural voices
        </p>
      </motion.div>
    </div>
  );
}
