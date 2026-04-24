"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Settings, SkipForward } from "lucide-react";
import { useReaderStore } from "@/stores/readerStore";
import { useTTSSync } from "@/hooks/useTTSSync";

interface FloatingControlsProps {
  bookId: string;
  tts: ReturnType<typeof useTTSSync>;
  onNextPage: () => void;
  onPrevPage: () => void;
  voices: { id: string; name: string }[];
}

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

export function FloatingControls({ bookId, tts, onNextPage, onPrevPage, voices }: FloatingControlsProps) {
  const store = useReaderStore();
  const { play, pause, resume, seek } = tts;
  const [showSettings, setShowSettings] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(SPEEDS.indexOf(store.ttsSpeed) || 2);

  const togglePlay = () => {
    if (store.isPlaying) {
      pause();
    } else if (store.isPaused) {
      resume();
    } else {
      const paragraphs = store.pageData?.paragraphs ?? [];
      const startIdx = paragraphs.findIndex((p) => p.text.trim().length > 0);
      if (startIdx !== -1) play(paragraphs[startIdx].text, startIdx);
    }
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    store.setSpeed(SPEEDS[next]);
  };

  const progress = store.totalPages > 0 ? Math.round((store.currentPage / store.totalPages) * 100) : 0;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn("fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4", store.focusMode && "shell-hide")}
    >
      <div className="rounded-full bg-[#0A0A0A]/90 backdrop-blur-[24px] border border-white/10 shadow-[0_10px_50px_rgba(99,102,241,0.2)] overflow-hidden">
        {/* Progress bar */}
        <div className="h-[2px] w-full bg-white/5">
          <motion.div className="h-full bg-primary" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
        </div>

        <div className="px-8 py-3 flex items-center gap-8">
          {/* Page nav */}
          <div className="flex items-center gap-2">
            <button onClick={onPrevPage} disabled={store.currentPage <= 1} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-colors">
              <ChevronLeft size={16} className="text-zinc-400" />
            </button>
            <div className="text-center min-w-[52px]">
              <div className="font-label text-[10px] text-zinc-500 uppercase tracking-widest">Page</div>
              <div className="font-label text-sm font-semibold text-primary">{store.currentPage}/{store.totalPages}</div>
            </div>
            <button onClick={onNextPage} disabled={store.currentPage >= store.totalPages} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-colors">
              <ChevronRight size={16} className="text-zinc-400" />
            </button>
          </div>

          {/* Main controls */}
          <div className="flex items-center gap-6 flex-1 justify-center">
            <button onClick={() => seek(-5)} className="text-zinc-400 hover:text-white transition-transform active:scale-90 duration-150">
              <RotateCcw size={18} />
            </button>
            <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-[0_10px_20px_rgba(99,102,241,0.3)]">
              {store.isPlaying
                ? <Pause size={20} className="text-white" fill="currentColor" />
                : <Play  size={20} className="text-white ml-0.5" fill="currentColor" />}
            </button>
            <button onClick={() => seek(5)} className="text-zinc-400 hover:text-white transition-transform active:scale-90 duration-150">
              <SkipForward size={18} />
            </button>
          </div>

          {/* Speed + settings */}
          <div className="flex items-center gap-3">
            <button onClick={cycleSpeed} className="px-3 py-1.5 rounded-full border border-primary/30 font-label text-xs text-primary hover:bg-primary/10 transition-colors">
              {SPEEDS[speedIdx]}x
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="text-zinc-400 hover:text-white transition-colors">
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 overflow-hidden">
              <div className="px-8 py-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="font-label text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block">Voice</label>
                  <select value={store.voiceId} onChange={(e) => store.setVoice(e.target.value)} className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 font-label text-sm text-on-surface focus:outline-none focus:border-primary/50">
                    {/* Edge TTS — grouped by accent */}
                    {["American", "British", "Australian", "Indian", "Irish", "Canadian"].map((accent) => {
                      const group = (voices as any[]).filter((v) => v.provider === "edge" && v.accent === accent);
                      if (!group.length) return null;
                      return (
                        <optgroup key={accent} label={`🎙 ${accent} (Free)`}>
                          {group.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {v.name} {v.gender === "female" ? "♀" : "♂"}{v.style ? ` — ${v.style}` : ""}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                    {/* Premium providers */}
                    {["gemini", "openai"].map((prov) => {
                      const group = (voices as any[]).filter((v) => v.provider === prov);
                      if (!group.length) return null;
                      const label = prov === "gemini" ? "✨ Google Gemini" : "⚡ OpenAI";
                      return (
                        <optgroup key={prov} label={label}>
                          {group.map((v: any) => <option key={v.id} value={v.id}>{v.name}{v.accent ? ` (${v.accent})` : ""}</option>)}
                        </optgroup>
                      );
                    })}
                    {/* Browser fallback */}
                    {(voices as any[]).filter((v) => v.provider === "webspeech").length > 0 && (
                      <optgroup label="Browser (Offline)">
                        {(voices as any[]).filter((v) => v.provider === "webspeech").map((v: any) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div>
                  <label className="font-label text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block">Font size: {store.fontSize}px</label>
                  <input type="range" min={14} max={30} step={1} value={store.fontSize} onChange={(e) => store.setFontSize(Number(e.target.value))} className="w-full accent-primary mt-3" />
                </div>
                <div>
                  <label className="font-label text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block">Theme</label>
                  <div className="flex gap-2">
                    {(["dark", "sepia", "light"] as const).map((t) => (
                      <button key={t} onClick={() => store.setTheme(t)} className={cn("flex-1 py-1.5 rounded-lg font-label text-xs border transition-colors capitalize", store.theme === t ? "border-primary text-primary bg-primary/10" : "border-white/10 text-zinc-500 hover:border-primary/40")}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-label text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block">Accessibility</label>
                  <button onClick={store.toggleDyslexia} className={cn("w-full py-1.5 rounded-lg font-label text-xs border transition-colors", store.dyslexiaMode ? "border-primary text-primary bg-primary/10" : "border-white/10 text-zinc-500 hover:border-primary/40")}>
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
