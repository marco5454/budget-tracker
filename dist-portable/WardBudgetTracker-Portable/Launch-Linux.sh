#!/usr/bin/env bash
# Ward Budget Tracker — portable launcher (Linux)
# Opens the app in your default browser. Fully offline.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="file://$DIR/app/index.html"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"
elif command -v gio >/dev/null 2>&1; then
  gio open "$URL"
else
  echo "Could not detect a browser opener. Open this URL manually:"
  echo "$URL"
fi
