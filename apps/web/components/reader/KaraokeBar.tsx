"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useReaderStore, WordTimestamp } from "@/stores/readerStore";
import { cn } from "@/lib/utils";

interface SentenceRange {
  startWord: number;
  endWord: number; // exclusive
}

/** Split paragraph text into sentence ranges (by word index). */
function getSentenceRanges(text: string, totalWords: number): SentenceRange[] {
  if (totalWords === 0) return [];

  // Split on sentence-ending punctuation
  const parts: string[] = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
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

  // Ensure all words are covered by the last range
  if (ranges.length > 0 && ranges[ranges.length - 1].endWord < totalWords) {
    ranges[ranges.length - 1].endWord = totalWords;
  }

  return ranges.length > 0 ? ranges : [{ startWord: 0, endWord: totalWords }];
}

export function KaraokeBar() {
  const store = useReaderStore();

  const isActive = store.isPlaying && store.wordTimestamps.length > 0;
  const para = store.pageData?.paragraphs[store.activeParagraphIndex];

  let tokens: WordTimestamp[] = [];
  let localActiveIdx = -1;

  if (isActive && para) {
    const totalWords = store.wordTimestamps.length;
    const sentences = getSentenceRanges(para.text, totalWords);

    const activeSentence =
      sentences.find(
        (s) => store.activeWordIndex >= s.startWord && store.activeWordIndex < s.endWord
      ) ?? sentences[sentences.length - 1];

    if (activeSentence) {
      tokens = store.wordTimestamps.slice(
        activeSentence.startWord,
        activeSentence.endWord
      );
      localActiveIdx = store.activeWordIndex - activeSentence.startWord;
    }
  }

  const show = isActive && !!para && tokens.length > 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="karaoke-bar"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-[7.5rem] left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-5 pointer-events-none"
        >
          <div
            className={cn(
              "glass rounded-2xl px-7 py-4 text-center",
              "border border-emerald-500/20",
              "bg-[#0c1a14]/90",
              "shadow-[0_8px_40px_rgba(0,0,0,0.55),0_0_0_1px_rgba(52,211,153,0.08)]"
            )}
          >
            {/* Sentence progress dots */}
            <p className="font-body text-[1.05rem] leading-relaxed tracking-[0.01em]">
              {tokens.map((token, i) => (
                <span
                  key={i}
                  className={cn(
                    "transition-colors duration-75",
                    i === localActiveIdx
                      ? "text-emerald-300 font-semibold"
                      : i < localActiveIdx
                      ? "text-[#2d4a3e]"
                      : "text-[#5a7a6e]"
                  )}
                >
                  {token.word}{" "}
                </span>
              ))}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
