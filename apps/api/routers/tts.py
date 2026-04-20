from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from core.security import get_current_user
from models.db import User
from schemas.pydantic_schemas import TTSRequest
from services.tts_service import stream_tts, get_available_voices

router = APIRouter()


@router.post("/stream")
async def tts_stream(
    body: TTSRequest,
    current_user: User = Depends(get_current_user),
):
    """Stream TTS audio + word timestamps as Server-Sent Events."""
    if not body.text.strip():
        raise HTTPException(400, "Text cannot be empty")

    return StreamingResponse(
        stream_tts(body.text, body.voice_id, body.speed),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/voices")
async def list_voices(current_user: User = Depends(get_current_user)):
    return get_available_voices()
