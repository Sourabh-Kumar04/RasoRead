"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trash2, Play, CheckCircle, Loader2 } from "lucide-react";
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
  pdf: "bg-red-500/10 text-red-300",
  epub: "bg-green-500/10 text-green-300",
  docx: "bg-blue-500/10 text-blue-300",
  txt: "bg-outline/10 text-outline",
};

const COVER_GRADIENTS = [
  "from-purple-900/80 to-indigo-900/80",
  "from-teal-900/80 to-cyan-900/80",
  "from-rose-900/80 to-pink-900/80",
  "from-amber-900/80 to-orange-900/80",
  "from-slate-800/80 to-slate-900/80",
];

export function BookCard({ book, progress, onDelete }: BookCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const gradient = COVER_GRADIENTS[book.title.charCodeAt(0) % COVER_GRADIENTS.length];
  const isReady = book.status === "ready";
  const isProcessing = book.status === "processing";
  const pct = progress?.completion_pct || 0;

  const handleOpen = () => {
    if (!isReady) return;
    router.push(`/reader/${book.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${book.title}"?`)) return;
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
      {/* Cover */}
      <div className="aspect-[3/4] mb-3 rounded-xl overflow-hidden relative bg-surface-high shadow-lg">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={cn("w-full h-full bg-gradient-to-b flex items-end p-4", gradient)}>
            <p className="font-headline italic text-lg text-white/90 leading-tight line-clamp-3">
              {book.title}
            </p>
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
          onClick={handleDelete}
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
      <div className="space-y-1">
        <h3
          className="font-headline text-[#dae2fd] text-base leading-tight line-clamp-2
                     group-hover:text-primary transition-colors"
        >
          {book.title}
        </h3>
        {book.author && (
          <p className="font-label text-[10px] uppercase tracking-widest text-outline">
            {book.author}
          </p>
        )}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-label text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded",
              FILE_TYPE_COLORS[book.file_type] || FILE_TYPE_COLORS.txt
            )}
          >
            {book.file_type}
          </span>
          {pct > 0 && pct < 95 && (
            <span className="font-label text-[9px] text-outline">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
