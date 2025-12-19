#!/usr/bin/env bash
# Run Next.js development server with proper environment
# Usage: ./scripts/dev.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "🚀 Little PAIPer - Development Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Load environment from ~/.env-secrets if it exists
if [ -f "$HOME/.env-secrets" ]; then
    echo "📝 Loading secrets from ~/.env-secrets"
    set -a
    source "$HOME/.env-secrets"
    set +a
else
    echo -e "${YELLOW}⚠️  ~/.env-secrets not found${NC}"
fi

# Verify we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from the learning directory${NC}"
    echo "Usage: cd learning && ./scripts/dev.sh"
    exit 1
fi

# Map dev credentials to generic env vars
export GITHUB_CLIENT_ID="${LILPAIPER_GITHUB_CLIENT_ID_DEV:-}"
export GITHUB_CLIENT_SECRET="${LILPAIPER_GITHUB_CLIENT_SECRET_DEV:-}"
export NEXTAUTH_SECRET="${LILPAIPER_NEXTAUTH_SECRET:-}"
export NEXTAUTH_URL="http://localhost:3000"

# Database
export DATABASE_URL="${LEARNING_DATABASE_URL_PROXY:-}"

# Google AI
export GOOGLE_API_KEY="${GOOGLE_API_KEY:-}"

# Cloud Run Job (for remote processing)
export CLOUD_RUN_PROJECT_ID="${LEARNING_GCP_PROJECT_ID:-}"
export CLOUD_RUN_REGION="${LEARNING_GCP_REGION:-}"
export CLOUD_RUN_JOB_NAME="${LEARNING_CLOUD_RUN_JOB_NAME:-}"

# Node environment
export NODE_ENV="development"

echo -e "  Environment: ${BLUE}development${NC}"
echo -e "  Auth URL: ${BLUE}${NEXTAUTH_URL}${NC}"
echo ""
echo "Configuration:"
echo -e "  GitHub OAuth: ${GITHUB_CLIENT_ID:+${GREEN}✅ configured${NC}}${GITHUB_CLIENT_ID:-${YELLOW}⚠️  missing${NC}}"
echo -e "  NextAuth Secret: ${NEXTAUTH_SECRET:+${GREEN}✅ configured${NC}}${NEXTAUTH_SECRET:-${YELLOW}⚠️  missing${NC}}"
echo -e "  Database: ${DATABASE_URL:+${GREEN}✅ connected${NC}}${DATABASE_URL:-${YELLOW}⚠️  missing${NC}}"
echo -e "  Google AI: ${GOOGLE_API_KEY:+${GREEN}✅ configured${NC}}${GOOGLE_API_KEY:-${YELLOW}⚠️  missing${NC}}"
echo -e "  Processing Mode: ${PROCESSING_MODE:-${BLUE}local${NC}}"
if [ "${PROCESSING_MODE}" = "job" ]; then
  echo -e "  Cloud Run Job: ${CLOUD_RUN_JOB_NAME:+${GREEN}✅ ${CLOUD_RUN_JOB_NAME}${NC}}${CLOUD_RUN_JOB_NAME:-${YELLOW}⚠️  missing${NC}}"
fi
echo -e "  Keep Temp Files: ${KEEP_TEMP_FILES:+${YELLOW}⚠️  enabled (debug mode)${NC}}${KEEP_TEMP_FILES:-${GREEN}✅ disabled${NC}}"
echo ""

if [ -z "$GITHUB_CLIENT_ID" ] || [ -z "$GITHUB_CLIENT_SECRET" ]; then
    echo -e "${YELLOW}⚠️  GitHub OAuth not configured${NC}"
    echo "   Auth features will be disabled"
    echo ""
fi

echo -e "${BLUE}▶️  Starting Next.js dev server...${NC}"
echo ""

# Start dev server
npm run dev
