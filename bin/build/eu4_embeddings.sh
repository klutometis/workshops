#!/usr/bin/env bash
set -euo pipefail

# Build EU4 embeddings from the Paradox wiki.
# Run from repo root: bin/build/eu4_embeddings.sh

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BASE_URL="https://eu4.paradoxwikis.com/"
OUT_DIR="$ROOT_DIR/game_companion/plugins/eu4/rag"
SITE_DIR="$OUT_DIR/site"
CORPUS="$OUT_DIR/eu4_guide.txt"
EMB_JSON="$OUT_DIR/eu4_walkthrough_embeddings.json"

mkdir -p "$SITE_DIR"

echo "1) Crawling site (polite, concurrent, HTML-only)…"
if ! command -v wget2 >/dev/null 2>&1; then
  echo "Error: wget2 is required. Please install it first."
  exit 1
fi

echo "Using wget2 with no-clobber (skip existing files)"
wget2 \
  -r \
  -nc \
  --no-parent \
  --no-page-requisites \
  --adjust-extension \
  --convert-links \
  --wait=1 \
  --random-wait \
  --max-threads=4 \
  --limit-rate=200k \
  --reject="*.png,*.jpg,*.jpeg,*.gif,*.svg,*.webp,*.ico,*.css,*.js,*.pdf,*.zip,*.woff,*.woff2,*.ttf,*.eot,*.mp3,*.mp4,*.avi,*.mov" \
  --reject-regex '.*(action=|oldid=|diff=|printable=yes|title=Special:|title=Talk:|title=Help:|title=User:|title=File:|title=Category:|title=Template:|index\.php\?).*' \
  --domains eu4.paradoxwikis.com \
  --user-agent="EU4-Companion-Embeddings/1.0 (+https://example.org)" \
  -P "$SITE_DIR" \
  "$BASE_URL"

echo "2) Converting HTML to text…"
: > "$CORPUS"
find "$SITE_DIR" -type f -name '*.html' -print0 | while IFS= read -r -d '' f; do
  TITLE="$(grep -m1 -oP '(?<=<title>).*?(?=</title>)' "$f" 2>/dev/null | sed 's/ - .*//; s/^\s*//; s/\s*$//')"
  CANON="$(grep -m1 -oP '(?<=rel=\"canonical\" href=\")[^\"]+' "$f" 2>/dev/null || true)"
  [ -z "$TITLE" ] && TITLE="$(basename "$f")"
  [ -z "$CANON" ] && CANON="file://$f"

  {
    echo
    echo "===== $TITLE ====="
    echo "URL: $CANON"
    echo

    if command -v lynx >/dev/null 2>&1; then
      lynx -dump -nolist -width=10000 "$f"
    elif command -v w3m >/dev/null 2>&1; then
      w3m -dump "$f"
    elif command -v html2text >/dev/null 2>&1; then
      html2text -width 0 "$f"
    else
      # Fallback: crude tag strip
      sed -e 's/<[^>]*>//g' "$f"
    fi \
    | sed '/^\s*Navigation menu\s*$/,/^$/d' \
    | sed '/^\s*Tools\s*$/,/^$/d' \
    | sed '/^\s*Personal tools\s*$/,/^$/d'
  } >> "$CORPUS"
done

echo "3) Building embeddings JSON…"
mkdir -p "$OUT_DIR"
cp "$CORPUS" "$ROOT_DIR/waker/walkthrough.txt"
python "$ROOT_DIR/waker/create_embeddings.py" --input "$ROOT_DIR/waker/walkthrough.txt" --output "$EMB_JSON"

# Attribution (CC BY-SA)
echo "Content derived from https://eu4.paradoxwikis.com/ (CC BY-SA). See site for license details." > "$OUT_DIR/ATTRIBUTION.txt"

echo "Done."
echo "Embeddings at: $EMB_JSON"
