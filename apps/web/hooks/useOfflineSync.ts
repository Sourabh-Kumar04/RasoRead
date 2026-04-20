"use client";

import { useEffect, useRef, useCallback } from "react";
import { offlineCache } from "@/lib/indexeddb";
import { notesApi, readerApi } from "@/lib/api";

/**
 * Monitors online/offline status and flushes any queued actions
 * (highlights, progress saves) when connectivity is restored.
 */
export function useOfflineSync(bookId?: string) {
  const isOnline = useRef(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const flushQueue = useCallback(async () => {
    // Flush queued highlights
    try {
      const queue = await offlineCache.flushHighlightQueue();
      for (const highlight of queue) {
        try {
          await notesApi.createHighlight(highlight as any);
        } catch {
          // Re-queue on failure
          await offlineCache.queueHighlight(highlight);
        }
      }
    } catch {}

    // Sync progress if we have a bookId
    if (bookId) {
      try {
        const cached = await offlineCache.loadProgress(bookId);
        if (cached) {
          await readerApi.saveProgress(bookId, {
            current_page: cached.current_page,
            char_offset: cached.char_offset,
            completion_pct: cached.completion_pct,
            tts_speed: cached.tts_speed,
            voice_id: cached.voice_id,
          });
        }
      } catch {}
    }
  }, [bookId]);

  useEffect(() => {
    const handleOnline = () => {
      isOnline.current = true;
      flushQueue();
    };

    const handleOffline = () => {
      isOnline.current = false;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Flush on mount if already online
    if (navigator.onLine) {
      flushQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushQueue]);

  return { isOnline: isOnline.current };
}
