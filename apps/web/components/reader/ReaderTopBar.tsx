"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, BookOpen, Focus, PanelRight } from "lucide-react";
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
        "fixed top-0 left-0 right-0 z-50 h-16",
        "flex items-center justify-between px-6",
        "bg-surface/70 glass border-b border-outline-variant/10",
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
          <ArrowLeft size={18} className="text-secondary" />
        </button>
        <div className="min-w-0">
          <p className="font-headline italic text-base text-[#dae2fd] leading-none truncate">
            {store.bookTitle || "Reading"}
          </p>
          <p className="font-label text-[10px] text-outline uppercase tracking-widest mt-0.5">
            Page {store.currentPage} of {store.totalPages}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={addBookmark}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          title="Bookmark this page (⌘B)"
        >
          <Bookmark size={16} className="text-secondary" />
        </button>

        <button
          onClick={store.toggleFocusMode}
          className={cn(
            "p-2 rounded-xl transition-colors",
            store.focusMode
              ? "bg-primary/10 text-primary"
              : "hover:bg-white/5 text-secondary"
          )}
          title="Focus mode (hides all controls)"
        >
          <Focus size={16} />
        </button>

        <button
          onClick={() => store.toggleSmartPanel()}
          className={cn(
            "p-2 rounded-xl transition-colors",
            store.showSmartPanel
              ? "bg-primary/10 text-primary"
              : "hover:bg-white/5 text-secondary"
          )}
          title="Smart panel (notes, AI, images)"
        >
          <PanelRight size={16} />
        </button>
      </div>
    </header>
  );
}
