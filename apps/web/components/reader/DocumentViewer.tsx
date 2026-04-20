"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReaderStore } from "@/stores/readerStore";
import { cn } from "@/lib/utils";
import { useTTSSync } from "@/hooks/useTTSSync";
import { notesApi } from "@/lib/api";
import { HighlightMenu } from "./HighlightMenu";
import { ImageModal } from "./ImageModal";
import { toast } from "@/components/ui/Toast";

interface DocumentViewerProps {
  bookId: string;
}

const HIGHLIGHT_CSS: Record<string, string> = {
  primary: "bg-primary/20 border-b-2 border-primary/60",
  yellow:  "bg-amber-400/20 border-b-2 border-amber-400/60",
  green:   "bg-green-400/20 border-b-2 border-green-400/60",
  red:     "bg-red-400/20 border-b-2 border-red-400/60",
};

export function DocumentViewer({ bookId }: DocumentViewerProps) {
  const store = useReaderStore();
  const { play } = useTTSSync();
  const activeParagraphRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Image modal state
  const [modalImage, setModalImage] = useState<{ b64: string; format: string; index: number } | null>(null);

  // Note quick-add modal state
  const [pendingNoteText, setPendingNoteText] = useState<string | null>(null);

  // Auto-scroll active paragraph into view with smooth zoom effect
  useEffect(() => {
    if (activeParagraphRef.current && store.isPlaying) {
      activeParagraphRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [store.activeParagraphIndex, store.isPlaying]);

  const handleHighlight = useCallback(
    async (color: string, text: string, _range: Range) => {
      try {
        const res = await notesApi.createHighlight({
          book_id: bookId,
          page: store.currentPage,
          start_char: 0,
          end_char: text.length,
          text,
          color,
        });
        store.addHighlight(res.data);
        toast.success("Highlight saved");
      } catch {
        toast.error("Could not save highlight");
      }
    },
    [bookId, store]
  );

  const handleNoteFromSelection = useCallback((text: string, _range: Range) => {
    setPendingNoteText(text);
    store.toggleSmartPanel("notes");
  }, [store]);

  const handleParagraphDoubleClick = useCallback(
    (text: string, paraIndex: number) => {
      if (store.isPlaying && store.activeParagraphIndex === paraIndex) return;
      play(text, paraIndex);
    },
    [play, store.isPlaying, store.activeParagraphIndex]
  );

  if (!store.pageData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4 text-outline">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="font-label text-sm">Loading page…</span>
        </div>
      </div>
    );
  }

  const { paragraphs, images } = store.pageData;

  return (
    <>
      {/* Highlight context menu (portal-style, absolute positioned) */}
      <HighlightMenu onHighlight={handleHighlight} onNote={handleNoteFromSelection} />

      {/* Image modal */}
      {modalImage && (
        <ImageModal
          imageB64={modalImage.b64}
          format={modalImage.format}
          figureIndex={modalImage.index}
          bookId={bookId}
          onClose={() => setModalImage(null)}
        />
      )}

      <div
        ref={containerRef}
        className={cn(
          "max-w-2xl mx-auto px-4 py-8 select-text relative",
          store.dyslexiaMode && "dyslexia-mode",
          store.theme === "sepia" && "sepia-mode"
        )}
        style={{ fontSize: store.fontSize }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={store.currentPage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {paragraphs.map((para, paraIndex) => {
              const isActive = store.activeParagraphIndex === paraIndex && store.isPlaying;
              const isSpoken = store.activeParagraphIndex > paraIndex && store.isPlaying;

              return (
                <div key={paraIndex} className="mb-8">
                  {para.is_heading ? (
                    <h2 className="reader-heading">{para.text}</h2>
                  ) : (
                    <motion.div
                      ref={isActive ? activeParagraphRef : null}
                      className={cn(
                        "reader-text rounded-lg transition-all duration-300 cursor-text -mx-3 px-3 py-1",
                        isActive && "bg-primary/5 ring-1 ring-primary/20",
                        isSpoken && "opacity-50"
                      )}
                      onDoubleClick={() => handleParagraphDoubleClick(para.text, paraIndex)}
                    >
                      {/* Tokenized for live TTS sync */}
                      {isActive && store.wordTimestamps.length > 0
                        ? store.wordTimestamps.map((token, i) => (
                            <span
                              key={i}
                              className={cn(
                                "word-token",
                                i === store.activeWordIndex && "active",
                                i < store.activeWordIndex && "spoken"
                              )}
                            >
                              {token.word}{" "}
                            </span>
                          ))
                        : renderWithHighlights(para.text, store.highlights, store.currentPage)}
                    </motion.div>
                  )}

                  {/* Inline images after relevant paragraph */}
                  {images
                    .filter((img) => img.index === paraIndex)
                    .map((img) => (
                      <div key={img.index} className="my-6">
                        {img.data_b64 ? (
                          <button
                            className="w-full rounded-xl overflow-hidden border border-outline-variant/20
                                       hover:border-primary/30 transition-colors cursor-zoom-in"
                            onClick={() =>
                              setModalImage({
                                b64: img.data_b64!,
                                format: img.format,
                                index: img.index,
                              })
                            }
                          >
                            <img
                              src={`data:image/${img.format};base64,${img.data_b64}`}
                              alt={`Figure ${img.index + 1}`}
                              className="w-full object-contain max-h-80"
                            />
                          </button>
                        ) : (
                          <div className="w-full h-32 rounded-xl bg-surface-high border border-outline-variant/20
                                          flex items-center justify-center">
                            <span className="font-label text-xs text-outline">Figure {img.index + 1}</span>
                          </div>
                        )}
                        <p className="text-center text-sm text-outline font-label mt-2 italic">
                          Figure {img.index + 1}
                        </p>
                      </div>
                    ))}
                </div>
              );
            })}

            {/* Page number */}
            <div className="text-center py-8">
              <span className="font-label text-xs text-outline/40 uppercase tracking-widest">
                — {store.currentPage} —
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

/** Render paragraph text with stored highlight spans overlaid */
function renderWithHighlights(
  text: string,
  highlights: { page: number; start_char: number; end_char: number; color: string; text: string }[],
  currentPage: number
) {
  const pageHighlights = highlights
    .filter((h) => h.page === currentPage)
    .sort((a, b) => a.start_char - b.start_char);

  if (!pageHighlights.length) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const h of pageHighlights) {
    if (h.start_char > cursor) {
      parts.push(<span key={`t-${cursor}`}>{text.slice(cursor, h.start_char)}</span>);
    }
    if (h.end_char > h.start_char) {
      parts.push(
        <span
          key={`h-${h.start_char}`}
          className={cn("rounded-sm", HIGHLIGHT_CSS[h.color] || HIGHLIGHT_CSS.primary)}
        >
          {text.slice(h.start_char, h.end_char)}
        </span>
      );
      cursor = h.end_char;
    }
  }

  if (cursor < text.length) {
    parts.push(<span key={`t-end`}>{text.slice(cursor)}</span>);
  }

  return <>{parts}</>;
}
