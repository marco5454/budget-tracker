@echo off
REM ============================================================
REM  Ward Budget Tracker - one-click start (Windows)
REM ============================================================
REM  This will:
REM    1. Install dependencies if needed
REM    2. Build the production bundle if missing or outdated
REM    3. Start a local server at http://localhost:4173
REM    4. Open the app in your default browser
REM ============================================================

setlocal enableextensions
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Install Node 18+ from https://nodejs.org/ and try again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies for the first time. This may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

if not exist dist\index.html (
  echo Building production bundle...
  call npm run build
  if errorlevel 1 (
    echo.
    echo [ERROR] Build failed.
    pause
    exit /b 1
  )
)

echo.
echo Starting Ward Budget Tracker on http://localhost:4173 ...
echo Press Ctrl+C in this window to stop the server.
echo.

start "" http://localhost:4173

call npx serve -s dist -l 4173

endlocal
