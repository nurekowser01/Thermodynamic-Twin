from fastapi import APIRouter

from config import OLLAMA_MODEL
from models import HealthResponse
from services import ollama_client

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    ollama_ok = await ollama_client.is_reachable()
    model_ready = await ollama_client.is_model_ready()
    return HealthResponse(
        status="healthy" if (ollama_ok and model_ready) else "degraded",
        ollama_reachable=ollama_ok,
        model_ready=model_ready,
        model=OLLAMA_MODEL,
    )
