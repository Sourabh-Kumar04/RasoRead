"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

import { booksApi, ttsApi, readerApi, analyticsApi } from "@/lib/api";
import { useReaderStore } from "@/stores/readerStore";
import { useReadingSession } from "@/hooks/useReadingSession";
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
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Single TTS instance for the entire reader page ──────────────────────────
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

    // Always start in real page (original) view mode
    store.setViewMode("original");

    const init = async () => {
      try {
        const bookRes = await booksApi.get(bookId);
        const book = bookRes.data;
        store.setBook(book.id, book.title, book.total_pages, book.toc || []);
        setInitialStatus(book.status as BookStatus);

        try {
          const settingsRes = await readerApi.getSettings(bookId);
          if (settingsRes.data?.tts_provider) {
            store.setProvider(settingsRes.data.tts_provider);
          }
        } catch {
          // ignore missing settings
        }
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
      // Read the latest state from the store directly, avoiding stale closures
      const latestPage = useReaderStore.getState().currentPage || 1;
      await loadPage(latestPage);
      setInitialized(true);
    };
    setup();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookStatus]);

  // ── Ping streak when playback starts ───────────────────────────────────────
  const streakPingedRef = useRef(false);
  useEffect(() => {
    if (store.isPlaying && !streakPingedRef.current) {
      streakPingedRef.current = true;
      analyticsApi.pingStreak().catch(() => {});
    }
    if (!store.isPlaying) streakPingedRef.current = false;
  }, [store.isPlaying]);
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
      // End of book — page requested beyond last page
      if (page > store.totalPages) {
        tts.stop();
        return;
      }

      const target = Math.max(1, Math.min(page, store.totalPages));
      if (target === store.currentPage) return;

      const wasPlaying = store.isPlaying;
      store.setPage(target);
      await loadPage(target);

      // Auto-start reading the new page if we were playing (continuous read)
      if (wasPlaying) {
        // Small delay to let pageData settle in the store
        setTimeout(() => {
          const paras = useReaderStore.getState().pageData?.paragraphs ?? [];
          const firstIdx = paras.findIndex((p) => p.text.trim().length > 0);
          if (firstIdx !== -1) {
            tts.play(paras[firstIdx].text, firstIdx);
          }
        }, 400);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, loadPage, tts]
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

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (store.isPlaying) tts.pause();
        else if (store.isPaused) tts.resume();
        else {
          const paras = store.pageData?.paragraphs ?? [];
          const idx = paras.findIndex((p) => p.text.trim().length > 0);
          if (idx !== -1) tts.play(paras[idx].text, idx);
        }
      } else if (e.code === "ArrowLeft") {
        goToPage(store.currentPage - 1);
      } else if (e.code === "ArrowRight") {
        goToPage(store.currentPage + 1);
      } else if (e.key.toLowerCase() === "f") {
        store.toggleFocusMode();
      } else if (e.key.toLowerCase() === "s") {
        store.toggleSmartPanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store, tts, goToPage]);



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
        "h-screen flex flex-col bg-[#0A0A0A] transition-all duration-500",
        store.focusMode && "focus-mode",
        store.theme === "sepia" && "sepia-mode",
        store.theme === "light" && "bg-white"
      )}
    >
      <ReaderTopBar bookId={bookId} onOpenTOC={() => setShowTOC(true)} />

      {/* ── Layout: scrollable content + fixed-width smart panel ─────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Scrollable reader area ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto relative" id="reader-scroll">
          <div
            className={cn(
              "min-h-full pb-40 transition-all duration-300",
            )}
          >
            <ErrorBoundary>
              <DocumentViewer bookId={bookId} tts={tts} onBookEnd={() => tts.stop()} />
            </ErrorBoundary>
          </div>

          {/* ── Fixed Bottom Dock ─────────────────── */}
          <div className="fixed inset-x-0 bottom-8 pointer-events-none z-50 flex justify-center">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="pointer-events-auto flex flex-col items-center gap-3 w-[90vw] max-w-2xl shell-hide"
            >
              <KaraokeBar />
              <FloatingControls
                tts={tts}
                onNextPage={nextPage}
                onPrevPage={prevPage}
                voices={voices}
              />
            </motion.div>
          </div>
        </div>

        {/* ── Smart panel (fixed width, not overlapping) ──────────────────── */}
        <AnimatePresence>
          {store.showSmartPanel && (
            <div className="w-80 shrink-0 border-l border-outline-variant/20 overflow-y-auto">
              <SmartPanel bookId={bookId} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Table of contents drawer */}
      <TOCDrawer
        open={showTOC}
        onClose={() => setShowTOC(false)}
        onJumpTo={goToPage}
      />
    </div>
  );
}
