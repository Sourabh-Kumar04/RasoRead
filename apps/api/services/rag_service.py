"""
RAG service — indexes book text and enables semantic Q&A and summarization.
Uses the active AI provider from ai_provider.py (Gemini / Groq / OpenAI).
Gracefully degrades when no API key is configured.
"""
from pathlib import Path
import os
from core.logging import get_logger
from services.ai_provider import (
    ACTIVE_PROVIDER, is_ai_available,
    get_llm, get_embeddings, get_provider_name,
)

logger = get_logger(__name__)

INDEX_DIR = Path(os.environ.get("FAISS_INDEX_DIR", "./faiss_indexes"))
INDEX_DIR.mkdir(parents=True, exist_ok=True)


# ── Indexing ──────────────────────────────────────────────────────────────────

def index_book(book_id: str, pages: list) -> str:
    """
    Chunk book text, create embeddings, save FAISS index to disk.
    No-op when no provider is available.
    """
    if not is_ai_available():
        logger.info("RAG indexing skipped (no AI provider): book %s", book_id)
        return book_id

    # Groq has no embeddings API — we still need Gemini or OpenAI for embeddings
    from services.ai_provider import HAS_GEMINI, HAS_OPENAI
    if not (HAS_GEMINI or HAS_OPENAI):
        logger.info("RAG indexing skipped (no embeddings provider — Groq only): book %s", book_id)
        return book_id

    try:
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        from langchain_community.vectorstores import FAISS

        full_text = "\n\n".join(
            p["text"]
            for page in pages
            for p in page.get("paragraphs", [])
            if p.get("text", "").strip()
        )

        if not full_text.strip():
            logger.warning("Book %s has no extractable text — skipping RAG index.", book_id)
            return book_id

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=100,
            separators=["\n\n", "\n", ". ", " "],
        )
        chunks = splitter.create_documents(
            [full_text],
            metadatas=[{"book_id": book_id, "chunk_i": i} for i in range(999)],
        )

        vectorstore = FAISS.from_documents(chunks, get_embeddings())
        vectorstore.save_local(str(INDEX_DIR / book_id))
        logger.info(
            "RAG index built for book %s: %d chunks via %s",
            book_id, len(chunks), get_provider_name(),
        )
    except Exception as exc:
        logger.warning("RAG indexing failed for book %s: %s", book_id, exc)

    return book_id


def _load_index(book_id: str):
    """Load FAISS index from disk. Returns None if unavailable."""
    try:
        from langchain_community.vectorstores import FAISS
        index_path = INDEX_DIR / book_id
        if not index_path.exists():
            return None
        return FAISS.load_local(
            str(index_path),
            get_embeddings(),
            allow_dangerous_deserialization=True,
        )
    except Exception as exc:
        logger.warning("Could not load FAISS index for %s: %s", book_id, exc)
        return None


# ── Q&A ───────────────────────────────────────────────────────────────────────

def ask_book(book_id: str, question: str) -> str:
    """Answer a question about the book using RAG."""
    if not is_ai_available():
        return (
            "AI Q&A is not configured. Set GEMINI_API_KEY, GROQ_API_KEY, or "
            "OPENAI_API_KEY in your .env file and restart the server."
        )

    vectorstore = _load_index(book_id)
    if vectorstore is None:
        return (
            "The book index is not ready yet. Please wait a moment after upload "
            "completes, then try again."
        )

    try:
        from langchain.chains import RetrievalQA
        chain = RetrievalQA.from_chain_type(
            llm=get_llm(temperature=0.1),
            chain_type="stuff",
            retriever=vectorstore.as_retriever(search_kwargs={"k": 6}),
            return_source_documents=False,
        )
        result = chain.invoke({"query": question})
        answer = result.get("result", "").strip()
        return answer or "I couldn't find a clear answer in the book for that question."
    except Exception as exc:
        logger.error("RAG Q&A failed (provider=%s): %s", ACTIVE_PROVIDER, exc)
        return f"Sorry, I couldn't process that question right now. ({type(exc).__name__})"


# ── Summarisation ─────────────────────────────────────────────────────────────

def summarize_text(text: str) -> dict:
    """
    Generate a chapter summary and 5 key points.
    Falls back to simple extractive summary when no AI provider is set.
    """
    if not is_ai_available():
        return _extractive_summary(text)

    prompt = (
        "You are an expert reading assistant. Read the following passage carefully and:\n"
        "1. Write a concise 3-5 sentence summary.\n"
        "2. List exactly 5 key points as short bullet items.\n\n"
        "Format your response EXACTLY as shown below (no deviations):\n"
        "SUMMARY:\n<your summary here>\n\n"
        "KEY POINTS:\n"
        "- <point 1>\n"
        "- <point 2>\n"
        "- <point 3>\n"
        "- <point 4>\n"
        "- <point 5>\n\n"
        "PASSAGE:\n" + text[:8000]
    )

    try:
        llm = get_llm(temperature=0.3)
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)
        return _parse_summary_response(content)
    except Exception as exc:
        logger.error("Summarization failed (provider=%s): %s", ACTIVE_PROVIDER, exc)
        return _extractive_summary(text)


def _parse_summary_response(content: str) -> dict:
    summary = ""
    key_points: list[str] = []

    if "SUMMARY:" in content and "KEY POINTS:" in content:
        parts = content.split("KEY POINTS:")
        summary = parts[0].replace("SUMMARY:", "").strip()
        raw = parts[1].strip()
        key_points = [
            line.lstrip("- •*·").strip()
            for line in raw.splitlines()
            if line.strip() and line.strip()[0] in "-•*·"
        ]

    return {
        "summary": summary or content.strip(),
        "key_points": key_points[:5],
    }


def _extractive_summary(text: str) -> dict:
    """Simple extractive fallback: first sentences of text."""
    sentences = [
        s.strip() for s in text.replace("\n", " ").split(".")
        if len(s.strip()) > 40
    ]
    summary = ". ".join(sentences[:3]).strip()
    if summary and not summary.endswith("."):
        summary += "."
    return {
        "summary": summary or "No summary available — add an AI provider API key to enable this feature.",
        "key_points": [s + "." for s in sentences[3:8]],
    }
