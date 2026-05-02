"use client";

import { useEffect, useRef, useCallback } from "react";
import { useReaderStore } from "@/stores/readerStore";

// Fallback types to bypass TS errors if @types/dom-speech-recognition is absent
type SpeechRecognition = any;
type SpeechRecognitionEvent = any;
type SpeechRecognitionErrorEvent = any;

interface VoiceCommandHandlers {
  onAddNote?: () => void;
  onBookmark?: () => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onPlayPause?: () => void;
  /** Called with color and matched text span when voice highlight command fires */
  onHighlight?: (color: string, text: string) => void;
}

export function useVoiceCommands(handlers: VoiceCommandHandlers, enabled = true) {
  const store = useReaderStore();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningRef = useRef(false);

  const processCommand = useCallback(
    (transcript: string) => {
      const cmd = transcript.toLowerCase().trim();

      if (cmd.includes("add note") || cmd.includes("take note")) {
        handlers.onAddNote?.();
      } else if (cmd.includes("bookmark") || cmd.includes("save page")) {
        handlers.onBookmark?.();
      } else if (cmd.includes("next page") || cmd.includes("go forward")) {
        handlers.onNextPage?.();
      } else if (cmd.includes("previous page") || cmd.includes("go back")) {
        handlers.onPrevPage?.();
      } else if (cmd.includes("increase speed") || cmd.includes("faster")) {
        store.setSpeed(Math.min(4, store.ttsSpeed + 0.25));
      } else if (cmd.includes("decrease speed") || cmd.includes("slower")) {
        store.setSpeed(Math.max(0.25, store.ttsSpeed - 0.25));
      } else if (cmd.includes("pause") || cmd.includes("stop reading")) {
        handlers.onPlayPause?.();
      } else if (cmd.includes("play") || cmd.includes("continue") || cmd.includes("resume")) {
        handlers.onPlayPause?.();
      } else if (cmd.includes("focus mode")) {
        store.toggleFocusMode();
      } else if (cmd.includes("summarise") || cmd.includes("summarize") || cmd.includes("summary")) {
        // Open AI tab — SmartPanel will auto-summarise
        store.toggleSmartPanel("ai");
      } else if (cmd.startsWith("ask") || cmd.startsWith("question")) {
        // "ask what is the main theme" → extract question after "ask"
        const question = cmd.replace(/^(ask|question)\s*/i, "").trim();
        if (question) {
          store.setAiQuestion(question);
          store.toggleSmartPanel("ai");
        }
      } else if (cmd.includes("highlight")) {
        // "raso highlight [start] to [end]" or "raso highlight [text]"
        // Extracts the text span between 'highlight' and 'to' (if present),
        // or everything after 'highlight'. Matches against current page paragraphs.
        const afterHighlight = cmd.replace(/.*highlight\s*/i, "").trim();
        if (afterHighlight) {
          // Try "X to Y" pattern first
          const toMatch = afterHighlight.match(/^(.+?)\s+to\s+(.+)$/i);
          let matchText = afterHighlight;
          if (toMatch) {
            const startFrag = toMatch[1].trim();
            const endFrag   = toMatch[2].trim();
            // Find in current page paragraphs
            const paragraphs = store.pageData?.paragraphs ?? [];
            const fullPage = paragraphs.map((p) => p.text).join(" ");
            const startIdx = fullPage.toLowerCase().indexOf(startFrag.toLowerCase());
            const endSearch = fullPage.toLowerCase().indexOf(endFrag.toLowerCase());
            if (startIdx !== -1 && endSearch !== -1) {
              const endIdx = endSearch + endFrag.length;
              matchText = fullPage.slice(startIdx, endIdx);
            }
          }
          handlers.onHighlight?.("yellow", matchText);
        } else {
          // No text given — open notes panel
          store.toggleSmartPanel("notes");
        }
      }
    },
    [handlers, store]
  );

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      if (last.isFinal) {
        processCommand(last[0].transcript);
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "no-speech") {
        console.warn("Voice recognition error:", e.error);
      }
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    listeningRef.current = true;
    try { recognition.start(); } catch {}

    return () => {
      listeningRef.current = false;
      recognition.stop();
    };
  }, [enabled, processCommand]);

  // Also expose a function for typed voice note capture
  const captureVoiceNote = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return reject(new Error("Speech recognition not supported"));

      const recognition = new SR();
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        resolve(event.results[0][0].transcript);
      };
      recognition.onerror = () => reject(new Error("Voice capture failed"));
      recognition.start();
    });
  }, []);

  return { captureVoiceNote };
}
