#!/usr/bin/env bash
# Apply database schema to PostgreSQL
# Usage: ./scripts/apply-schema.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "🗄️  Little PAIPer - Schema Application"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Load environment from ~/.env-secrets if it exists
if [ -f "$HOME/.env-secrets" ]; then
    echo "📝 Loading environment from ~/.env-secrets"
    set -a
    source "$HOME/.env-secrets"
    set +a
else
    echo -e "${YELLOW}⚠️  ~/.env-secrets not found${NC}"
fi

# Check for database connection string
DB_URL="${LEARNING_DATABASE_URL_PROXY:-${DATABASE_URL:-}}"

if [ -z "$DB_URL" ]; then
    echo -e "${RED}❌ Database connection not configured!${NC}"
    echo ""
    echo "Set one of these environment variables:"
    echo "  LEARNING_DATABASE_URL_PROXY (recommended for local dev)"
    echo "  DATABASE_URL (fallback)"
    echo ""
    echo "Example in ~/.env-secrets:"
    echo '  LEARNING_DATABASE_URL_PROXY="postgresql://postgres:password@localhost:5432/learning"'
    echo ""
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "scripts/schema.sql" ]; then
    echo -e "${RED}❌ Must run from learning/ directory${NC}"
    echo "Usage: cd learning && ./scripts/apply-schema.sh"
    exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql not found!${NC}"
    echo ""
    echo "Install PostgreSQL client:"
    echo "  Ubuntu/Debian: sudo apt install postgresql-client"
    echo "  macOS: brew install postgresql"
    echo ""
    exit 1
fi

# Apply schema
echo "📝 Applying schema from scripts/schema.sql..."
echo "🔗 Connection: ${DB_URL%%@*}@***" # Hide password in output
echo ""

if psql "$DB_URL" -f scripts/schema.sql; then
    echo ""
    echo -e "${GREEN}✅ Schema applied successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Import video: npx tsx scripts/import-youtube-to-db.ts kCc8FmEb1nY"
    echo "  2. Check data: npx tsx scripts/check-db-schema.ts"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Schema application failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Verify Cloud SQL Proxy is running: lsof -i :5432"
    echo "  2. Test connection: psql \"\$LEARNING_DATABASE_URL_PROXY\" -c 'SELECT 1;'"
    echo "  3. Check ~/.env-secrets has correct credentials"
    echo ""
    exit 1
fi
