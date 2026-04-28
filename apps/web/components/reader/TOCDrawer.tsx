"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Bookmark, Trash2 } from "lucide-react";
import { useReaderStore } from "@/stores/readerStore";
import { readerApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TOCDrawerProps {
  open: boolean;
  onClose: () => void;
  onJumpTo: (page: number) => void;
}

type Tab = "toc" | "bookmarks";

export function TOCDrawer({ open, onClose, onJumpTo }: TOCDrawerProps) {
  const store = useReaderStore();
  const [tab, setTab] = useState<Tab>("toc");
  const [bookmarks, setBookmarks] = useState<{ id: string; page: number; label?: string }[]>([]);

  useEffect(() => {
    if (!open || !store.bookId) return;
    readerApi.listBookmarks(store.bookId)
      .then((res) => setBookmarks(res.data))
      .catch(() => {});
  }, [open, store.bookId]);

  const deleteBookmark = async (id: string) => {
    if (!store.bookId) return;
    try {
      await readerApi.deleteBookmark(store.bookId, id);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch {}
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 top-16 z-30 bg-black/50"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed left-0 top-16 bottom-0 w-72 z-40 bg-surface-mid
                       border-r border-outline-variant/20 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTab("toc")}
                  className={cn(
                    "flex items-center gap-1.5 font-label text-sm transition-colors",
                    tab === "toc" ? "text-primary" : "text-outline hover:text-zinc-300"
                  )}
                >
                  <BookOpen size={14} />
                  Contents
                </button>
                <button
                  onClick={() => setTab("bookmarks")}
                  className={cn(
                    "flex items-center gap-1.5 font-label text-sm transition-colors",
                    tab === "bookmarks" ? "text-primary" : "text-outline hover:text-zinc-300"
                  )}
                >
                  <Bookmark size={14} />
                  Bookmarks
                  {bookmarks.length > 0 && (
                    <span className="font-label text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                      {bookmarks.length}
                    </span>
                  )}
                </button>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <X size={14} className="text-outline" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-2">
              {tab === "toc" ? (
                store.toc.length === 0 ? (
                  <p className="text-sm text-outline font-label text-center py-8 px-4">
                    No table of contents available.
                  </p>
                ) : (
                  store.toc.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => { onJumpTo(item.page); onClose(); }}
                      className={cn(
                        "w-full text-left px-5 py-3 font-label text-sm transition-colors",
                        "hover:bg-white/5 border-b border-outline-variant/5",
                        item.level === 1 && "text-[#dae2fd] font-medium",
                        item.level === 2 && "text-secondary pl-8",
                        item.level >= 3 && "text-outline pl-12 text-xs",
                        store.currentPage === item.page && "bg-primary/10 text-primary"
                      )}
                    >
                      {item.title}
                      <span className="ml-2 text-outline text-xs">p.{item.page}</span>
                    </button>
                  ))
                )
              ) : (
                bookmarks.length === 0 ? (
                  <p className="text-sm text-outline font-label text-center py-8 px-4">
                    No bookmarks yet. Use the bookmark button in the top bar to save your place.
                  </p>
                ) : (
                  bookmarks
                    .sort((a, b) => a.page - b.page)
                    .map((bm) => (
                      <div
                        key={bm.id}
                        className="flex items-center justify-between px-5 py-3 hover:bg-white/5 border-b border-outline-variant/5 group"
                      >
                        <button
                          onClick={() => { onJumpTo(bm.page); onClose(); }}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <Bookmark size={12} className="text-primary shrink-0" fill="currentColor" />
                          <span className="font-label text-sm text-[#dae2fd]">
                            {bm.label || `Page ${bm.page}`}
                          </span>
                          <span className="font-label text-xs text-outline ml-auto">p.{bm.page}</span>
                        </button>
                        <button
                          onClick={() => deleteBookmark(bm.id)}
                          className="p-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all ml-2"
                        >
                          <Trash2 size={11} className="text-outline" />
                        </button>
                      </div>
                    ))
                )
              )}
            </div>

            {/* Progress footer */}
            <div className="border-t border-outline-variant/20 p-4">
              <div className="flex justify-between font-label text-[10px] text-outline mb-1.5">
                <span>Progress</span>
                <span className="text-primary">{Math.round(store.completionPct)}%</span>
              </div>
              <div className="h-1 w-full bg-surface-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${store.completionPct}%` }} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
