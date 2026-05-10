"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, BookOpen, BarChart2, LogOut, X, Headphones, Zap, Clock, Upload } from "lucide-react";
import { BookCard } from "@/components/library/BookCard";
import { UploadDropzone } from "@/components/library/UploadDropzone";
import { StreakTracker } from "@/components/library/StreakTracker";
import { booksApi, readerApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { OnboardingModal } from "@/components/ui/OnboardingModal";

type FilterTab = "all" | "reading" | "finished" | "unread";
type SortOption = "created_at" | "title" | "author" | "last_read";

export default function LibraryPage() {
  const router = useRouter();
  const [books, setBooks] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortOption>("created_at");
  const [showUpload, setShowUpload] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("rasoread_access_token");
    if (!token) { router.push("/login"); return; }
    fetchBooks();

    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    fetchBooks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const res = await booksApi.list(sort);
      setBooks(res.data);
      const progEntries = await Promise.allSettled(
        res.data.map((b: any) => readerApi.getProgress(b.id))
      );
      const progMap: Record<string, any> = {};
      progEntries.forEach((result, i) => {
        if (result.status === "fulfilled") progMap[res.data[i].id] = result.value.data;
      });
      setProgress(progMap);
    } catch (err: any) {
      if (err?.response?.status === 401) router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (book: any) => { setBooks((prev) => [book, ...prev]); setShowUpload(false); };
  const handleDelete = (id: string) => setBooks((prev) => prev.filter((b) => b.id !== id));
  const logout = () => {
    localStorage.removeItem("rasoread_access_token");
    localStorage.removeItem("rasoread_refresh_token");
    router.push("/login");
  };

  const filtered = books.filter((b) => {
    const matchSearch = !search || b.title.toLowerCase().includes(search.toLowerCase()) || (b.author || "").toLowerCase().includes(search.toLowerCase());
    const pct = progress[b.id]?.completion_pct || 0;
    const matchFilter =
      filter === "all" ||
      (filter === "reading" && pct > 0 && pct < 95) ||
      (filter === "finished" && pct >= 95) ||
      (filter === "unread" && pct === 0);
    return matchSearch && matchFilter;
  });

  const continueBook = books.find((b) => { const pct = progress[b.id]?.completion_pct || 0; return pct > 0 && pct < 95; });
  const totalHours = Math.round(books.reduce((acc, b) => acc + (b.total_words || 0), 0) / 15000 * 10) / 10;
  const booksFinished = books.filter((b) => (progress[b.id]?.completion_pct || 0) >= 95).length;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-primary/30">
      <OnboardingModal />
      <div className="fixed inset-0 bg-grid opacity-10 pointer-events-none" />

      {/* ── Floating Header ────────────────────────────────────────────────── */}
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 md:px-12 flex items-center justify-center pt-6",
        scrolled ? "h-20" : "h-24"
      )}>
        <div className={cn(
          "w-full max-w-7xl flex items-center justify-between px-6 h-14 rounded-2xl transition-all duration-300",
          scrolled ? "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl" : "bg-transparent border-transparent"
        )}>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push("/")}>
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Headphones size={16} className="text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight text-white italic">RasoRead</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <span className="text-white text-sm font-semibold">Library</span>
              <button onClick={() => router.push("/insights")} className="text-zinc-500 hover:text-white transition-colors text-sm font-medium">Insights</button>
              <button onClick={() => router.push("/collections")} className="text-zinc-500 hover:text-white transition-colors text-sm font-medium">Collections</button>
              <button onClick={() => router.push("/profile")} className="text-zinc-500 hover:text-white transition-colors text-sm font-medium">Profile</button>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-primary/50 transition-all">
              <Search size={14} className="text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search library..." 
                className="bg-transparent border-none outline-none text-xs w-32 md:w-48 text-white placeholder:text-zinc-600 font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <StreakBadge />
            <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />
            <button onClick={logout} className="p-2 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-white transition-all" aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-28 md:pb-16 px-6 md:px-12 max-w-7xl mx-auto relative z-10">
        {/* Stats Row */}
        {books.length > 0 && (
          <div className="flex flex-wrap items-center gap-6 py-6 mb-8 border-b border-white/5">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5">
              <BookOpen size={14} className="text-primary" />
              <span className="text-xs font-semibold text-zinc-400">{books.length} {books.length === 1 ? "Book" : "Books"}</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5">
              <Headphones size={14} className="text-primary" />
              <span className="text-xs font-semibold text-zinc-400">{totalHours}h Audio</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5">
              <Zap size={14} className="text-primary" />
              <span className="text-xs font-semibold text-zinc-400">{booksFinished} Finished</span>
            </div>
          </div>
        )}

        {/* Layout with Streak Tracker and Continue Reading */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-14">
          <div className="col-span-1 lg:col-span-2">
            {/* Continue Reading - Premium Card */}
            {continueBook && (
              <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full">
                <div
                  className="group relative rounded-[2rem] overflow-hidden cursor-pointer border border-white/10 hover:border-primary/40 transition-all duration-500 shadow-2xl h-full flex"
                  onClick={() => router.push(`/reader/${continueBook.id}`)}
                >
                  {/* Background Glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] -z-10 group-hover:bg-primary/10 transition-all" />
                  
                  <div className="relative flex flex-col sm:flex-row gap-8 p-8 items-center bg-black/40 backdrop-blur-xl w-full">
                    <div className="w-32 md:w-40 aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.6)] shrink-0 border border-white/10 relative group-hover:scale-[1.02] transition-transform duration-500">
                      {continueBook.cover_url ? (
                        <img src={continueBook.cover_url} alt={continueBook.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-b from-primary/20 to-zinc-900 flex items-end p-4">
                          <p className="font-serif italic text-sm text-white/80 leading-tight line-clamp-3">{continueBook.title}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
                    </div>

                    <div className="flex-1 w-full space-y-6">
                      <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30 mb-4">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Continue listening</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white tracking-tight leading-tight group-hover:text-primary transition-colors">{continueBook.title}</h2>
                        {continueBook.author && <p className="text-lg text-zinc-500 mt-1 font-medium italic font-serif">— {continueBook.author}</p>}
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-zinc-500">
                          <span>Progress: {Math.round(progress[continueBook.id]?.completion_pct || 0)}%</span>
                          <span>Page {progress[continueBook.id]?.current_page} of {continueBook.total_pages}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress[continueBook.id]?.completion_pct || 0}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-primary rounded-full shadow-[0_0_12px_rgba(129,140,248,0.6)]" 
                          />
                        </div>
                      </div>

                      <button className="btn-primary flex items-center gap-3 px-8 h-12 text-sm font-bold">
                        <Headphones size={18} fill="currentColor" />
                        Resume Session
                      </button>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </div>
          
          <div className="col-span-1 lg:col-span-1 flex flex-col">
            <StreakTracker />
          </div>
        </div>

        {/* Library Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white tracking-tight">{search ? `Results for "${search}"` : "Your Library"}</h2>
            {filtered.length > 0 && <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-widest">{filtered.length} Books</span>}
          </div>
          <div className="flex items-center gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
            {(["all", "reading", "finished", "unread"] as FilterTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-xs font-bold transition-all uppercase tracking-widest",
                  filter === t ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-1.5 text-xs text-zinc-400 font-medium focus:outline-none focus:border-primary/50"
          >
            <option value="created_at">Newest</option>
            <option value="title">Title</option>
            <option value="author">Author</option>
            <option value="last_read">Last Read</option>
          </select>
        </div>

        {/* Content Grid */}
        <AnimatePresence mode="wait">
          {showUpload && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-10 overflow-hidden">
              <div className="p-1 rounded-[2rem] bg-gradient-to-r from-primary/30 via-white/5 to-indigo-500/30">
                <div className="bg-zinc-950 rounded-[1.9rem] overflow-hidden">
                  <UploadDropzone onUploadSuccess={handleUploadSuccess} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="aspect-[3/4] rounded-2xl bg-white/[0.03] animate-pulse border border-white/5" />
                <div className="h-4 bg-white/[0.03] rounded-full w-3/4 animate-pulse" />
                <div className="h-3 bg-white/[0.03] rounded-full w-1/2 animate-pulse" />
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 space-y-8 text-center">
            <div className="w-24 h-24 rounded-[2.5rem] bg-white/[0.03] border border-white/5 flex items-center justify-center text-zinc-700">
              <BookOpen size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white tracking-tight">Your library is silent</h3>
              <p className="text-zinc-500 max-w-xs mx-auto text-sm leading-relaxed font-medium">Upload a document to begin your journey into the architecture of silence.</p>
            </div>
            <button onClick={() => setShowUpload(true)} className="btn-primary h-14 px-8">
              <Upload size={18} className="mr-2 inline" />
              Upload First Book
            </button>
          </motion.div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-zinc-800">
              <Search size={28} />
            </div>
            <p className="text-xl font-bold text-zinc-500">No matches found</p>
            <button onClick={() => { setSearch(""); setFilter("all"); }} className="text-sm font-bold text-primary hover:brightness-125 transition-all">Clear All Filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-12">
            {filtered.map((book) => <BookCard key={book.id} book={book} progress={progress[book.id]} onDelete={handleDelete} />)}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowUpload((v) => !v)}
        className={cn(
          "fixed bottom-8 right-8 w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 z-50 shadow-2xl",
          showUpload ? "bg-white text-black rotate-45" : "bg-primary text-white shadow-primary/40"
        )}
        aria-label={showUpload ? "Close upload" : "Upload book"}
      >
        <Plus size={28} />
      </button>
    </div>
  );
}