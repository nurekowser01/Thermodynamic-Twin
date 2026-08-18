from fastapi import APIRouter

from config import GEMINI_MODEL
from models import HealthResponse
from services import gemini_client

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    ready = gemini_client.is_configured()
    return HealthResponse(
        status="healthy" if ready else "degraded",
        model_ready=ready,
        model=GEMINI_MODEL,
    )
