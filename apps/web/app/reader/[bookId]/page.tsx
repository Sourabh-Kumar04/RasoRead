"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

import { booksApi, ttsApi, readerApi } from "@/lib/api";
import { useReaderStore } from "@/stores/readerStore";
import { useReadingSession } from "@/hooks/useReadingSession";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { useBookPolling } from "@/hooks/useBookPolling";
import { useOfflineSync } from "@/hooks/useOfflineSync";

import { DocumentViewer } from "@/components/reader/DocumentViewer";
import { FloatingControls } from "@/components/reader/FloatingControls";
import { KaraokeBar } from "@/components/reader/KaraokeBar";
import { SmartPanel } from "@/components/reader/SmartPanel";
import { ReaderTopBar } from "@/components/reader/ReaderTopBar";
import { TOCDrawer } from "@/components/reader/TOCDrawer";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { toast } from "@/components/ui/Toast";
import { useTTSSync } from "@/hooks/useTTSSync";

type BookStatus = "processing" | "ready" | "error" | "unknown";

export default function ReaderPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.bookId as string;

  const store = useReaderStore();
  const { loadProgress, saveProgress, loadPage } = useReadingSession(bookId);
  useOfflineSync(bookId);

  // ── Stable ref so useTTSSync's onPageEnd always calls the latest goToPage ──
  const goToPageRef = useRef<(page: number) => void>(() => {});

  // ── Single TTS instance for the entire reader page ──────────────────────────
  // IMPORTANT: useTTSSync must only be instantiated ONCE. Having it in both
  // FloatingControls and DocumentViewer causes two separate audio contexts,
  // conflicting session refs, and broken auto-continue.
  const tts = useTTSSync({ onPageEnd: () => goToPageRef.current(store.currentPage + 1) });

  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [showTOC, setShowTOC] = useState(false);
  const [initialStatus, setInitialStatus] = useState<BookStatus>("unknown");
  const [initialized, setInitialized] = useState(false);

  const { status: bookStatus, errorMsg } = useBookPolling(bookId, initialStatus);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("rasoread_access_token");
    if (!token) { router.push("/login"); return; }

    const init = async () => {
      try {
        const bookRes = await booksApi.get(bookId);
        const book = bookRes.data;
        store.setBook(book.id, book.title, book.total_pages, book.toc || []);
        setInitialStatus(book.status as BookStatus);
      } catch (err: any) {
        if (err?.response?.status === 401) router.push("/login");
        else if (err?.response?.status === 404) {
          toast.error("Book not found");
          router.push("/library");
        } else {
          toast.error("Could not load book");
        }
      }

      // Load voices (non-blocking)
      try {
        const vRes = await ttsApi.voices();
        setVoices(vRes.data);
      } catch {
        setVoices([
          { id: "nova", name: "Nova" },
          { id: "alloy", name: "Alloy" },
          { id: "echo", name: "Echo" },
          { id: "fable", name: "Fable (British)" },
          { id: "onyx", name: "Onyx" },
          { id: "shimmer", name: "Shimmer" },
        ]);
      }
    };

    init();

    // Cleanup: reset reader state when leaving
    return () => {
      store.setPlaying(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // ── When book becomes ready ─────────────────────────────────────────────────
  useEffect(() => {
    if (bookStatus !== "ready" || initialized) return;
    const setup = async () => {
      await loadProgress();
      const startPage = store.currentPage || 1;
      await loadPage(startPage);
      setInitialized(true);
    };
    setup();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookStatus]);

  // ── Auto-save progress on page change ──────────────────────────────────────
  useEffect(() => {
    if (!initialized || !store.currentPage || !store.totalPages) return;
    const pct = (store.currentPage / store.totalPages) * 100;
    store.setProgress(store.currentPage, store.charOffset, pct);
    saveProgress(store.currentPage, store.charOffset, pct);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.currentPage, initialized]);

  // ── Page navigation ─────────────────────────────────────────────────────────
  const goToPage = useCallback(
    async (page: number) => {
      const target = Math.max(1, Math.min(page, store.totalPages));
      if (target === store.currentPage) return;
      store.setPage(target);
      await loadPage(target);
    },
    [store, loadPage]
  );

  // Keep the ref in sync so the TTS onPageEnd closure always has the latest version
  useEffect(() => { goToPageRef.current = goToPage; }, [goToPage]);

  const nextPage = useCallback(
    () => goToPage(store.currentPage + 1),
    [goToPage, store.currentPage]
  );
  const prevPage = useCallback(
    () => goToPage(store.currentPage - 1),
    [goToPage, store.currentPage]
  );

  // ── Voice commands ──────────────────────────────────────────────────────────
  useVoiceCommands(
    {
      onNextPage: nextPage,
      onPrevPage: prevPage,
      onBookmark: async () => {
        try {
          await readerApi.addBookmark(bookId, store.currentPage, `Page ${store.currentPage}`);
          toast.success(`Bookmarked page ${store.currentPage}`);
        } catch {
          toast.error("Could not save bookmark");
        }
      },
      onAddNote: () => store.toggleSmartPanel("notes"),
      onPlayPause: () => store.setPlaying(!store.isPlaying),
    },
    initialized
  );

  // ── Loading / error states ──────────────────────────────────────────────────
  if (bookStatus === "processing" || bookStatus === "unknown") {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <BookOpen size={32} className="text-primary animate-pulse" />
        </div>
        <div className="text-center space-y-2 px-6">
          <p className="font-headline text-2xl text-[#dae2fd]">Processing your book</p>
          <p className="font-label text-sm text-outline max-w-xs">
            Extracting text, building AI index… usually takes 15–60 seconds.
          </p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary/40 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (bookStatus === "error") {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-6">
        <p className="font-headline text-2xl text-[#dae2fd]">Processing failed</p>
        <p className="font-label text-sm text-red-300 max-w-sm text-center">{errorMsg}</p>
        <button className="btn-ghost mt-2" onClick={() => router.push("/library")}>
          Back to library
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen bg-surface transition-all duration-500",
        store.focusMode && "focus-mode",
        store.theme === "sepia" && "sepia-mode",
        store.theme === "light" && "bg-white"
      )}
    >
      <ReaderTopBar bookId={bookId} />

      {/* TOC open button — hidden in focus mode */}
      {!store.focusMode && (
        <button
          onClick={() => setShowTOC(true)}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-xl
                     bg-surface-mid border border-outline-variant/20
                     hover:border-primary/30 transition-colors"
          title="Table of contents"
        >
          <BookOpen size={16} className="text-outline" />
        </button>
      )}

      {/* Reader content */}
      <main
        className={cn(
          "pt-20 pb-56 transition-all duration-300",
          store.showSmartPanel ? "md:mr-80" : ""
        )}
      >
        <ErrorBoundary>
          <DocumentViewer bookId={bookId} tts={tts} />
        </ErrorBoundary>
      </main>

      {/* Table of contents drawer */}
      <TOCDrawer
        open={showTOC}
        onClose={() => setShowTOC(false)}
        onJumpTo={goToPage}
      />

      {/* Smart panel */}
      <AnimatePresence>
        {store.showSmartPanel && <SmartPanel bookId={bookId} />}
      </AnimatePresence>

      {/* Karaoke bar — appears above floating controls during playback */}
      <KaraokeBar />

      {/* Floating playback controls */}
      <FloatingControls
        bookId={bookId}
        tts={tts}
        onNextPage={nextPage}
        onPrevPage={prevPage}
        voices={voices}
      />
    </div>
  );
}
