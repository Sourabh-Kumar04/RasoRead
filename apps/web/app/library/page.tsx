"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, BookOpen, BarChart2, LogOut, X, Headphones, Zap, Clock } from "lucide-react";
import { BookCard } from "@/components/library/BookCard";
import { UploadDropzone } from "@/components/library/UploadDropzone";
import { booksApi, readerApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { OnboardingModal } from "@/components/ui/OnboardingModal";

type FilterTab = "all" | "reading" | "finished" | "unread";

export default function LibraryPage() {
  const router = useRouter();
  const [books, setBooks] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showUpload, setShowUpload] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const token = localStorage.getItem("rasoread_access_token");
    if (!token) { router.push("/login"); return; }
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const res = await booksApi.list();
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
    const matchFilter = filter === "all" || (filter === "reading" && pct > 0 && pct < 95) || (filter === "finished" && pct >= 95) || (filter === "unread" && pct === 0);
    return matchSearch && matchFilter;
  });

  const continueBook = books.find((b) => progress[b.id]?.completion_pct > 0 && progress[b.id]?.completion_pct < 95);
  const totalHours = Math.round(books.reduce((acc, b) => acc + (b.total_words || 0), 0) / 15000 * 10) / 10;
  const booksFinished = books.filter((b) => (progress[b.id]?.completion_pct || 0) >= 95).length;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-on-surface">
      <OnboardingModal />
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-8 bg-[#0A0A0A]/90 backdrop-blur-[20px] border-b border-white/[0.06]">
        <div className="flex items-center gap-10">
          <span className="font-headline text-xl font-semibold text-white tracking-tight italic">RasoRead</span>
          <nav className="hidden md:flex items-center gap-6">
            <span className="text-white font-label text-sm font-semibold">Library</span>
            <button onClick={() => router.push("/insights")} className="text-zinc-500 hover:text-zinc-300 transition-colors font-label text-sm">Insights</button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => router.push("/search")}
              placeholder="Search books..."
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-sm w-52 focus:border-primary/40 focus:bg-white/[0.06] outline-none transition-all text-zinc-300 placeholder:text-zinc-600 cursor-pointer"
              readOnly
            />
          </div>
          <button onClick={() => router.push("/insights")} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-500 hover:text-zinc-300">
            <BarChart2 size={16} />
          </button>
          <StreakBadge />
          <button onClick={logout} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-600 hover:text-zinc-400">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="pt-20 pb-32 px-8 max-w-[1200px] mx-auto">

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        {books.length > 0 && (
          <div className="flex items-center gap-6 py-5 border-b border-white/[0.06] mb-8">
            <div className="flex items-center gap-2 text-zinc-500">
              <BookOpen size={14} />
              <span className="font-label text-xs">{books.length} books</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-500">
              <Headphones size={14} />
              <span className="font-label text-xs">{totalHours}h of audio</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-500">
              <Zap size={14} />
              <span className="font-label text-xs">{booksFinished} finished</span>
            </div>
            {continueBook && (
              <div className="ml-auto flex items-center gap-2 text-primary">
                <Clock size={14} />
                <span className="font-label text-xs">
                  {Math.round(progress[continueBook.id]?.completion_pct || 0)}% through <em>{continueBook.title}</em>
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Continue reading ─────────────────────────────────────────────── */}
        {continueBook && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <div
              className="relative rounded-2xl overflow-hidden cursor-pointer group border border-white/[0.06] hover:border-primary/30 transition-all duration-300"
              style={{ background: "linear-gradient(135deg, rgba(128,131,255,0.06) 0%, rgba(10,10,10,0) 60%)" }}
              onClick={() => router.push(`/reader/${continueBook.id}`)}
            >
              <div className="flex flex-col md:flex-row gap-6 p-6 items-center">
                <div className="w-28 aspect-[3/4] rounded-xl overflow-hidden shadow-2xl shrink-0 border border-white/10">
                  {continueBook.cover_url
                    ? <img src={continueBook.cover_url} alt={continueBook.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full bg-gradient-to-b from-primary/20 to-surface-container-high flex items-end p-3"><p className="font-headline italic text-sm text-white/80 leading-tight line-clamp-3">{continueBook.title}</p></div>
                  }
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="font-label text-[10px] uppercase tracking-[0.15em] text-primary mb-1">Continue listening</p>
                    <h2 className="font-headline text-2xl text-white font-medium">{continueBook.title}</h2>
                    {continueBook.author && <p className="font-label text-sm text-zinc-500 mt-0.5">{continueBook.author}</p>}
                  </div>
                  <div>
                    <div className="flex justify-between font-label text-xs text-zinc-600 mb-1.5">
                      <span>Page {progress[continueBook.id]?.current_page} of {continueBook.total_pages}</span>
                      <span className="text-primary">{Math.round(progress[continueBook.id]?.completion_pct || 0)}%</span>
                    </div>
                    <div className="h-0.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress[continueBook.id]?.completion_pct || 0}%` }} />
                    </div>
                  </div>
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label text-sm font-semibold hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_16px_rgba(128,131,255,0.25)]">
                    <Headphones size={14} />
                    Resume
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ── Header + filters ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="font-headline text-2xl font-medium text-white">Library</h2>
            {filtered.length > 0 && (
              <span className="font-label text-xs text-zinc-600 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-full">
                {filtered.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(["all", "reading", "finished", "unread"] as FilterTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-3 py-1 rounded-lg font-label text-xs transition-all",
                  filter === t
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-600 hover:text-zinc-400"
                )}
              >
                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Upload dropzone ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {showUpload && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6 overflow-hidden">
              <UploadDropzone onUploadSuccess={handleUploadSuccess} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Books grid ───────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] rounded-xl bg-white/[0.04] mb-3" />
                <div className="h-3.5 bg-white/[0.04] rounded mb-1.5" />
                <div className="h-3 bg-white/[0.04] rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <BookOpen size={28} className="text-zinc-700" />
            </div>
            <p className="font-headline text-xl text-zinc-600">{search ? "No results found" : "Your library is empty"}</p>
            <p className="font-label text-sm text-zinc-700">{search ? `No books match "${search}"` : "Upload a PDF, EPUB, DOCX, or TXT to get started"}</p>
            {!search && (
              <button onClick={() => setShowUpload(true)} className="btn-ghost text-sm mt-2">
                Upload your first book
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-9">
            {filtered.map((book) => <BookCard key={book.id} book={book} progress={progress[book.id]} onDelete={handleDelete} />)}
          </div>
        )}
      </main>

      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
      <button
        onClick={() => setShowUpload((v) => !v)}
        className="fixed bottom-24 right-6 w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-on-primary hover:brightness-110 active:scale-95 transition-all z-40 shadow-[0_8px_24px_rgba(128,131,255,0.3)]"
      >
        {showUpload ? <X size={18} /> : <Plus size={18} />}
      </button>
    </div>
  );
}