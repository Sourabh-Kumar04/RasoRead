"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Focus, PanelRight } from "lucide-react";
import { useReaderStore } from "@/stores/readerStore";
import { readerApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";

interface ReaderTopBarProps {
  bookId: string;
}

export function ReaderTopBar({ bookId }: ReaderTopBarProps) {
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
        "fixed top-0 left-0 right-0 z-50 h-20",
        "flex items-center justify-between px-10",
        "bg-[#0A0A0A]/80 backdrop-blur-[20px] border-b border-white/10",
        "shadow-[0_20px_40px_rgba(99,102,241,0.1)]",
        "transition-opacity duration-300",
        store.focusMode && "shell-hide"
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={() => router.push("/library")}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors shrink-0"
          title="Back to library"
        >
          <ArrowLeft size={18} className="text-zinc-400" />
        </button>
        <div className="min-w-0">
          <p className="font-headline italic text-base text-white leading-none truncate">
            {store.bookTitle || "Reading"}
          </p>
          <p className="font-label text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">
            Page {store.currentPage} of {store.totalPages}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button onClick={addBookmark} className="p-2 rounded-xl hover:bg-white/5 transition-colors" title="Bookmark">
          <Bookmark size={16} className="text-zinc-400" />
        </button>
        <button
          onClick={store.toggleFocusMode}
          className={cn("p-2 rounded-xl transition-colors", store.focusMode ? "bg-primary/10 text-primary" : "hover:bg-white/5 text-zinc-400")}
        >
          <Focus size={16} />
        </button>
        <button
          onClick={() => store.toggleSmartPanel()}
          className={cn("p-2 rounded-xl transition-colors", store.showSmartPanel ? "bg-primary/10 text-primary" : "hover:bg-white/5 text-zinc-400")}
        >
          <PanelRight size={16} />
        </button>
      </div>
    </header>
  );
}
