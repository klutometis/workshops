#!/bin/bash
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

set -e

# Configuration
IMAGE_NAME="learning-job-test"
IMAGE_TAG="${2:-latest}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment from ~/.env-secrets if it exists
if [ -f "$HOME/.env-secrets" ]; then
  echo -e "${BLUE}📝 Loading secrets from ~/.env-secrets${NC}"
  set -a
  source "$HOME/.env-secrets"
  set +a
fi

# Check for library ID
LIBRARY_ID="${1:-}"
if [ -z "$LIBRARY_ID" ]; then
  echo -e "${RED}❌ Error: Library ID required${NC}"
  echo ""
  echo "Usage: $0 <library-id> [image-tag]"
  echo ""
  echo "Example:"
  echo "  $0 53bb5e7f-9a4d-4cf1-a926-7e6b7d3d203a"
  echo ""
  exit 1
fi

# Validate UUID format
if ! [[ "$LIBRARY_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
  echo -e "${RED}❌ Error: Invalid library ID format${NC}"
  echo "Expected UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  exit 1
fi

# Check for required environment variables
if [ -z "$GOOGLE_API_KEY" ]; then
  echo -e "${YELLOW}⚠️  Warning: GOOGLE_API_KEY not set${NC}"
fi

if [ -z "$LEARNING_DATABASE_URL" ]; then
  echo -e "${YELLOW}⚠️  Warning: LEARNING_DATABASE_URL not set${NC}"
fi

# Verify we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ Error: Must run from the learning directory${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}🧪 Testing Cloud Run Job Locally${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Library ID: ${LIBRARY_ID}"
echo -e "  Image Tag: ${IMAGE_TAG}"
echo ""

# Build the image
echo -e "${YELLOW}🏗️  Building Docker image...${NC}"
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""

# Run the job command
echo -e "${BLUE}🚀 Running job processor...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

docker run --rm \
  -e LIBRARY_ID="$LIBRARY_ID" \
  -e GOOGLE_API_KEY="$GOOGLE_API_KEY" \
  -e DATABASE_URL="$LEARNING_DATABASE_URL" \
  -e NODE_ENV=production \
  -e KEEP_TEMP_FILES=true \
  "${IMAGE_NAME}:${IMAGE_TAG}" \
  npx tsx scripts/process-library.ts

EXIT_CODE=$?

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ Job completed successfully!${NC}"
else
  echo -e "${RED}❌ Job failed with exit code: $EXIT_CODE${NC}"
fi
echo ""

exit $EXIT_CODE
