"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Users, BookOpen, Activity, Shield, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AdminStats {
  users: {
    total: number;
    verified: number;
    new_last_30_days: number;
  };
  books: {
    total: number;
    ready: number;
    processing: number;
    error: number;
  };
  activity_last_7_days: Record<string, number>;
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("rasoread_access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Get current user to check role
    api.get("/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setUserRole(res.data.role);
        if (res.data.role !== "admin") {
          setError("Access denied. Admin role required.");
          setLoading(false);
          return;
        }
        // Fetch admin stats
        return api.get("/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
      })
      .then((res) => {
        if (res) setStats(res.data);
      })
      .catch(() => {
        setError("Failed to load admin data");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-8">
            <ArrowLeft size={20} /> Back
          </button>
          <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
            <Shield size={48} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-zinc-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-grid opacity-10 pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 pt-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14 rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/10">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white">
              <ArrowLeft size={20} />
            </button>
            <span className="text-sm font-bold tracking-widest uppercase text-white/60">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
            <Shield size={14} className="text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-400">Admin</span>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-24 px-6 max-w-6xl mx-auto">
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {/* Users Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-[2rem] bg-zinc-900/40 border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Users size={20} className="text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Users</span>
              </div>
              <p className="text-4xl font-bold text-white mb-1">{stats.users.total}</p>
              <p className="text-xs text-zinc-500">
                {stats.users.verified} verified · {stats.users.new_last_30_days} new this month
              </p>
            </motion.div>

            {/* Books Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-[2rem] bg-zinc-900/40 border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <BookOpen size={20} className="text-green-400" />
                </div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Books</span>
              </div>
              <p className="text-4xl font-bold text-white mb-1">{stats.books.total}</p>
              <p className="text-xs text-zinc-500">
                {stats.books.ready} ready · {stats.books.processing} processing · {stats.books.error} errors
              </p>
            </motion.div>

            {/* Activity Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-[2rem] bg-zinc-900/40 border border-white/10 col-span-1 md:col-span-2"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Activity size={20} className="text-purple-400" />
                </div>
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Activity (7 days)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.activity_last_7_days).slice(0, 4).map(([event, count]) => (
                  <div key={event} className="text-center p-3 bg-white/[0.03] rounded-xl">
                    <p className="text-2xl font-bold text-white">{count}</p>
                    <p className="text-[10px] text-zinc-500 uppercase">{event.replace("_", " ")}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-8 rounded-[2rem] bg-zinc-900/40 border border-white/10"
        >
          <h2 className="text-lg font-bold text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button className="p-4 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.06] transition-all text-left">
              <p className="text-sm font-semibold text-white">View All Users</p>
              <p className="text-xs text-zinc-500 mt-1">Browse user database</p>
            </button>
            <button className="p-4 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.06] transition-all text-left">
              <p className="text-sm font-semibold text-white">System Health</p>
              <p className="text-xs text-zinc-500 mt-1">Check API status</p>
            </button>
            <button className="p-4 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.06] transition-all text-left">
              <p className="text-sm font-semibold text-white">Quota Management</p>
              <p className="text-xs text-zinc-500 mt-1">View rate limits</p>
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}