export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  settings: Record<string, unknown>;
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  file_type: "pdf" | "epub" | "docx" | "txt";
  cover_url?: string;
  total_pages: number;
  total_words: number;
  toc: TOCItem[];
  status: "processing" | "ready" | "error";
  created_at: string;
}

export interface TOCItem {
  title: string;
  page: number;
  level: number;
}

export interface Paragraph {
  text: string;
  bbox: number[] | null;
  is_heading: boolean;
  word_count: number;
  ocr?: boolean;
}

export interface PageImage {
  bbox: number[];
  index: number;
  format: string;
  data_b64?: string;
}

export interface PageData {
  page: number;
  paragraphs: Paragraph[];
  images: PageImage[];
}

export interface ReadingProgress {
  current_page: number;
  char_offset: number;
  completion_pct: number;
  tts_speed: number;
  voice_id: string;
  last_read_at: string;
}

export interface Highlight {
  id: string;
  book_id: string;
  page: number;
  start_char: number;
  end_char: number;
  text: string;
  color: string;
  created_at: string;
}

export interface Note {
  id: string;
  book_id: string;
  highlight_id?: string;
  page?: number;
  content: string;
  source: "typed" | "voice";
  created_at: string;
}

export interface Bookmark {
  id: string;
  book_id: string;
  page: number;
  label?: string;
  created_at: string;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface Voice {
  id: string;
  name: string;
  gender: string;
  accent: string;
}

export interface AnalyticsSummary {
  event_counts: Record<string, number>;
  books_completed: number;
  total_books: number;
  avg_speed: number;
  daily_stats: { date: string; events: number }[];
  most_highlighted_books: { book_id: string; highlight_count: number }[];
}
