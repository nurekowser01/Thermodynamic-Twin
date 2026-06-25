import httpx
from fastapi import APIRouter, HTTPException

from config import MAX_CHAT_HISTORY, MAX_CONTEXT_CHARS, OLLAMA_MODEL
from context_slim import slim_plant_context
from models import ChatRequest, ChatResponse
from prompts import SYSTEM_PROMPT, build_context_block
from services import ollama_client

router = APIRouter()


def _truncate_context(context_block: str) -> str:
    if len(context_block) <= MAX_CONTEXT_CHARS:
        return context_block
    return context_block[: MAX_CONTEXT_CHARS - 24] + "...[truncated for speed]"


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    if not await ollama_client.is_reachable():
        raise HTTPException(
            status_code=503,
            detail="Ollama is not reachable. Ensure the ollama service is running.",
        )
    if not await ollama_client.is_model_ready():
        raise HTTPException(
            status_code=503,
            detail=(
                f"Model '{OLLAMA_MODEL}' is not loaded. "
                f"Run: bash scripts/preload-model.sh "
                f"(or: docker compose exec ollama ollama pull {OLLAMA_MODEL})"
            ),
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
        reply = await ollama_client.chat(messages)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Ollama request timed out.")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Ollama error: {e}")

    if not reply:
        raise HTTPException(status_code=502, detail="Empty response from Ollama.")

    return ChatResponse(reply=reply, model=OLLAMA_MODEL)
