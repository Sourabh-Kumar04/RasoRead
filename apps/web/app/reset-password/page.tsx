"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff, BookOpen, ArrowLeft } from "lucide-react";
import { authApi } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token!, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/8 blur-[100px] rounded-full" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[400px] text-center"
        >
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-green-400 text-3xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Password reset</h1>
          <p className="text-zinc-500 mb-6">Your password has been changed successfully.</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full h-10 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm"
          >
            Sign in with new password
          </button>
        </motion.div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-white tracking-tight">New password</h1>
          <p className="text-sm text-zinc-500 mt-1">Enter your new password below</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8">
          <form onSubmit={submit} className="space-y-4">
            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">New password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-lg px-3.5 pr-10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:bg-white/[0.06] transition-all"
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

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Confirm password</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
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
              disabled={loading || !token}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}