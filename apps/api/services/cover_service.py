"""
Cover service — extracts cover image from PDF/EPUB and returns base64.
Used to generate library thumbnails without a third-party API.
"""
import io
import base64
from pathlib import Path
from typing import Optional

from core.logging import get_logger

logger = get_logger(__name__)


def extract_pdf_cover(file_bytes: bytes, width: int = 400) -> Optional[str]:
    """
    Render the first page of a PDF at low resolution and return base64 JPEG.
    Returns None if extraction fails.
    """
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        if len(doc) == 0:
            return None

        page = doc[0]
        scale = width / page.rect.width
        mat = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("jpeg")
        return base64.b64encode(img_bytes).decode()
    except Exception as exc:
        logger.warning("PDF cover extraction failed: %s", exc)
        return None


def extract_epub_cover(file_bytes: bytes) -> Optional[str]:
    """
    Extract cover image from EPUB metadata.
    Returns base64 string of the cover image or None.
    """
    try:
        import ebooklib
        from ebooklib import epub

        book = epub.read_epub(io.BytesIO(file_bytes))

        # Try cover item from metadata
        cover_id = None
        for meta in book.get_metadata("OPF", "meta"):
            if meta[1].get("name") == "cover":
                cover_id = meta[1].get("content")
                break

        if cover_id:
            item = book.get_item_with_id(cover_id)
            if item:
                return base64.b64encode(item.get_content()).decode()

        # Fallback: first image item
        for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
            return base64.b64encode(item.get_content()).decode()

        return None
    except Exception as exc:
        logger.warning("EPUB cover extraction failed: %s", exc)
        return None


def extract_cover(file_bytes: bytes, file_type: str) -> Optional[str]:
    """Route to appropriate cover extractor by file type."""
    if file_type == "pdf":
        return extract_pdf_cover(file_bytes)
    elif file_type == "epub":
        return extract_epub_cover(file_bytes)
    return None


def cover_to_data_url(b64: str, mime: str = "image/jpeg") -> str:
    return f"data:{mime};base64,{b64}"
