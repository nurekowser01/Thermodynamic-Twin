#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=model-switch.sh
source "$SCRIPT_DIR/model-switch.sh"

MODEL="${OLLAMA_MODEL:-$(get_current_model)}"

cd "$ROOT"
ensure_ollama_running
pull_model "$MODEL"
warm_model "$MODEL"

echo ""
echo "Model $MODEL pulled and warmed."
echo "Health check:"
check_health || true
