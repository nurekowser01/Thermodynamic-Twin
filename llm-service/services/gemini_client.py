import httpx

from config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_REQUEST_TIMEOUT, MAX_TOKENS, TEMPERATURE

_CONNECT_TIMEOUT = 5.0
_BASE = "https://generativelanguage.googleapis.com/v1beta"


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _to_gemini_contents(messages: list[dict]) -> tuple[str, list[dict]]:
    system_parts: list[str] = []
    contents: list[dict] = []
    for m in messages:
        role = m.get("role", "user")
        text = (m.get("content") or "").strip()
        if not text:
            continue
        if role == "system":
            system_parts.append(text)
            continue
        gemini_role = "model" if role == "assistant" else "user"
        if contents and contents[-1]["role"] == gemini_role:
            contents[-1]["parts"][0]["text"] += "\n\n" + text
        else:
            contents.append({"role": gemini_role, "parts": [{"text": text}]})
    if contents and contents[0]["role"] != "user":
        contents.insert(0, {"role": "user", "parts": [{"text": "(continue)"}]})
    return "\n\n".join(system_parts), contents


async def chat(messages: list[dict]) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")

    system_text, contents = _to_gemini_contents(messages)
    if not contents:
        raise RuntimeError("No user message to send to Gemini")

    payload: dict = {
        "contents": contents,
        "generationConfig": {
            "temperature": TEMPERATURE,
            "maxOutputTokens": MAX_TOKENS,
        },
    }
    if system_text:
        payload["systemInstruction"] = {"parts": [{"text": system_text}]}

    url = f"{_BASE}/models/{GEMINI_MODEL}:generateContent"
    timeout = httpx.Timeout(GEMINI_REQUEST_TIMEOUT, connect=_CONNECT_TIMEOUT)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url, params={"key": GEMINI_API_KEY}, json=payload)
        r.raise_for_status()
        data = r.json()

    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("Empty response from Gemini")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts).strip()
    return text
