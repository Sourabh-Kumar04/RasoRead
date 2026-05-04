"use client";

import { useRef, useCallback, useEffect } from "react";
import { useReaderStore, WordTimestamp } from "@/stores/readerStore";
import { ttsApi } from "@/lib/api";

export interface UseTTSSyncOptions {
  onPageEnd?: () => void;
}

function findNextReadable(
  paragraphs: { text: string }[],
  currentIdx: number
): number {
  // Read ALL paragraphs including headings — skip only truly empty ones
  for (let i = currentIdx + 1; i < paragraphs.length; i++) {
    if (paragraphs[i].text.trim().length > 0) return i;
  }
  return -1;
}

export function useTTSSync(options?: UseTTSSyncOptions) {
  const store = useReaderStore();

  const audioRef        = useRef<HTMLAudioElement | null>(null);
  const rafRef          = useRef<number | null>(null);
  const audioChunksRef  = useRef<Uint8Array[]>([]);
  const utteranceRef    = useRef<SpeechSynthesisUtterance | null>(null);
  const onPageEndRef    = useRef<(() => void) | undefined>(options?.onPageEnd);
  const goToPageRef     = useRef<((delta: number) => void) | null>(null);
  const selfPlayRef     = useRef<((t: string, p: number) => Promise<void>) | null>(null);
  const webSpeechMode   = useRef(false);
  const sessionRef      = useRef(0);

  useEffect(() => { onPageEndRef.current = options?.onPageEnd; });

  useEffect(() => () => {
    sessionRef.current++;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    window.speechSynthesis?.cancel();
  }, []);

  const continueAfter = useCallback((paraIndex: number) => {
    const paras = useReaderStore.getState().pageData?.paragraphs ?? [];
    const nextIdx = findNextReadable(paras, paraIndex);
    if (nextIdx !== -1) {
      const speed = useReaderStore.getState().ttsSpeed || 1;
      setTimeout(() => {
        selfPlayRef.current?.(paras[nextIdx].text, nextIdx);
      }, 350 / speed);
    } else {
      onPageEndRef.current?.();
    }
  }, []);

  const startSyncLoop = useCallback(
    (timestamps: WordTimestamp[], paraIndex: number) => {
      const tick = () => {
        if (!audioRef.current) return;
        const t = audioRef.current.currentTime;
        const idx = timestamps.findIndex((w) => t >= w.start && t < w.end);
        if (idx !== -1) store.setActiveWord(idx, paraIndex);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [store]
  );

  const speakWithWebSpeech = useCallback(
    (text: string, timestamps: WordTimestamp[], paraIndex: number, mySession: number) => {
      window.speechSynthesis?.cancel();

      // Ensure we find a valid voice or the browser may fail to speak
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = useReaderStore.getState().ttsSpeed;
      utterance.lang = "en-US";
      
      // Let the browser use its reliable default voice!
      // Assigning voices from getVoices() randomly causes Chrome Windows to silently
      // abort if it picks an unavailable online voice.

      let wordIdx = 0;
      utterance.onboundary = (e) => {
        if (e.name === "word") {
          store.setActiveWord(wordIdx, paraIndex);
          wordIdx++;
        }
      };

      const startTime = Date.now();

      utterance.onend = () => {
        if (sessionRef.current !== mySession) return;
        
        // Anti-skip guard: if it finished in under 50ms, it was silently blocked!
        if (Date.now() - startTime < 50) {
           console.warn("WebSpeech blocked or silently skipped (finished too fast). Halting.");
           store.setPlaying(false);
           store.setActiveWord(-1, paraIndex);
           return; // DO NOT continue
        }

        store.setPlaying(false);
        store.setActiveWord(-1, paraIndex);
        continueAfter(paraIndex);
      };

      utterance.onerror = (e) => {
        if (sessionRef.current !== mySession) return;
        if (e.error === "canceled" || e.error === "interrupted") return;
        console.error("WebSpeech error:", e.error);
        
        // DO NOT continue automatically on error to prevent infinite jump loops
        store.setPlaying(false);
        store.setActiveWord(-1, paraIndex);
      };

      utteranceRef.current = utterance;
      store.setPlaying(true);
      store.setWordTimestamps(timestamps);

      setTimeout(() => {
        if (sessionRef.current !== mySession) return;
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      }, 100);
    },
    [store, continueAfter]
  );

  const play = useCallback(
    async (text: string, paraIndex: number) => {
      if (!text.trim()) {
        continueAfter(paraIndex);
        return;
      }

      const mySession = ++sessionRef.current;

      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.speechSynthesis?.cancel();

      store.setPlaying(true);
      store.setActiveWord(-1, paraIndex);
      store.setWordTimestamps([]); // CLEAR old text immediately!
      audioChunksRef.current = [];

      // CRITICAL FIX: The app was getting permanently stuck in WebSpeech fallback mode 
      // after a single error, bypassing the backend Edge TTS entirely forever.
      // We must reset it to false on every new paragraph so we always attempt high-quality TTS.
      webSpeechMode.current = false;

      // 1. Create Audio object synchronously so we don't hit Autoplay lock
      if (!audioRef.current) audioRef.current = new Audio();
      try {
        audioRef.current.play().catch(() => {});
        audioRef.current.pause();
      } catch (e) {}

      const { voiceId, ttsSpeed } = useReaderStore.getState();
      const token = typeof window !== "undefined" ? localStorage.getItem("rasoread_access_token") : null;

      try {
        const response = await fetch(ttsApi.streamUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text, voice_id: voiceId, speed: ttsSpeed, book_id: useReaderStore.getState().bookId }),
        });

        if (!response.ok || !response.body) throw new Error("TTS request failed");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let timestamps: WordTimestamp[] = [];
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (sessionRef.current !== mySession) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          // The last element is either empty (if ended with \n\n) or incomplete
          buffer = parts.pop() || "";

          for (const rawBlock of parts) {
            const lines = rawBlock.split("\n");
            let dataChunk = "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                dataChunk += line.slice(6);
              }
            }
            if (!dataChunk) continue;

            try {
              const msg = JSON.parse(dataChunk);

              if (msg.type === "timestamps") {
                timestamps = msg.data;
                store.setWordTimestamps(timestamps);
              } else if (msg.type === "audio") {
                const bytes = Uint8Array.from(atob(msg.chunk), (c) => c.charCodeAt(0));
                audioChunksRef.current.push(bytes);
              } else if (msg.type === "use_webspeech" || msg.type === "error") {
                console.warn("Backend TTS skipped or error:", msg.message || "using webspeech");
                webSpeechMode.current = true;
                speakWithWebSpeech(msg.text || text, timestamps, paraIndex, mySession);
              } else if (msg.type === "done") {
                if (!webSpeechMode.current && audioChunksRef.current.length > 0) {
                  const total = audioChunksRef.current.reduce((a, b) => a + b.length, 0);
                  const combined = new Uint8Array(total);
                  let offset = 0;
                  for (const c of audioChunksRef.current) { combined.set(c, offset); offset += c.length; }
                  const blob = new Blob([combined], { type: "audio/mp3" });
                  const url = URL.createObjectURL(blob);

                  if (!audioRef.current) audioRef.current = new Audio();
                  audioRef.current.src = url;
                  audioRef.current.playbackRate = useReaderStore.getState().ttsSpeed;
                  
                  // Wrap in promise to handle autoplay failures
                  audioRef.current.onended = () => {
                    if (sessionRef.current !== mySession) { URL.revokeObjectURL(url); return; }
                    store.setPlaying(false);
                    store.setActiveWord(-1, paraIndex);
                    if (rafRef.current) cancelAnimationFrame(rafRef.current);
                    URL.revokeObjectURL(url);
                    continueAfter(paraIndex);
                  };
                  
                  try {
                    await audioRef.current.play();
                    startSyncLoop(timestamps, paraIndex);
                  } catch (e) {
                    console.error("Audio playback blocked:", e);
                    URL.revokeObjectURL(url); // prevent memory leak
                    if (sessionRef.current === mySession) {
                      store.setPlaying(false);
                      store.setActiveWord(-1, paraIndex);
                    }
                  }
                } else if (!webSpeechMode.current && audioChunksRef.current.length === 0) {
                  // Fallback if backend returned 'done' but absolutely no audio!
                  console.warn("Backend generated 0 audio chunks. Using webspeech fallback.");
                  webSpeechMode.current = true;
                  speakWithWebSpeech(text, timestamps, paraIndex, mySession);
                }
              }
            } catch (err) {
              console.error("Malformed SSE JSON:", err, "Raw data:", dataChunk);
            }
          }
        }
      } catch (err) {
        console.error("TTS request error:", err);
        if (sessionRef.current === mySession) {
          store.setPlaying(false);
          // Auto-fallback if the API is offline
          webSpeechMode.current = true;
          speakWithWebSpeech(text, [], paraIndex, mySession);
        }
      }
    },
    [store, speakWithWebSpeech, startSyncLoop, continueAfter]
  );

  // Keep selfPlayRef in sync so continueAfter and voice-change can call play
  useEffect(() => { selfPlayRef.current = play; }, [play]);

  // ── Restart TTS when voice changes mid-playback ──────────────────────────
  const voiceChangeRef = useRef(store.voiceId);
  useEffect(() => {
    if (voiceChangeRef.current === store.voiceId) return;
    voiceChangeRef.current = store.voiceId;

    // Only restart if currently playing — otherwise the new voice takes effect on next play
    if (!useReaderStore.getState().isPlaying) return;

    // Stop current audio immediately so the old voice doesn't keep playing
    sessionRef.current++;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    window.speechSynthesis?.cancel();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const paras = useReaderStore.getState().pageData?.paragraphs ?? [];
    const currentParaIdx = useReaderStore.getState().activeParagraphIndex;
    const para = paras[currentParaIdx];
    if (para?.text) {
      setTimeout(() => {
        selfPlayRef.current?.(para.text, currentParaIdx);
      }, 150);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.voiceId]);

  // ── Media Session API — lock screen controls ──────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    const state = useReaderStore.getState();
    const title = state.bookTitle || "RasoRead";
    const page  = state.currentPage;

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: `Page ${page}`,
      album:  "RasoRead",
      artwork: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });

    navigator.mediaSession.setActionHandler("play",          () => { audioRef.current?.play(); store.setPlaying(true); });
    navigator.mediaSession.setActionHandler("pause",         () => { audioRef.current?.pause(); store.setPlaying(false); store.setPaused(true); });
    navigator.mediaSession.setActionHandler("seekbackward",  () => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); });
    navigator.mediaSession.setActionHandler("seekforward",   () => { if (audioRef.current) audioRef.current.currentTime += 30; });
    navigator.mediaSession.setActionHandler("previoustrack", () => { /* restart current paragraph */ if (audioRef.current) audioRef.current.currentTime = 0; });
    navigator.mediaSession.setActionHandler("nexttrack",     () => { onPageEndRef.current?.(); });

    return () => {
      ["play","pause","seekbackward","seekforward","previoustrack","nexttrack"].forEach((a) => {
        try { navigator.mediaSession.setActionHandler(a as MediaSessionAction, null); } catch {}
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.bookTitle, store.currentPage]);

  // Keep Media Session playback state in sync
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = store.isPlaying ? "playing" : store.isPaused ? "paused" : "none";
  }, [store.isPlaying, store.isPaused]);

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
    sessionRef.current++;
    webSpeechMode.current = false; // always reset on explicit stop
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    window.speechSynthesis?.cancel();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    store.setPlaying(false);
    store.setActiveWord(-1, 0);
  }, [store]);

  const seek = useCallback((seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + seconds);
    }
  }, []);

  return { play, pause, resume, stop, seek, audioRef };
}
