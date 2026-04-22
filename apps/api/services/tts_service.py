"""
TTS Service — Gemini (Google Cloud TTS), OpenAI, ElevenLabs, or Web Speech fallback.

All providers stream Server-Sent Events in the same format:
  { type: "timestamps", data: [{word, start, end}] }   — always first
  { type: "audio", chunk: "<base64 mp3>" }              — repeated
  { type: "use_webspeech", text, speed }                — fallback only
  { type: "error", message }                            — on failure
  { type: "done" }                                      — always last

Word timestamps are computed analytically (character-rate model).
Replace with real word-boundary events from the TTS API for production accuracy.
"""
import re
import base64
import json
from typing import AsyncGenerator

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)

# ── Provider availability ─────────────────────────────────────────────────────
_HAS_GEMINI     = bool(settings.GEMINI_API_KEY)
_HAS_OPENAI     = bool(settings.OPENAI_API_KEY)
_HAS_ELEVENLABS = bool(settings.ELEVENLABS_API_KEY)

# Gemini TTS voices (Google Cloud Text-to-Speech)
VOICES_GEMINI = [
    {"id": "en-US-Journey-F",   "name": "Journey (F)",   "gender": "female",  "accent": "American",  "provider": "gemini"},
    {"id": "en-US-Journey-D",   "name": "Journey (M)",   "gender": "male",    "accent": "American",  "provider": "gemini"},
    {"id": "en-US-Studio-O",    "name": "Studio O",      "gender": "female",  "accent": "American",  "provider": "gemini"},
    {"id": "en-US-Studio-Q",    "name": "Studio Q",      "gender": "male",    "accent": "American",  "provider": "gemini"},
    {"id": "en-GB-Journey-F",   "name": "British (F)",   "gender": "female",  "accent": "British",   "provider": "gemini"},
    {"id": "en-GB-Journey-D",   "name": "British (M)",   "gender": "male",    "accent": "British",   "provider": "gemini"},
    {"id": "en-AU-Journey-F",   "name": "Australian (F)","gender": "female",  "accent": "Australian","provider": "gemini"},
    {"id": "en-IN-Journey-F",   "name": "Indian (F)",    "gender": "female",  "accent": "Indian",    "provider": "gemini"},
]

VOICES_OPENAI = [
    {"id": "nova",    "name": "Nova",    "gender": "female",  "accent": "American", "provider": "openai"},
    {"id": "alloy",   "name": "Alloy",   "gender": "neutral", "accent": "American", "provider": "openai"},
    {"id": "echo",    "name": "Echo",    "gender": "male",    "accent": "American", "provider": "openai"},
    {"id": "fable",   "name": "Fable",   "gender": "male",    "accent": "British",  "provider": "openai"},
    {"id": "onyx",    "name": "Onyx",    "gender": "male",    "accent": "American", "provider": "openai"},
    {"id": "shimmer", "name": "Shimmer", "gender": "female",  "accent": "American", "provider": "openai"},
]

VOICES_WEBSPEECH = [
    {"id": "webspeech-default", "name": "Browser Default", "gender": "neutral", "accent": "System", "provider": "webspeech"},
]


def get_available_voices() -> list[dict]:
    """Return all available voices grouped by provider."""
    voices = []
    if _HAS_GEMINI:
        voices.extend(VOICES_GEMINI)
    if _HAS_OPENAI:
        voices.extend(VOICES_OPENAI)
    if not voices:
        voices.extend(VOICES_WEBSPEECH)
    return voices


def _resolve_tts_provider(voice_id: str) -> str:
    """Pick TTS provider based on config + voice_id prefix + availability."""
    # Voice ID encodes provider
    if voice_id.startswith("en-") or voice_id.startswith("en_"):
        if _HAS_GEMINI:
            return "gemini"
    if voice_id in {v["id"] for v in VOICES_OPENAI}:
        if _HAS_OPENAI:
            return "openai"
    if voice_id.startswith("webspeech"):
        return "webspeech"

    # Honour config preference
    pref = settings.TTS_PROVIDER.lower()
    if pref == "gemini"     and _HAS_GEMINI:     return "gemini"
    if pref == "openai"     and _HAS_OPENAI:     return "openai"
    if pref == "elevenlabs" and _HAS_ELEVENLABS: return "elevenlabs"

    # Fallback chain
    if _HAS_GEMINI:     return "gemini"
    if _HAS_OPENAI:     return "openai"
    if _HAS_ELEVENLABS: return "elevenlabs"
    return "webspeech"


# ── Timestamp generator ───────────────────────────────────────────────────────

