"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Play, Pause, ChevronLeft, ChevronRight, SkipForward, SkipBack,
  Settings2, ChevronDown, Moon, Clock, X,
} from "lucide-react";
import { useReaderStore } from "@/stores/readerStore";
import { useTTSSync } from "@/hooks/useTTSSync";
import { useEffect } from "react";

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
const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60, 90];

export function FloatingControls({ tts, onNextPage, onPrevPage, voices }: FloatingControlsProps) {
  const store = useReaderStore();
  const { play, pause, resume, seek } = tts;
  const [showSettings, setShowSettings] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);

  // Timer countdown effect
  useEffect(() => {
    if (!store.sleepTimerEndTime) {
      setTimerRemaining(null);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((store.sleepTimerEndTime! - Date.now()) / 1000));
      setTimerRemaining(remaining);
      if (remaining === 0) {
        pause();
        store.clearSleepTimer();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [store.sleepTimerEndTime, pause, store]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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

  // cycleSpeed removed, now we have a dropdown

  const progress = store.totalPages > 0
    ? Math.round((store.currentPage / store.totalPages) * 100)
    : 0;

  return (
    <div className={cn(
      "w-full transition-all duration-300",
      store.focusMode && "opacity-10 hover:opacity-100"
    )}>
      {/* ── Main bar ───────────────────────────────────────────────── */}
      <div className="relative bg-[#111111]/95 backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.7)]">

        {/* Progress stripe */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-white/[0.04] rounded-t-2xl overflow-hidden">
          <motion.div
            className="h-full bg-indigo-500"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        <div className="flex items-center h-[64px] px-4 gap-0">

          {/* Book title — desktop */}
          <div className="hidden lg:flex items-center gap-3 min-w-0 w-[180px] shrink-0 border-r border-white/[0.06] pr-4 mr-4">
            {/* Waveform */}
            <div className="flex items-center gap-px shrink-0">
              {[10, 16, 8, 14, 6].map((h, i) => (
                <motion.div
                  key={i}
                  className="w-[2px] rounded-full bg-indigo-400"
                  animate={{
                    height: store.isPlaying
                      ? [`${h}px`, `${h * 1.6}px`, `${h}px`]
                      : "3px",
                    opacity: store.isPlaying ? 1 : 0.3,
                  }}
                  transition={{ repeat: Infinity, duration: 0.9 + i * 0.1, delay: i * 0.08 }}
                />
              ))}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-white truncate leading-tight">
                {store.bookTitle || "—"}
              </p>
              <p className="text-[10px] text-zinc-600 leading-tight">
                pg {store.currentPage} / {store.totalPages}
              </p>
            </div>
          </div>

          {/* ── Page nav ─────────────────────────────────────────── */}
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={onPrevPage}
              disabled={store.currentPage <= 1}
              className="p-2 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-all active:scale-90 text-zinc-400 hover:text-white"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page indicator — mobile */}
            <span className="text-xs font-semibold text-zinc-500 min-w-[52px] text-center tabular-nums">
              {store.currentPage}<span className="text-zinc-700 mx-0.5">/</span>{store.totalPages}
            </span>

            <button
              onClick={onNextPage}
              disabled={store.currentPage >= store.totalPages}
              className="p-2 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 transition-all active:scale-90 text-zinc-400 hover:text-white"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* ── TTS controls ─────────────────────────────────────── */}
          <div className="flex items-center gap-1 mx-auto">
            <button
              onClick={() => seek(-15)}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all active:scale-90"
              aria-label="Back 15s"
            >
              <SkipBack size={16} />
            </button>

            <motion.button
              onClick={togglePlay}
              whileTap={{ scale: 0.93 }}
              className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center mx-1 shadow-[0_0_20px_rgba(99,102,241,0.35)] transition-colors"
              aria-label={store.isPlaying ? "Pause" : "Play"}
            >
              {store.isPlaying
                ? <Pause size={18} className="text-white" fill="currentColor" />
                : <Play size={18} className="text-white ml-0.5" fill="currentColor" />
              }
            </motion.button>

            <button
              onClick={() => seek(15)}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all active:scale-90"
              aria-label="Forward 15s"
            >
              <SkipForward size={16} />
            </button>
          </div>

          {/* ── Speed + Settings ─────────────────────────────────── */}
          <div className="flex items-center gap-1 ml-2 relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className={cn(
                "h-8 px-2.5 rounded-lg text-xs font-semibold transition-all tabular-nums",
                showSpeedMenu ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              )}
              aria-label="Change speed"
            >
              {store.ttsSpeed}×
            </button>

            <AnimatePresence>
              {showSpeedMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setShowSpeedMenu(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full mb-2 left-0 w-[4.5rem] py-1.5 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] z-50 flex flex-col"
                  >
                    {SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => {
                          store.setSpeed(speed);
                          setShowSpeedMenu(false);
                        }}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium text-left transition-colors",
                          speed === store.ttsSpeed
                            ? "text-indigo-400 bg-indigo-500/10"
                            : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                        )}
                      >
                        {speed}×
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-2 rounded-lg transition-all",
                showSettings
                  ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25"
                  : "text-zinc-500 hover:text-white hover:bg-white/[0.06]"
              )}
              aria-label="Settings"
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>

        {/* ── Settings panel ──────────────────────────────────────── */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/[0.06]"
            >
              <div className="grid grid-cols-2 gap-6 p-5">

                <div className="space-y-2 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                    AI Provider
                  </label>
                  <div className="relative">
                    <select
                      value={store.ttsProvider}
                      onChange={(e) => {
                        const prov = e.target.value;
                        store.setProvider(prov);
                        // Save to backend immediately
                        if (store.bookId) {
                          import("@/lib/api").then((m) => {
                            m.readerApi.saveSettings(store.bookId!, { tts_provider: prov }).catch(() => {});
                          });
                        }
                      }}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-indigo-500/50 appearance-none"
                    >
                      <option value="edge">Edge TTS (Free)</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI</option>
                      <option value="elevenlabs">ElevenLabs</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                {/* Voice selector */}
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                    Narrator voice
                  </label>
                  <div className="relative">
                    <select
                      value={store.voiceId}
                      onChange={(e) => store.setVoice(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-indigo-500/50 appearance-none"
                    >
                      {["American", "British", "Australian", "Indian", "Irish", "Canadian"].map((accent) => {
                        const group = (voices as any[]).filter((v) => v.provider === "edge" && v.accent === accent);
                        if (!group.length) return null;
                        return (
                          <optgroup key={accent} label={accent}>
                            {group.map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {v.name} {v.gender === "female" ? "F" : "M"}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                      {["gemini", "openai"].map((prov) => {
                        const group = (voices as any[]).filter((v) => v.provider === prov);
                        if (!group.length) return null;
                        return (
                          <optgroup key={prov} label={prov === "gemini" ? "Gemini" : "OpenAI"}>
                            {group.map((v: any) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                {/* Font size */}
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                    Font size — {store.fontSize}px
                  </label>
                  <input
                    type="range"
                    min={14} max={26} step={1}
                    value={store.fontSize}
                    onChange={(e) => store.setFontSize(Number(e.target.value))}
                    className="w-full h-1 rounded-full appearance-none accent-indigo-500"
                  />
                </div>

                {/* Theme */}
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Theme</label>
                  <div className="flex gap-2">
                    {(["dark", "sepia", "light"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => store.setTheme(t)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[10px] font-semibold capitalize border transition-all",
                          store.theme === t
                            ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                            : "border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/15"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* View mode + dyslexia */}
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Display</label>
                  <div className="flex gap-2">
                    <button
                      onClick={store.toggleViewMode}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-all",
                        store.viewMode === "original"
                          ? "border-indigo-500/50 text-indigo-400 bg-indigo-500/10"
                          : "border-white/[0.06] text-zinc-500 hover:border-white/15 hover:text-zinc-300"
                      )}
                    >
                      {store.viewMode === "original" ? "Real page" : "Text mode"}
                    </button>
                    <button
                      onClick={store.toggleDyslexia}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-semibold border transition-all",
                        store.dyslexiaMode
                          ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                          : "border-white/[0.06] text-zinc-500 hover:border-white/15 hover:text-zinc-300"
                      )}
                    >
                      {store.dyslexiaMode ? "Dyslexia on" : "Standard"}
                    </button>
                  </div>
                </div>

                {/* Sleep Timer */}
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                    Sleep Timer
                  </label>
                  <div className="flex items-center gap-2">
                    {store.sleepTimerMinutes ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                        <Moon size={14} className="text-indigo-400" />
                        <span className="text-xs font-medium text-indigo-300">
                          {timerRemaining !== null ? formatTime(timerRemaining) : `${store.sleepTimerMinutes} min`}
                        </span>
                        <button
                          onClick={() => store.clearSleepTimer()}
                          className="p-1 hover:bg-indigo-500/20 rounded"
                        >
                          <X size={12} className="text-indigo-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {SLEEP_TIMER_OPTIONS.map((mins) => (
                          <button
                            key={mins}
                            onClick={() => store.setSleepTimer(mins)}
                            className="px-3 py-1.5 text-xs font-medium bg-white/[0.04] border border-white/10 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all"
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
