#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL="${OLLAMA_MODEL:-smollm:135m}"

cd "$ROOT"
echo "Starting Ollama..."
docker compose up -d ollama

echo "Pulling model: $MODEL"
docker compose exec ollama ollama pull "$MODEL"

echo "Warming model in memory..."
# OLLAMA_KEEP_ALIVE is set in docker-compose.yml - no flag needed!
docker compose exec ollama ollama run "$MODEL" "ping"

echo "✅ Model $MODEL pulled and warmed."
echo "📊 Check memory: docker stats --no-stream"