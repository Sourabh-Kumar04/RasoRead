"""
Document processing service — handles PDF, EPUB, DOCX, TXT extraction.
Runs as a Celery background task after upload.
"""

import re
import io
import base64
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from PIL import Image
import pytesseract

from core.celery_app import celery_app
from core.config import settings


# ── Main entry point ──────────────────────────────────────────────────────────

def process_document(file_bytes: bytes, file_type: str) -> dict:
    """Route to the appropriate parser based on file type."""
    if file_type == "pdf":
        return _process_pdf(file_bytes)
    elif file_type in ("epub", "application/epub+zip"):
        return _process_epub(file_bytes)
    elif file_type in ("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"):
        return _process_docx(file_bytes)
    elif file_type in ("txt", "text/plain"):
        return _process_txt(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


# ── PDF ───────────────────────────────────────────────────────────────────────

def _process_pdf(file_bytes: bytes) -> dict:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    total_words = 0

    for page_num, page in enumerate(doc):
        page_height = page.rect.height
        blocks = page.get_text("dict")["blocks"]
        paragraphs = []
        images = []

        for block in blocks:
            bbox = block.get("bbox", [0, 0, 0, 0])
            y_pct = bbox[1] / page_height if page_height else 0

            # Skip likely headers/footers (top 7% and bottom 7%)
            if y_pct < 0.07 or y_pct > 0.93:
                continue

            if block["type"] == 0:  # text
                text = _extract_block_text(block)
                if not text:
                    continue
                paragraphs.append({
                    "text": text,
                    "bbox": bbox,
                    "is_heading": _is_heading(block),
                    "word_count": len(text.split()),
                })
                total_words += len(text.split())

            elif block["type"] == 1:  # image
                try:
                    xref = block.get("image")
                    if xref:
                        img_data = doc.extract_image(xref)
                        images.append({
                            "bbox": bbox,
                            "index": len(images),
                            "format": img_data.get("ext", "png"),
                            "data_b64": base64.b64encode(img_data["image"]).decode(),
                        })
                except Exception:
                    pass

        # OCR fallback for scanned pages
        if not paragraphs:
            try:
                pix = page.get_pixmap(dpi=200)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                ocr_text = pytesseract.image_to_string(img).strip()
                if ocr_text:
                    paragraphs.append({
                        "text": ocr_text,
                        "bbox": None,
                        "is_heading": False,
                        "word_count": len(ocr_text.split()),
                        "ocr": True,
                    })
                    total_words += len(ocr_text.split())
            except Exception:
                pass

        pages.append({
            "page": page_num + 1,
            "paragraphs": paragraphs,
            "images": images,
        })

    return {
        "pages": pages,
        "total_pages": len(doc),
        "total_words": total_words,
        "toc": _extract_pdf_toc(doc),
    }


def _extract_block_text(block: dict) -> str:
    lines = []
    for line in block.get("lines", []):
        spans = line.get("spans", [])
        line_text = " ".join(s["text"] for s in spans if s.get("text", "").strip())
        if line_text.strip():
            lines.append(line_text.strip())
    text = " ".join(lines).strip()
    # Remove isolated page numbers like "42" or "- 42 -"
    if re.match(r"^[-–—\s]*\d{1,4}[-–—\s]*$", text):
        return ""
    return text


def _is_heading(block: dict) -> bool:
    for line in block.get("lines", []):
        for span in line.get("spans", []):
            if span.get("size", 0) >= 14 or (span.get("flags", 0) & 16):
                return True
    return False


def _extract_pdf_toc(doc) -> list:
    return [
        {"title": item[1], "page": item[2], "level": item[0]}
        for item in doc.get_toc()
    ]


# ── EPUB ──────────────────────────────────────────────────────────────────────

def _process_epub(file_bytes: bytes) -> dict:
    try:
        import ebooklib
        from ebooklib import epub
        from html.parser import HTMLParser
    except ImportError:
        raise RuntimeError("ebooklib not installed")

    book = epub.read_epub(io.BytesIO(file_bytes))
    pages = []
    total_words = 0
    toc = []

    class TextExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.texts = []
            self._in_body = False

        def handle_data(self, data):
            text = data.strip()
            if text:
                self.texts.append(text)

    for i, item in enumerate(book.get_items_of_type(ebooklib.ITEM_DOCUMENT)):
        extractor = TextExtractor()
        extractor.feed(item.get_body_content().decode("utf-8", errors="ignore"))
        full_text = " ".join(extractor.texts).strip()
        if not full_text:
            continue

        # Split into paragraphs by double newline or sentence groups
        raw_paras = [p.strip() for p in full_text.split("  ") if p.strip()]
        paragraphs = [{"text": p, "bbox": None, "is_heading": False, "word_count": len(p.split())} for p in raw_paras]
        total_words += sum(p["word_count"] for p in paragraphs)

        toc.append({"title": item.get_name(), "page": i + 1, "level": 1})
        pages.append({"page": i + 1, "paragraphs": paragraphs, "images": []})

    return {"pages": pages, "total_pages": len(pages), "total_words": total_words, "toc": toc}


# ── DOCX ──────────────────────────────────────────────────────────────────────

def _process_docx(file_bytes: bytes) -> dict:
    try:
        from docx import Document
    except ImportError:
        raise RuntimeError("python-docx not installed")

    doc = Document(io.BytesIO(file_bytes))
    pages = [{"page": 1, "paragraphs": [], "images": []}]
    total_words = 0
    chars_per_page = 3000
    char_count = 0
    toc = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        is_heading = para.style.name.startswith("Heading")
        if is_heading:
            toc.append({"title": text, "page": len(pages), "level": 1})
        word_count = len(text.split())
        total_words += word_count
        pages[-1]["paragraphs"].append({
            "text": text,
            "bbox": None,
            "is_heading": is_heading,
            "word_count": word_count,
        })
        char_count += len(text)
        if char_count > chars_per_page:
            pages.append({"page": len(pages) + 1, "paragraphs": [], "images": []})
            char_count = 0

    return {"pages": pages, "total_pages": len(pages), "total_words": total_words, "toc": toc}


# ── TXT ───────────────────────────────────────────────────────────────────────

def _process_txt(file_bytes: bytes) -> dict:
    text = file_bytes.decode("utf-8", errors="ignore")
    raw_paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chars_per_page = 3000
    pages = []
    current_page_paras = []
    current_chars = 0
    total_words = 0

    for para_text in raw_paras:
        wc = len(para_text.split())
        total_words += wc
        current_page_paras.append({"text": para_text, "bbox": None, "is_heading": False, "word_count": wc})
        current_chars += len(para_text)
        if current_chars > chars_per_page:
            pages.append({"page": len(pages) + 1, "paragraphs": current_page_paras, "images": []})
            current_page_paras = []
            current_chars = 0

    if current_page_paras:
        pages.append({"page": len(pages) + 1, "paragraphs": current_page_paras, "images": []})

    return {"pages": pages, "total_pages": len(pages), "total_words": total_words, "toc": []}


# ── Celery task ───────────────────────────────────────────────────────────────

@celery_app.task(name="process_book", bind=True, max_retries=3)
def process_book_task(self, book_id: str, s3_key: str, file_type: str):
    """Async Celery task: download from storage, parse, index, update DB."""
    import asyncio
    from core.database import AsyncSessionLocal
    from models.db import Book
    from services.storage_service import StorageService
    from services.rag_service import index_book
    from sqlalchemy import select, update

    async def _run():
        storage = StorageService()
        file_bytes = await storage.download(s3_key, book_id=book_id)
        result = process_document(file_bytes, file_type)

        # Index for RAG
        try:
            index_book(book_id, result["pages"])
        except Exception:
            pass  # RAG indexing is best-effort

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Book).where(Book.id == book_id).values(
                    extracted_text=result,
                    total_pages=result["total_pages"],
                    total_words=result["total_words"],
                    toc=result["toc"],
                    vector_index_id=book_id,
                    status="ready",
                )
            )
            await db.commit()

    try:
        asyncio.run(_run())
    except Exception as exc:
        import asyncio as _asyncio
        from core.database import AsyncSessionLocal
        from models.db import Book
        from sqlalchemy import update as _update

        async def _mark_error():
            async with AsyncSessionLocal() as db:
                await db.execute(
                    _update(Book).where(Book.id == book_id).values(
                        status="error", error_message=str(exc)
                    )
                )
                await db.commit()

        _asyncio.run(_mark_error())
        raise self.retry(exc=exc, countdown=30)
