"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { booksApi } from "@/lib/api";

type BookStatus = "processing" | "ready" | "error" | "unknown";

interface PollResult {
  status: BookStatus;
  error?: string;
}

/**
 * Poll book processing status until it's "ready" or "error".
 * Returns current status and a manual refetch function.
 */
export function useBookPolling(
  bookId: string,
  initialStatus: BookStatus = "unknown",
  intervalMs = 3000
) {
  const [status, setStatus] = useState<BookStatus>(initialStatus);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const res = await booksApi.status(bookId);
      const s: BookStatus = res.data.status as BookStatus;

      if (!activeRef.current) return;
      setStatus(s);

      if (s === "error") {
        setErrorMsg(res.data.error || "Processing failed");
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else if (s === "ready") {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch {
      // Network error — keep polling
    }
  }, [bookId]);

  useEffect(() => {
    activeRef.current = true;

    // Don't poll if already done
    if (initialStatus === "ready" || initialStatus === "error") {
      setStatus(initialStatus);
      return;
    }

    // Poll immediately then on interval
    poll();
    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      activeRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [bookId, initialStatus, intervalMs, poll]);

  return { status, errorMsg, refetch: poll };
}
