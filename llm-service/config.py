import os

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "smollm:135m")
OLLAMA_REQUEST_TIMEOUT = int(os.environ.get("OLLAMA_REQUEST_TIMEOUT", "90"))
TEMPERATURE = float(os.environ.get("TEMPERATURE", "0.0"))
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "256"))
NUM_CTX = int(os.environ.get("NUM_CTX", "2048"))
MAX_CONTEXT_CHARS = int(os.environ.get("MAX_CONTEXT_CHARS", "1500"))
MAX_CHAT_HISTORY = int(os.environ.get("MAX_CHAT_HISTORY", "4"))
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:8080").split(",")
    if o.strip()
]
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
