#!/usr/bin/env bash
# ============================================================
#  Ward Budget Tracker - one-click start (Linux / macOS)
# ============================================================
#  This will:
#    1. Install dependencies if needed
#    2. Build the production bundle if missing
#    3. Start a local server at http://localhost:4173
#    4. Try to open the app in your default browser
# ============================================================

set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "[ERROR] Node.js is not installed or not on PATH."
  echo "Install Node 18+ from https://nodejs.org/ and try again."
  echo
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies for the first time. This may take a few minutes..."
  npm install
fi

if [ ! -f dist/index.html ]; then
  echo "Building production bundle..."
  npm run build
fi

URL="http://localhost:4173"

echo
echo "Starting Ward Budget Tracker on $URL ..."
echo "Press Ctrl+C in this window to stop the server."
echo

# Open the URL in the default browser if a known opener exists.
if command -v xdg-open >/dev/null 2>&1; then
  ( sleep 1 && xdg-open "$URL" >/dev/null 2>&1 ) &
elif command -v open >/dev/null 2>&1; then
  ( sleep 1 && open "$URL" >/dev/null 2>&1 ) &
fi

exec npx serve -s dist -l 4173
