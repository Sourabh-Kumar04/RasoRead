"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw,
  ChevronLeft, ChevronRight, Volume2, Settings, Mic,
} from "lucide-react";
import { useReaderStore } from "@/stores/readerStore";
import { useTTSSync } from "@/hooks/useTTSSync";

interface FloatingControlsProps {
  bookId: string;
  onNextPage: () => void;
  onPrevPage: () => void;
  voices: { id: string; name: string }[];
}

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

export function FloatingControls({
  bookId,
  onNextPage,
  onPrevPage,
  voices,
}: FloatingControlsProps) {
  const store = useReaderStore();
  const { pause, resume, stop, seek } = useTTSSync();
  const [showSettings, setShowSettings] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(SPEEDS.indexOf(store.ttsSpeed) || 2);

  const togglePlay = () => {
    if (store.isPlaying) {
      pause();
    } else if (store.isPaused) {
      resume();
    }
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    store.setSpeed(SPEEDS[next]);
  };

  const progress =
    store.totalPages > 0
      ? Math.round((store.currentPage / store.totalPages) * 100)
      : 0;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4",
        store.focusMode && "shell-hide"
      )}
    >
      <div className="glass bg-surface-bright/80 rounded-3xl border border-outline-variant/20 shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 w-full bg-surface-highest">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <div className="px-5 py-4 flex items-center justify-between gap-4">
          {/* Page info */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onPrevPage}
              disabled={store.currentPage <= 1}
              className="p-2 rounded-xl hover:bg-white/5 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={18} className="text-secondary" />
            </button>
            <div className="text-center">
              <div className="font-label text-xs text-outline">Page</div>
              <div className="font-label text-sm font-semibold text-primary">
                {store.currentPage} / {store.totalPages}
              </div>
            </div>
            <button
              onClick={onNextPage}
              disabled={store.currentPage >= store.totalPages}
              className="p-2 rounded-xl hover:bg-white/5 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={18} className="text-secondary" />
            </button>
          </div>

          {/* Main controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => seek(-5)}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <RotateCcw size={18} className="text-secondary" />
            </button>

            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-primary flex items-center justify-center
                         hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              {store.isPlaying ? (
                <Pause size={20} className="text-[#0f0069]" fill="currentColor" />
              ) : (
                <Play size={20} className="text-[#0f0069] ml-0.5" fill="currentColor" />
              )}
            </button>

            <button
              onClick={() => seek(5)}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <SkipForward size={18} className="text-secondary" />
            </button>
          </div>

          {/* Speed + Settings */}
          <div className="flex items-center gap-2">
            <button
              onClick={cycleSpeed}
              className="px-3 py-1.5 rounded-full bg-surface-highest border border-outline-variant/20
                         font-label text-xs text-primary hover:bg-surface-bright transition-colors"
            >
              {SPEEDS[speedIdx]}x
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <Settings size={18} className="text-secondary" />
            </button>
          </div>
        </div>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-outline-variant/20 overflow-hidden"
            >
              <div className="px-5 py-4 grid grid-cols-2 gap-4">
                {/* Voice selector */}
                <div>
                  <label className="font-label text-xs text-outline uppercase tracking-widest mb-2 block">
                    Voice
                  </label>
                  <select
                    value={store.voiceId}
                    onChange={(e) => store.setVoice(e.target.value)}
                    className="w-full bg-surface-highest border border-outline-variant/20 rounded-lg
                               px-3 py-2 font-label text-sm text-[#dae2fd] focus:outline-none focus:border-primary/50"
                  >
                    {/* Group voices by provider */}
                    {["gemini", "openai", "webspeech"].map((prov) => {
                      const group = voices.filter((v: any) => v.provider === prov || (!v.provider && prov === "openai"));
                      if (!group.length) return null;
                      const label = prov === "gemini" ? "Google Gemini" : prov === "openai" ? "OpenAI" : "Browser";
                      return (
                        <optgroup key={prov} label={label}>
                          {group.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {v.name} {v.accent ? `(${v.accent})` : ""}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                {/* Font size */}
                <div>
                  <label className="font-label text-xs text-outline uppercase tracking-widest mb-2 block">
                    Font size: {store.fontSize}px
                  </label>
                  <input
                    type="range"
                    min={14}
                    max={30}
                    step={1}
                    value={store.fontSize}
                    onChange={(e) => store.setFontSize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                {/* Theme */}
                <div>
                  <label className="font-label text-xs text-outline uppercase tracking-widest mb-2 block">
                    Theme
                  </label>
                  <div className="flex gap-2">
                    {(["dark", "sepia", "light"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => store.setTheme(t)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg font-label text-xs border transition-colors capitalize",
                          store.theme === t
                            ? "border-primary text-primary bg-primary/10"
                            : "border-outline-variant/30 text-outline hover:border-primary/30"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dyslexia mode */}
                <div>
                  <label className="font-label text-xs text-outline uppercase tracking-widest mb-2 block">
                    Accessibility
                  </label>
                  <button
                    onClick={store.toggleDyslexia}
                    className={cn(
                      "w-full py-1.5 rounded-lg font-label text-xs border transition-colors",
                      store.dyslexiaMode
                        ? "border-primary text-primary bg-primary/10"
                        : "border-outline-variant/30 text-outline hover:border-primary/30"
                    )}
                  >
                    {store.dyslexiaMode ? "Dyslexia font ON" : "Dyslexia font OFF"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
