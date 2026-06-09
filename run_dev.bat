@echo off
:: run_dev.bat — Start backend API + frontend dev server (Windows)
:: Usage: double-click or run from terminal

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   Sirajganj GT Twin — Dev Launcher
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set ROOT=%~dp0

:: Start FastAPI backend in new window
echo Starting FastAPI backend on port 8749...
start "GT Twin — Backend" cmd /k "cd /d %ROOT%backend && uvicorn api:app --port 8749 --reload"

:: Wait 3 seconds for backend
timeout /t 3 /nobreak > nul

:: Start Vite frontend in new window
echo Starting Vite frontend on port 5173...
start "GT Twin — Frontend" cmd /k "cd /d %ROOT%frontend && npm run dev"

echo.
echo   Backend  : http://localhost:8749
echo   Frontend : http://localhost:5173
echo   API docs : http://localhost:8749/docs
echo.
echo   Close both terminal windows to stop.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pause
