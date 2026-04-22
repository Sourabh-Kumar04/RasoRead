# Changes Made

## 1. apps/api/core/config.py
Added production startup assertions at the bottom of the file.
- Crashes fast if `JWT_SECRET` is still the default `"change-me"` in production
- Crashes fast if `STORAGE_BACKEND=db` is used in production (not safe for large files)

## 2. apps/api/routers/auth.py
Fixed missing database commit after user registration.
- Added `await db.commit()` and `await db.refresh(user)` after `db.flush()`
- Without this, the new user row was not guaranteed to be persisted to the database

## 3. apps/api/routers/books.py
Added pagination to the `GET /books` endpoint.
- Added `skip` (default 0) and `limit` (default 50) query parameters
- Prevents loading all books at once for users with large libraries

## 4. apps/web/components/reader/DocumentViewer.tsx
Fixed highlight character offsets.
- `start_char` and `end_char` were always sent as `0` and `text.length`
- Now computes real offsets by searching the selected text within the full page text
- Highlights now correctly re-render in the right position across sessions

## 5. apps/web/components/library/UploadDropzone.tsx
Replaced `any` type with a proper `BookOut` interface.
- Defined a typed `BookOut` interface matching the API response shape
- `onUploadSuccess` callback is now fully typed

## 6. apps/web/hooks/useReadingSession.ts
Completed the offline highlight sync (was a TODO comment with no implementation).
- Added `notesApi` import
- When the browser comes back online, queued highlights are now sent to the API
- If a highlight fails to sync, it is re-queued for the next online event

## 7. apps/web/components/library/BookCard.tsx
Replaced `window.confirm()` with a proper modal dialog.
- `window.confirm` is blocked in some browsers and iframe environments
- Added a `DeleteConfirmModal` component with Cancel and Delete buttons
- Modal includes a warning message about permanent data loss
- Uses `AnimatePresence` for smooth enter/exit animation

---

## Session 2 — TTS Read-Aloud Bugs

### Root Cause
`useTTSSync` was instantiated twice — once inside `FloatingControls` and once inside `DocumentViewer`. This caused:
- Two separate `audioRef`, `sessionRef`, and `webSpeechMode` refs
- The audio played in one instance while word highlighting ran in the other
- `continueAfter` called `selfPlayRef` from the wrong instance, breaking auto-continue
- `webSpeechMode.current = true` set in one instance never visible to the other

### 8. apps/web/app/reader/[bookId]/page.tsx
Lifted `useTTSSync` to the reader page — single source of truth.
- Added `useRef` import
- Created one `tts` instance at the page level with `onPageEnd` wired via a stable `goToPageRef`
- Added `goToPageRef` to keep the `onPageEnd` closure always pointing to the latest `goToPage`
- Passed `tts` as a prop to both `DocumentViewer` and `FloatingControls`

### 9. apps/web/components/reader/DocumentViewer.tsx
Removed internal `useTTSSync` instantiation.
- Now accepts `tts: ReturnType<typeof useTTSSync>` as a prop
- Destructures `play` from the shared instance
- Removed `onPageEnd` prop (no longer needed)
- Fixed unused `range` parameter warning (renamed to `_range`)

### 10. apps/web/components/reader/FloatingControls.tsx
Removed internal `useTTSSync` instantiation.
- Now accepts `tts: ReturnType<typeof useTTSSync>` as a prop
- Destructures `play, pause, resume, stop, seek` from the shared instance
- Removed `onPageEnd: onNextPage` wiring (handled at page level)

### 11. apps/web/hooks/useTTSSync.ts
Fixed two secondary bugs:
- WebSpeech anti-skip guard threshold lowered from 200ms → 50ms. The 200ms guard was incorrectly halting short but valid paragraphs (e.g. single-sentence headings), breaking auto-continue for real content.
- Added comment clarifying `webSpeechMode.current = false` reset on `stop()` to ensure clean state on page navigation.
