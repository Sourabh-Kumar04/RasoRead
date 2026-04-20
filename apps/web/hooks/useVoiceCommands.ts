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
