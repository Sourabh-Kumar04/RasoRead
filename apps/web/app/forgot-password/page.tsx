"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff, BookOpen, ArrowLeft } from "lucide-react";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Something went wrong");
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

      {/* Back to home */}
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
        className="w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center mb-4 cursor-pointer"
            onClick={() => router.push("/")}
          >
            <BookOpen size={18} className="text-white" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reset password</h1>
          <p className="text-sm text-zinc-500 mt-1">Enter your email and we'll send you a reset link</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8">
          {sent ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-6"
            >
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-400 text-xl">✓</span>
              </div>
              <p className="text-white font-medium">Check your email</p>
              <p className="text-zinc-500 text-sm mt-2">
                If an account exists for {email}, we've sent password reset instructions.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="text-indigo-400 text-sm mt-4 hover:underline"
              >
                Back to sign in
              </button>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-lg px-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:bg-white/[0.06] transition-all"
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
                type="submit"
                disabled={loading}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-zinc-600 mt-6">
          Remember your password?{" "}
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