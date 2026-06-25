import time

import httpx

from config import (
    MAX_TOKENS,
    NUM_CTX,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_REQUEST_TIMEOUT,
    TEMPERATURE,
)

_CONNECT_TIMEOUT = 5.0
_CACHE_TTL = 30.0
_tags_cache: tuple[float, bool, bool] | None = None


def _base() -> str:
    return OLLAMA_BASE_URL.rstrip("/")


async def _fetch_tags() -> tuple[bool, bool]:
    global _tags_cache
    now = time.monotonic()
    if _tags_cache is not None and now - _tags_cache[0] < _CACHE_TTL:
        return _tags_cache[1], _tags_cache[2]

    reachable = False
    model_ready = False
    try:
        async with httpx.AsyncClient(timeout=_CONNECT_TIMEOUT) as client:
            r = await client.get(f"{_base()}/api/tags")
            if r.status_code == 200:
                reachable = True
                names = {m.get("name", "") for m in r.json().get("models", [])}
                if OLLAMA_MODEL in names:
                    model_ready = True
                else:
                    base = OLLAMA_MODEL.split(":")[0]
                    model_ready = any(
                        n == OLLAMA_MODEL or n.startswith(f"{base}:") for n in names
                    )
    except (httpx.HTTPError, OSError):
        pass

    _tags_cache = (now, reachable, model_ready)
    return reachable, model_ready


async def is_reachable() -> bool:
    reachable, _ = await _fetch_tags()
    return reachable


async def is_model_ready() -> bool:
    reachable, model_ready = await _fetch_tags()
    return reachable and model_ready


async def chat(messages: list[dict]) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "keep_alive": "5m",
        "options": {
            "temperature": TEMPERATURE,
            "num_predict": MAX_TOKENS,
            "num_ctx": NUM_CTX,
        },
    }
    timeout = httpx.Timeout(OLLAMA_REQUEST_TIMEOUT, connect=_CONNECT_TIMEOUT)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(f"{_base()}/api/chat", json=payload)
        r.raise_for_status()
        data = r.json()
        return data.get("message", {}).get("content", "").strip()
