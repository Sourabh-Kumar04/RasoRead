"use client";

import { useCallback, useEffect, useRef } from "react";
import { readerApi } from "@/lib/api";
import { offlineCache } from "@/lib/indexeddb";
import { useReaderStore } from "@/stores/readerStore";

export function useReadingSession(bookId: string) {
  const store = useReaderStore();
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  // Load progress on mount (backend first, fallback to IndexedDB)
  const loadProgress = useCallback(async () => {
    try {
      const res = await readerApi.getProgress(bookId);
      const p = res.data;
      store.setProgress(p.current_page, p.char_offset, p.completion_pct);
      store.setSpeed(p.tts_speed);
      store.setVoice(p.voice_id);
      // Cache locally for offline
      await offlineCache.saveProgress(bookId, p);
    } catch {
      // Fallback to IndexedDB
      const cached = await offlineCache.loadProgress(bookId);
      if (cached) {
        store.setProgress(cached.current_page, cached.char_offset, cached.completion_pct || 0);
        if (cached.tts_speed) store.setSpeed(cached.tts_speed);
      }
    }
  }, [bookId, store]);

  // Debounced save — fires 2s after last call
  const saveProgress = useCallback(
    (page: number, offset: number, pct: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const payload = {
          current_page: page,
          char_offset: offset,
          completion_pct: pct,
          tts_speed: store.ttsSpeed,
          voice_id: store.voiceId,
        };
        // Always save locally
        await offlineCache.saveProgress(bookId, payload);
        // Sync to backend when online
        if (navigator.onLine) {
          try {
            await readerApi.saveProgress(bookId, payload);
          } catch {
            // Will retry on next save
          }
        }
      }, 2000);
    },
    [bookId, store.ttsSpeed, store.voiceId]
  );

  // Load page text (cached → network)
  const loadPage = useCallback(
    async (page: number) => {
      // Try cache first for instant display
      const cached = await offlineCache.loadPage(bookId, page);
      if (cached) {
        store.setPageData(cached);
      }

      // Always fetch fresh from API
      try {
        const res = await readerApi.getPage(bookId, page);
        store.setPageData(res.data);
        // Cache for offline
        await offlineCache.savePage(bookId, page, res.data);
      } catch (err) {
        if (!cached) {
          console.error("Failed to load page:", err);
        }
      }
    },
    [bookId, store]
  );

  // Flush offline highlight queue when back online
  useEffect(() => {
    const handleOnline = async () => {
      const queue = await offlineCache.flushHighlightQueue();
      // Re-submit queued highlights
      // (import notesApi here if needed)
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return { loadProgress, saveProgress, loadPage };
}
