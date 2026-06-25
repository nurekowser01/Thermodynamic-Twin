#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL="${OLLAMA_MODEL:-qwen2.5:0.5b}"

cd "$ROOT"
echo "Starting Ollama..."
docker compose up -d ollama

echo "Pulling model: $MODEL"
docker compose exec ollama ollama pull "$MODEL"

echo "Warming model in memory..."
docker compose exec ollama ollama run "$MODEL" "ping" --verbose=false

echo "Model $MODEL pulled and warmed."
