"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  X, FileText, Image, Brain, BarChart2,
  Mic, MicOff, Plus, Trash2, Loader2, Send, Download, Sparkles, Share2,
} from "lucide-react";
import { useReaderStore } from "@/stores/readerStore";
import { notesApi, aiApi, analyticsApi } from "@/lib/api";
import { AIProviderPanel } from "@/components/ui/AIProviderPanel";
import { toast } from "@/components/ui/Toast";

interface SmartPanelProps {
  bookId: string;
}

const TABS = [
  { id: "notes",     label: "Notes",    icon: FileText  },
  { id: "ai",        label: "AI",       icon: Brain     },
  { id: "images",    label: "Images",   icon: Image     },
  { id: "analytics", label: "Stats",    icon: BarChart2 },
] as const;

// ── Voice capture helper ──────────────────────────────────────────────────────
function useVoiceCapture() {
  const [listening, setListening] = useState(false);

  const capture = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) { reject(new Error("Speech recognition not supported")); return; }
      const rec = new SR();
      rec.interimResults = false;
      rec.lang = "en-US";
      setListening(true);
      rec.onresult = (e: any) => { setListening(false); resolve(e.results[0][0].transcript); };
      rec.onerror  = () => { setListening(false); reject(new Error("Voice capture failed")); };
      rec.onend    = () => setListening(false);
      rec.start();
    });
  };

  return { capture, listening };
}

