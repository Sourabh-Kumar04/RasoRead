"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Headphones, Flame, Loader2, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { initials, cn } from "@/lib/utils";

interface PublicProfile {
  id: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  stats: {
    books_count: number;
    books_completed: number;
    streak_days: number;
    total_listening_minutes: number;
  };
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/auth/${userId}/public`);
        setProfile(res.data);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setError("This profile is private or doesn't exist.");
        } else {
          setError("Failed to load profile.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-400 hover:text-white mb-8"
          >
            <ArrowLeft size={20} /> Back
          </button>
          <div className="p-8 bg-zinc-900/40 border border-white/10 rounded-2xl text-center">
            <Globe size={48} className="text-zinc-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Profile Unavailable</h2>
            <p className="text-zinc-400">{error || "This profile is private."}</p>
          </div>
        </div>
      </div>
    );
  }

  const hoursListened = Math.round((profile.stats.total_listening_minutes || 0) / 60);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-grid opacity-10 pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 pt-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 h-14 rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/10">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-sm font-bold tracking-widest uppercase text-white/60">Public Profile</span>
          <div className="w-10" />
        </div>
      </header>

      <main className="pt-32 pb-24 px-6 max-w-2xl mx-auto">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative group p-8 rounded-[2.5rem] bg-zinc-900/40 border border-white/10 overflow-hidden mb-8"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-[60px] -z-10" />

          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-[2rem] bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-4xl text-primary shadow-[0_0_30px_rgba(129,140,248,0.25)]">
              {profile.name ? initials(profile.name) : "?"}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">{profile.name || "Anonymous"}</h1>
              {profile.bio && (
                <p className="text-zinc-500 font-medium mt-1">{profile.bio}</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-[2rem] bg-zinc-900/40 border border-white/10"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <BookOpen size={20} className="text-blue-400" />
              </div>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Books</span>
            </div>
            <p className="text-3xl font-bold text-white">{profile.stats.books_count}</p>
            <p className="text-xs text-zinc-500 mt-1">{profile.stats.books_completed} completed</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-6 rounded-[2rem] bg-zinc-900/40 border border-white/10"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Headphones size={20} className="text-green-400" />
              </div>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Listening</span>
            </div>
            <p className="text-3xl font-bold text-white">{hoursListened}h</p>
            <p className="text-xs text-zinc-500 mt-1">total time</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="col-span-2 p-6 rounded-[2rem] bg-zinc-900/40 border border-white/10"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Flame size={20} className="text-orange-400" />
              </div>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Reading Streak</span>
            </div>
            <p className="text-3xl font-bold text-white">{profile.stats.streak_days} days</p>
            <p className="text-xs text-zinc-500 mt-1">current streak</p>
          </motion.div>
        </div>

        {/* Join CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 p-6 rounded-[2rem] bg-gradient-to-r from-primary/10 to-indigo-500/10 border border-primary/20 text-center"
        >
          <p className="text-zinc-400 text-sm">
            Join RasoRead to start your own reading journey
          </p>
          <button
            onClick={() => router.push("/register")}
            className="mt-4 px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:brightness-110 transition-all"
          >
            Get Started
          </button>
        </motion.div>
      </main>
    </div>
  );
}