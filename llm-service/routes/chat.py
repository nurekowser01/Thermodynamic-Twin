import httpx
from fastapi import APIRouter, HTTPException

from config import GEMINI_MODEL, MAX_CHAT_HISTORY, MAX_CONTEXT_CHARS
from context_slim import slim_plant_context
from models import ChatRequest, ChatResponse
from prompts import SYSTEM_PROMPT, build_context_block
from services import gemini_client

router = APIRouter()


def _truncate_context(context_block: str) -> str:
    if len(context_block) <= MAX_CONTEXT_CHARS:
        return context_block
    return context_block[: MAX_CONTEXT_CHARS - 24] + "...[truncated for speed]"


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    if not gemini_client.is_configured():
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not set. Add it to .env (local) or Render env vars.",
        )

    raw_context = req.context.model_dump() if req.context else None
    context_block = _truncate_context(
        build_context_block(slim_plant_context(raw_context))
    )

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.append({
        "role": "system",
        "content": f"Current plant context (JSON):\n{context_block}",
    })
    history = req.messages[-MAX_CHAT_HISTORY:] if MAX_CHAT_HISTORY > 0 else []
    for m in history:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": req.message})

    try:
        reply = await gemini_client.chat(messages)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Gemini request timed out.")
    except httpx.HTTPStatusError as e:
        detail = e.response.text[:300] if e.response is not None else str(e)
        raise HTTPException(status_code=503, detail=f"Gemini error: {detail}")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Gemini error: {e}")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not reply:
        raise HTTPException(status_code=502, detail="Empty response from Gemini.")

    return ChatResponse(reply=reply, model=GEMINI_MODEL)
