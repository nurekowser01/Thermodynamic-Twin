@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."

set MODEL=%~1
if not defined MODEL set MODEL=smollm:135m

echo Switching to %MODEL%...

echo Starting Ollama...
docker compose up -d ollama

echo Pulling model (skips if already local)...
docker compose exec -T ollama ollama pull %MODEL%

echo Updating docker-compose.yml...
powershell -NoProfile -Command "(Get-Content docker-compose.yml) -replace '^      OLLAMA_MODEL: .*', '      OLLAMA_MODEL: %MODEL%' | Set-Content docker-compose.yml"

echo Restarting llm-advisor...
docker compose up -d --force-recreate llm-advisor

echo Warming model...
docker compose exec -T ollama ollama run %MODEL% "ping" --verbose=false

echo.
echo Model switch complete: %MODEL%
echo Open http://localhost:8080
curl -s http://localhost:8080/api/llm/health 2>nul
echo.
