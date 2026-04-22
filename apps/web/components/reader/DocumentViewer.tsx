"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReaderStore } from "@/stores/readerStore";
import { cn } from "@/lib/utils";
import { useTTSSync } from "@/hooks/useTTSSync";
import { notesApi } from "@/lib/api";
import { HighlightMenu } from "./HighlightMenu";
import { ImageModal } from "./ImageModal";
import { PageImageViewer } from "./PageImageViewer";
import { toast } from "@/components/ui/Toast";

interface DocumentViewerProps {
  bookId: string;
  /** Single shared TTS instance from the reader page. */
  tts: ReturnType<typeof useTTSSync>;
}

const HIGHLIGHT_CSS: Record<string, string> = {
  primary: "bg-primary/20 border-b-2 border-primary/60",
  yellow:  "bg-amber-400/20 border-b-2 border-amber-400/60",
  green:   "bg-green-400/20 border-b-2 border-green-400/60",
  red:     "bg-red-400/20 border-b-2 border-red-400/60",
};

interface SentenceRange { startWord: number; endWord: number }

/** Map paragraph text → sentence ranges in terms of word-timestamp indices. */
function getSentenceRanges(text: string, totalWords: number): SentenceRange[] {
  if (totalWords === 0) return [];
  const parts = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const ranges: SentenceRange[] = [];
  let wordCursor = 0;

  for (const part of parts) {
    const wc = part.trim().split(/\s+/).filter(Boolean).length;
    if (wc === 0) continue;
    const end = Math.min(wordCursor + wc, totalWords);
    ranges.push({ startWord: wordCursor, endWord: end });
    wordCursor += wc;
    if (wordCursor >= totalWords) break;
  }
  if (ranges.length > 0 && ranges[ranges.length - 1].endWord < totalWords) {
    ranges[ranges.length - 1].endWord = totalWords;
  }
  return ranges.length > 0 ? ranges : [{ startWord: 0, endWord: totalWords }];
}

