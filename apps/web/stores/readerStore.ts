import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface Paragraph {
  text: string;
  bbox: number[] | null;
  is_heading: boolean;
  word_count: number;
}

export interface PageData {
  page: number;
  paragraphs: Paragraph[];
  images: { bbox: number[]; index: number; format: string; data_b64?: string }[];
}

export interface ReaderState {
  // Book
  bookId: string | null;
  bookTitle: string;
  totalPages: number;
  toc: { title: string; page: number; level: number }[];

  // Navigation
  currentPage: number;
  charOffset: number;
  completionPct: number;
  pageData: PageData | null;

  // TTS
  isPlaying: boolean;
  isPaused: boolean;
  ttsSpeed: number;
  voiceId: string;
  activeWordIndex: number;
  activeParagraphIndex: number;
  wordTimestamps: WordTimestamp[];

  // UI
  focusMode: boolean;
  theme: "dark" | "sepia" | "light";
  fontSize: number;
  dyslexiaMode: boolean;
  showSmartPanel: boolean;
  smartPanelTab: "notes" | "images" | "ai" | "analytics";

  // Highlights
  highlights: { id: string; page: number; start_char: number; end_char: number; text: string; color: string }[];

  // Actions
  setBook: (id: string, title: string, totalPages: number, toc: ReaderState["toc"]) => void;
  setPage: (page: number) => void;
  setPageData: (data: PageData | null) => void;
  setPlaying: (playing: boolean) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  setVoice: (voiceId: string) => void;
  setActiveWord: (wordIndex: number, paraIndex: number) => void;
  setWordTimestamps: (timestamps: WordTimestamp[]) => void;
  setProgress: (page: number, offset: number, pct: number) => void;
  toggleFocusMode: () => void;
  setTheme: (theme: ReaderState["theme"]) => void;
  setFontSize: (size: number) => void;
  toggleDyslexia: () => void;
  toggleSmartPanel: (tab?: ReaderState["smartPanelTab"]) => void;
  setHighlights: (highlights: ReaderState["highlights"]) => void;
  addHighlight: (h: ReaderState["highlights"][0]) => void;
  removeHighlight: (id: string) => void;
  reset: () => void;
}

export const useReaderStore = create<ReaderState>()(
  devtools(
    persist(
      (set, get) => ({
        bookId: null,
        bookTitle: "",
        totalPages: 0,
        toc: [],
        currentPage: 1,
        charOffset: 0,
        completionPct: 0,
        pageData: null,
        isPlaying: false,
        isPaused: false,
        ttsSpeed: 1.0,
        voiceId: "edge-en-US-AriaNeural",
        activeWordIndex: -1,
        activeParagraphIndex: 0,
        wordTimestamps: [],
        focusMode: false,
        theme: "dark",
        fontSize: 20,
        dyslexiaMode: false,
        showSmartPanel: false,
        smartPanelTab: "notes",
        highlights: [],

        setBook: (id, title, totalPages, toc) =>
          set({ bookId: id, bookTitle: title, totalPages, toc }),

        setPage: (page) => set({ currentPage: page, pageData: null, activeWordIndex: -1 }),

        setPageData: (data) => set({ pageData: data }),

        setPlaying: (playing) => set({ isPlaying: playing, isPaused: !playing }),

        setPaused: (paused) => set({ isPaused: paused, isPlaying: !paused }),

        setSpeed: (speed) => set({ ttsSpeed: speed }),

        setVoice: (voiceId) => set({ voiceId }),

        setActiveWord: (wordIndex, paraIndex) =>
          set({ activeWordIndex: wordIndex, activeParagraphIndex: paraIndex }),

        setWordTimestamps: (timestamps) => set({ wordTimestamps: timestamps }),

        setProgress: (page, offset, pct) =>
          set({ currentPage: page, charOffset: offset, completionPct: pct }),

        toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

        setTheme: (theme) => set({ theme }),

        setFontSize: (fontSize) => set({ fontSize }),

        toggleDyslexia: () => set((s) => ({ dyslexiaMode: !s.dyslexiaMode })),

        toggleSmartPanel: (tab) =>
          set((s) => ({
            showSmartPanel: tab ? true : !s.showSmartPanel,
            smartPanelTab: tab || s.smartPanelTab,
          })),

        setHighlights: (highlights) => set({ highlights }),

        addHighlight: (h) =>
          set((s) => ({ highlights: [...s.highlights, h] })),

        removeHighlight: (id) =>
          set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) })),

        reset: () =>
          set({
            bookId: null,
            bookTitle: "",
            totalPages: 0,
            toc: [],
            currentPage: 1,
            charOffset: 0,
            pageData: null,
            isPlaying: false,
            wordTimestamps: [],
            highlights: [],
          }),
      }),
      {
        name: "rasoread-reader",
        partialize: (state) => ({
          ttsSpeed: state.ttsSpeed,
          voiceId: state.voiceId,
          theme: state.theme,
          fontSize: state.fontSize,
          dyslexiaMode: state.dyslexiaMode,
        }),
      }
    )
  )
);
