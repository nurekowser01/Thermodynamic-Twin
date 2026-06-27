#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=model-switch.sh
source "$SCRIPT_DIR/model-switch.sh"

MODEL="${1:-qwen2.5:0.5b}"
echo "Switching to $MODEL..."
apply_model "$MODEL"
