"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen } from "lucide-react";
import { useReaderStore } from "@/stores/readerStore";
import { cn } from "@/lib/utils";

interface TOCDrawerProps {
  open: boolean;
  onClose: () => void;
  onJumpTo: (page: number) => void;
}

export function TOCDrawer({ open, onClose, onJumpTo }: TOCDrawerProps) {
  const store = useReaderStore();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/50"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed left-0 top-0 bottom-0 w-72 z-40 bg-surface-mid
                       border-r border-outline-variant/20 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-primary" />
                <span className="font-label text-sm font-semibold text-[#dae2fd]">
                  Contents
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={14} className="text-outline" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {store.toc.length === 0 ? (
                <p className="text-sm text-outline font-label text-center py-8 px-4">
                  No table of contents available for this book.
                </p>
              ) : (
                store.toc.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onJumpTo(item.page);
                      onClose();
                    }}
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
              )}
            </div>

            {/* Bookmarks section */}
            <div className="border-t border-outline-variant/20 p-4">
              <p className="font-label text-[10px] uppercase tracking-widest text-outline mb-3">
                Current position
              </p>
              <div className="h-1.5 w-full bg-surface-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${store.completionPct}%` }}
                />
              </div>
              <p className="font-label text-xs text-outline mt-1">
                {Math.round(store.completionPct)}% complete
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
