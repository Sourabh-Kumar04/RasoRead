"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, BookOpen, ArrowLeft } from "lucide-react";
import { authApi } from "@/lib/api";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid verification link");
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        await authApi.verifyEmail(token);
        setSuccess(true);
      } catch (err: any) {
        setError(err?.response?.data?.detail || "Failed to verify email");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-zinc-400">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        {/* Ambient glow */}
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
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Email verified</h1>
          <p className="text-zinc-500 mb-6">Your email has been verified successfully. You can now sign in to your account.</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full h-10 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm"
          >
            Sign in
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-600/8 blur-[100px] rounded-full" />
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
        className="w-full max-w-[400px] text-center"
      >
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-red-400 text-3xl">✕</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Verification failed</h1>
        <p className="text-zinc-500 mb-6">{error || "This verification link is invalid or has expired."}</p>
        <button
          onClick={() => router.push("/register")}
          className="w-full h-10 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm"
        >
          Create new account
        </button>
      </motion.div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <VerifyForm />
    </Suspense>
  );
}