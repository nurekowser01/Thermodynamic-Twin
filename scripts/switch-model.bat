@echo off
setlocal
cd /d "%~dp0.."

if not defined COMPOSE_FILE set COMPOSE_FILE=docker-compose.cpu.yml

set MODEL=%~1
if not defined MODEL set MODEL=qwen2.5:0.5b

echo Switching to %MODEL% (%COMPOSE_FILE%)...

echo Starting Ollama...
docker compose -f %COMPOSE_FILE% up -d ollama

echo Pulling model (skips if already local)...
docker compose -f %COMPOSE_FILE% exec -T ollama ollama pull %MODEL%

echo Updating %COMPOSE_FILE%...
powershell -NoProfile -Command "(Get-Content %COMPOSE_FILE%) -replace '^      OLLAMA_MODEL: .*', '      OLLAMA_MODEL: %MODEL%' | Set-Content %COMPOSE_FILE%"

echo Restarting llm-advisor...
docker compose -f %COMPOSE_FILE% up -d --force-recreate llm-advisor

echo Warming model...
docker compose -f %COMPOSE_FILE% exec -T ollama ollama run %MODEL% "ping" --verbose=false

echo.
echo Model switch complete: %MODEL%
echo Compose file: %COMPOSE_FILE%
echo Open http://localhost:8080
curl -s http://localhost:8080/api/llm/health 2>nul
echo.
