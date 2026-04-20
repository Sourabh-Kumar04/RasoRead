"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Loader2 } from "lucide-react";
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
    if (form.password !== form.confirm) {
      setError("Passwords don't match");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
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
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center gap-3 justify-center mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen size={20} className="text-primary" />
          </div>
          <span className="font-headline italic text-2xl text-[#dae2fd]">RasoRead</span>
        </div>

        <div className="bg-surface-low rounded-3xl border border-outline-variant/20 p-8 space-y-6">
          <div>
            <h1 className="font-headline text-3xl text-[#dae2fd]">Create account</h1>
            <p className="font-label text-sm text-outline mt-1">
              Start your audio reading journey
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {[
              { label: "Name", key: "name", type: "text", placeholder: "Your name" },
              { label: "Email", key: "email", type: "email", placeholder: "you@example.com" },
              { label: "Password", key: "password", type: "password", placeholder: "Min 8 characters" },
              { label: "Confirm password", key: "confirm", type: "password", placeholder: "Repeat password" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="font-label text-xs uppercase tracking-widest text-outline mb-2 block">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={set(key as keyof typeof form)}
                  placeholder={placeholder}
                  required
                  className="w-full bg-surface-high border border-outline-variant/20 rounded-xl
                             px-4 py-3 font-label text-sm text-[#dae2fd] placeholder:text-outline
                             focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            ))}

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
              {loading && <Loader2 size={16} className="animate-spin" />}
              Create account
            </button>
          </form>

          <p className="text-center font-label text-sm text-outline">
            Already have an account?{" "}
            <button
              onClick={() => router.push("/login")}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
