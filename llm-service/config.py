import os

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
GEMINI_REQUEST_TIMEOUT = int(os.environ.get("GEMINI_REQUEST_TIMEOUT", "60"))
TEMPERATURE = float(os.environ.get("TEMPERATURE", "0.0"))
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "256"))
MAX_CONTEXT_CHARS = int(os.environ.get("MAX_CONTEXT_CHARS", "3000"))
MAX_CHAT_HISTORY = int(os.environ.get("MAX_CHAT_HISTORY", "4"))
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:8080").split(",")
    if o.strip()
]
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
