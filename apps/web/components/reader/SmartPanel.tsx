"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  X, FileText, Image, Brain, BarChart2,
  Mic, Plus, Trash2, Loader2, Send, Download,
} from "lucide-react";
import { useReaderStore } from "@/stores/readerStore";
import { notesApi, aiApi, analyticsApi } from "@/lib/api";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { AIProviderBadge, AIProviderPanel } from "@/components/ui/AIProviderPanel";
import { toast } from "@/components/ui/Toast";

interface SmartPanelProps {
  bookId: string;
}

const TABS = [
  { id: "notes", label: "Notes", icon: FileText },
  { id: "images", label: "Images", icon: Image },
  { id: "ai", label: "AI", icon: Brain },
  { id: "analytics", label: "Stats", icon: BarChart2 },
] as const;

export function SmartPanel({ bookId }: SmartPanelProps) {
  const store = useReaderStore();
  const [notes, setNotes] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [summary, setSummary] = useState<{ summary: string; key_points: string[] } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const { captureVoiceNote } = useVoiceCommands({}, false);

  // Load data when panel opens
  useEffect(() => {
    if (!store.showSmartPanel) return;
    loadNotes();
    loadHighlights();
    if (store.smartPanelTab === "analytics") loadAnalytics();
  }, [store.showSmartPanel, store.smartPanelTab]);

  const loadNotes = async () => {
    try {
      const res = await notesApi.listNotes(bookId);
      setNotes(res.data);
    } catch {}
  };

  const loadHighlights = async () => {
    try {
      const res = await notesApi.listHighlights(bookId);
      setHighlights(res.data);
      store.setHighlights(res.data);
    } catch {}
  };

  const loadAnalytics = async () => {
    try {
      const res = await analyticsApi.summary();
      setAnalytics(res.data);
    } catch {}
  };

  const addNote = async () => {
    if (!noteInput.trim()) return;
    try {
      const res = await notesApi.createNote({
        book_id: bookId,
        content: noteInput,
        source: "typed",
        page: store.currentPage,
      });
      setNotes((prev) => [res.data, ...prev]);
      setNoteInput("");
      setAddingNote(false);
    } catch {}
  };

  const addVoiceNote = async () => {
    try {
      const text = await captureVoiceNote();
      const res = await notesApi.createNote({
        book_id: bookId,
        content: text,
        source: "voice",
        page: store.currentPage,
      });
      setNotes((prev) => [res.data, ...prev]);
    } catch (err) {
      console.error("Voice note failed:", err);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await notesApi.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  // ── Export highlights as Markdown ────────────────────────────────────────
  const exportHighlights = (hl: any[], bookTitle: string) => {
    const lines = [
      `# Highlights — ${bookTitle}`,
      `*Exported from RasoRead on ${new Date().toLocaleDateString()}*`,
      "",
      ...hl.map((h) => `> ${h.text}\n> — Page ${h.page}\n`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${bookTitle.replace(/[^a-z0-9]/gi, "_")}_highlights.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteHighlight = async (id: string) => {
    try {
      await notesApi.deleteHighlight(id);
      setHighlights((prev) => prev.filter((h) => h.id !== id));
      store.removeHighlight(id);
    } catch {}
  };

  const askAI = async () => {
    if (!aiQuestion.trim() || aiLoading) return;
    setAiLoading(true);
    setAiAnswer("");
    try {
      const res = await aiApi.ask(bookId, aiQuestion);
      setAiAnswer(res.data.content);
      setAiQuestion("");
    } catch {
      setAiAnswer("Sorry, I couldn't process that question. Make sure the book has finished indexing.");
    } finally {
      setAiLoading(false);
    }
  };

  const summarizeCurrentPage = async () => {
    if (!store.pageData || summaryLoading) return;
    setSummaryLoading(true);
    try {
      const text = store.pageData.paragraphs.map((p) => p.text).join("\n\n");
      const res = await aiApi.summarize(bookId, text);
      const parsed = JSON.parse(res.data.content);
      setSummary(parsed);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  if (!store.showSmartPanel) return null;

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="fixed right-0 top-0 bottom-0 w-80 z-40 flex flex-col
                 bg-surface-mid border-l border-outline-variant/20 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
        <span className="font-headline italic text-lg text-[#dae2fd]">Smart Panel</span>
        <button
          onClick={() => store.toggleSmartPanel()}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X size={16} className="text-outline" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/20">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => store.toggleSmartPanel(id as any)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 font-label text-[10px] uppercase tracking-widest transition-colors",
              store.smartPanelTab === id
                ? "text-primary border-b-2 border-primary"
                : "text-outline hover:text-secondary"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* NOTES TAB */}
          {store.smartPanelTab === "notes" && (
            <motion.div
              key="notes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-4"
            >
              {/* Add note controls */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAddingNote(!addingNote)}
                  className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg
                             border border-outline-variant/30 hover:border-primary/30
                             text-sm font-label text-outline hover:text-primary transition-colors"
                >
                  <Plus size={14} />
                  Add note
                </button>
                <button
                  onClick={addVoiceNote}
                  className="p-2 rounded-lg border border-outline-variant/30
                             hover:border-primary/30 text-outline hover:text-primary transition-colors"
                >
                  <Mic size={14} />
                </button>
              </div>

              {addingNote && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="space-y-2"
                >
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Write your note…"
                    rows={3}
                    className="w-full bg-surface-high border border-outline-variant/20 rounded-lg
                               px-3 py-2 text-sm font-label text-[#dae2fd] placeholder:text-outline
                               resize-none focus:outline-none focus:border-primary/50"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.metaKey) addNote();
                    }}
                  />
                  <button onClick={addNote} className="btn-primary w-full py-2 text-sm">
                    Save note (⌘↵)
                  </button>
                </motion.div>
              )}

              {/* Highlights section */}
              {highlights.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-label text-[10px] uppercase tracking-widest text-outline">
                      Highlights — {highlights.length} total
                    </p>
                    <button
                      onClick={() => exportHighlights(highlights, store.bookTitle)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-outline-variant/30 hover:border-primary/30 text-outline hover:text-primary transition-colors"
                      title="Export highlights as Markdown"
                    >
                      <Download size={11} />
                      <span className="font-label text-[9px] uppercase tracking-widest">Export</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {highlights
                      .filter((h) => h.page === store.currentPage)
                      .map((h) => (
                        <div
                          key={h.id}
                          className="group relative p-3 rounded-lg bg-surface-high border border-primary/20"
                        >
                          <p className="text-sm text-[#dae2fd] leading-relaxed pr-12">{h.text}</p>
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/share/${h.id}`;
                                navigator.clipboard?.writeText(url);
                                toast.success("Share link copied");
                              }}
                              className="p-1 rounded hover:bg-white/10 transition-all"
                              title="Copy share link"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-outline"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                            </button>
                            <button
                              onClick={() => deleteHighlight(h.id)}
                              className="p-1 rounded hover:bg-white/10 transition-all"
                            >
                              <Trash2 size={12} className="text-outline" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Notes list */}
              <div>
                <p className="font-label text-[10px] uppercase tracking-widest text-outline mb-3">
                  Notes
                </p>
                {notes.length === 0 ? (
                  <p className="text-sm text-outline font-label text-center py-8">
                    No notes yet. Double-tap text to start reading, then add notes here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="group relative p-3 rounded-lg bg-surface-high border border-outline-variant/10"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-label text-[10px] text-outline uppercase tracking-wider">
                            Page {note.page}
                          </span>
                          {note.source === "voice" && (
                            <span className="font-label text-[9px] text-primary/70 uppercase tracking-wider">
                              Voice
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#dae2fd] leading-relaxed">{note.content}</p>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100
                                     p-1 rounded hover:bg-white/10 transition-all"
                        >
                          <Trash2 size={12} className="text-outline" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* IMAGES TAB */}
          {store.smartPanelTab === "images" && (
            <motion.div
              key="images"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              {store.pageData?.images.length === 0 ? (
                <p className="text-sm text-outline font-label text-center py-8">
                  No images on this page.
                </p>
              ) : (
                <div className="space-y-4">
                  {store.pageData?.images.map((img, i) => (
                    <div key={i} className="rounded-xl overflow-hidden border border-outline-variant/20">
                      {img.data_b64 && (
                        <img
                          src={`data:image/${img.format};base64,${img.data_b64}`}
                          alt={`Figure ${i + 1}`}
                          className="w-full object-contain"
                        />
                      )}
                      <div className="p-3 bg-surface-high">
                        <p className="font-label text-xs text-outline">Figure {i + 1}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* AI TAB */}
          {store.smartPanelTab === "ai" && (
            <motion.div
              key="ai"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-4"
            >
              {/* Summarize button */}
              <button
                onClick={summarizeCurrentPage}
                disabled={summaryLoading}
                className="w-full py-2.5 rounded-xl border border-primary/30 text-primary
                           font-label text-sm hover:bg-primary/5 disabled:opacity-50
                           flex items-center justify-center gap-2 transition-colors"
              >
                {summaryLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Brain size={14} />
                )}
                Summarize this page
              </button>

              {/* Summary result */}
              {summary && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-surface-high border border-outline-variant/10">
                    <p className="font-label text-[10px] uppercase tracking-widest text-primary mb-2">
                      Summary
                    </p>
                    <p className="text-sm text-[#dae2fd] leading-relaxed">{summary.summary}</p>
                  </div>
                  {summary.key_points.length > 0 && (
                    <div className="p-4 rounded-xl bg-surface-high border border-outline-variant/10">
                      <p className="font-label text-[10px] uppercase tracking-widest text-primary mb-2">
                        Key points
                      </p>
                      <ul className="space-y-2">
                        {summary.key_points.map((pt, i) => (
                          <li key={i} className="flex gap-2 text-sm text-[#dae2fd]">
                            <span className="text-primary mt-1 shrink-0">•</span>
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Q&A */}
              <div className="border-t border-outline-variant/20 pt-4">
                <p className="font-label text-[10px] uppercase tracking-widest text-outline mb-3">
                  Ask about this book
                </p>
                <div className="flex gap-2">
                  <input
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Ask a question…"
                    className="flex-1 bg-surface-high border border-outline-variant/20 rounded-lg
                               px-3 py-2 text-sm font-label text-[#dae2fd] placeholder:text-outline
                               focus:outline-none focus:border-primary/50"
                    onKeyDown={(e) => e.key === "Enter" && askAI()}
                  />
                  <button
                    onClick={askAI}
                    disabled={aiLoading}
                    className="p-2 rounded-lg bg-primary text-[#0f0069] hover:bg-primary/90
                               disabled:opacity-50 transition-colors"
                  >
                    {aiLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </div>
                {aiAnswer && (
                  <div className="mt-3 p-4 rounded-xl bg-surface-high border border-outline-variant/10">
                    <p className="text-sm text-[#dae2fd] leading-relaxed">{aiAnswer}</p>
                  </div>
                )}
              </div>

              {/* Provider status */}
              <div className="border-t border-outline-variant/20 pt-4">
                <p className="font-label text-[10px] uppercase tracking-widest text-outline mb-3">
                  AI providers
                </p>
                <AIProviderPanel />
              </div>
            </motion.div>
          )}

          {/* ANALYTICS TAB */}
          {store.smartPanelTab === "analytics" && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-4"
            >
              {/* Completion */}
              <div className="p-4 rounded-xl bg-surface-high border border-outline-variant/10">
                <p className="font-label text-[10px] uppercase tracking-widest text-outline mb-2">
                  Completion
                </p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="font-headline text-3xl text-primary">
                    {Math.round(store.completionPct)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-surface-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${store.completionPct}%` }}
                  />
                </div>
              </div>

              {/* Reading speed */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-surface-high border border-outline-variant/10">
                  <p className="font-label text-[10px] text-outline mb-1">Speed</p>
                  <p className="font-headline text-xl text-[#dae2fd]">{store.ttsSpeed}x</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-high border border-outline-variant/10">
                  <p className="font-label text-[10px] text-outline mb-1">Page</p>
                  <p className="font-headline text-xl text-[#dae2fd]">
                    {store.currentPage}/{store.totalPages}
                  </p>
                </div>
              </div>

              {analytics && (
                <>
                  {/* Daily chart */}
                  <div className="p-4 rounded-xl bg-surface-lowest border border-outline-variant/10">
                    <p className="font-label text-[10px] uppercase tracking-widest text-outline mb-3">
                      Activity (7 days)
                    </p>
                    <div className="flex items-end gap-1 h-16">
                      {analytics.daily_stats.slice(-7).map((d: any, i: number) => {
                        const max = Math.max(...analytics.daily_stats.map((s: any) => s.events), 1);
                        const h = Math.max(4, (d.events / max) * 56);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full rounded-t bg-primary/40"
                              style={{ height: h }}
                            />
                            <span className="font-label text-[8px] text-outline">
                              {d.date.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-high border border-outline-variant/10">
                    <p className="font-label text-[10px] text-outline mb-1">Books completed</p>
                    <p className="font-headline text-xl text-[#dae2fd]">
                      {analytics.books_completed}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
