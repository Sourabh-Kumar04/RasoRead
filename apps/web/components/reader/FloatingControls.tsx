"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Play, Pause, RotateCcw, ChevronLeft, ChevronRight, SkipForward, Settings, Mic2,
} from "lucide-react";
import { useReaderStore } from "@/stores/readerStore";
import { useTTSSync } from "@/hooks/useTTSSync";

interface FloatingControlsProps {
  tts: ReturnType<typeof useTTSSync>;
  onNextPage: () => void;
  onPrevPage: () => void;
  voices: {
    id: string;
    name: string;
    provider?: string;
    accent?: string;
    gender?: string;
    style?: string;
  }[];
}

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

export function FloatingControls({ tts, onNextPage, onPrevPage, voices }: FloatingControlsProps) {
  const store = useReaderStore();
  const { play, pause, resume, seek } = tts;
  const [showSettings, setShowSettings] = useState(false);
  const speedIdx = Math.max(0, SPEEDS.indexOf(store.ttsSpeed));

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
    store.setSpeed(SPEEDS[next]);
  };

  const progress = store.totalPages > 0 ? Math.round((store.currentPage / store.totalPages) * 100) : 0;

  return (
    <div className={cn("w-full transition-all duration-500", store.focusMode && "opacity-20 hover:opacity-100")}>
      {/* Drag handle indicator */}
      <div className="w-full flex justify-center pb-3 opacity-20 group-hover:opacity-60 transition-opacity">
        <div className="w-12 h-1 rounded-full bg-white" />
      </div>

      {/* Main pill control bar */}
      <div className="bg-[#050505]/80 backdrop-blur-3xl rounded-[2rem] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-visible relative">
        {/* Book progress line */}
        <div className="absolute top-0 left-0 h-[3px] w-full bg-white/[0.03] rounded-t-full overflow-hidden">
          <motion.div
            className="h-full bg-primary shadow-[0_0_15px_rgba(129,140,248,0.5)]"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>

        <div className="flex items-center gap-6 md:gap-10 px-6 md:px-10 py-4">
          {/* Metadata Section */}
          <div className="hidden lg:flex items-center gap-5 border-r border-white/5 pr-8">
            <div className="audio-wave">
              {[12, 16, 8, 14, 10, 16, 6].map((h, i) => (
                <motion.span
                  key={i}
                  animate={{ height: store.isPlaying ? [`${h}px`, `${h*1.5}px`, `${h}px`] : "4px" }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                />
              ))}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-none mb-1">Live Feed</span>
              <p className="text-sm font-semibold text-primary truncate max-w-[120px] tracking-tight">{store.bookTitle || "Loading..."}</p>
            </div>
          </div>

          {/* Page Controls */}
          <div className="flex items-center gap-3">
            <button onClick={onPrevPage} disabled={store.currentPage <= 1} className="p-2 rounded-xl hover:bg-white/5 disabled:opacity-20 transition-all active:scale-90">
              <ChevronLeft size={18} className="text-zinc-400" />
            </button>
            <div className="flex flex-col items-center min-w-[50px]">
               <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Page</span>
               <span className="text-sm font-bold text-white tracking-tighter">{store.currentPage}<span className="text-zinc-500 mx-0.5">/</span>{store.totalPages}</span>
            </div>
            <button onClick={onNextPage} disabled={store.currentPage >= store.totalPages} className="p-2 rounded-xl hover:bg-white/5 disabled:opacity-20 transition-all active:scale-90">
              <ChevronRight size={18} className="text-zinc-400" />
            </button>
          </div>

          {/* Core Controls */}
          <div className="flex items-center gap-6 md:gap-8">
            <button onClick={() => seek(-15)} className="text-zinc-600 hover:text-white transition-all active:scale-90">
              <RotateCcw size={20} />
            </button>
            
            <motion.button
              onClick={togglePlay}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-[0_8px_32px_rgba(129,140,248,0.4)] border border-white/20 relative group/btn"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity rounded-2xl" />
              {store.isPlaying
                ? <Pause size={24} className="text-white" fill="currentColor" />
                : <Play size={24} className="text-white ml-1" fill="currentColor" />}
            </motion.button>

            <button onClick={() => seek(15)} className="text-zinc-600 hover:text-white transition-all active:scale-90">
              <SkipForward size={20} />
            </button>
          </div>

          {/* Auxiliary Controls */}
          <div className="flex items-center gap-4 border-l border-white/5 pl-8 md:pl-10">
            <button onClick={cycleSpeed} className="flex flex-col items-center gap-1 group/item">
              <span className="text-[10px] font-bold text-zinc-600 group-hover/item:text-primary transition-colors uppercase tracking-widest">Speed</span>
              <span className="text-xs font-bold text-white bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 group-hover/item:border-primary/30 transition-all">{SPEEDS[speedIdx]}x</span>
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn("p-3 rounded-2xl transition-all", showSettings ? "bg-primary/20 text-primary border border-primary/30 shadow-[0_0_20px_rgba(129,140,248,0.2)]" : "text-zinc-600 hover:text-white bg-white/5 border border-transparent")}
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Settings expansion */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/5"
            >
              <div className="px-10 py-8 grid grid-cols-2 gap-8 bg-black/40">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI Narrator</label>
                  <div className="relative">
                    <select
                      value={store.voiceId}
                      onChange={(e) => store.setVoice(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
                    >
                      {["American", "British", "Australian", "Indian", "Irish", "Canadian"].map((accent) => {
                        const group = (voices as any[]).filter((v) => v.provider === "edge" && v.accent === accent);
                        if (!group.length) return null;
                        return (
                          <optgroup key={accent} label={`🎙 ${accent}`}>
                            {group.map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {v.name} {v.gender === "female" ? "♀" : "♂"}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                      {["gemini", "openai"].map((prov) => {
                        const group = (voices as any[]).filter((v) => v.provider === prov);
                        if (!group.length) return null;
                        return (
                          <optgroup key={prov} label={prov === "gemini" ? "✨ Gemini" : "⚡ OpenAI"}>
                            {group.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </optgroup>
                        );
                      })}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                       <ChevronRight size={14} className="rotate-90" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Typography Scale: {store.fontSize}px</label>
                  <input type="range" min={14} max={26} step={1} value={store.fontSize} onChange={(e) => store.setFontSize(Number(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-full appearance-none accent-primary cursor-pointer" />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Interface Theme</label>
                  <div className="flex gap-3">
                    {(["dark", "sepia", "light"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => store.setTheme(t)}
                        className={cn("flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all", store.theme === t ? "border-primary text-primary bg-primary/10 shadow-[0_0_15px_rgba(129,140,248,0.15)]" : "border-white/5 text-zinc-600 hover:border-white/20")}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Accessibility</label>
                  <button
                    onClick={store.toggleDyslexia}
                    className={cn("w-full py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all", store.dyslexiaMode ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" : "border-white/5 text-zinc-600 hover:border-white/20")}
                  >
                    {store.dyslexiaMode ? "Dyslexia Support ON" : "Standard Type"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
