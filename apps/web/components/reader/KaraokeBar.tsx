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
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-4xl mx-auto"
        >
          <div className="relative group">
            {/* Subtle glow behind the bar */}
            <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-3xl -z-10 group-hover:bg-primary/10 transition-all duration-500" />
            
            <div className={cn(
              "rounded-[1.5rem] px-8 py-5 text-center transition-all duration-500",
              "border border-white/10 shadow-2xl",
              "bg-black/60 backdrop-blur-3xl"
            )}>
              <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
                {tokens.map((token, i) => {
                  const isCurrent = i === localActiveIdx;
                  const isPast = i < localActiveIdx;
                  
                  return (
                    <motion.span
                      key={i}
                      initial={false}
                      animate={{
                        scale: isCurrent ? 1.05 : 1,
                        color: isCurrent ? "#818cf8" : isPast ? "#52525b" : "#a1a1aa"
                      }}
                      className={cn(
                        "text-[1.1rem] leading-relaxed transition-all duration-200",
                        isCurrent ? "font-bold" : "font-medium"
                      )}
                    >
                      {token.word}
                    </motion.span>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
