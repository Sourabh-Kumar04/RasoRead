"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Highlighter, StickyNote, Copy, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface HighlightMenuProps {
  onHighlight: (color: string, text: string, range: Range) => void;
  onNote: (text: string, range: Range) => void;
  onAskAI: (text: string) => void;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
}

const COLORS = [
  { id: "primary", label: "Purple", cls: "bg-primary/60" },
  { id: "yellow",  label: "Yellow", cls: "bg-amber-400/60" },
  { id: "green",   label: "Green",  cls: "bg-emerald-400/60" },
  { id: "red",     label: "Red",    cls: "bg-red-400/60" },
];

export function HighlightMenu({ onHighlight, onNote, onAskAI, onMenuOpen, onMenuClose }: HighlightMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [savedRange, setSavedRange] = useState<Range | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setVisible(false);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) { setVisible(false); return; }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Position menu above the selection, centered
    const x = rect.left + rect.width / 2;
    const y = rect.top + window.scrollY - 12;

    setSelectedText(text);
    setSavedRange(range.cloneRange());
    setPosition({ x, y });
    setVisible(true);
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleSelectionChange);
    document.addEventListener("touchend", handleSelectionChange);
    return () => {
      document.removeEventListener("mouseup", handleSelectionChange);
      document.removeEventListener("touchend", handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // Close when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Notify parent of menu visibility changes
  useEffect(() => {
    if (visible) onMenuOpen?.();
    else onMenuClose?.();
  }, [visible, onMenuOpen, onMenuClose]);

  const handleHighlight = (colorId: string) => {
    if (!savedRange) return;
    onHighlight(colorId, selectedText, savedRange);
    window.getSelection()?.removeAllRanges();
    setVisible(false);
  };

  const handleNote = () => {
    if (!savedRange) return;
    onNote(selectedText, savedRange);
    setVisible(false);
  };

  const handleAskAI = () => {
    onAskAI(selectedText);
    setVisible(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: 6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.95 }}
          transition={{ duration: 0.12 }}
          style={{
            position: "absolute",
            left: position.x,
            top: position.y,
            transform: "translate(-50%, -100%)",
            zIndex: 9999,
          }}
          className="flex items-center gap-1 px-2 py-2 rounded-2xl
                     bg-zinc-900/95 border border-white/10
                     shadow-2xl backdrop-blur-xl"
        >
          {/* Ask AI */}
          <button
            onClick={handleAskAI}
            title="Ask AI about this"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-primary/20 text-primary transition-all group"
          >
            <Sparkles size={14} className="group-hover:scale-110 transition-transform" />
            <span className="font-label text-[10px] font-semibold uppercase tracking-wider">Ask AI</span>
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Color swatches */}
          <div className="flex items-center gap-1.5 px-1">
            {COLORS.map((c) => (
              <button
                key={c.id}
                title={`Highlight ${c.label}`}
                onClick={() => handleHighlight(c.id)}
                className={cn(
                  "w-5 h-5 rounded-full border border-white/10 hover:scale-125 transition-transform",
                  c.cls
                )}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Note */}
          <button
            onClick={handleNote}
            title="Add note"
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <StickyNote size={14} />
          </button>

          {/* Copy */}
          <button
            onClick={handleCopy}
            title="Copy text"
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <Copy size={14} />
          </button>

          {/* Dismiss */}
          <button
            onClick={() => setVisible(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-outline transition-colors"
          >
            <X size={12} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