export function SmartPanel({ bookId }: SmartPanelProps) {
  const store = useReaderStore();
  const voice = useVoiceCapture();

  const [notes,           setNotes]           = useState<any[]>([]);
  const [highlights,      setHighlights]      = useState<any[]>([]);
  const [aiQuestion,      setAiQuestion]      = useState("");
  const [aiAnswer,        setAiAnswer]        = useState("");
  const [aiLoading,       setAiLoading]       = useState(false);
  const [summary,         setSummary]         = useState<{ summary: string; key_points: string[] } | null>(null);
  const [summaryLoading,  setSummaryLoading]  = useState(false);
  const [analytics,       setAnalytics]       = useState<any>(null);
  const [noteInput,       setNoteInput]       = useState("");
  const [addingNote,      setAddingNote]      = useState(false);
  const [voiceNoteActive, setVoiceNoteActive] = useState(false);
  const aiInputRef = useRef<HTMLInputElement>(null);

  // Load data when panel opens or tab changes
  useEffect(() => {
    if (!store.showSmartPanel) return;
    loadNotes();
    loadHighlights();
    if (store.smartPanelTab === "analytics") loadAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.showSmartPanel, store.smartPanelTab, bookId]);

  // Consume pending AI question from store (set by HighlightMenu "Ask AI")
  useEffect(() => {
    if (store.aiQuestion && store.smartPanelTab === "ai") {
      setAiQuestion(store.aiQuestion);
      store.setAiQuestion("");
      setTimeout(() => aiInputRef.current?.focus(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.aiQuestion, store.smartPanelTab]);

  // Auto-summarise when switching to AI tab if no summary yet
  useEffect(() => {
    if (store.smartPanelTab === "ai" && !summary && !summaryLoading && store.pageData) {
      summarizePage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.smartPanelTab]);

  const loadNotes = async () => {
    try { const r = await notesApi.listNotes(bookId); setNotes(r.data); } catch {}
  };

  const loadHighlights = async () => {
    try {
      const r = await notesApi.listHighlights(bookId);
      setHighlights(r.data);
      store.setHighlights(r.data);
    } catch {}
  };

  const loadAnalytics = async () => {
    try { const r = await analyticsApi.summary(); setAnalytics(r.data); } catch {}
  };

  // ── Notes ─────────────────────────────────────────────────────────────────

  const addNote = async (content: string, source: "typed" | "voice" = "typed") => {
    if (!content.trim()) return;
    try {
      const r = await notesApi.createNote({ book_id: bookId, content, source, page: store.currentPage });
      setNotes((p) => [r.data, ...p]);
      setNoteInput("");
      setAddingNote(false);
      toast.success(source === "voice" ? "Voice note saved" : "Note saved");
    } catch { toast.error("Could not save note"); }
  };

  const addVoiceNote = async () => {
    setVoiceNoteActive(true);
    try {
      const text = await voice.capture();
      await addNote(text, "voice");
    } catch { toast.error("Voice capture failed"); }
    finally { setVoiceNoteActive(false); }
  };

  const deleteNote = async (id: string) => {
    try { await notesApi.deleteNote(id); setNotes((p) => p.filter((n) => n.id !== id)); } catch {}
  };

  // ── Highlights ────────────────────────────────────────────────────────────

  const deleteHighlight = async (id: string) => {
    try {
      await notesApi.deleteHighlight(id);
      setHighlights((p) => p.filter((h) => h.id !== id));
      store.removeHighlight(id);
    } catch {}
  };

  const exportHighlights = () => {
    const lines = [
      `# Highlights — ${store.bookTitle}`,
      `*Exported from RasoRead on ${new Date().toLocaleDateString()}*`,
      "",
      ...highlights.map((h) => `> ${h.text}\n> — Page ${h.page}\n`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `${store.bookTitle.replace(/[^a-z0-9]/gi, "_")}_highlights.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareHighlight = (h: any) => {
    const url = `${window.location.origin}/share/${h.id}`;
    navigator.clipboard?.writeText(url);
    toast.success("Share link copied");
  };

  // ── AI ────────────────────────────────────────────────────────────────────

  const summarizePage = async () => {
    if (!store.pageData || summaryLoading) return;
    setSummaryLoading(true);
    setSummary(null);
    try {
      const text = store.pageData.paragraphs.map((p) => p.text).join("\n\n");
      const r = await aiApi.summarize(bookId, text);
      setSummary(JSON.parse(r.data.content));
    } catch { setSummary(null); }
    finally { setSummaryLoading(false); }
  };

  const askAI = async (question?: string) => {
    const q = question ?? aiQuestion;
    if (!q.trim() || aiLoading) return;
    setAiLoading(true);
    setAiAnswer("");
    try {
      const r = await aiApi.ask(bookId, q);
      setAiAnswer(r.data.content);
      if (!question) setAiQuestion("");
    } catch { setAiAnswer("Could not reach AI. The book may still be indexing."); }
    finally { setAiLoading(false); }
  };

  // Voice Q&A — user speaks a question
  const voiceAskAI = async () => {
    try {
      const question = await voice.capture();
      setAiQuestion(question);
      await askAI(question);
    } catch { toast.error("Voice capture failed"); }
  };

  if (!store.showSmartPanel) return null;

  const pageHighlights = highlights.filter((h) => h.page === store.currentPage);

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="flex flex-col h-full bg-[#0d0d0d]/95 backdrop-blur-2xl border-l border-white/[0.08]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <span className="font-headline italic text-base text-white">Smart Panel</span>
        <button onClick={() => store.toggleSmartPanel()} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <X size={16} className="text-zinc-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => store.toggleSmartPanel(id as any)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 font-label text-[10px] uppercase tracking-widest transition-colors",
              store.smartPanelTab === id
                ? "text-primary border-b-2 border-primary"
                : "text-zinc-600 hover:text-zinc-400"
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ── NOTES TAB ─────────────────────────────────────────────────── */}
          {store.smartPanelTab === "notes" && (
            <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-5">

              {/* Add note controls */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAddingNote(!addingNote)}
                  className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] hover:border-primary/30 text-sm font-label text-zinc-500 hover:text-primary transition-colors"
                >
                  <Plus size={13} />
                  Add note
                </button>
                <button
                  onClick={addVoiceNote}
                  disabled={voiceNoteActive || voice.listening}
                  className={cn(
                    "p-2 rounded-lg border transition-colors",
                    voiceNoteActive || voice.listening
                      ? "border-red-500/40 bg-red-500/10 text-red-400 animate-pulse"
                      : "border-white/[0.08] hover:border-primary/30 text-zinc-500 hover:text-primary"
                  )}
                  title="Voice note"
                >
                  {voiceNoteActive || voice.listening ? <MicOff size={13} /> : <Mic size={13} />}
                </button>
              </div>

              {addingNote && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="space-y-2">
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Write your note…"
                    rows={3}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-label text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-primary/40"
                    onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) addNote(noteInput); }}
                  />
                  <button onClick={() => addNote(noteInput)} className="w-full py-2 rounded-lg bg-primary text-on-primary font-label text-xs font-semibold hover:brightness-110 transition-all">
                    Save (⌘↵)
                  </button>
                </motion.div>
              )}

              {/* Page highlights */}
              {pageHighlights.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-label text-[10px] uppercase tracking-widest text-zinc-600">
                      Page {store.currentPage} highlights ({pageHighlights.length})
                    </span>
                    <button onClick={exportHighlights} className="flex items-center gap-1 font-label text-[10px] text-primary hover:brightness-125 transition-all uppercase tracking-widest">
                      <Download size={10} /> Export all
                    </button>
                  </div>
                  {pageHighlights.map((h) => (
                    <div key={h.id} className="group relative p-3 rounded-lg bg-primary/5 border border-primary/15 hover:border-primary/30 transition-all">
                      <p className="text-sm font-label text-zinc-300 leading-relaxed italic pr-14">"{h.text}"</p>
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => shareHighlight(h)} className="p-1 rounded hover:bg-white/10 transition-all" title="Copy share link">
                          <Share2 size={11} className="text-zinc-500" />
                        </button>
                        <button onClick={() => deleteHighlight(h.id)} className="p-1 rounded hover:bg-white/10 transition-all">
                          <Trash2 size={11} className="text-zinc-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All notes */}
              <div className="space-y-3">
                <span className="font-label text-[10px] uppercase tracking-widest text-zinc-600">Notes</span>
                {notes.length === 0 ? (
                  <p className="text-sm font-label text-zinc-600 text-center py-8 italic">
                    No notes yet. Double-tap text to start reading, then add notes here.
                  </p>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="group relative p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-all">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-label text-[10px] text-zinc-600 uppercase tracking-widest">Page {note.page}</span>
                        {note.source === "voice" && (
                          <span className="font-label text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-widest">Voice</span>
                        )}
                      </div>
                      <p className="text-sm font-label text-zinc-300 leading-relaxed">{note.content}</p>
                      <button onClick={() => deleteNote(note.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all">
                        <Trash2 size={11} className="text-zinc-500" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* ── AI TAB ────────────────────────────────────────────────────── */}
          {store.smartPanelTab === "ai" && (
            <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-4">

              {/* Summarise button */}
              <div className="flex gap-2">
                <button
                  onClick={summarizePage}
                  disabled={summaryLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/30 text-primary font-label text-sm hover:bg-primary/5 disabled:opacity-50 transition-colors"
                >
                  {summaryLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Summarise this page
                </button>
              </div>

              {/* Summary result */}
              {summaryLoading && (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Loader2 size={18} className="animate-spin text-primary" />
                  <span className="font-label text-sm text-zinc-500">Analysing page…</span>
                </div>
              )}

              {summary && !summaryLoading && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="font-label text-[10px] uppercase tracking-widest text-primary block mb-2">Summary</span>
                    <p className="text-sm font-label text-zinc-300 leading-relaxed">{summary.summary}</p>
                  </div>
                  {summary.key_points.length > 0 && (
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <span className="font-label text-[10px] uppercase tracking-widest text-primary block mb-2">Key points</span>
                      <ul className="space-y-2">
                        {summary.key_points.map((pt, i) => (
                          <li key={i} className="flex gap-2 text-sm font-label text-zinc-400">
                            <span className="text-primary mt-1 shrink-0">•</span>
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Save summary as note */}
                  <button
                    onClick={() => addNote(`Summary of page ${store.currentPage}: ${summary.summary}`, "typed")}
                    className="w-full py-2 rounded-lg border border-white/[0.08] font-label text-xs text-zinc-500 hover:text-primary hover:border-primary/30 transition-colors"
                  >
                    Save summary as note
                  </button>
                </motion.div>
              )}

              {/* Q&A */}
              <div className="border-t border-white/[0.06] pt-4 space-y-3">
                <span className="font-label text-[10px] uppercase tracking-widest text-zinc-600">Ask about this book</span>
                <div className="flex gap-2">
                  <input
                    ref={aiInputRef}
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Ask a question…"
                    className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-label text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-primary/40"
                    onKeyDown={(e) => e.key === "Enter" && askAI()}
                  />
                  {/* Voice Q&A button */}
                  <button
                    onClick={voiceAskAI}
                    disabled={voice.listening || aiLoading}
                    className={cn(
                      "p-2 rounded-lg border transition-colors",
                      voice.listening
                        ? "border-red-500/40 bg-red-500/10 text-red-400 animate-pulse"
                        : "border-white/[0.08] hover:border-primary/30 text-zinc-500 hover:text-primary"
                    )}
                    title="Ask by voice"
                  >
                    <Mic size={14} />
                  </button>
                  <button
                    onClick={() => askAI()}
                    disabled={aiLoading || !aiQuestion.trim()}
                    className="p-2 rounded-lg bg-primary text-on-primary hover:brightness-110 disabled:opacity-40 transition-all"
                  >
                    {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>

                {aiAnswer && (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-xl bg-primary/5 border border-primary/15">
                    <p className="text-sm font-label text-zinc-300 leading-relaxed">{aiAnswer}</p>
                    {/* Save answer as note */}
                    <button
                      onClick={() => addNote(`Q: ${aiQuestion}\nA: ${aiAnswer}`, "typed")}
                      className="mt-3 font-label text-[10px] text-primary hover:brightness-125 transition-all uppercase tracking-widest"
                    >
                      Save as note →
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Provider status */}
              <div className="border-t border-white/[0.06] pt-4">
                <span className="font-label text-[10px] uppercase tracking-widest text-zinc-600 block mb-3">AI providers</span>
                <AIProviderPanel />
              </div>
            </motion.div>
          )}

          {/* ── IMAGES TAB ────────────────────────────────────────────────── */}
          {store.smartPanelTab === "images" && (
            <motion.div key="images" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
              {!store.pageData?.images.length ? (
                <p className="text-sm font-label text-zinc-600 text-center py-12">No images on this page.</p>
              ) : (
                <div className="space-y-4">
                  {store.pageData.images.map((img, i) => (
                    <div key={i} className="rounded-xl overflow-hidden border border-white/[0.08]">
                      {img.data_b64 && (
                        <img src={`data:image/${img.format};base64,${img.data_b64}`} alt={`Figure ${i + 1}`} className="w-full object-contain" />
                      )}
                      <div className="p-3 bg-white/[0.02]">
                        <span className="font-label text-xs text-zinc-600">Figure {i + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── ANALYTICS TAB ─────────────────────────────────────────────── */}
          {store.smartPanelTab === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-4">
              {/* Completion ring */}
              <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-5">
                <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke="rgb(192,193,255)" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - store.completionPct / 100)}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-headline text-lg text-white">{Math.round(store.completionPct)}%</span>
                  </div>
                </div>
                <div>
                  <p className="font-label text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Completion</p>
                  <p className="font-label text-sm text-zinc-300">Page {store.currentPage} of {store.totalPages}</p>
                  <p className="font-label text-xs text-zinc-600 mt-0.5">Speed: {store.ttsSpeed}x</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="font-label text-[10px] text-zinc-600 mb-1">Highlights</p>
                  <p className="font-headline text-xl text-white">{highlights.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="font-label text-[10px] text-zinc-600 mb-1">Notes</p>
                  <p className="font-headline text-xl text-white">{notes.length}</p>
                </div>
              </div>

              {analytics && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="font-label text-[10px] uppercase tracking-widest text-zinc-600 mb-4">Activity (7 days)</p>
                  <div className="flex items-end gap-1.5 h-16">
                    {analytics.daily_stats.slice(-7).map((d: any, i: number) => {
                      const max = Math.max(...analytics.daily_stats.map((s: any) => s.events), 1);
                      const h = Math.max(4, (d.events / max) * 56);
                      const isToday = i === analytics.daily_stats.slice(-7).length - 1;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-full rounded-t-sm ${isToday ? "bg-primary/60" : "bg-white/[0.08]"}`} style={{ height: h }} />
                          <span className="font-label text-[8px] text-zinc-700">{d.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}
