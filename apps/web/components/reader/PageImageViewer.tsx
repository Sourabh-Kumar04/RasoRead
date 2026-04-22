"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { readerApi } from "@/lib/api";
import { PageData } from "@/stores/readerStore";

interface PageImageViewerProps {
  bookId: string;
  currentPage: number;
  pageData: PageData;
  activeParagraphIndex: number;
  isPlaying: boolean;
}

interface PageImage {
  image_b64: string;
  width: number;
  height: number;
  pdf_width: number;
  pdf_height: number;
}

export function PageImageViewer({
  bookId,
  currentPage,
  pageData,
  activeParagraphIndex,
  isPlaying,
}: PageImageViewerProps) {
  const [pageImg, setPageImg]   = useState<PageImage | null>(null);
  const [loading, setLoading]   = useState(true);
  const [failed,  setFailed]    = useState(false);
  const activeRef               = useRef<HTMLDivElement | null>(null);
  const containerRef            = useRef<HTMLDivElement | null>(null);

  // ── Load the rendered page image whenever the page changes ─────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setPageImg(null);

    readerApi
      .getPageImage(bookId, currentPage)
      .then((res) => {
        if (!cancelled) {
          setPageImg(res.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setFailed(true);
        }
      });

    return () => { cancelled = true; };
  }, [bookId, currentPage]);

  // ── Prefetch next page in the background ────────────────────────────────
  useEffect(() => {
    if (!pageImg) return;
    readerApi.getPageImage(bookId, currentPage + 1).catch(() => {/* best-effort */});
  }, [bookId, currentPage, pageImg]);

  // ── Scroll the active highlight box into view ────────────────────────────
  useEffect(() => {
    if (activeRef.current && isPlaying) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeParagraphIndex, isPlaying]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-xs text-outline font-label">Rendering page…</span>
        </div>
      </div>
    );
  }

  // ── Failed → signal caller to fall back to text renderer ────────────────
  if (failed || !pageImg) return null;

  const { pdf_width, pdf_height, image_b64 } = pageImg;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPage}
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full select-none rounded-xl overflow-hidden
                   shadow-[0_8px_40px_rgba(0,0,0,0.6)]
                   ring-1 ring-white/10"
      >
        {/* ── Rendered PDF page ────────────────────────────────────────── */}
        <img
          src={`data:image/png;base64,${image_b64}`}
          alt={`Page ${currentPage}`}
          className="w-full h-auto block"
          draggable={false}
        />

        {/* ── TTS highlight overlays (% positions from PDF bboxes) ─────── */}
        {pageData.paragraphs.map((para, idx) => {
          if (!para.bbox) return null;
          const [x0, y0, x1, y1] = para.bbox as number[];

          const isActive  = activeParagraphIndex === idx && isPlaying;
          const isSpoken  = activeParagraphIndex >  idx && isPlaying;

          if (!isActive && !isSpoken) return null; // skip un-read paras for perf

          return (
            <div
              key={idx}
              ref={isActive ? activeRef : null}
              className={cn(
                "absolute pointer-events-none rounded-[2px] transition-all duration-400",
                isActive && "ring-[1.5px] ring-emerald-400/50",
              )}
              style={{
                left:            `${(x0 / pdf_width)         * 100}%`,
                top:             `${(y0 / pdf_height)        * 100}%`,
                width:           `${((x1 - x0) / pdf_width)  * 100}%`,
                height:          `${((y1 - y0) / pdf_height) * 100}%`,
                background: isActive
                  ? "rgba(40, 100, 60, 0.38)"   // NaturalReader-style dark green
                  : "rgba(0, 0, 0, 0.14)",      // dimmed for spoken text
              }}
            />
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
