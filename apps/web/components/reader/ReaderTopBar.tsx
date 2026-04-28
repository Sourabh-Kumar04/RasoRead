"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Bookmark, Focus, PanelRight, List, FileText, BookOpen } from "lucide-react";
import { useReaderStore } from "@/stores/readerStore";
import { readerApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";

interface ReaderTopBarProps {
  bookId: string;
  onOpenTOC: () => void;
}

export function ReaderTopBar({ bookId, onOpenTOC }: ReaderTopBarProps) {
  const router = useRouter();
  const store = useReaderStore();

  const addBookmark = async () => {
    try {
      await readerApi.addBookmark(bookId, store.currentPage, `Page ${store.currentPage}`);
      toast.success(`Bookmarked page ${store.currentPage}`);
    } catch {
      toast.error("Could not save bookmark");
    }
  };

  return (
    <header
      className={cn(
        "fixed top-4 left-4 right-4 z-50 h-14",
        "flex items-center justify-between px-6",
        "bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl",
        "shadow-2xl transition-all duration-500",
        store.focusMode && "opacity-0 pointer-events-none"
      )}
    >
      {/* Left: back + TOC + title */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={() => router.push("/library")}
          className="p-1.5 rounded-xl hover:bg-white/5 transition-all active:scale-90"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-zinc-400" />
        </button>

        <div className="h-4 w-px bg-white/10 hidden sm:block" />

        <div className="min-w-0 hidden md:block">
          <p className="text-xs font-bold text-white truncate max-w-[200px]">
            {store.bookTitle || "Reading"}
          </p>
        </div>
      </div>

      {/* Center: Progress */}
      <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Chapter Progress</span>
             <span className="text-[10px] font-bold text-primary">{Math.round((store.currentPage / store.totalPages) * 100)}%</span>
          </div>
          <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div 
               className="h-full bg-primary"
               initial={false}
               animate={{ width: `${Math.round((store.currentPage / store.totalPages) * 100)}%` }}
            />
          </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={store.toggleViewMode}
          className={cn(
            "flex items-center gap-2 h-9 px-3 rounded-xl transition-all border",
            store.viewMode === "original" 
              ? "bg-primary/10 border-primary/30 text-primary" 
              : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
          )}
          title={store.viewMode === "original" ? "Switch to Text Mode" : "Switch to Original Page"}
        >
          {store.viewMode === "original" ? <FileText size={16} /> : <BookOpen size={16} />}
          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">
            {store.viewMode === "original" ? "Original" : "Text"}
          </span>
        </button>

        <div className="h-4 w-px bg-white/10 mx-1" />

        <button
          onClick={onOpenTOC}
          className="p-2 rounded-xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white"
          title="Contents"
        >
          <List size={18} />
        </button>
        <button
          onClick={addBookmark}
          className="p-2 rounded-xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white"
          title="Bookmark"
        >
          <Bookmark size={18} />
        </button>
        <div className="h-4 w-px bg-white/10 mx-1" />
        <button
          onClick={() => store.toggleSmartPanel()}
          className={cn(
            "p-2 rounded-xl transition-all",
            store.showSmartPanel ? "bg-primary/20 text-primary border border-primary/20" : "text-zinc-400 hover:text-white hover:bg-white/5"
          )}
          title="Insights"
        >
          <PanelRight size={18} />
        </button>
      </div>
    </header>
  );
}

