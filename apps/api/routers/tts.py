from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.db import User
from schemas.pydantic_schemas import TTSRequest
from services.tts_service import stream_tts, get_available_voices

router = APIRouter()


@router.post("/stream")
async def tts_stream(
    body: TTSRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream TTS audio + word timestamps as Server-Sent Events."""
    if not body.text.strip():
        raise HTTPException(400, "Text cannot be empty")

    pref = None
    if body.book_id:
        from sqlalchemy import select
        from models.db import UserBookSettings
        res = await db.execute(
            select(UserBookSettings).where(
                UserBookSettings.book_id == body.book_id,
                UserBookSettings.user_id == current_user.id
            )
        )
        s = res.scalar_one_or_none()
        if s:
            pref = s.tts_provider

    return StreamingResponse(
        stream_tts(body.text, body.voice_id, body.speed, provider_pref=pref),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/voices")
async def list_voices(current_user: User = Depends(get_current_user)):
    return get_available_voices()
