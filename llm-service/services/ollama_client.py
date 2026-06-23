import httpx

from config import OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_REQUEST_TIMEOUT, TEMPERATURE

_CONNECT_TIMEOUT = 5.0


def _base() -> str:
    return OLLAMA_BASE_URL.rstrip("/")


async def is_reachable() -> bool:
    try:
        async with httpx.AsyncClient(timeout=_CONNECT_TIMEOUT) as client:
            r = await client.get(f"{_base()}/api/tags")
            return r.status_code == 200
    except (httpx.HTTPError, OSError):
        return False


async def is_model_ready() -> bool:
    try:
        async with httpx.AsyncClient(timeout=_CONNECT_TIMEOUT) as client:
            r = await client.get(f"{_base()}/api/tags")
            if r.status_code != 200:
                return False
            names = {m.get("name", "") for m in r.json().get("models", [])}
            if OLLAMA_MODEL in names:
                return True
            # Ollama may report "llama3.2:3b" while config uses base name
            base = OLLAMA_MODEL.split(":")[0]
            return any(n == OLLAMA_MODEL or n.startswith(f"{base}:") for n in names)
    except (httpx.HTTPError, OSError):
        return False


async def chat(messages: list[dict]) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": TEMPERATURE},
    }
    timeout = httpx.Timeout(OLLAMA_REQUEST_TIMEOUT, connect=_CONNECT_TIMEOUT)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(f"{_base()}/api/chat", json=payload)
        r.raise_for_status()
        data = r.json()
        return data.get("message", {}).get("content", "").strip()
