"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { readerApi } from "@/lib/api";
import { PageData } from "@/stores/readerStore";
import { useReaderStore } from "@/stores/readerStore";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageImage {
  page: number;
  image_b64: string;
  width: number;
  height: number;
  pdf_width: number;
  pdf_height: number;
}

interface PageImageViewerProps {
  bookId: string;
  currentPage: number;
  totalPages: number;
  pageData: PageData | null;
  activeParagraphIndex: number;
  isPlaying: boolean;
  /** Called when page image fails to load (e.g. non-PDF book) */
  onFailed?: () => void;
  onParagraphDoubleClick?: (text: string, index: number) => void;
}

// Highlight color map → rgba overlay
const HIGHLIGHT_COLORS: Record<string, string> = {
  primary: "rgba(129, 140, 248, 0.30)",
  yellow:  "rgba(251, 191, 36,  0.35)",
  green:   "rgba(52,  211, 153, 0.30)",
  red:     "rgba(248,  113, 113, 0.30)",
};
const HIGHLIGHT_BORDER: Record<string, string> = {
  primary: "rgba(129, 140, 248, 0.7)",
  yellow:  "rgba(251, 191, 36,  0.8)",
  green:   "rgba(52,  211, 153, 0.7)",
  red:     "rgba(248, 113, 113, 0.7)",
};

// ── Buffer size: current + 2 ahead ────────────────────────────────────────────
const BUFFER_AHEAD = 2;

// ── Component ─────────────────────────────────────────────────────────────────

