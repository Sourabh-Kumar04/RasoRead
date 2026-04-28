"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Brain, Zap, TrendingUp, BookOpen, Flame, Clock, Target } from "lucide-react";
import { analyticsApi, booksApi } from "@/lib/api";

export default function InsightsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<any>(null);
  const [streak, setStreak] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("rasoread_access_token");
    if (!token) { router.push("/library"); return; }
    
    Promise.all([analyticsApi.summary(), analyticsApi.getStreak(), booksApi.list()])
      .then(([aRes, sRes, bRes]) => { 
        setAnalytics(aRes.data); 
        setStreak(sRes.data); 
        setBooks(bRes.data); 
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [router]);

  const daily = analytics?.daily_stats || [];
  const maxEvents = Math.max(...daily.map((d: any) => d.events), 1);
  const totalEvents = Object.values(analytics?.event_counts || {}).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <div className="fixed inset-0 bg-grid opacity-10 pointer-events-none" />

      {/* Floating Header */}
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 md:px-12 flex items-center justify-center pt-6",
        scrolled ? "h-20" : "h-24"
      )}>
        <div className={cn(
          "w-full max-w-7xl flex items-center justify-between px-6 h-14 rounded-2xl transition-all duration-300",
          scrolled ? "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl" : "bg-transparent border-transparent"
        )}>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/library")} className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all">
              <ArrowLeft size={20} />
            </button>
            <span className="text-sm font-bold tracking-widest uppercase text-white/60">Insights Center</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40" />
          </div>
        </div>
      </header>

      <main className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto relative z-10">
        <header className="mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">Neural Library Metrics</h1>
          <p className="text-zinc-500 font-medium text-lg italic font-serif">Deep analysis of your scholarly journey and knowledge retention.</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* Knowledge Graph Hero */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 relative group overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/40 backdrop-blur-xl p-10">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-1">Architecture of Knowledge</span>
                      <h3 className="text-3xl font-bold text-white tracking-tight">Conceptual Map</h3>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Brain size={24} />
                    </div>
                  </div>
                  
                  <div className="h-[400px] flex items-center justify-center relative scale-110 lg:scale-100">
                    <svg className="absolute inset-0 w-full h-full opacity-40">
                      <line className="knowledge-line" stroke="rgba(129,140,248,0.4)" strokeWidth="1" x1="25%" y1="35%" x2="50%" y2="50%" />
                      <line className="knowledge-line" stroke="rgba(129,140,248,0.4)" strokeWidth="1" x1="75%" y1="25%" x2="50%" y2="50%" />
                      <line className="knowledge-line" stroke="rgba(129,140,248,0.4)" strokeWidth="1" x1="45%" y1="75%" x2="50%" y2="50%" />
                      <line className="knowledge-line" stroke="rgba(129,140,248,0.4)" strokeWidth="1" x1="25%" y1="35%" x2="45%" y2="75%" />
                    </svg>
                    
                    <div className="relative z-10 flex flex-wrap justify-center gap-16">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_40px_rgba(129,140,248,0.2)]">
                          <Brain size={28} className="text-primary" />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Cognitive Flow</span>
                      </div>
                      <div className="flex flex-col items-center gap-4 mt-16">
                        <div className="w-24 h-24 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center">
                          <BookOpen size={28} className="text-zinc-500" />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Epistemology</span>
                      </div>
                      <div className="flex flex-col items-center gap-4 -mt-10">
                        <div className="w-16 h-16 rounded-full bg-zinc-900/50 border border-white/5 flex items-center justify-center">
                          <Zap size={22} className="text-zinc-600" />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Logic</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Stats */}
              <div className="space-y-6">
                <div className="p-8 rounded-[2rem] bg-zinc-900/40 border border-white/10 hover:border-orange-500/30 transition-all group overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[40px] -z-10 group-hover:bg-orange-500/10 transition-all" />
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Momentum Streak</span>
                    <Flame size={20} className={streak?.streak > 0 ? "text-orange-500" : "text-zinc-800"} fill={streak?.streak > 0 ? "currentColor" : "none"} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-white">{streak?.streak || 0}</span>
                    <span className="text-sm font-bold text-zinc-600 uppercase">Days Active</span>
                  </div>
                  <p className="text-xs font-medium text-zinc-500 mt-4">Record performance: {streak?.longest || 0} days</p>
                </div>

                <div className="p-8 rounded-[2rem] bg-zinc-900/40 border border-white/10 hover:border-primary/30 transition-all group overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[40px] -z-10 group-hover:bg-primary/10 transition-all" />
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Recall Velocity</span>
                    <TrendingUp size={20} className="text-primary/60" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-white">{analytics?.books_completed ? Math.round((analytics.books_completed / Math.max(books.length, 1)) * 100) : 0}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full mt-6 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: "84%" }} className="h-full bg-primary" />
                  </div>
                </div>
              </div>
            </section>

            {/* Core Stats Grid */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: "Corpus Size", value: books.length, icon: BookOpen, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
                { label: "Finished", value: analytics?.books_completed || 0, icon: Target, color: "text-indigo-400", bg: "bg-indigo-400/10 border-indigo-400/20" },
                { label: "Neural Speed", value: `${analytics?.avg_speed || 1}x`, icon: Zap, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
                { label: "Deep Sessions", value: totalEvents, icon: Brain, color: "text-violet-400", bg: "bg-violet-400/10 border-violet-400/20" },
              ].map(({ label, value, icon: Icon, color, bg }, i) => (
                <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", bg)}>
                    <Icon size={18} className={color} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">{label}</span>
                    <p className="text-2xl font-bold text-white">{value}</p>
                  </div>
                </motion.div>
              ))}
            </section>

            {/* Activity History */}
            {daily.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-10 rounded-[2.5rem] bg-zinc-900/40 border border-white/10">
                <div className="flex items-center justify-between mb-10">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Temporal Activity</span>
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    <Clock size={12} className="text-primary" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">{daily.slice(-7).reduce((a: number, d: any) => a + d.events, 0)} Session Points</span>
                  </div>
                </div>
                <div className="flex items-end gap-3 h-32">
                  {daily.slice(-7).map((d: any, i: number) => {
                    const h = Math.max(6, (d.events / maxEvents) * 100);
                    const isToday = i === daily.slice(-7).length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-3">
                        <motion.div 
                          initial={{ height: 0 }} 
                          animate={{ height: `${h}%` }} 
                          transition={{ delay: i * 0.05, duration: 0.6 }}
                          className={cn(
                            "w-full rounded-lg transition-all",
                            isToday ? "bg-primary shadow-[0_0_20px_rgba(129,140,248,0.3)]" : "bg-white/5 hover:bg-white/10"
                          )} 
                        />
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider", isToday ? "text-primary" : "text-zinc-700")}>{d.date?.slice(5) || ""}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}