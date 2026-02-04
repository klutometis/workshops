#!/usr/bin/env bash
# Debug mode for library processing
# Keeps temp files and shows detailed logging
#
# Usage: ./scripts/debug-process-library.sh <library-id>

set -euo pipefail

if [ $# -eq 0 ]; then
    echo "❌ Error: Library ID required"
    echo ""
    echo "Usage: ./scripts/debug-process-library.sh <library-id>"
    echo ""
    echo "Example:"
    echo "  ./scripts/debug-process-library.sh 3f41d8c2-7e56-4284-acc1-fb3b3a9c8fd9"
    exit 1
fi

LIBRARY_ID="$1"

echo ""
echo "🐛 DEBUG MODE PROCESSING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Library ID: $LIBRARY_ID"
echo ""
echo "Features enabled:"
echo "  ✓ Keep temp files (won't cleanup /tmp)"
echo "  ✓ Extra debug logging"
echo "  ✓ File size reports"
echo "  ✓ Directory listings"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Set debug environment variables
export KEEP_TEMP_FILES=true
export DEBUG_PROCESSING=true

# Run processor
npx tsx scripts/process-library.ts "$LIBRARY_ID"
