import httpx
from fastapi import APIRouter, HTTPException

from config import OLLAMA_MODEL
from models import ChatRequest, ChatResponse
from prompts import SYSTEM_PROMPT, build_context_block
from services import ollama_client

router = APIRouter()


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
            detail=f"Model '{OLLAMA_MODEL}' is not loaded. Run: docker compose exec ollama ollama pull {OLLAMA_MODEL}",
        )

    context_dict = req.context.model_dump() if req.context else None
    context_block = build_context_block(context_dict)

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.append({
        "role": "system",
        "content": f"Current plant context (JSON):\n{context_block}",
    })
    for m in req.messages:
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
