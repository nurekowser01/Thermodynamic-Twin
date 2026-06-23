import os

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
OLLAMA_REQUEST_TIMEOUT = int(os.environ.get("OLLAMA_REQUEST_TIMEOUT", "120"))
TEMPERATURE = float(os.environ.get("TEMPERATURE", "0.3"))
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:8080").split(",")
    if o.strip()
]
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
