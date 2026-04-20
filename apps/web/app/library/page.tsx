"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Plus, BookOpen, BarChart2, LogOut, X } from "lucide-react";
import { BookCard } from "@/components/library/BookCard";
import { UploadDropzone } from "@/components/library/UploadDropzone";
import { booksApi, readerApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "reading" | "finished" | "unread";

export default function LibraryPage() {
  const router = useRouter();
  const [books, setBooks] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    // Guard: redirect if not authed
    const token = localStorage.getItem("rasoread_access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const res = await booksApi.list();
      setBooks(res.data);
      // Fetch progress for each book in parallel
      const progEntries = await Promise.allSettled(
        res.data.map((b: any) => readerApi.getProgress(b.id))
      );
      const progMap: Record<string, any> = {};
      progEntries.forEach((result, i) => {
        if (result.status === "fulfilled") {
          progMap[res.data[i].id] = result.value.data;
        }
      });
      setProgress(progMap);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (book: any) => {
    setBooks((prev) => [book, ...prev]);
    setShowUpload(false);
  };

  const handleDelete = (id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
  };

  const logout = () => {
    localStorage.removeItem("rasoread_access_token");
    localStorage.removeItem("rasoread_refresh_token");
    router.push("/login");
  };

  const filtered = books.filter((b) => {
    const matchSearch =
      !search ||
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      (b.author || "").toLowerCase().includes(search.toLowerCase());

    const pct = progress[b.id]?.completion_pct || 0;
    const matchFilter =
      filter === "all" ||
      (filter === "reading" && pct > 0 && pct < 95) ||
      (filter === "finished" && pct >= 95) ||
      (filter === "unread" && pct === 0);

    return matchSearch && matchFilter;
  });

  // Continue reading — last opened book
  const continueBook = books.find(
    (b) => progress[b.id]?.completion_pct > 0 && progress[b.id]?.completion_pct < 95
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6
                         bg-surface/70 glass border-b border-outline-variant/10">
        <span className="font-headline italic text-xl text-[#dae2fd]">RasoRead</span>
        <div className="hidden md:flex gap-8">
          {["Library", "Search", "AI Insights"].map((item) => (
            <button
              key={item}
              className="font-label text-xs uppercase tracking-widest text-outline hover:text-primary transition-colors"
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/insights")}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <BarChart2 size={16} className="text-secondary" />
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <LogOut size={16} className="text-outline" />
          </button>
        </div>
      </header>

      <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto">
        {/* Continue reading hero */}
        {continueBook && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-16"
          >
            <p className="font-label text-xs uppercase tracking-widest text-outline mb-4">
              Continue reading
            </p>
            <div
              className="relative rounded-3xl bg-surface-low border border-outline-variant/10 overflow-hidden
                         hover:border-primary/20 transition-colors cursor-pointer group"
              onClick={() => router.push(`/reader/${continueBook.id}`)}
            >
              <div className="flex flex-col md:flex-row gap-8 p-8 items-center">
                <div className="w-48 aspect-[3/4] rounded-xl overflow-hidden shadow-2xl shrink-0 bg-surface-high">
                  <div className="w-full h-full bg-gradient-to-b from-primary-container/60 to-surface-lowest
                                  flex items-end p-4">
                    <p className="font-headline italic text-xl text-white/90 leading-tight">
                      {continueBook.title}
                    </p>
                  </div>
                </div>
                <div className="flex-1 space-y-6">
                  <div>
                    <h2 className="font-headline text-4xl text-[#dae2fd]">{continueBook.title}</h2>
                    {continueBook.author && (
                      <p className="font-headline italic text-lg text-outline mt-1">
                        {continueBook.author}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between font-label text-xs text-outline mb-2">
                      <span>Page {progress[continueBook.id]?.current_page}</span>
                      <span>{Math.round(progress[continueBook.id]?.completion_pct || 0)}% complete</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${progress[continueBook.id]?.completion_pct || 0}%` }}
                      />
                    </div>
                  </div>
                  <button className="btn-primary flex items-center gap-2">
                    <BookOpen size={16} />
                    Resume reading
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Search + filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-10 items-start md:items-center justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your library…"
              className="w-full bg-surface-low border-b border-outline-variant/30 focus:border-primary
                         pl-10 pr-4 py-3 font-label text-sm text-[#dae2fd] placeholder:text-outline
                         outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["all", "reading", "finished", "unread"] as FilterTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-4 py-1.5 rounded-full font-label text-xs font-semibold capitalize transition-colors",
                  filter === t
                    ? "bg-primary text-[#0f0069]"
                    : "bg-surface-high text-secondary hover:bg-surface-bright"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Upload dropzone */}
        {showUpload && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-10"
          >
            <UploadDropzone onUploadSuccess={handleUploadSuccess} />
          </motion.div>
        )}

        {/* Books grid */}
        <section>
          <p className="font-label text-xs uppercase tracking-widest text-outline mb-6">
            Your books {filtered.length > 0 && `(${filtered.length})`}
          </p>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] rounded-xl bg-surface-high mb-3" />
                  <div className="h-4 bg-surface-high rounded mb-2" />
                  <div className="h-3 bg-surface-high rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24 space-y-4">
              <BookOpen size={48} className="text-outline/30 mx-auto" />
              <p className="font-label text-outline">
                {search ? "No books match your search." : "Your library is empty."}
              </p>
              {!search && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="btn-ghost text-sm"
                >
                  Upload your first book
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
              {filtered.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  progress={progress[book.id]}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowUpload((v) => !v)}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-primary
                   flex items-center justify-center shadow-2xl shadow-primary/30
                   hover:scale-110 active:scale-95 transition-transform z-40"
      >
        {showUpload ? (
          <X size={22} className="text-[#0f0069]" />
        ) : (
          <Plus size={22} className="text-[#0f0069]" />
        )}
      </button>
    </div>
  );
}
