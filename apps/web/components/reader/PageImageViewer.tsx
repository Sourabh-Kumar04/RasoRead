"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { readerApi } from "@/lib/api";
import { PageData } from "@/stores/readerStore";

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
}

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
}: PageImageViewerProps) {
  // Map of page number → rendered image data
  const [imageCache, setImageCache] = useState<Map<number, PageImage>>(new Map());
  const [loading, setLoading] = useState(true);
  const activeRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef<Set<number>>(new Set());

  // ── Fetch a batch of pages into the cache ──────────────────────────────────
  const fetchBuffer = useCallback(
    async (startPage: number) => {
      // Determine which pages we actually need to fetch
      const needed: number[] = [];
      for (let p = startPage; p <= Math.min(startPage + BUFFER_AHEAD, totalPages); p++) {
        if (!fetchingRef.current.has(p)) {
          // Check cache via functional update to avoid stale closure
          needed.push(p);
          fetchingRef.current.add(p);
        }
      }
      if (needed.length === 0) return;

      try {
        const res = await readerApi.getPagesBuffer(bookId, needed[0], needed.length);
        const pages: PageImage[] = res.data.pages;
        setImageCache((prev) => {
          const next = new Map(prev);
          for (const pg of pages) next.set(pg.page, pg);
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
            maxWidth: "860px",
            borderRadius: "2px",
            outline: "1px solid rgba(255,255,255,0.08)",
            boxShadow:
              "0 1px 4px rgba(0,0,0,0.5), 0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
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
                className="absolute pointer-events-none rounded-[2px] transition-all duration-300"
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
              />
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