export function PageImageViewer({
  bookId,
  currentPage,
  totalPages,
  pageData,
  activeParagraphIndex,
  isPlaying,
  onFailed,
  onParagraphDoubleClick,
}: PageImageViewerProps) {
  const store = useReaderStore();
  // Map of page number → rendered image data
  const [imageCache, setImageCache] = useState<Map<number, PageImage>>(new Map());
  const imageCacheRef = useRef<Map<number, PageImage>>(new Map());
  const [loading, setLoading] = useState(true);
  const activeRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef<Set<number>>(new Set());

  // ── Fetch a batch of pages into the cache ──────────────────────────────────
  const fetchBuffer = useCallback(
    async (startPage: number) => {
      // Determine which pages we actually need to fetch
      const needed: number[] = [];
      for (let p = startPage; p <= Math.min(startPage + BUFFER_AHEAD, totalPages); p++) {
        if (!fetchingRef.current.has(p) && !imageCacheRef.current.has(p)) {
          needed.push(p);
          fetchingRef.current.add(p);
        }
      }
      if (needed.length === 0) return;

      try {
        const res = await readerApi.getPagesBuffer(bookId, needed[0], needed.length, 180);
        const pages: PageImage[] = res.data.pages;
        setImageCache((prev) => {
          const next = new Map(prev);
          for (const pg of pages) {
            next.set(pg.page, pg);
            imageCacheRef.current.set(pg.page, pg);
          }
          return next;
        });
      } catch {
        // silently ignore — will retry on next render
        if (needed[0] === currentPage) onFailed?.();
      } finally {
        for (const p of needed) fetchingRef.current.delete(p);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookId, totalPages, currentPage]
  );

  // ── Fetch current + buffer whenever page changes ───────────────────────────
  useEffect(() => {
    setLoading(!imageCache.has(currentPage));
    fetchBuffer(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, bookId]);

  // ── Once current page is in cache, stop showing spinner ───────────────────
  useEffect(() => {
    if (imageCache.has(currentPage)) setLoading(false);
  }, [imageCache, currentPage]);

  // ── Scroll active paragraph highlight into view ────────────────────────────
  useEffect(() => {
    if (activeRef.current && isPlaying) {
      const container = document.getElementById("reader-scroll");
      if (container) {
        const el = activeRef.current;
        const elTop = el.getBoundingClientRect().top;
        const containerTop = container.getBoundingClientRect().top;
        const offset = elTop - containerTop + container.scrollTop - container.clientHeight / 2;
        container.scrollTo({ top: offset, behavior: "smooth" });
      }
    }
  }, [activeParagraphIndex, isPlaying]);

  const pageImg = imageCache.get(currentPage) ?? null;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading || !pageImg) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-xs text-outline font-label">Loading page {currentPage}…</span>
        </div>
      </div>
    );
  }

  const { pdf_width, pdf_height, image_b64 } = pageImg;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPage}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="relative w-full select-none"
      >
        {/* ── Book page shadow + border — real book feel ─────────────────── */}
        <div
          className="relative mx-auto overflow-hidden"
          style={{
            maxWidth: "960px",
            borderRadius: "3px",
            outline: "1px solid rgba(255,255,255,0.06)",
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.6), 0 16px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 0 1px rgba(0,0,0,0.1)",
          }}
        >
          {/* White page background so PDF content is always visible on dark theme */}
          <div className="bg-white">
            {/* Rendered PDF page image */}
            <img
              src={`data:image/png;base64,${image_b64}`}
              alt={`Page ${currentPage}`}
              className="w-full h-auto block"
              draggable={false}
            />
          </div>

          {/* ── Saved highlight overlays ─────────────────────────────── */}
          {store.highlights
            .filter((h) => h.page === currentPage)
            .map((h) => {
              // Find the matching paragraph by text content
              const para = pageData?.paragraphs.find(
                (p) => p.bbox && p.text.includes(h.text.slice(0, 30))
              );
              if (!para?.bbox) return null;
              const [x0, y0, x1, y1] = para.bbox as number[];
              return (
                <div
                  key={h.id}
                  className="absolute pointer-events-none rounded-[1px] transition-all duration-300"
                  style={{
                    left:   `${(x0 / pdf_width)  * 100}%`,
                    top:    `${(y0 / pdf_height) * 100}%`,
                    width:  `${((x1 - x0) / pdf_width)  * 100}%`,
                    height: `${((y1 - y0) / pdf_height) * 100}%`,
                    background: HIGHLIGHT_COLORS[h.color] ?? HIGHLIGHT_COLORS.primary,
                    boxShadow: `inset 0 -2px 0 ${HIGHLIGHT_BORDER[h.color] ?? HIGHLIGHT_BORDER.primary}`,
                  }}
                />
              );
            })}

          {/* ── TTS paragraph highlight overlays ─────────────────────────── */}
          {pageData?.paragraphs.map((para, idx) => {
            if (!para.bbox) return null;
            const [x0, y0, x1, y1] = para.bbox as number[];

            const isActive = activeParagraphIndex === idx && isPlaying;
            const isSpoken = activeParagraphIndex > idx && isPlaying;

            if (!isActive && !isSpoken) return null;

            return (
              <div
                key={idx}
                ref={isActive ? activeRef : null}
                className="absolute pointer-events-auto rounded-[2px] transition-all duration-300"
                style={{
                  left:   `${(x0 / pdf_width)         * 100}%`,
                  top:    `${(y0 / pdf_height)         * 100}%`,
                  width:  `${((x1 - x0) / pdf_width)  * 100}%`,
                  height: `${((y1 - y0) / pdf_height)  * 100}%`,
                  background: isActive
                    ? "rgba(34, 197, 94, 0.28)"
                    : "rgba(0, 0, 0, 0.18)",
                  boxShadow: isActive
                    ? "inset 0 0 0 1.5px rgba(34, 197, 94, 0.5)"
                    : "none",
                }}
              >
                {/* Invisible text for selection and double-click to play */}
                <span 
                  className="text-transparent selection:bg-primary/30 selection:text-transparent cursor-text"
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    fontSize: `${(y1 - y0) * 0.8}px`,
                    lineHeight: 1,
                    overflow: "hidden",
                  }}
                  onDoubleClick={(e) => {
                    // Prevent default selection if we want to play
                    e.preventDefault();
                    if (onParagraphDoubleClick) {
                      onParagraphDoubleClick(para.text, idx);
                    }
                  }}
                >
                  {para.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Page number ───────────────────────────────────────────────── */}
        <div className="text-center mt-4 mb-2">
          <span className="font-label text-xs text-outline/50 uppercase tracking-widest">
            — {currentPage} / {totalPages} —
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
