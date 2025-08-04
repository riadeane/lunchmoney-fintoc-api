#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Lunchmoney-Fintoc Sync Docker Runner${NC}"
echo "========================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create a .env file with your API credentials."
    echo "You can copy from .env.example:"
    echo "  cp .env.example .env"
    echo "  # Then edit .env with your actual API keys"
    exit 1
fi

# Check if required variables are set
source .env
if [ -z "$LUNCHMONEY_TOKEN" ] || [ -z "$FINTOC_API_KEY" ] || [ -z "$FINTOC_LINK_ID" ]; then
    echo -e "${RED}❌ Error: Required environment variables not set${NC}"
    echo "Please ensure your .env file contains:"
    echo "  LUNCHMONEY_TOKEN=your_token"
    echo "  FINTOC_API_KEY=your_key"
    echo "  FINTOC_LINK_ID=your_link_id"
    exit 1
fi

# Parse command line arguments
MODE="server"
COMMAND=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --cli)
            MODE="cli"
            shift
            ;;
        --dry-run)
            COMMAND="$COMMAND --dry-run"
            shift
            ;;
        --show-memory)
            COMMAND="$COMMAND --show-memory"
            shift
            ;;
        --rebuild-memory)
            COMMAND="$COMMAND --rebuild-memory"
            shift
            ;;
        --clear-memory)
            COMMAND="$COMMAND --clear-memory"
            shift
            ;;
        --export-memory)
            COMMAND="$COMMAND --export-memory"
            shift
            ;;
        --build)
            echo -e "${YELLOW}🔨 Building Docker image...${NC}"
            docker-compose build
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --cli              Run in CLI mode instead of server"
            echo "  --dry-run          Preview changes without making them"
            echo "  --show-memory      Display memory statistics"
            echo "  --rebuild-memory   Rebuild memory from transaction history"
            echo "  --clear-memory     Clear all memory"
            echo "  --export-memory    Export memory to config format"
            echo "  --build            Build Docker image before running"
            echo "  --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                           # Run server"
            echo "  $0 --cli --dry-run          # CLI dry run"
            echo "  $0 --cli --show-memory      # Show memory stats"
            echo "  $0 --build                  # Build and run server"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Build image if it doesn't exist
if ! docker image inspect lunchmoney-fintoc-sync_lunchmoney-fintoc-sync >/dev/null 2>&1; then
    echo -e "${YELLOW}🔨 Docker image not found. Building...${NC}"
    docker-compose build
fi

if [ "$MODE" = "cli" ]; then
    echo -e "${GREEN}🖥️  Running CLI mode...${NC}"
    if [ -n "$COMMAND" ]; then
        echo -e "${BLUE}Command: node bin/cli.js$COMMAND${NC}"
    fi
    docker-compose run --rm lunchmoney-fintoc-cli node bin/cli.js $COMMAND
else
    echo -e "${GREEN}🚀 Starting server mode...${NC}"
    echo -e "${BLUE}Health check: http://localhost:5000/health${NC}"
    echo -e "${BLUE}Statistics: http://localhost:5000/stats${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    docker-compose up lunchmoney-fintoc-sync
fi