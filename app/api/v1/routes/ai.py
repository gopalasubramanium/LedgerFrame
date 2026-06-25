"""AI chat endpoint — grounded, streaming via Server-Sent Events."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.grounding import answer_stream
from app.api.deps import get_db

router = APIRouter()


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)


@router.post("/ai/chat")
async def ai_chat(payload: ChatIn, session: AsyncSession = Depends(get_db)) -> StreamingResponse:
    async def event_gen():
        async for event in answer_stream(session, payload.question):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
