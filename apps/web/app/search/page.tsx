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
  const [searchError, setSearchError] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    setSearchError("");
    try {
      const res = await aiApi.search(q);
      setResults(res.data.results);
      if (res.data.results.length === 0 && !res.data.ai_available) {
        setSearchError("Neural search engine offline. Check environment configuration.");
      }
    } catch (err: any) {
      setResults([]);
      if (err?.response?.status === 429) {
        setSearchError("Neural request limit exceeded. Cooldown active.");
      } else if (err?.response?.status === 503) {
        setSearchError("AI Index is not initialized. Please re-index your corpus.");
      } else {
        setSearchError("Neural synthesis failed. Verify book processing status.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") doSearch(query);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <div className="fixed inset-0 bg-grid opacity-10 pointer-events-none" />

      {/* Floating Header */}
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 md:px-12 flex items-center justify-center pt-6",
        scrolled ? "h-20" : "h-24"
      )}>
        <div className={cn(
          "w-full max-w-4xl flex items-center justify-between px-6 h-14 rounded-2xl transition-all duration-300",
          scrolled ? "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl" : "bg-transparent border-transparent"
        )}>
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-all">
              <ArrowLeft size={20} />
            </button>
            <div className="relative flex-1 max-w-2xl hidden md:block">
               <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
               <input
                 autoFocus
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 onKeyDown={handleKey}
                 placeholder="Search neural library..."
                 className="w-full h-10 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-primary/50 transition-all"
               />
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button
              onClick={() => doSearch(query)}
              disabled={loading || !query.trim()}
              className="h-10 px-6 rounded-xl bg-primary text-white font-bold text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-30"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Initiate Search"}
            </button>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-24 px-6 max-w-3xl mx-auto relative z-10">
        <AnimatePresence mode="wait">
          {!searched ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-32 text-center"
            >
              <div className="w-20 h-20 rounded-[2rem] bg-zinc-900/50 border border-white/5 flex items-center justify-center mb-8">
                <Search size={32} className="text-zinc-700" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-4">Neural Search</h2>
              <p className="text-zinc-500 font-medium text-lg italic font-serif max-w-sm">
                Query your entire corpus of knowledge using high-fidelity semantic analysis.
              </p>
              
              <div className="mt-12 w-full max-w-md md:hidden">
                 <input
                   autoFocus
                   value={query}
                   onChange={(e) => setQuery(e.target.value)}
                   onKeyDown={handleKey}
                   placeholder="Search library..."
                   className="w-full h-14 bg-zinc-900/50 border border-white/10 rounded-2xl px-6 text-white text-center focus:outline-none focus:border-primary/50 transition-all"
                 />
              </div>
            </motion.div>
          ) : loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-40 gap-6">
              <div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Synthesizing Results</p>
            </motion.div>
          ) : results.length === 0 ? (
            <motion.div key="no-results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-32 text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center justify-center mb-6">
                 <Search size={24} className="text-red-500/40" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Null Result</h3>
              <p className="text-zinc-500 font-medium max-w-xs">{searchError || "No semantic matches found for this query within your corpus."}</p>
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center justify-between mb-8">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
                  {results.length} Potential Connection{results.length !== 1 ? "s" : ""} Found
                </span>
              </div>
              
              <div className="space-y-4">
                {results.map((r, i) => (
                  <motion.div
                    key={`${r.book_id}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => router.push(`/reader/${r.book_id}`)}
                    className="group relative p-8 rounded-[2rem] bg-zinc-900/40 border border-white/5 hover:border-primary/30 hover:bg-zinc-900/60 cursor-pointer transition-all overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[40px] -z-10 group-hover:bg-primary/10 transition-all" />
                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1">
                        <BookOpen size={20} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                           <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">
                             {r.book_title}
                           </h4>
                           {r.author && <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest truncate">/ {r.author}</span>}
                        </div>
                        <p className="text-zinc-400 font-medium leading-relaxed italic font-serif text-lg">
                          "{r.excerpt}"
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
