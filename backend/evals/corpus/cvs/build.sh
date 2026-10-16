#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | tail -1)}"
if [ ! -x "${CHROME:-}" ]; then
  echo "No Chromium found. Install Playwright's browsers or set CHROME to a chrome binary." >&2
  exit 1
fi

render() {
  "$CHROME" --headless --no-sandbox --disable-gpu --no-pdf-header-footer "$@" >/dev/null 2>&1
}

for dir in */; do
  case="${dir%/}"
  [ -f "$case/index.html" ] || continue
  if grep -q 'name="layout" content="scan"' "$case/index.html"; then
    render --hide-scrollbars --window-size=794,1123 --force-device-scale-factor=2 --screenshot="$case/page.png" "$case/index.html"
    cat > "$case/scan.html" <<'HTML'
<!doctype html>
<html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 0 }
body { margin: 0 }
img { display: block; width: 210mm; height: 297mm; filter: grayscale(1) contrast(1.15) blur(0.3px); transform: rotate(0.3deg) }
</style></head><body><img src="page.png"></body></html>
HTML
    render --print-to-pdf="$case/cv.pdf" "$case/scan.html"
    rm "$case/scan.html" "$case/page.png"
    echo "$case: cv.pdf (scan, no text layer)"
  else
    render --print-to-pdf="$case/cv.pdf" "$case/index.html"
    echo "$case: cv.pdf"
  fi
done
