#!/usr/bin/env bash
# Start Cloud SQL Proxy for local development
# Usage: ./scripts/start-db-proxy.sh

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "🔌 Starting Cloud SQL Proxy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Load environment from ~/.env-secrets if it exists
if [ -f "$HOME/.env-secrets" ]; then
    echo "📝 Loading secrets from ~/.env-secrets"
    set -a
    source "$HOME/.env-secrets"
    set +a
else
    echo -e "${RED}❌ Error: ~/.env-secrets not found${NC}"
    exit 1
fi

# Check required variables
if [ -z "${LEARNING_GCP_PROJECT_ID:-}" ]; then
    echo -e "${RED}❌ Error: LEARNING_GCP_PROJECT_ID not set${NC}"
    exit 1
fi

INSTANCE_CONNECTION_NAME="${LEARNING_GCP_PROJECT_ID}:us-central1:learning-db"
PROXY_PORT=5432

echo -e "  Project: ${BLUE}${LEARNING_GCP_PROJECT_ID}${NC}"
echo -e "  Instance: ${BLUE}learning-db${NC}"
echo -e "  Port: ${BLUE}${PROXY_PORT}${NC}"
echo ""

# Check if cloud-sql-proxy is installed
if [ ! -f "$HOME/bin/cloud-sql-proxy" ]; then
    echo -e "${RED}❌ Error: cloud-sql-proxy not found at ~/bin/cloud-sql-proxy${NC}"
    echo "Install with: curl -o ~/bin/cloud-sql-proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64"
    exit 1
fi

# Check if port is already in use
if lsof -Pi :${PROXY_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port ${PROXY_PORT} is already in use${NC}"
    echo "Checking if it's the proxy..."
    if pgrep -f "cloud-sql-proxy.*${INSTANCE_CONNECTION_NAME}" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Cloud SQL Proxy is already running${NC}"
        exit 0
    else
        echo -e "${RED}❌ Port is used by another process${NC}"
        echo "Stop it or choose a different port"
        exit 1
    fi
fi

echo -e "${BLUE}▶️  Starting proxy...${NC}"
echo ""
echo "Connection string for local development:"
echo -e "${GREEN}${LEARNING_DATABASE_URL_PROXY}${NC}"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the proxy
$HOME/bin/cloud-sql-proxy \
    "${INSTANCE_CONNECTION_NAME}" \
    --port="${PROXY_PORT}"