export function DocumentViewer({ bookId, tts }: DocumentViewerProps) {
  const store = useReaderStore();
  const { play } = tts;

  const activeParagraphRef = useRef<HTMLDivElement | null>(null);
  const activeSentenceRef  = useRef<HTMLSpanElement | null>(null);
  const containerRef       = useRef<HTMLDivElement>(null);

  const [modalImage, setModalImage] = useState<{
    b64: string; format: string; index: number;
  } | null>(null);
  const [, setPendingNoteText] = useState<string | null>(null);

  // ── Whether this book is a PDF with bbox data ────────────────────────────
  const isPdfWithBbox = Boolean(
    store.pageData?.paragraphs.some((p) => p.bbox !== null)
  );

  // ── Scroll: sentence-level during TTS, paragraph-level when paused ───────
  useEffect(() => {
    if (activeSentenceRef.current && store.isPlaying) {
      activeSentenceRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [store.activeWordIndex, store.isPlaying]);

  useEffect(() => {
    if (activeParagraphRef.current && !store.isPlaying) {
      activeParagraphRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [store.activeParagraphIndex, store.isPlaying]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleHighlight = useCallback(
    async (color: string, text: string, _range: Range) => {
      // Compute real character offsets within the page text
      const pageText = store.pageData?.paragraphs.map((p) => p.text).join("\n") ?? "";
      const startChar = pageText.indexOf(text);
      const endChar = startChar >= 0 ? startChar + text.length : text.length;

      try {
        const res = await notesApi.createHighlight({
          book_id: bookId, page: store.currentPage,
          start_char: Math.max(0, startChar),
          end_char: endChar,
          text, color,
        });
        store.addHighlight(res.data);
        toast.success("Highlight saved");
      } catch {
        toast.error("Could not save highlight");
      }
    },
    [bookId, store]
  );

  const handleNoteFromSelection = useCallback(
    (text: string, _range: Range) => {
      setPendingNoteText(text);
      store.toggleSmartPanel("notes");
    },
    [store]
  );

  const handleParagraphDoubleClick = useCallback(
    (text: string, paraIndex: number) => {
      if (store.isPlaying && store.activeParagraphIndex === paraIndex) return;
      play(text, paraIndex);
    },
    [play, store.isPlaying, store.activeParagraphIndex]
  );

  // ── Loading spinner ───────────────────────────────────────────────────────
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

  // ════════════════════════════════════════════════════════════════════════
  //  PDF MODE — show the rendered page image with bbox highlight overlays
  // ════════════════════════════════════════════════════════════════════════
  if (isPdfWithBbox) {
    return (
      <>
        <HighlightMenu onHighlight={handleHighlight} onNote={handleNoteFromSelection} />

        {modalImage && (
          <ImageModal
            imageB64={modalImage.b64} format={modalImage.format}
            figureIndex={modalImage.index} bookId={bookId}
            onClose={() => setModalImage(null)}
          />
        )}

        {/* Paper-white page card */}
        <div className="max-w-4xl mx-auto px-4 py-4">
          <PageImageViewer
            bookId={bookId}
            currentPage={store.currentPage}
            pageData={store.pageData}
            activeParagraphIndex={store.activeParagraphIndex}
            isPlaying={store.isPlaying}
          />

          {/* Page number */}
          <div className="text-center py-4">
            <span className="font-label text-xs text-outline/40 uppercase tracking-widest">
              — {store.currentPage} —
            </span>
          </div>
        </div>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TEXT MODE — EPUB / TXT / books without bbox (sentence-level highlight)
  // ════════════════════════════════════════════════════════════════════════
  return (
    <>
      <HighlightMenu onHighlight={handleHighlight} onNote={handleNoteFromSelection} />

      {modalImage && (
        <ImageModal
          imageB64={modalImage.b64} format={modalImage.format}
          figureIndex={modalImage.index} bookId={bookId}
          onClose={() => setModalImage(null)}
        />
      )}

      <div
        ref={containerRef}
        className={cn(
          "max-w-4xl mx-auto px-8 py-8 select-text relative",
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
              const isSpoken = store.activeParagraphIndex >  paraIndex && store.isPlaying;

              return (
                <div key={paraIndex} className="mb-8">
                  {para.is_heading ? (
                    <h2 className="reader-heading">{para.text}</h2>
                  ) : (
                    <motion.div
                      ref={isActive ? activeParagraphRef : null}
                      className={cn(
                        "reader-text rounded-xl transition-all duration-300 cursor-text -mx-4 px-4 py-2",
                        isActive && "bg-surface-highest/20",
                        isSpoken && "opacity-40"
                      )}
                      onDoubleClick={() => handleParagraphDoubleClick(para.text, paraIndex)}
                    >
                      {isActive && store.wordTimestamps.length > 0 ? (
                        // Sentence-level rendering with green band highlight
                        getSentenceRanges(para.text, store.wordTimestamps.length).map(
                          (sent, sentIdx) => {
                            const isSentActive =
                              store.activeWordIndex >= sent.startWord &&
                              store.activeWordIndex <  sent.endWord;
                            const isSentSpoken = store.activeWordIndex >= sent.endWord;
                            const sentTokens   = store.wordTimestamps.slice(
                              sent.startWord, sent.endWord
                            );

                            return (
                              <span
                                key={sentIdx}
                                ref={isSentActive ? activeSentenceRef : null}
                                className={cn(
                                  "transition-all duration-300 rounded-sm",
                                  isSentActive &&
                                    "bg-emerald-500/20 ring-1 ring-emerald-400/25",
                                  isSentSpoken && "opacity-40"
                                )}
                              >
                                {sentTokens.map((token, wordIdx) => {
                                  const globalIdx = sent.startWord + wordIdx;
                                  return (
                                    <span
                                      key={wordIdx}
                                      className={cn(
                                        "word-token",
                                        globalIdx === store.activeWordIndex && "tts-active-word",
                                        globalIdx <  store.activeWordIndex && "spoken"
                                      )}
                                    >
                                      {token.word}{" "}
                                    </span>
                                  );
                                })}
                              </span>
                            );
                          }
                        )
                      ) : (
                        renderWithHighlights(para.text, store.highlights, store.currentPage)
                      )}
                    </motion.div>
                  )}

                  {/* Inline images */}
                  {images
                    .filter((img) => img.index === paraIndex)
                    .map((img) => (
                      <div key={img.index} className="my-6">
                        {img.data_b64 ? (
                          <button
                            className="w-full rounded-xl overflow-hidden border border-outline-variant/20
                                       hover:border-primary/30 transition-colors cursor-zoom-in"
                            onClick={() => setModalImage({ b64: img.data_b64!, format: img.format, index: img.index })}
                          >
                            <img
                              src={`data:image/${img.format};base64,${img.data_b64}`}
                              alt={`Figure ${img.index + 1}`}
                              className="w-full object-contain max-h-80"
                            />
                          </button>
                        ) : (
                          <div className="w-full h-32 rounded-xl bg-surface-high border border-outline-variant/20 flex items-center justify-center">
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

/** Render paragraph text with stored highlight spans overlaid. */
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
    if (h.start_char > cursor)
      parts.push(<span key={`t-${cursor}`}>{text.slice(cursor, h.start_char)}</span>);
    if (h.end_char > h.start_char) {
      parts.push(
        <span key={`h-${h.start_char}`} className={cn("rounded-sm", HIGHLIGHT_CSS[h.color] || HIGHLIGHT_CSS.primary)}>
          {text.slice(h.start_char, h.end_char)}
        </span>
      );
      cursor = h.end_char;
    }
  }
  if (cursor < text.length)
    parts.push(<span key="t-end">{text.slice(cursor)}</span>);

  return <>{parts}</>;
}
