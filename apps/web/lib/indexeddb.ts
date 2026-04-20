import { get, set, del, keys } from "idb-keyval";

const PREFIX = "rasoread:";

export const offlineCache = {
  // ── Progress ──────────────────────────────────────────────────────────────
  async saveProgress(bookId: string, progress: {
    current_page: number;
    char_offset: number;
    completion_pct?: number;
    tts_speed?: number;
    voice_id?: string;
  }) {
    await set(`${PREFIX}progress:${bookId}`, { ...progress, ts: Date.now() });
  },

  async loadProgress(bookId: string) {
    return await get(`${PREFIX}progress:${bookId}`);
  },

  // ── Book text (page-level caching) ────────────────────────────────────────
  async savePage(bookId: string, page: number, data: unknown) {
    await set(`${PREFIX}page:${bookId}:${page}`, data);
  },

  async loadPage(bookId: string, page: number) {
    return await get(`${PREFIX}page:${bookId}:${page}`);
  },

  // ── Book metadata ─────────────────────────────────────────────────────────
  async saveBookMeta(bookId: string, meta: unknown) {
    await set(`${PREFIX}book:${bookId}`, meta);
  },

  async loadBookMeta(bookId: string) {
    return await get(`${PREFIX}book:${bookId}`);
  },

  // ── Highlights (offline queue) ────────────────────────────────────────────
  async queueHighlight(highlight: unknown) {
    const existing = (await get(`${PREFIX}highlight_queue`)) || [];
    await set(`${PREFIX}highlight_queue`, [...existing, highlight]);
  },

  async flushHighlightQueue(): Promise<unknown[]> {
    const queue = (await get(`${PREFIX}highlight_queue`)) || [];
    await del(`${PREFIX}highlight_queue`);
    return queue;
  },

  // ── Cleanup ───────────────────────────────────────────────────────────────
  async clearBook(bookId: string) {
    const allKeys = await keys();
    const bookKeys = (allKeys as string[]).filter((k) =>
      k.startsWith(`${PREFIX}page:${bookId}`) ||
      k === `${PREFIX}book:${bookId}` ||
      k === `${PREFIX}progress:${bookId}`
    );
    await Promise.all(bookKeys.map(del));
  },
};
