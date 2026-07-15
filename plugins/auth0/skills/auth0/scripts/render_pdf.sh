#!/usr/bin/env bash
# render_pdf.sh — convert a styled HTML report into PDF.
# Usage: render_pdf.sh <input.html> <output.pdf>
# Tries headless Chrome first (zero install on macOS), then wkhtmltopdf, then weasyprint.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <input.html> <output.pdf>" >&2
  exit 2
fi

INPUT="$1"
OUTPUT="$2"

if [[ ! -f "$INPUT" ]]; then
  echo "render_pdf: input file not found: $INPUT" >&2
  exit 1
fi

# Resolve to absolute paths — Chrome's --print-to-pdf is picky about cwd.
INPUT_ABS="$(cd "$(dirname "$INPUT")" && pwd)/$(basename "$INPUT")"
OUTPUT_DIR="$(cd "$(dirname "$OUTPUT")" && pwd)"
OUTPUT_ABS="$OUTPUT_DIR/$(basename "$OUTPUT")"

CHROME_CANDIDATES=(
  # PATH lookups first — works on any system where Chrome is on $PATH
  google-chrome
  google-chrome-stable
  chromium
  chromium-browser
  chrome
  microsoft-edge
  microsoft-edge-stable
  brave-browser

  # macOS app bundles
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  "/Applications/Arc.app/Contents/MacOS/Arc"

  # Linux package locations
  /usr/bin/google-chrome
  /usr/bin/google-chrome-stable
  /usr/bin/chromium
  /usr/bin/chromium-browser
  /usr/bin/microsoft-edge
  /usr/bin/microsoft-edge-stable
  /usr/bin/brave-browser
  /opt/google/chrome/google-chrome
  /opt/google/chrome/chrome
  /snap/bin/chromium
  /snap/bin/chrome

  # Windows / WSL fallbacks
  "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
  "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
  "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe"
  "/c/Program Files/Google/Chrome/Application/chrome.exe"
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
)

resolve_chrome() {
  local cand="$1"
  if [[ "$cand" == /* ]] || [[ "$cand" == "./"* ]]; then
    [[ -x "$cand" ]] && printf '%s' "$cand" && return 0
    return 1
  fi
  command -v "$cand" 2>/dev/null && return 0
  return 1
}

CHROME=""
for cand in "${CHROME_CANDIDATES[@]}"; do
  if resolved="$(resolve_chrome "$cand")"; then
    CHROME="$resolved"
    break
  fi
done

if [[ -n "$CHROME" ]]; then
  echo "render_pdf: using $CHROME" >&2
  # Render to a temp file and only promote it on success — a stale PDF already
  # sitting at OUTPUT_ABS must never be mistaken for a fresh, successful render.
  TMP_PDF="$(mktemp -t render_pdf.XXXXXX 2>/dev/null || echo "${OUTPUT_ABS}.tmp.$$")"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --no-pdf-header-footer \
    --print-to-pdf="$TMP_PDF" \
    "file://$INPUT_ABS" \
    >/dev/null 2>&1 \
    || "$CHROME" \
      --headless \
      --disable-gpu \
      --print-to-pdf="$TMP_PDF" \
      "file://$INPUT_ABS" \
      >/dev/null 2>&1 || true
  if [[ -s "$TMP_PDF" ]]; then
    mv -f "$TMP_PDF" "$OUTPUT_ABS"
    echo "render_pdf: wrote $OUTPUT_ABS" >&2
    exit 0
  fi
  rm -f "$TMP_PDF"
  echo "render_pdf: Chrome produced no output; trying other renderers" >&2
fi

if command -v wkhtmltopdf >/dev/null 2>&1; then
  echo "render_pdf: using wkhtmltopdf" >&2
  wkhtmltopdf --enable-local-file-access "$INPUT_ABS" "$OUTPUT_ABS"
  exit $?
fi

if command -v weasyprint >/dev/null 2>&1; then
  echo "render_pdf: using weasyprint" >&2
  weasyprint "$INPUT_ABS" "$OUTPUT_ABS"
  exit $?
fi

cat >&2 <<EOF
render_pdf: no PDF renderer found.
Tried: Chrome / Chromium / Edge / Brave / Arc on macOS, Linux, WSL paths,
       plus wkhtmltopdf and weasyprint.

Install one of:
  - Google Chrome  https://www.google.com/chrome  (recommended; zero-config)
  - Chromium       (Linux: \`apt install chromium\` / \`dnf install chromium\`)
  - wkhtmltopdf    (macOS: \`brew install --cask wkhtmltopdf\` · Linux: \`apt install wkhtmltopdf\`)
  - weasyprint     (\`pip install weasyprint\` plus system cairo + pango)

The HTML report is still at: $INPUT_ABS
EOF
exit 1
