#!/usr/bin/env bash
set -euo pipefail

CHROME=${CHROME:-$(ls ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | tail -1)}
FLAGS=(--headless --no-sandbox --disable-gpu --no-pdf-header-footer --log-level=3)
SAMPLES=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

for dir in "$SAMPLES"/*/; do
  id=$(basename "$dir")
  if [[ $id == *-scan ]]; then
    "$CHROME" "${FLAGS[@]}" --window-size=794,1123 --force-device-scale-factor=2 \
      --screenshot="$WORK/page.png" "file://$dir/cv.html" 2>/dev/null
    cat > "$WORK/scan.html" <<'HTML'
<!doctype html>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; background: #ebe8e1; }
  img { width: 200mm; margin: 8mm 0 0 6mm; transform: rotate(0.8deg);
        filter: grayscale(1) contrast(1.25) brightness(0.97) blur(0.5px); }
</style>
<img src="page.png" />
HTML
    "$CHROME" "${FLAGS[@]}" --print-to-pdf="$dir/cv.pdf" "file://$WORK/scan.html" 2>/dev/null
  else
    "$CHROME" "${FLAGS[@]}" --print-to-pdf="$dir/cv.pdf" "file://$dir/cv.html" 2>/dev/null
  fi
  echo "$id"
done
