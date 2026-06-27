@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."

if not defined COMPOSE_FILE set COMPOSE_FILE=docker-compose.cpu.yml

echo ========================================
echo   LLM Model Selector
echo ========================================
echo.
echo Compose file: %COMPOSE_FILE%
echo.

for /f "tokens=2 delims=: " %%a in ('findstr /B "      OLLAMA_MODEL:" %COMPOSE_FILE%') do set CURRENT=%%a
echo Current model: %CURRENT%
echo.
echo Select a model:
echo.
echo   1) smollm:135m     - Default (~92 MB)
echo   2) smollm:360m     - Very fast (~229 MB)
echo   3) tinyllama       - Fast (~637 MB)
echo   4) qwen2.5:0.5b    - Balanced (~400 MB)
echo   5) qwen2.5:1.5b    - Better (~1 GB)
echo   6) llama3.2:1b     - Good (~1.3 GB)
echo   7) llama3.2:3b     - Best (~2.5 GB)
echo   8) Custom
echo   0) Exit
echo.

set /p choice="Enter your choice (0-8): "

if "%choice%"=="1" set MODEL=smollm:135m
if "%choice%"=="2" set MODEL=smollm:360m
if "%choice%"=="3" set MODEL=tinyllama
if "%choice%"=="4" set MODEL=qwen2.5:0.5b
if "%choice%"=="5" set MODEL=qwen2.5:1.5b
if "%choice%"=="6" set MODEL=llama3.2:1b
if "%choice%"=="7" set MODEL=llama3.2:3b
if "%choice%"=="8" set /p MODEL="Enter custom model name: "
if "%choice%"=="0" exit /b 0

if not defined MODEL (
  echo Invalid choice.
  exit /b 1
)

echo.
echo Selected model: %MODEL%
echo.

call "%~dp0switch-model.bat" %MODEL%
