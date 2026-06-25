@echo off
setlocal
cd /d "%~dp0.."

if not defined OLLAMA_MODEL (
  for /f "tokens=2 delims=: " %%a in ('findstr /B "      OLLAMA_MODEL:" docker-compose.yml') do set OLLAMA_MODEL=%%a
)
if not defined OLLAMA_MODEL set OLLAMA_MODEL=smollm:135m

echo Starting Ollama...
docker compose up -d ollama

echo Pulling model: %OLLAMA_MODEL%
docker compose exec ollama ollama pull %OLLAMA_MODEL%

echo Warming model in memory...
docker compose exec ollama ollama run %OLLAMA_MODEL% "ping"

echo.
echo Model %OLLAMA_MODEL% pulled and warmed.
echo Health check:
curl -s http://localhost:8080/api/llm/health
echo.
