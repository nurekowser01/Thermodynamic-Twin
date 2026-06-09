#!/usr/bin/env bash
# run_dev.sh — Start backend API + frontend dev server
# Usage: bash run_dev.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Sirajganj GT Twin — Dev Launcher"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Kill any existing processes on our ports
fuser -k 8749/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true

# Start FastAPI backend
echo "▶  Starting FastAPI backend on port 8749..."
cd "$ROOT/backend"
uvicorn api:app --port 8749 --reload --log-level warning &
BACK_PID=$!

# Wait for backend to be ready
echo "   Waiting for API..."
for i in {1..15}; do
  curl -sf http://localhost:8749/health > /dev/null && break
  sleep 1
done
echo "   API ready ✓"

# Start Vite frontend
echo "▶  Starting Vite frontend on port 5173..."
cd "$ROOT/frontend"
npm run dev -- --host &
FRONT_PID=$!

echo ""
echo "  ✓ Backend  : http://localhost:8749"
echo "  ✓ Frontend : http://localhost:5173"
echo "  ✓ API docs : http://localhost:8749/docs"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

trap "kill $BACK_PID $FRONT_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
