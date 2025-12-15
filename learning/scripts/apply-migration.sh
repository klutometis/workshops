#!/usr/bin/env bash
# Apply database migration to PostgreSQL
# Usage: ./scripts/apply-migration.sh [migration-name]
#
# If migration-name is provided, only runs that migration
# Otherwise, runs all unapplied migrations in order

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "🔄 Little PAIPer - Database Migration"
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
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "scripts/migrations" ]; then
    echo -e "${RED}❌ Must run from learning/ directory${NC}"
    echo "Usage: cd learning && ./scripts/apply-migration.sh"
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

echo "🔗 Connection: ${DB_URL%%@*}@***" # Hide password in output
echo ""

# Get specific migration or all migrations
SPECIFIC_MIGRATION="${1:-}"

if [ -n "$SPECIFIC_MIGRATION" ]; then
    # Run specific migration
    MIGRATION_FILE="scripts/migrations/${SPECIFIC_MIGRATION}.sql"
    
    if [ ! -f "$MIGRATION_FILE" ]; then
        echo -e "${RED}❌ Migration not found: $MIGRATION_FILE${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}📝 Applying migration: ${SPECIFIC_MIGRATION}${NC}"
    echo ""
    
    if psql "$DB_URL" -f "$MIGRATION_FILE"; then
        echo ""
        echo -e "${GREEN}✅ Migration ${SPECIFIC_MIGRATION} applied successfully!${NC}"
    else
        echo ""
        echo -e "${RED}❌ Migration ${SPECIFIC_MIGRATION} failed${NC}"
        exit 1
    fi
else
    # Run all unapplied migrations in order
    echo "🔍 Checking for unapplied migrations..."
    echo ""
    
    # Ensure schema_migrations table exists
    psql "$DB_URL" -c "
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name TEXT UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    " > /dev/null
    
    # Get list of applied migrations
    APPLIED_MIGRATIONS=$(psql "$DB_URL" -t -c "SELECT migration_name FROM schema_migrations ORDER BY migration_name;" | tr -d ' ')
    
    # Find all migration files
    MIGRATION_FILES=$(ls scripts/migrations/*.sql 2>/dev/null | sort || true)
    
    if [ -z "$MIGRATION_FILES" ]; then
        echo -e "${YELLOW}⚠️  No migration files found in scripts/migrations/${NC}"
        exit 0
    fi
    
    APPLIED_COUNT=0
    SKIPPED_COUNT=0
    
    for MIGRATION_FILE in $MIGRATION_FILES; do
        # Extract migration name (e.g., "001-add-users" from "scripts/migrations/001-add-users.sql")
        MIGRATION_NAME=$(basename "$MIGRATION_FILE" .sql)
        
        # Check if already applied
        if echo "$APPLIED_MIGRATIONS" | grep -q "^${MIGRATION_NAME}$"; then
            echo -e "${YELLOW}⏭️  Skipping ${MIGRATION_NAME} (already applied)${NC}"
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        else
            echo -e "${BLUE}📝 Applying migration: ${MIGRATION_NAME}${NC}"
            
            if psql "$DB_URL" -f "$MIGRATION_FILE"; then
                echo -e "${GREEN}✅ ${MIGRATION_NAME} applied successfully${NC}"
                APPLIED_COUNT=$((APPLIED_COUNT + 1))
            else
                echo ""
                echo -e "${RED}❌ Migration ${MIGRATION_NAME} failed${NC}"
                exit 1
            fi
            echo ""
        fi
    done
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}✅ Migration complete!${NC}"
    echo "   Applied: $APPLIED_COUNT"
    echo "   Skipped: $SKIPPED_COUNT"
fi

echo ""
echo "Next steps:"
echo "  1. Verify migration: npx tsx scripts/check-db-schema.ts"
echo "  2. Test with existing data"
echo ""
