#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=model-switch.sh
source "$SCRIPT_DIR/model-switch.sh"

echo "========================================"
echo "  LLM Model Selector"
echo "========================================"
echo ""
echo "Current model: $(get_current_model)"
echo ""
echo "Select a model:"
echo ""
echo "  1) smollm:135m     - Default (~92 MB)"
echo "  2) smollm:360m     - Very fast (~229 MB)"
echo "  3) tinyllama       - Fast (~637 MB)"
echo "  4) qwen2.5:0.5b    - Balanced (~400 MB)"
echo "  5) qwen2.5:1.5b    - Better (~1 GB)"
echo "  6) llama3.2:1b     - Good (~1.3 GB)"
echo "  7) llama3.2:3b     - Best (~2.5 GB)"
echo "  8) Custom          - Enter any model name"
echo "  0) Exit"
echo ""

read -r -p "Enter your choice (0-8): " choice

case "$choice" in
  1) MODEL="smollm:135m" ;;
  2) MODEL="smollm:360m" ;;
  3) MODEL="tinyllama" ;;
  4) MODEL="qwen2.5:0.5b" ;;
  5) MODEL="qwen2.5:1.5b" ;;
  6) MODEL="llama3.2:1b" ;;
  7) MODEL="llama3.2:3b" ;;
  8) read -r -p "Enter custom model name: " MODEL ;;
  0) echo "Exiting."; exit 0 ;;
  *) echo "Invalid choice." >&2; exit 1 ;;
esac

echo ""
echo "Selected model: $MODEL"
echo ""
apply_model "$MODEL"
