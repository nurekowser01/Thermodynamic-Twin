# Shared model switch helpers — source from select-model.sh / switch-model.sh
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.cpu.yml}"
COMPOSE_PATH="$ROOT/$COMPOSE_FILE"

compose() {
  docker compose -f "$COMPOSE_PATH" "$@"
}

get_current_model() {
  grep '^      OLLAMA_MODEL:' "$COMPOSE_PATH" | sed 's/.*OLLAMA_MODEL: //' | tr -d ' '
}

model_exists_locally() {
  local model="$1"
  compose exec -T ollama ollama list 2>/dev/null \
    | awk 'NR>1 {print $1}' \
    | grep -qxF "$model"
}

ensure_ollama_running() {
  cd "$ROOT"
  echo "Starting Ollama ($COMPOSE_FILE)..."
  compose up -d ollama
  echo "Waiting for Ollama..."
  for _ in $(seq 1 30); do
    if compose exec -T ollama ollama list >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Error: Ollama did not become ready in time." >&2
  return 1
}

pull_model() {
  local model="$1"
  if model_exists_locally "$model"; then
    echo "Model already exists locally: $model"
    return 0
  fi
  echo "Pulling model: $model"
  compose exec -T ollama ollama pull "$model"
}

update_compose_model() {
  local model="$1"
  cd "$ROOT"
  if [[ "$OSTYPE" == darwin* ]]; then
    sed -i '' "s/^      OLLAMA_MODEL: .*/      OLLAMA_MODEL: ${model}/" "$COMPOSE_PATH"
  else
    sed -i "s/^      OLLAMA_MODEL: .*/      OLLAMA_MODEL: ${model}/" "$COMPOSE_PATH"
  fi
  echo "Updated $COMPOSE_FILE -> OLLAMA_MODEL: $model"
}

restart_advisor() {
  cd "$ROOT"
  echo "Restarting llm-advisor..."
  compose up -d --force-recreate llm-advisor
}

warm_model() {
  local model="$1"
  echo "Warming model in memory..."
  compose exec -T ollama ollama run "$model" "ping" --verbose=false >/dev/null 2>&1 || true
}

check_health() {
  sleep 3
  echo "Health check:"
  if curl -sf http://localhost:8080/api/llm/health 2>/dev/null; then
    echo ""
    return 0
  fi
  echo "Could not reach http://localhost:8080/api/llm/health"
  echo "Ensure the frontend container is running: compose up -d"
  return 1
}

apply_model() {
  local model="$1"
  if [[ -z "$model" ]]; then
    echo "Error: model name is required." >&2
    return 1
  fi

  cd "$ROOT"
  ensure_ollama_running
  pull_model "$model"
  update_compose_model "$model"
  restart_advisor
  warm_model "$model"
  check_health || true

  echo ""
  echo "Model switch complete: $model"
  echo "Compose file: $COMPOSE_FILE"
  echo "Open http://localhost:8080"
}
