"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { aiApi } from "@/lib/api";

interface SearchResult {
  book_id: string;
  book_title: string;
  author?: string;
  excerpt: string;
  score: number;
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await aiApi.search(q);
      setResults(res.data.results);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") doSearch(query);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-on-surface">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center gap-4 px-6 bg-[#0A0A0A]/90 backdrop-blur-[20px] border-b border-white/[0.06]">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={16} />
        </button>

        {/* Search input */}
        <div className="flex-1 relative max-w-xl">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search across all your books…"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 font-label text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-primary/40 transition-all"
          />
        </div>

        <button
          onClick={() => doSearch(query)}
          disabled={loading || !query.trim()}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label text-sm font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : "Search"}
        </button>
      </header>

      <main className="pt-24 pb-20 px-6 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {!searched ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-32 gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <Search size={22} className="text-zinc-700" />
              </div>
              <p className="font-headline text-xl text-zinc-600">Search your library</p>
              <p className="font-label text-sm text-zinc-700 text-center max-w-xs">
                Find passages, quotes, and ideas across all your books using AI semantic search.
              </p>
            </motion.div>
          ) : loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-32">
              <Loader2 size={24} className="text-primary animate-spin" />
            </motion.div>
          ) : results.length === 0 ? (
            <motion.div key="no-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-32 gap-3">
              <p className="font-headline text-xl text-zinc-600">No results found</p>
              <p className="font-label text-sm text-zinc-700">Try different keywords or upload more books.</p>
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <p className="font-label text-[10px] uppercase tracking-widest text-zinc-600 mb-5">
                {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
              </p>
              {results.map((r, i) => (
                <motion.div
                  key={`${r.book_id}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => router.push(`/reader/${r.book_id}`)}
                  className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-primary/30 hover:bg-white/[0.04] cursor-pointer transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <BookOpen size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-label text-xs font-semibold text-primary group-hover:text-primary/80 transition-colors truncate">
                        {r.book_title}
                        {r.author && <span className="text-zinc-600 font-normal ml-1">— {r.author}</span>}
                      </p>
                      <p className="font-label text-sm text-zinc-400 mt-1.5 leading-relaxed line-clamp-3">
                        "{r.excerpt}"
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
