"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Brain, Zap, TrendingUp, BookOpen } from "lucide-react";
import { analyticsApi, booksApi } from "@/lib/api";

export default function InsightsPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("rasoread_access_token");
    if (!token) { router.push("/login"); return; }

    Promise.all([
      analyticsApi.summary(),
      booksApi.list(),
    ]).then(([aRes, bRes]) => {
      setAnalytics(aRes.data);
      setBooks(bRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const daily = analytics?.daily_stats || [];
  const maxEvents = Math.max(...daily.map((d: any) => d.events), 1);

  return (
    <div className="min-h-screen bg-surface">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6
                         bg-surface/70 glass border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/library")} className="p-2 rounded-xl hover:bg-white/5">
            <ArrowLeft size={16} className="text-secondary" />
          </button>
          <span className="font-headline italic text-lg text-[#dae2fd]">AI Insights</span>
        </div>
      </header>

      <main className="pt-24 pb-20 px-6 max-w-4xl mx-auto space-y-10">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Books in library", value: books.length, icon: BookOpen },
                { label: "Completed", value: analytics?.books_completed || 0, icon: TrendingUp },
                { label: "Avg speed", value: `${analytics?.avg_speed || 1}x`, icon: Zap },
                { label: "Actions logged", value: Object.values(analytics?.event_counts || {}).reduce((a: any, b: any) => a + b, 0), icon: Brain },
              ].map(({ label, value, icon: Icon }) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-2xl bg-surface-low border border-outline-variant/10 space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-label text-[10px] uppercase tracking-widest text-outline">{label}</p>
                    <p className="font-headline text-3xl text-[#dae2fd]">{value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Activity chart */}
            <div className="p-6 rounded-2xl bg-surface-low border border-outline-variant/10">
              <p className="font-label text-xs uppercase tracking-widest text-outline mb-6">
                Activity — last 7 days
              </p>
              <div className="flex items-end gap-3 h-32">
                {daily.slice(-7).map((d: any, i: number) => {
                  const h = Math.max(8, (d.events / maxEvents) * 112);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: h }}
                        className="w-full rounded-t-lg bg-primary/30 hover:bg-primary/50 transition-colors cursor-default"
                        title={`${d.events} events`}
                      />
                      <span className="font-label text-[9px] text-outline">{d.date?.slice(5) || ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Most highlighted */}
            {analytics?.most_highlighted_books?.length > 0 && (
              <div className="p-6 rounded-2xl bg-surface-low border border-outline-variant/10">
                <p className="font-label text-xs uppercase tracking-widest text-outline mb-4">
                  Most highlighted books
                </p>
                <div className="space-y-3">
                  {analytics.most_highlighted_books.map((item: any, i: number) => {
                    const book = books.find((b) => b.id === item.book_id);
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <span className="font-label text-xs text-outline w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-label text-sm text-[#dae2fd] truncate">
                            {book?.title || "Unknown"}
                          </p>
                        </div>
                        <span className="font-label text-xs text-primary shrink-0">
                          {item.highlight_count} highlights
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Event breakdown */}
            {analytics?.event_counts && Object.keys(analytics.event_counts).length > 0 && (
              <div className="p-6 rounded-2xl bg-surface-low border border-outline-variant/10">
                <p className="font-label text-xs uppercase tracking-widest text-outline mb-4">
                  Event breakdown
                </p>
                <div className="space-y-2">
                  {Object.entries(analytics.event_counts).map(([type, count]: any) => {
                    const total = Object.values(analytics.event_counts).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
                    const pct = Math.round((Number(count) / total) * 100);
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <span className="font-label text-xs text-outline w-32 capitalize">
                          {type.replace(/_/g, " ")}
                        </span>
                        <div className="flex-1 h-1.5 bg-surface-highest rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-label text-xs text-outline w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
