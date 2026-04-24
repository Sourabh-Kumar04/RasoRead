"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Headphones, BookOpen, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

interface SharedHighlight {
  text: string;
  book_title: string;
  author?: string;
  page: number;
  color: string;
}

export default function SharePage() {
  const { highlightId } = useParams<{ highlightId: string }>();
  const router = useRouter();
  const [data, setData] = useState<SharedHighlight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/notes/highlights/${highlightId}/share`)
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [highlightId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-4 px-6">
        <p className="font-headline text-2xl text-zinc-400">Highlight not found</p>
        <button onClick={() => router.push("/")} className="font-label text-sm text-primary hover:underline">
          Go to RasoRead
        </button>
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    primary: "border-primary/40 bg-primary/5",
    yellow:  "border-amber-400/40 bg-amber-400/5",
    green:   "border-emerald-400/40 bg-emerald-400/5",
    red:     "border-red-400/40 bg-red-400/5",
  };
  const cardColor = colorMap[data.color] || colorMap.primary;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-4 py-16">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/5 blur-[100px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Brand */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Headphones size={16} className="text-primary" />
          </div>
          <span className="font-headline italic text-lg text-white tracking-tight">RasoRead</span>
        </div>

        {/* Highlight card */}
        <div className={`rounded-2xl border p-7 mb-6 ${cardColor}`}>
          <p className="font-headline text-xl text-white leading-relaxed italic mb-5">
            "{data.text}"
          </p>
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-zinc-500" />
            <span className="font-label text-sm text-zinc-500">
              {data.book_title}
              {data.author && ` — ${data.author}`}
              {" · "}p.{data.page}
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-3">
          <p className="font-label text-sm text-zinc-600">
            Listen to this book with AI voices on RasoRead
          </p>
          <button
            onClick={() => router.push("/register")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary font-label text-sm font-semibold hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_16px_rgba(128,131,255,0.25)]"
          >
            Start reading free
            <ArrowRight size={14} />
          </button>
          <p className="font-label text-[10px] text-zinc-700 uppercase tracking-widest">
            No credit card · 20+ neural voices
          </p>
        </div>
      </motion.div>
    </div>
  );
}
