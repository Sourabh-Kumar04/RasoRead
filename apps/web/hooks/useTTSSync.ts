"use client";

import { useRef, useCallback, useEffect } from "react";
import { useReaderStore, WordTimestamp } from "@/stores/readerStore";
import { ttsApi } from "@/lib/api";

export function useTTSSync() {
  const store = useReaderStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Cancel any running RAF loop on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (utteranceRef.current) {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  // RAF loop: sync active word highlight to audio currentTime
  const startSyncLoop = useCallback(
    (timestamps: WordTimestamp[], paraIndex: number) => {
      const tick = () => {
        if (!audioRef.current) return;
        const t = audioRef.current.currentTime;
        const idx = timestamps.findIndex((w) => t >= w.start && t < w.end);
        if (idx !== -1) {
          store.setActiveWord(idx, paraIndex);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [store]
  );

  // Web Speech API fallback (no API key)
  const playWithWebSpeech = useCallback(
    (text: string, timestamps: WordTimestamp[], paraIndex: number) => {
      window.speechSynthesis?.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = store.ttsSpeed;

      let wordIdx = 0;
      utterance.onboundary = (event) => {
        if (event.name === "word") {
          store.setActiveWord(wordIdx, paraIndex);
          wordIdx++;
        }
      };
      utterance.onend = () => {
        store.setPlaying(false);
        store.setActiveWord(-1, paraIndex);
      };
      utterance.onerror = () => store.setPlaying(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      store.setPlaying(true);
      store.setWordTimestamps(timestamps);
    },
    [store]
  );

  const play = useCallback(
    async (text: string, paraIndex: number) => {
      if (!text.trim()) return;

      // Pause existing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.speechSynthesis?.cancel();

      store.setPlaying(true);
      audioChunksRef.current = [];

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("rasoread_access_token")
          : null;

      try {
        const response = await fetch(ttsApi.streamUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            text,
            voice_id: store.voiceId,
            speed: store.ttsSpeed,
          }),
        });

        if (!response.ok || !response.body) throw new Error("TTS request failed");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let timestamps: WordTimestamp[] = [];
        let useWebSpeech = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text_chunk = decoder.decode(value, { stream: true });
          const lines = text_chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const msg = JSON.parse(line.slice(6));

              if (msg.type === "timestamps") {
                timestamps = msg.data;
                store.setWordTimestamps(timestamps);

              } else if (msg.type === "audio") {
                const bytes = Uint8Array.from(atob(msg.chunk), (c) => c.charCodeAt(0));
                audioChunksRef.current.push(bytes);

              } else if (msg.type === "use_webspeech") {
                useWebSpeech = true;
                playWithWebSpeech(msg.text, timestamps, paraIndex);

              } else if (msg.type === "done") {
                if (!useWebSpeech && audioChunksRef.current.length > 0) {
                  const total = audioChunksRef.current.reduce((a, b) => a + b.length, 0);
                  const combined = new Uint8Array(total);
                  let offset = 0;
                  for (const chunk of audioChunksRef.current) {
                    combined.set(chunk, offset);
                    offset += chunk.length;
                  }
                  const blob = new Blob([combined], { type: "audio/mp3" });
                  const url = URL.createObjectURL(blob);

                  if (!audioRef.current) {
                    audioRef.current = new Audio();
                  }
                  audioRef.current.src = url;
                  audioRef.current.playbackRate = store.ttsSpeed;
                  audioRef.current.onended = () => {
                    store.setPlaying(false);
                    store.setActiveWord(-1, paraIndex);
                    if (rafRef.current) cancelAnimationFrame(rafRef.current);
                    URL.revokeObjectURL(url);
                  };
                  await audioRef.current.play();
                  startSyncLoop(timestamps, paraIndex);
                }
              }
            } catch {
              // Malformed SSE line — skip
            }
          }
        }
      } catch (err) {
        console.error("TTS error:", err);
        store.setPlaying(false);
      }
    },
    [store, startSyncLoop, playWithWebSpeech]
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    window.speechSynthesis?.pause();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    store.setPlaying(false);
    store.setPaused(true);
  }, [store]);

  const resume = useCallback(() => {
    audioRef.current?.play();
    window.speechSynthesis?.resume();
    store.setPlaying(true);
  }, [store]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    window.speechSynthesis?.cancel();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    store.setPlaying(false);
    store.setActiveWord(-1, 0);
  }, [store]);

  const seek = useCallback(
    (seconds: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(
          0,
          audioRef.current.currentTime + seconds
        );
      }
    },
    []
  );

  return { play, pause, resume, stop, seek, audioRef };
}
