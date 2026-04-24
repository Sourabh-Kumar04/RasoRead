"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Play, CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { booksApi } from "@/lib/api";

interface BookCardProps {
  book: {
    id: string;
    title: string;
    author?: string;
    cover_url?: string;
    status: string;
    file_type: string;
    total_pages: number;
  };
  progress?: {
    completion_pct: number;
    current_page: number;
    last_read_at: string;
  };
  onDelete: (id: string) => void;
}

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf:  "bg-red-500/10 text-red-400 border border-red-500/20",
  epub: "bg-green-500/10 text-green-400 border border-green-500/20",
  docx: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  txt:  "bg-zinc-800 text-zinc-400 border border-white/10",
};

const COVER_GRADIENTS = [
  "from-indigo-900/80 to-purple-900/80",
  "from-teal-900/80 to-cyan-900/80",
  "from-rose-900/80 to-pink-900/80",
  "from-amber-900/80 to-orange-900/80",
  "from-slate-800/80 to-slate-900/80",
];

function DeleteConfirmModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="glass-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <p className="font-label font-semibold text-on-surface">Delete book?</p>
            <p className="font-label text-sm text-zinc-400 mt-0.5 line-clamp-1">"{title}"</p>
          </div>
        </div>
        <p className="font-label text-sm text-zinc-400 mb-5">
          This will permanently remove the book and all your highlights, notes, and progress.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-white/10 font-label text-sm text-zinc-400 hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 font-label text-sm text-white transition-colors">Delete</button>
        </div>
      </motion.div>
    </div>
  );
}

export function BookCard({ book, progress, onDelete }: BookCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const gradient = COVER_GRADIENTS[book.title.charCodeAt(0) % COVER_GRADIENTS.length];
  const isReady = book.status === "ready";
  const isProcessing = book.status === "processing";
  const pct = progress?.completion_pct || 0;

  const handleOpen = () => {
    if (!isReady) return;
    router.push(`/reader/${book.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteModal(false);
    setDeleting(true);
    try {
      await booksApi.delete(book.id);
      onDelete(book.id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group cursor-pointer"
      onClick={handleOpen}
    >
      <AnimatePresence>
        {showDeleteModal && (
          <DeleteConfirmModal
            title={book.title}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setShowDeleteModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Cover */}
      <div className="aspect-[3/4] mb-3 rounded-xl overflow-hidden relative bg-white/[0.04] border border-white/[0.06] shadow-lg">
        {book.cover_url ? (
          <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className={cn("w-full h-full bg-gradient-to-b flex items-end p-3", gradient)}>
            <p className="font-headline italic text-sm text-white/90 leading-tight line-clamp-3">{book.title}</p>
          </div>
        )}

        {/* Status overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="text-primary animate-spin" />
            <span className="font-label text-xs text-primary/80">Processing…</span>
          </div>
        )}

        {/* Play overlay on hover */}
        {isReady && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all
                          flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center
                            shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
              <Play size={20} className="text-[#0f0069] ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}

        {/* Progress bar */}
        {pct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {/* Completion badge */}
        {pct >= 95 && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500/90
                          flex items-center justify-center">
            <CheckCircle size={14} className="text-white" />
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={handleDeleteClick}
          disabled={deleting}
          className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/60 opacity-0
                     group-hover:opacity-100 hover:bg-red-500/80 transition-all"
        >
          {deleting ? (
            <Loader2 size={12} className="text-white animate-spin" />
          ) : (
            <Trash2 size={12} className="text-white" />
          )}
        </button>
      </div>

      {/* Meta */}
      <div className="space-y-0.5">
        <h3 className="font-headline text-base font-medium text-zinc-200 leading-tight line-clamp-2 group-hover:text-white transition-colors">
          {book.title}
        </h3>
        {book.author && <p className="font-label text-xs text-zinc-600">{book.author}</p>}
        <div className="flex items-center gap-2 pt-1">
          <span className={cn("font-label text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded", FILE_TYPE_COLORS[book.file_type] || FILE_TYPE_COLORS.txt)}>
            {book.file_type}
          </span>
          {pct > 0 && pct < 95 && <span className="font-label text-[9px] text-zinc-600">{Math.round(pct)}%</span>}
        </div>
      </div>
    </motion.div>
  );
}
