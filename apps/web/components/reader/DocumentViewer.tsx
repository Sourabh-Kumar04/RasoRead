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
  /** Called when TTS finishes the last paragraph on the last page. */
  onBookEnd?: () => void;
}

const HIGHLIGHT_CSS: Record<string, string> = {
  primary: "bg-primary/20 border-b-2 border-primary/60",
  yellow:  "bg-amber-400/20 border-b-2 border-amber-400/60",
  green:   "bg-green-400/20 border-b-2 border-green-400/60",
  red:     "bg-red-400/20 border-b-2 border-red-400/60",
};

interface SentenceRange { startWord: number; endWord: number }

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
  if (ranges.length > 0 && ranges[ranges.length - 1].endWord < totalWords)
    ranges[ranges.length - 1].endWord = totalWords;
  return ranges.length > 0 ? ranges : [{ startWord: 0, endWord: totalWords }];
}

export function DocumentViewer({ bookId, tts, onBookEnd }: DocumentViewerProps) {
  const store = useReaderStore();
  const { play } = tts;

  const activeParagraphRef = useRef<HTMLDivElement | null>(null);
  const activeSentenceRef  = useRef<HTMLSpanElement | null>(null);
  const containerRef       = useRef<HTMLDivElement>(null);

  const [modalImage, setModalImage] = useState<{
    b64: string; format: string; index: number;
  } | null>(null);
  const [, setPendingNoteText] = useState<string | null>(null);

  // ── Scroll active paragraph into view during TTS ──────────────────────────
  useEffect(() => {
    if (activeSentenceRef.current && store.isPlaying) {
      const container = document.getElementById("reader-scroll");
      if (container) {
        const el = activeSentenceRef.current;
        const elTop = el.getBoundingClientRect().top;
        const containerTop = container.getBoundingClientRect().top;
        const offset = elTop - containerTop + container.scrollTop - container.clientHeight / 2;
        container.scrollTo({ top: offset, behavior: "smooth" });
      }
    }
  }, [store.activeWordIndex, store.isPlaying]);

  useEffect(() => {
    if (activeParagraphRef.current && !store.isPlaying) {
      const container = document.getElementById("reader-scroll");
      if (container) {
        const el = activeParagraphRef.current;
        const elTop = el.getBoundingClientRect().top;
        const containerTop = container.getBoundingClientRect().top;
        const offset = elTop - containerTop + container.scrollTop - container.clientHeight / 2;
        container.scrollTo({ top: offset, behavior: "smooth" });
      }
    }
  }, [store.activeParagraphIndex, store.isPlaying]);

  // ── Highlight handler ─────────────────────────────────────────────────────
  const handleHighlight = useCallback(
    async (color: string, text: string, _range: Range) => {
      const pageText = store.pageData?.paragraphs.map((p) => p.text).join("\n") ?? "";
      const startChar = pageText.indexOf(text);
      const endChar = startChar >= 0 ? startChar + text.length : text.length;
      try {
        const res = await notesApi.createHighlight({
          book_id: bookId, page: store.currentPage,
          start_char: Math.max(0, startChar), end_char: endChar,
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

  const handleAskAI = useCallback(
    (text: string) => {
      store.setAiQuestion(`Explain this: "${text}"`);
      store.toggleSmartPanel("ai");
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

  // ── Loading ───────────────────────────────────────────────────────────────
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

  // ════════════════════════════════════════════════════════════════════════════
  //  BOOK PAGE MODE — real rendered PDF page with paragraph highlight overlays
  //  Used for all PDFs (OCR is now primary so all PDFs have page images)
  // ════════════════════════════════════════════════════════════════════════════
  const hasPdfPageImage = store.pageData !== null; // always show page image for PDFs

  // Detect if this is a PDF book by checking if the book has page images available
  // We try to show the page image view for all books; it falls back to text mode
  // if the page-image endpoint returns an error (e.g. EPUB/DOCX/TXT)
  return (
    <>
      <HighlightMenu 
        onHighlight={handleHighlight} 
        onNote={handleNoteFromSelection} 
        onAskAI={handleAskAI}
      />

      {modalImage && (
        <ImageModal
          imageB64={modalImage.b64} format={modalImage.format}
          figureIndex={modalImage.index} bookId={bookId}
          onClose={() => setModalImage(null)}
        />
      )}

      {/* ── Book page image view (PDF) ──────────────────────────────────── */}
      <BookPageView
        bookId={bookId}
        store={store}
        paragraphs={paragraphs}
        images={images}
        activeParagraphRef={activeParagraphRef}
        activeSentenceRef={activeSentenceRef}
        containerRef={containerRef}
        modalImage={modalImage}
        setModalImage={setModalImage}
        handleParagraphDoubleClick={handleParagraphDoubleClick}
        handleHighlight={handleHighlight}
        handleNoteFromSelection={handleNoteFromSelection}
        handleAskAI={handleAskAI}
      />
    </>
  );
}

// ── BookPageView — renders the actual PDF page image + text overlay fallback ──

function BookPageView({
  bookId,
  store,
  paragraphs,
  images,
  activeParagraphRef,
  activeSentenceRef,
  containerRef,
  modalImage,
  setModalImage,
  handleParagraphDoubleClick,
  handleHighlight,
  handleNoteFromSelection,
  handleAskAI,
}: any) {
  const [useTextFallback, setUseTextFallback] = useState(false);

  // If page image fails to load (EPUB/DOCX/TXT), fall back to text rendering
  const handleImageFailed = useCallback(() => setUseTextFallback(true), []);

  // Use the viewMode from the store, but override if fallback is required.
  // Default to "original" if viewMode is undefined (old persisted state).
  const effectiveViewMode = useTextFallback ? "text" : (store.viewMode ?? "original");

  if (effectiveViewMode !== "text") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-4">
        <PageImageViewer
          bookId={bookId}
          currentPage={store.currentPage}
          totalPages={store.totalPages}
          pageData={store.pageData}
          activeParagraphIndex={store.activeParagraphIndex}
          isPlaying={store.isPlaying}
          onFailed={handleImageFailed}
        />
      </div>
    );
  }

  // ── Text fallback for EPUB / DOCX / TXT ────────────────────────────────────
  return (
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
          {paragraphs.map((para: any, paraIndex: number) => {
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
                      "reader-text rounded-xl transition-all duration-300 cursor-text -mx-4 px-4 py-2",
                      isActive && "bg-primary/5 ring-1 ring-primary/20 shadow-[0_0_40px_rgba(99,102,241,0.08)]",
                      isSpoken && "opacity-40"
                    )}
                    onDoubleClick={() => handleParagraphDoubleClick(para.text, paraIndex)}
                  >
                    {isActive && store.wordTimestamps.length > 0 ? (
                      getSentenceRanges(para.text, store.wordTimestamps.length).map(
                        (sent: SentenceRange, sentIdx: number) => {
                          const isSentActive =
                            store.activeWordIndex >= sent.startWord &&
                            store.activeWordIndex < sent.endWord;
                          const isSentSpoken = store.activeWordIndex >= sent.endWord;
                          const sentTokens = store.wordTimestamps.slice(sent.startWord, sent.endWord);
                          return (
                            <span
                              key={sentIdx}
                              ref={isSentActive ? activeSentenceRef : null}
                              className={cn(
                                "transition-all duration-300 rounded-sm",
                                isSentActive && "bg-primary/10 ring-1 ring-primary/20",
                                isSentSpoken && "opacity-40"
                              )}
                            >
                              {sentTokens.map((token: any, wordIdx: number) => {
                                const globalIdx = sent.startWord + wordIdx;
                                return (
                                  <span
                                    key={wordIdx}
                                    className={cn(
                                      "word-token",
                                      globalIdx === store.activeWordIndex && "tts-active-word",
                                      globalIdx < store.activeWordIndex && "spoken"
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

                {images
                  .filter((img: any) => img.index === paraIndex)
                  .map((img: any) => (
                    <div key={img.index} className="my-6">
                      {img.data_b64 ? (
                        <button
                          className="w-full rounded-xl overflow-hidden border border-outline-variant/20
                                     hover:border-primary/30 transition-colors cursor-zoom-in"
                          onClick={() => setModalImage({ b64: img.data_b64, format: img.format, index: img.index })}
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
  );
}

function renderWithHighlights(
  text: string,
  highlights: { page: number; start_char: number; end_char: number; color: string; text: string }[],
  currentPage: number
) {
  const HIGHLIGHT_CSS: Record<string, string> = {
    primary: "bg-primary/20 border-b-2 border-primary/60",
    yellow:  "bg-amber-400/20 border-b-2 border-amber-400/60",
    green:   "bg-green-400/20 border-b-2 border-green-400/60",
    red:     "bg-red-400/20 border-b-2 border-red-400/60",
  };
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