def compute_word_timestamps(text: str, speed: float) -> list[dict]:
    """
    Analytical word timestamps (character-rate model, ≈ 14 chars/sec at 1×).
    Good enough for highlight sync; replace with API word-boundary events
    (ElevenLabs /with-timestamps, Google TTS timepoints) for frame accuracy.
    """
    PAUSE = {",": 0.12, ";": 0.18, ":": 0.18, ".": 0.32, "!": 0.32, "?": 0.32, "\n": 0.45}
    tokens = re.findall(r"\S+", text)
    result: list[dict] = []
    cursor = 0.0

    for token in tokens:
        word = token.rstrip(".,;:!?\"'")
        if not word:
            continue
        dur = max(0.08, len(word) / (speed * 14.0))
        end = cursor + dur
        result.append({"word": word, "start": round(cursor, 3), "end": round(end, 3)})
        for ch in reversed(token):
            if ch in PAUSE:
                end += PAUSE[ch] / speed
                break
        cursor = end

    return result


# ── Gemini TTS ────────────────────────────────────────────────────────────────

async def stream_tts_gemini(
    text: str, voice_id: str, speed: float
) -> AsyncGenerator[str, None]:
    """
    Google Cloud Text-to-Speech via the google-cloud-texttospeech SDK.
    Requires GEMINI_API_KEY (or GOOGLE_APPLICATION_CREDENTIALS for service account).
    Returns MP3 audio chunked as base64 SSE events.
    """
    timestamps = compute_word_timestamps(text, speed)
    yield f"data: {json.dumps({'type': 'timestamps', 'data': timestamps})}\n\n"

    try:
        from google.cloud import texttospeech

        # Authenticate with API key
        import os
        client = texttospeech.TextToSpeechAsyncClient()

        # Map speed to speaking_rate (Google TTS: 0.25 – 4.0, same as OpenAI)
        synthesis_input = texttospeech.SynthesisInput(text=text[:5000])
        voice_params = texttospeech.VoiceSelectionParams(
            language_code="-".join(voice_id.split("-")[:2]),  # e.g. "en-US"
            name=voice_id,
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=min(max(speed, 0.25), 4.0),
        )

        response = await client.synthesize_speech(
            input=synthesis_input,
            voice=voice_params,
            audio_config=audio_config,
        )

        # Chunk the audio for streaming
        audio = response.audio_content
        chunk_size = 4096
        for i in range(0, len(audio), chunk_size):
            b64 = base64.b64encode(audio[i:i + chunk_size]).decode()
            yield f"data: {json.dumps({'type': 'audio', 'chunk': b64})}\n\n"

    except ImportError:
        logger.warning("google-cloud-texttospeech not installed. Falling back to generativeai TTS.")
        async for event in _stream_tts_gemini_genai(text, voice_id, speed):
            yield event
        return
    except Exception as exc:
        logger.error("Gemini Cloud TTS error: %s", exc)
        # Fall back to generativeai SDK
        async for event in _stream_tts_gemini_genai(text, voice_id, speed):
            yield event
        return

    yield 'data: {"type": "done"}\n\n'


async def _stream_tts_gemini_genai(
    text: str, voice_id: str, speed: float
) -> AsyncGenerator[str, None]:
    """
    Fallback using EDGE-TTS (Microsoft Azure Cognitive) which is totally free,
    does not hit API limits, and produces ultra realistic audio seamlessly.
    """
    try:
        import edge_tts
        import base64
        import json

        # Edge TTS voices (using popular natural voices)
        voice_map = {
            "en-US-Journey-F": "en-US-AriaNeural",
            "en-US-Journey-D": "en-US-ChristopherNeural",
            "en-US-Studio-O":  "en-US-JennyNeural",
            "en-US-Studio-Q":  "en-US-GuyNeural",
            "en-GB-Journey-F": "en-GB-SoniaNeural",
            "en-GB-Journey-D": "en-GB-RyanNeural",
            "en-AU-Journey-F": "en-AU-NatashaNeural",
            "en-IN-Journey-F": "en-IN-NeerjaNeural",
        }
        edge_voice = voice_map.get(voice_id, "en-US-AriaNeural")

        # Map speed float to edge-tts rate format (e.g. '+20%', '-10%')
        rate_int = int((speed - 1.0) * 100)
        rate_str = f"+{rate_int}%" if rate_int >= 0 else f"{rate_int}%"

        communicate = edge_tts.Communicate(text[:5000], edge_voice, rate=rate_str)
        chunk_buffer = bytearray()

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunk_buffer.extend(chunk["data"])
                # Send in reasonably sized chunks (e.g., 8KB)
                if len(chunk_buffer) >= 8192:
                    b64 = base64.b64encode(bytes(chunk_buffer)).decode()
                    yield f"data: {json.dumps({'type': 'audio', 'chunk': b64})}\n\n"
                    chunk_buffer.clear()
                    
        # Flush any remaining audio
        if chunk_buffer:
            b64 = base64.b64encode(bytes(chunk_buffer)).decode()
            yield f"data: {json.dumps({'type': 'audio', 'chunk': b64})}\n\n"

    except ImportError:
        logger.warning("edge-tts not installed! Falling back to WebSpeech")
        yield f"data: {json.dumps({'type': 'use_webspeech', 'text': text, 'speed': speed})}\n\n"
    except Exception as exc:
        logger.error("Edge TTS Error: %s", exc)
        yield f"data: {json.dumps({'type': 'use_webspeech', 'text': text, 'speed': speed})}\n\n"

    yield 'data: {"type": "done"}\n\n'


