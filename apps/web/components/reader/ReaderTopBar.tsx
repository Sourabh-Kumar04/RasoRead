"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Bookmark, PanelRight, List, FileText, BookOpen } from "lucide-react";
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

  const pct = store.totalPages > 0
    ? Math.round((store.currentPage / store.totalPages) * 100)
    : 0;

  return (
    <header
      className={cn(
        "fixed top-3 left-3 right-3 z-50 h-12",
        "flex items-center justify-between px-4",
        "bg-[#111111]/90 backdrop-blur-2xl border border-white/[0.08] rounded-xl",
        "shadow-[0_2px_16px_rgba(0,0,0,0.5)] transition-all duration-300",
        store.focusMode && "opacity-0 pointer-events-none"
      )}
    >
      {/* Left: back + title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => router.push("/library")}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-all active:scale-90 text-zinc-400 hover:text-white"
          aria-label="Back to library"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="h-4 w-px bg-white/[0.08]" />

        <p className="text-xs font-semibold text-zinc-300 truncate max-w-[140px] md:max-w-[240px] hidden sm:block">
          {store.bookTitle || "Reading"}
        </p>
      </div>

      {/* Center: progress bar */}
      <div className="flex flex-col items-center gap-1 absolute left-1/2 -translate-x-1/2">
        <div className="w-40 md:w-56 h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-500 rounded-full"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <span className="text-[9px] font-semibold text-zinc-600 tabular-nums">{pct}%</span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {/* View mode toggle */}
        <button
          onClick={store.toggleViewMode}
          className={cn(
            "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[10px] font-semibold border transition-all",
            store.viewMode === "original"
              ? "bg-indigo-500/12 border-indigo-500/30 text-indigo-400"
              : "bg-white/[0.04] border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:border-white/15"
          )}
          title={store.viewMode === "original" ? "Real page view" : "Text view"}
        >
          {store.viewMode === "original"
            ? <><BookOpen size={13} /><span className="hidden sm:block">Real Page</span></>
            : <><FileText size={13} /><span className="hidden sm:block">Text</span></>
          }
        </button>

        <div className="h-4 w-px bg-white/[0.08] mx-0.5" />

        <button
          onClick={onOpenTOC}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-all text-zinc-500 hover:text-white"
          title="Table of contents"
        >
          <List size={16} />
        </button>

        <button
          onClick={addBookmark}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-all text-zinc-500 hover:text-white"
          title="Bookmark this page"
        >
          <Bookmark size={16} />
        </button>

        <div className="h-4 w-px bg-white/[0.08] mx-0.5" />

        <button
          onClick={() => store.toggleSmartPanel()}
          className={cn(
            "p-1.5 rounded-lg transition-all",
            store.showSmartPanel
              ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25"
              : "text-zinc-500 hover:text-white hover:bg-white/[0.06]"
          )}
          title="AI insights panel"
        >
          <PanelRight size={16} />
        </button>
      </div>
    </header>
  );
}
