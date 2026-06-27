#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export COMPOSE_FILE=docker-compose.cpu.yml
exec docker compose -f "$ROOT/$COMPOSE_FILE" "$@"
