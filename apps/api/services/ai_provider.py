"""
AI Provider Service — unified interface for Gemini, Groq, and OpenAI.

Priority / fallback chain:
  Configured AI_PROVIDER → next available with a key → extractive fallback

Usage:
    from services.ai_provider import get_llm, get_embeddings, get_provider_name

The returned objects are LangChain-compatible, so rag_service.py works
identically regardless of which provider is active.
"""
from typing import Optional
from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

# ── Availability flags ────────────────────────────────────────────────────────
HAS_GEMINI  = bool(settings.GEMINI_API_KEY)
HAS_GROQ    = bool(settings.GROQ_API_KEY)
HAS_OPENAI  = bool(settings.OPENAI_API_KEY)

# Resolve the active provider at import time so it's consistent per process
def _resolve_provider() -> str:
    preferred = settings.AI_PROVIDER.lower()
    availability = {
        "gemini": HAS_GEMINI,
        "groq":   HAS_GROQ,
        "openai": HAS_OPENAI,
    }
    if availability.get(preferred):
        return preferred
    # Fallback chain: gemini → groq → openai → none
    for p in ("gemini", "groq", "openai"):
        if availability[p]:
            logger.warning(
                "AI_PROVIDER=%s has no API key. Falling back to %s.", preferred, p
            )
            return p
    logger.warning("No AI provider API key set. AI features will use extractive fallback.")
    return "none"

ACTIVE_PROVIDER: str = _resolve_provider()
logger.info("Active AI provider: %s", ACTIVE_PROVIDER)


# ── LLM factory ──────────────────────────────────────────────────────────────

def get_llm(temperature: float = 0.2):
    """Return a LangChain-compatible LLM for the active provider."""
    if ACTIVE_PROVIDER == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=temperature,
            convert_system_message_to_human=True,
        )
    elif ACTIVE_PROVIDER == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=settings.GROQ_MODEL,
            groq_api_key=settings.GROQ_API_KEY,
            temperature=temperature,
        )
    elif ACTIVE_PROVIDER == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=settings.OPENAI_MODEL,
            openai_api_key=settings.OPENAI_API_KEY,
            temperature=temperature,
        )
    raise RuntimeError("No AI provider available")


def get_embeddings():
    """
    Return a LangChain-compatible embeddings model.

    Groq does not yet offer an embeddings API, so we fall back to
    Gemini or OpenAI embeddings even when Groq is the chat provider.
    """
    if HAS_GEMINI:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        return GoogleGenerativeAIEmbeddings(
            model="models/embedding-001",
            google_api_key=settings.GEMINI_API_KEY,
        )
    elif HAS_OPENAI:
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(openai_api_key=settings.OPENAI_API_KEY)
    raise RuntimeError("No embeddings provider available (need GEMINI_API_KEY or OPENAI_API_KEY)")


def get_provider_name() -> str:
    """Human-readable active provider name."""
    names = {
        "gemini": f"Google Gemini ({settings.GEMINI_MODEL})",
        "groq":   f"Groq ({settings.GROQ_MODEL})",
        "openai": f"OpenAI ({settings.OPENAI_MODEL})",
        "none":   "No provider (extractive fallback)",
    }
    return names.get(ACTIVE_PROVIDER, ACTIVE_PROVIDER)


def is_ai_available() -> bool:
    return ACTIVE_PROVIDER != "none"


# ── Gemini Vision (image description) ────────────────────────────────────────

async def describe_image_gemini(image_b64: str, mime: str = "image/png") -> str:
    """Use Gemini Pro Vision to describe an image for accessibility."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(settings.GEMINI_PRO_MODEL)
        import base64
        img_bytes = base64.b64decode(image_b64)
        response = model.generate_content([
            "Describe this image briefly for an accessibility caption (2-3 sentences max).",
            {"mime_type": mime, "data": img_bytes},
        ])
        return response.text.strip()
    except Exception as exc:
        logger.error("Gemini image description failed: %s", exc)
        return "Could not generate image description."


async def describe_image_openai(image_b64: str) -> str:
    """Fallback image description via OpenAI GPT-4o Vision."""
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image briefly for an accessibility caption (2-3 sentences)."},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
                ],
            }],
            max_tokens=150,
        )
        return response.choices[0].message.content
    except Exception as exc:
        logger.error("OpenAI image description failed: %s", exc)
        return "Could not generate image description."


async def describe_image(image_b64: str) -> str:
    """Route image description to best available provider."""
    if HAS_GEMINI:
        return await describe_image_gemini(image_b64)
    elif HAS_OPENAI:
        return await describe_image_openai(image_b64)
    return "Image description requires a GEMINI_API_KEY or OPENAI_API_KEY."


# ── Chat completion (non-streaming) ───────────────────────────────────────────

async def chat_completion(prompt: str, temperature: float = 0.2) -> str:
    """Send a chat completion request and return the text response."""
    if ACTIVE_PROVIDER == "gemini":
        return await _chat_gemini(prompt, temperature)
    elif ACTIVE_PROVIDER == "groq":
        return await _chat_groq(prompt, temperature)
    elif ACTIVE_PROVIDER == "openai":
        return await _chat_openai(prompt, temperature)
    return "AI provider not available"


async def _chat_gemini(prompt: str, temperature: float) -> str:
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)
    response = model.generate_content(prompt)
    return response.text.strip()


async def _chat_groq(prompt: str, temperature: float) -> str:
    from groq import AsyncGroq
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    response = await client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return response.choices[0].message.content


async def _chat_openai(prompt: str, temperature: float) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return response.choices[0].message.content


# ── Streaming chat completion ────────────────────────────────────────────────

async def chat_completion_stream(prompt: str, temperature: float = 0.2):
    """Yield chat completion response chunks as they become available."""
    if ACTIVE_PROVIDER == "gemini":
        async for chunk in _chat_gemini_stream(prompt, temperature):
            yield chunk
    elif ACTIVE_PROVIDER == "groq":
        async for chunk in _chat_groq_stream(prompt, temperature):
            yield chunk
    elif ACTIVE_PROVIDER == "openai":
        async for chunk in _chat_openai_stream(prompt, temperature):
            yield chunk


async def _chat_gemini_stream(prompt: str, temperature: float):
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL)
    response = model.generate_content(prompt, stream=True)
    for chunk in response:
        if chunk.text:
            yield chunk.text


async def _chat_groq_stream(prompt: str, temperature: float):
    from groq import AsyncGroq
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    response = await client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        stream=True,
    )
    async for chunk in response:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def _chat_openai_stream(prompt: str, temperature: float):
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        stream=True,
    )
    async for chunk in response:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
