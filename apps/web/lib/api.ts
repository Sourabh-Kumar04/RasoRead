import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("rasoread_access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const refresh = localStorage.getItem("rasoread_refresh_token");
      if (refresh) {
        try {
          const res = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refresh,
          });
          localStorage.setItem("rasoread_access_token", res.data.access_token);
          error.config.headers.Authorization = `Bearer ${res.data.access_token}`;
          return axios(error.config);
        } catch {
          localStorage.removeItem("rasoread_access_token");
          localStorage.removeItem("rasoread_refresh_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (email: string, name: string, password: string) =>
    api.post("/auth/register", { email, name, password }),
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  refresh: (refreshToken: string) =>
    api.post("/auth/refresh", { refresh_token: refreshToken }),
  logout: (accessJti: string, refreshJti: string) =>
    api.post("/auth/logout", { access_jti: accessJti, refresh_jti: refreshJti }),
  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post("/auth/reset-password", { token, new_password: newPassword }),
  verifyEmail: (token: string) =>
    api.get("/auth/verify", { params: { token } }),
  me: () => api.get("/auth/me"),
  updateSettings: (settings: Record<string, unknown>) =>
    api.patch("/auth/settings", settings),
  deleteAccount: () => api.delete("/auth/me"),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/auth/me/avatar", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ── Books ──────────────────────────────────────────────────────────────────────
export const booksApi = {
  list: (sort?: string) => api.get("/books", { params: { sort } }),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/books/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  get: (id: string) => api.get(`/books/${id}`),
  status: (id: string) => api.get(`/books/${id}/status`),
  update: (id: string, data: { title?: string; author?: string }) =>
    api.patch(`/books/${id}`, data),
  delete: (id: string) => api.delete(`/books/${id}`),
  reprocess: (id: string) => api.post(`/books/${id}/reprocess`),
  updateCover: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.patch(`/books/${id}/cover`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  export: (id: string, format: string = "md") =>
    api.get(`/books/${id}/export`, { params: { format } }),
};

// ── Reader ──────────────────────────────────────────────────────────────────────
export const readerApi = {
  getPage: (bookId: string, page: number) =>
    api.get(`/reader/${bookId}/text`, { params: { page } }),
  getPageImage: (bookId: string, page: number, dpi = 150) =>
    api.get(`/reader/${bookId}/page-image`, { params: { page, dpi } }),
  getPagesBuffer: (bookId: string, start: number, count = 3, dpi = 150) =>
    api.get(`/reader/${bookId}/pages-buffer`, { params: { start, count, dpi } }),
  getProgress: (bookId: string) => api.get(`/reader/${bookId}/progress`),
  saveProgress: (
    bookId: string,
    data: {
      current_page: number;
      char_offset: number;
      completion_pct?: number;
      tts_speed?: number;
      voice_id?: string;
    }
  ) => api.post(`/reader/${bookId}/progress`, data),
  listBookmarks: (bookId: string) => api.get(`/reader/${bookId}/bookmarks`),
  addBookmark: (bookId: string, page: number, label?: string) =>
    api.post(`/reader/${bookId}/bookmarks`, { book_id: bookId, page, label }),
  deleteBookmark: (bookId: string, bookmarkId: string) =>
    api.delete(`/reader/${bookId}/bookmarks/${bookmarkId}`),
  getSettings: (bookId: string) => api.get(`/reader/${bookId}/settings`),
  saveSettings: (bookId: string, data: { tts_provider: string }) =>
    api.post(`/reader/${bookId}/settings`, data),
  search: (bookId: string, q: string) =>
    api.get(`/reader/${bookId}/search`, { params: { q } }),
};

// ── TTS ───────────────────────────────────────────────────────────────────────
export const ttsApi = {
  voices: () => api.get("/tts/voices"),
  streamUrl: () => `${API_URL}/tts/stream`,
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  providers: () => api.get("/ai/providers"),
  search: (q: string) => api.get("/ai/search", { params: { q } }),
  ask: (bookId: string, question: string) =>
    api.post(`/ai/${bookId}/ask`, { question }),
  askStream: (bookId: string, question: string): EventSource => {
    // Returns an EventSource for SSE streaming
    const url = `${API_URL}/ai/${bookId}/ask/stream`;
    const encodedQuestion = encodeURIComponent(question);
    return new EventSource(`${url}?question=${encodedQuestion}`);
  },
  summarize: (bookId: string, chapterText: string) =>
    api.post(`/ai/${bookId}/summarize`, { chapter_text: chapterText }),
  summarizeStream: (bookId: string, chapterText: string): EventSource => {
    const url = `${API_URL}/ai/${bookId}/summarize/stream`;
    return new EventSource(`${url}?chapter_text=${encodeURIComponent(chapterText)}`);
  },
  keypoints: (bookId: string, chapterText: string) =>
    api.post(`/ai/${bookId}/keypoints`, { chapter_text: chapterText }),
  describeImage: (bookId: string, imageB64: string) =>
    api.post(`/ai/${bookId}/describe-image`, { image_b64: imageB64 }),
  explain: (bookId: string, text: string) =>
    api.post(`/ai/${bookId}/explain`, { text }),
  translate: (bookId: string, text: string, targetLang: string) =>
    api.post(`/ai/${bookId}/translate`, { text, target_lang: targetLang }),
  quiz: (bookId: string, chapterText?: string) =>
    api.post(`/ai/${bookId}/quiz`, { chapter_text: chapterText || "" }),
  generateToc: (bookId: string) =>
    api.post(`/ai/${bookId}/generate-toc`),
};

// ── Notes ─────────────────────────────────────────────────────────────────────
export const notesApi = {
  listHighlights: (bookId: string) =>
    api.get("/notes/highlights", { params: { book_id: bookId } }),
  createHighlight: (data: {
    book_id: string;
    page: number;
    start_char: number;
    end_char: number;
    text: string;
    color?: string;
  }) => api.post("/notes/highlights", data),
  deleteHighlight: (id: string) => api.delete(`/notes/highlights/${id}`),
  updateHighlight: (id: string, data: { color?: string; text?: string }) =>
    api.patch(`/notes/highlights/${id}`, data),
  listNotes: (bookId: string) =>
    api.get("/notes/notes", { params: { book_id: bookId } }),
  createNote: (data: {
    book_id: string;
    content: string;
    source?: string;
    page?: number;
    highlight_id?: string;
  }) => api.post("/notes/notes", data),
  deleteNote: (id: string) => api.delete(`/notes/notes/${id}`),
  updateNote: (id: string, data: { content?: string; audio_url?: string }) =>
    api.patch(`/notes/notes/${id}`, data),
  searchHighlights: (q: string) => api.get("/notes/highlights", { params: { q } }),
};

// ── Analytics ───────────────────────────────────────────────────────────────
export const analyticsApi = {
  summary: (days?: number) => api.get("/analytics/summary", { params: { days } }),
  pingStreak: () => api.post("/analytics/streak/ping"),
  getStreak: () => api.get("/analytics/streak"),
  logEvent: (
    event_type: string,
    book_id?: string,
    metadata?: Record<string, unknown>
  ) => api.post("/analytics/event", { event_type, book_id, metadata }),
  bookStats: (bookId: string) => api.get(`/analytics/books/${bookId}/stats`),
};

// ── Collections ───────────────────────────────────────────────────────────────
export const collectionsApi = {
  list: () => api.get("/collections"),
  create: (data: { name: string; description?: string; cover_color?: string }) =>
    api.post("/collections", data),
  get: (id: string) => api.get(`/collections/${id}`),
  update: (id: string, data: { name: string; description?: string; cover_color?: string }) =>
    api.patch(`/collections/${id}`, data),
  delete: (id: string) => api.delete(`/collections/${id}`),
  addBook: (collectionId: string, bookId: string) =>
    api.post(`/collections/${collectionId}/books`, { book_id: bookId }),
  removeBook: (collectionId: string, bookId: string) =>
    api.delete(`/collections/${collectionId}/books/${bookId}`),
};