# ── OpenAI TTS ────────────────────────────────────────────────────────────────

async def stream_tts_openai(
    text: str, voice_id: str, speed: float
) -> AsyncGenerator[str, None]:
    """OpenAI TTS-1-HD with streaming MP3 audio."""
    from openai import AsyncOpenAI

    timestamps = compute_word_timestamps(text, speed)
    yield f"data: {json.dumps({'type': 'timestamps', 'data': timestamps})}\n\n"

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    # Map any non-OpenAI voice_id to a safe default
    safe_voice = voice_id if voice_id in {v["id"] for v in VOICES_OPENAI} else "nova"

    try:
        async with client.audio.speech.with_streaming_response.create(
            model="tts-1-hd",
            voice=safe_voice,
            input=text[:4096],
            speed=min(max(speed, 0.25), 4.0),
            response_format="mp3",
        ) as response:
            async for chunk in response.iter_bytes(chunk_size=4096):
                b64 = base64.b64encode(chunk).decode()
                yield f"data: {json.dumps({'type': 'audio', 'chunk': b64})}\n\n"
    except Exception as exc:
        logger.error("OpenAI TTS error: %s", exc)
        yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    yield 'data: {"type": "done"}\n\n'


# ── ElevenLabs TTS ────────────────────────────────────────────────────────────

async def stream_tts_elevenlabs(
    text: str, voice_id: str, speed: float
) -> AsyncGenerator[str, None]:
    """ElevenLabs streaming TTS — highest quality, requires API key."""
    import httpx

    timestamps = compute_word_timestamps(text, speed)
    yield f"data: {json.dumps({'type': 'timestamps', 'data': timestamps})}\n\n"

    # Use a safe ElevenLabs voice ID
    EL_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"  # Rachel
    el_voice = (
        voice_id
        if not voice_id.startswith(("en-", "webspeech", "nova", "alloy", "echo", "fable", "onyx", "shimmer"))
        else EL_DEFAULT_VOICE
    )

    headers = {"xi-api-key": settings.ELEVENLABS_API_KEY, "Content-Type": "application/json"}
    payload = {
        "text": text[:5000],
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "speed": min(max(speed, 0.25), 4.0),
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                f"https://api.elevenlabs.io/v1/text-to-speech/{el_voice}/stream",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes(4096):
                    b64 = base64.b64encode(chunk).decode()
                    yield f"data: {json.dumps({'type': 'audio', 'chunk': b64})}\n\n"
    except Exception as exc:
        logger.error("ElevenLabs TTS error: %s", exc)
        yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    yield 'data: {"type": "done"}\n\n'


# ── Web Speech fallback ───────────────────────────────────────────────────────

async def stream_tts_webspeech(text: str, speed: float) -> AsyncGenerator[str, None]:
    """No server audio — instruct client to use browser SpeechSynthesis API."""
    timestamps = compute_word_timestamps(text, speed)
    yield f"data: {json.dumps({'type': 'timestamps', 'data': timestamps})}\n\n"
    yield f"data: {json.dumps({'type': 'use_webspeech', 'text': text, 'speed': speed})}\n\n"
    yield 'data: {"type": "done"}\n\n'


# ── Main entry point ──────────────────────────────────────────────────────────

async def stream_tts(
    text: str,
    voice_id: str = "en-US-Journey-F",
    speed: float = 1.0,
) -> AsyncGenerator[str, None]:
    """Route TTS request to the appropriate provider."""
    provider = _resolve_tts_provider(voice_id)
    logger.debug("TTS provider=%s voice=%s speed=%.2f", provider, voice_id, speed)

    if provider == "gemini":
        async for event in stream_tts_gemini(text, voice_id, speed):
            yield event
    elif provider == "elevenlabs":
        async for event in stream_tts_elevenlabs(text, voice_id, speed):
            yield event
    elif provider == "openai":
        async for event in stream_tts_openai(text, voice_id, speed):
            yield event
    else:
        logger.info("TTS fallback: Web Speech API (no provider API key configured)")
        async for event in stream_tts_webspeech(text, speed):
            yield event
