"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Brain, Loader2 } from "lucide-react";
import { aiApi } from "@/lib/api";

interface ImageModalProps {
  imageB64: string | null;
  format?: string;
  figureIndex?: number;
  bookId: string;
  onClose: () => void;
}

export function ImageModal({
  imageB64,
  format = "png",
  figureIndex,
  bookId,
  onClose,
}: ImageModalProps) {
  const [description, setDescription] = useState<string | null>(null);
  const [descLoading, setDescLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const loadDescription = async () => {
    if (!imageB64 || descLoading || description) return;
    setDescLoading(true);
    try {
      const res = await aiApi.describeImage(bookId, imageB64);
      setDescription(res.data.content);
    } catch {
      setDescription("Could not generate description.");
    } finally {
      setDescLoading(false);
    }
  };

  const downloadImage = () => {
    if (!imageB64) return;
    const link = document.createElement("a");
    link.href = `data:image/${format};base64,${imageB64}`;
    link.download = `figure-${(figureIndex ?? 0) + 1}.${format}`;
    link.click();
  };

  return (
    <AnimatePresence>
      {imageB64 && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ minHeight: "100dvh" }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="relative z-10 w-full max-w-3xl bg-surface-mid rounded-3xl
                       border border-outline-variant/20 shadow-2xl overflow-hidden"
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant/20">
              <p className="font-label text-sm text-secondary">
                {figureIndex !== undefined ? `Figure ${figureIndex + 1}` : "Image"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadDescription}
                  disabled={descLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                             border border-outline-variant/20 hover:border-primary/30
                             font-label text-xs text-secondary hover:text-primary
                             disabled:opacity-50 transition-colors"
                >
                  {descLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Brain size={12} />
                  )}
                  AI Description
                </button>
                <button
                  onClick={downloadImage}
                  className="p-2 rounded-lg hover:bg-white/5 text-secondary transition-colors"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 text-outline transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Image */}
            <div className="bg-surface-lowest flex items-center justify-center p-4 max-h-[60vh] overflow-auto">
              <img
                src={`data:image/${format};base64,${imageB64}`}
                alt={`Figure ${(figureIndex ?? 0) + 1}`}
                className="max-w-full max-h-full object-contain rounded-xl"
              />
            </div>

            {/* AI Description */}
            {description && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="px-5 py-4 border-t border-outline-variant/20"
              >
                <p className="font-label text-[10px] uppercase tracking-widest text-primary mb-2">
                  AI Description
                </p>
                <p className="font-body text-sm text-[#dae2fd] leading-relaxed">
                  {description}
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
