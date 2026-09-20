#!/usr/bin/env bash
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -euo pipefail

# Build EU4 tutorial embeddings from specific Paradox wiki pages.
# Run from game_companion directory: ./eu4/build_embeddings.sh

# Ensure we're in the game_companion directory
if [ ! -f "pyproject.toml" ] || [ ! -d "eu4" ]; then
    echo "Error: This script must be run from the game_companion directory"
    echo "Usage: cd game_companion && ./eu4/build_embeddings.sh"
    exit 1
fi

# Output files in the eu4 directory
OUT_DIR="./eu4"
SITE_DIR="$OUT_DIR/site"
CORPUS="$OUT_DIR/corpus.txt"
EMB_JSON="$OUT_DIR/embeddings.json"

mkdir -p "$SITE_DIR"

# Curated list of tutorial and beginner-relevant pages
TUTORIAL_URLS=(
  "https://eu4.paradoxwikis.com/Beginner%27s_guide"
  "https://eu4.paradoxwikis.com/Interface"
  "https://eu4.paradoxwikis.com/Country_interface"
  "https://eu4.paradoxwikis.com/Province_interface"
  "https://eu4.paradoxwikis.com/Macrobuilder"
  "https://eu4.paradoxwikis.com/Controls"
  "https://eu4.paradoxwikis.com/Land_warfare"
  "https://eu4.paradoxwikis.com/Naval_warfare"
  "https://eu4.paradoxwikis.com/Warfare"
  "https://eu4.paradoxwikis.com/Army"
  "https://eu4.paradoxwikis.com/Navy"
  "https://eu4.paradoxwikis.com/Diplomacy"
  "https://eu4.paradoxwikis.com/Economy"
  "https://eu4.paradoxwikis.com/Trade"
  "https://eu4.paradoxwikis.com/Technology"
  "https://eu4.paradoxwikis.com/Colonization"
  "https://eu4.paradoxwikis.com/Religion"
  "https://eu4.paradoxwikis.com/Estates"
  "https://eu4.paradoxwikis.com/Government"
  "https://eu4.paradoxwikis.com/Monarch_power"
  "https://eu4.paradoxwikis.com/Stability"
  "https://eu4.paradoxwikis.com/Aggressive_expansion"
  "https://eu4.paradoxwikis.com/Coring"
  "https://eu4.paradoxwikis.com/Culture"
  "https://eu4.paradoxwikis.com/Development"
  "https://eu4.paradoxwikis.com/Buildings"
  "https://eu4.paradoxwikis.com/Advisors"
  "https://eu4.paradoxwikis.com/Missions"
  "https://eu4.paradoxwikis.com/Disasters"
  "https://eu4.paradoxwikis.com/Holy_Roman_Empire"
  "https://eu4.paradoxwikis.com/Papacy"
  "https://eu4.paradoxwikis.com/Subject_nations"
  "https://eu4.paradoxwikis.com/Alliance"
  "https://eu4.paradoxwikis.com/Personal_union"
  "https://eu4.paradoxwikis.com/Coalition"
)

echo "1) Downloading tutorial pages (${#TUTORIAL_URLS[@]} pages)..."
if ! command -v wget2 >/dev/null 2>&1; then
  echo "Error: wget2 is required. Please install it first."
  exit 1
fi

# Download each page
for i in "${!TUTORIAL_URLS[@]}"; do
  url="${TUTORIAL_URLS[$i]}"
  echo "[$((i+1))/${#TUTORIAL_URLS[@]}] Downloading: $(basename "$url" | sed 's/%27/'"'"'/g')"
  
  wget2 \
    --no-parent \
    --page-requisites \
    --convert-links \
    --adjust-extension \
    --no-clobber \
    --wait=1 \
    --random-wait \
    --limit-rate=200k \
    --user-agent="EU4-Companion-Embeddings/1.0 (+https://example.org)" \
    -P "$SITE_DIR" \
    "$url" 2>/dev/null || echo "  Warning: Failed to download $url"
done

echo "2) Converting HTML to text..."
: > "$CORPUS"

# Process downloaded HTML files (unique files only)
find "$SITE_DIR" -type f -name '*.html' | sort -u | while IFS= read -r f; do
  # Skip index files, special pages, and client challenge pages
  basename=$(basename "$f")
  if [[ "$basename" =~ ^(index\.html|Special:|Talk:|User:|File:|Category:|Template:|client_challenge) ]]; then
    continue
  fi
  
  # Extract title and canonical URL
  TITLE="$(grep -m1 -oP '(?<=<title>).*?(?=</title>)' "$f" 2>/dev/null | sed 's/ - Europa Universalis 4 Wiki//; s/^\s*//; s/\s*$//')"
  CANON="$(grep -m1 -oP '(?<=rel="canonical" href=")[^"]+' "$f" 2>/dev/null || echo "file://$f")"
  
  [ -z "$TITLE" ] && TITLE="$(basename "$f" .html | sed 's/_/ /g')"
  
  echo "  Processing: $TITLE"
  
  {
    echo
    echo "===== $TITLE ====="
    echo "URL: $CANON"
    echo
    
    # Convert HTML to text
    if command -v lynx >/dev/null 2>&1; then
      lynx -dump -nolist -width=10000 "$f" 2>/dev/null
    elif command -v w3m >/dev/null 2>&1; then
      w3m -dump "$f" 2>/dev/null
    elif command -v html2text >/dev/null 2>&1; then
      html2text -width 0 "$f" 2>/dev/null
    else
      # Basic HTML stripping
      sed -e 's/<[^>]*>//g' "$f"
    fi | \
    # Remove navigation and UI elements
    sed '/^\s*Navigation menu\s*$/,/^$/d' | \
    sed '/^\s*Tools\s*$/,/^$/d' | \
    sed '/^\s*Personal tools\s*$/,/^$/d' | \
    sed '/^\s*Views\s*$/,/^$/d' | \
    sed '/^\s*More\s*$/,/^$/d' | \
    sed '/^\s*Search\s*$/,/^$/d' | \
    sed '/^\s*\[edit\]\s*$/d' | \
    # Remove excessive blank lines
    sed '/^$/N;/^\n$/d'
  } >> "$CORPUS"
done

# Check corpus size
CORPUS_SIZE=$(du -h "$CORPUS" | cut -f1)
echo "Corpus size: $CORPUS_SIZE"

echo "3) Building embeddings JSON..."
# Create embeddings using uv
if ! command -v uv >/dev/null 2>&1; then
  echo "Error: uv is required. Please install it first."
  exit 1
fi

echo "Using uv to create embeddings..."
uv run python embeddings.py \
  --input "$CORPUS" \
  --output "$EMB_JSON" \
  --chunk-size 1500 \
  --overlap 300 \
  --model "gemini-embedding-001"

# Attribution
echo "Content derived from https://eu4.paradoxwikis.com/ (CC BY-SA). See site for license details." > "$OUT_DIR/ATTRIBUTION.txt"

echo "Done!"
echo "Tutorial corpus: $CORPUS ($CORPUS_SIZE)"
echo "Embeddings at: $EMB_JSON"
echo ""
echo "To use with voice chat:"
echo "  cd <project_root>"
echo "  VOICE_GAME=eu4 GOOGLE_API_KEY=... poetry run python waker/voice_chat.py"
