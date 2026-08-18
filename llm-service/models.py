from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class PlantContext(BaseModel):
    mode: Optional[int] = None
    fuel: Optional[str] = None
    inputs: Optional[dict[str, Any]] = None
    result: Optional[dict[str, Any]] = None
    static_data: Optional[dict[str, Any]] = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    messages: list[ChatMessage] = Field(default_factory=list)
    context: Optional[PlantContext] = None


class ChatResponse(BaseModel):
    reply: str
    model: str


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded"]
    model_ready: bool
    model: str
    service: str = "llm-advisor"
