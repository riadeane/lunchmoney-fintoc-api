# lunchmoney‑fintoc‑sync

This project provides a production‑ready Node.js solution for synchronising transactions from your Chilean bank via the [Fintoc](https://fintoc.com/) API into the [Lunch Money](https://lunchmoney.app) budget app. It includes both a command‑line interface (CLI) for one‑off syncs and a server for automated scheduling.

The original `agucova/lunchmoney‑fintoc` project was written in Rust and served as an early proof of concept.  This fork reimplements the core functionality in JavaScript/Node.js with a focus on ease of configuration, duplicate prevention, auto‑categorisation and automation.

## Features

### Core Functionality

* **Environment and JSON configuration** – supply your API keys and options either through a `.env` file or a `config.json`.  See the `.env.example` and `config.example.json` files for the available variables.
* **Enhanced duplicate prevention** – uses both simple date+amount matching and advanced transaction fingerprinting to prevent duplicates even when transactions are modified.
* **Intelligent auto‑categorisation** – combines manual rules from `config.json` with AI-like fuzzy matching and learning from your transaction history.
* **Smart memory learning** – automatically learns category assignments from your existing Lunch Money transaction history with conflict resolution and confidence scoring.
* **Automated server mode** – run a persistent server that automatically syncs transactions hourly and rebuilds the categorisation memory daily.

### Reliability & Performance

* **Exponential backoff retry logic** – automatically retries failed API calls with intelligent backoff to handle temporary network issues.
* **Batch processing** – handles large transaction sets efficiently by processing them in batches.
* **Enhanced error handling** – comprehensive error tracking, sanitized logging, and graceful degradation when individual transactions fail.
* **Rate limiting protection** – built-in safeguards to prevent hitting API rate limits.

### User Experience

* **Rich CLI interface** – colour‑coded logging with detailed progress tracking and comprehensive status reporting.
* **Memory management commands** – built-in commands to view, rebuild, clear, and export categorisation memory.
* **Dry‑run mode** – preview changes without making any API calls using `--dry-run`.
* **Detailed sync reports** – comprehensive summaries showing processed, inserted, skipped, and failed transactions.

### Server Features

* **RESTful API endpoints** – health checks, statistics, manual sync triggers, and memory management via HTTP.
* **Health monitoring** – real-time API connectivity checks and system status reporting.
* **Graceful shutdown** – proper cleanup of scheduled tasks and resources.
* **Production‑ready logging** – structured, sanitized logs suitable for production environments.

### Security & Monitoring

* **Secure credential handling** – API keys are sanitized from logs and error messages.
* **Input validation** – payee data sanitization and transaction validation.
* **Comprehensive monitoring** – server statistics, memory usage tracking, and error reporting.
* **GitHub Actions friendly** – optimized for CI/CD with proper exit codes and error handling.

## Installation

### Option 1: Docker (Recommended)

The easiest way to run this system is with Docker:

```bash
# Clone repository
git clone https://github.com/yourusername/lunchmoney-fintoc-sync.git
cd lunchmoney-fintoc-sync

# Set up environment variables
cp .env.example .env
# Edit .env with your API credentials

# Run server
./docker/docker-run.sh

# Or run CLI commands
./docker/docker-run.sh --cli --dry-run
```

### Option 2: Node.js (Manual)

If you prefer to run directly with Node.js:

```bash
git clone https://github.com/yourusername/lunchmoney-fintoc-sync.git
cd lunchmoney-fintoc-sync
npm install
```

Create a `.env` file based on `.env.example` and set your API credentials:

```bash
cp .env.example .env
```

Fill in your **Lunch Money** API token (`LUNCHMONEY_TOKEN`), your **Fintoc** API key (`FINTOC_API_KEY`), your **Fintoc** account or link ID (`FINTOC_LINK_ID`) and, optionally, the **Lunch Money asset ID** you created for your manually‑managed account (`LUNCHMONEY_ASSET_ID`).  You can also override the default number of days to sync and the currency code.

Optionally, copy `config.example.json` to `config.json` and customise it.  This JSON file lets you specify a longer sync period and define simple category rules:

```json
{
  "currency": "CLP",
  "days_to_sync": 7,
  "category_rules": {
    "Lider": "Groceries",
    "Starbucks": "Coffee"
  }
}
```

## Usage

### CLI Mode (One-time sync)

To run the sync once from the command line:

```bash
npm start
```

or, equivalently:

```bash
node bin/cli.js
```

#### CLI Options

**Basic Operations:**

```bash
node bin/cli.js --dry-run           # Preview changes without making API calls
```

**Memory Management:**

```bash
node bin/cli.js --show-memory       # Display categorization memory statistics
node bin/cli.js --rebuild-memory    # Rebuild memory from Lunch Money history
node bin/cli.js --clear-memory      # Clear all learned categorization data
node bin/cli.js --export-memory     # Export memory in config.json format
```

**Examples:**

```bash
# Check what the system has learned so far
node bin/cli.js --show-memory

# Force rebuild memory from your transaction history
node bin/cli.js --rebuild-memory

# See what would be synced without making changes
node bin/cli.js --dry-run

# Export learned rules to use in config.json
node bin/cli.js --export-memory > learned_rules.json
```

### Server Mode (Automated scheduling)

To run the persistent server that automatically handles syncing and memory learning:

```bash
node server.js
```

The server provides:

* **Hourly syncing**: Automatically syncs new transactions every hour
* **Daily memory rebuilding**: Updates categorisation memory from your Lunch Money history at 3 AM daily
* **RESTful API endpoints**: Full HTTP API for monitoring and manual control
* **Health monitoring**: Real-time system and API connectivity checks
* **Production logging**: Structured, sanitized logs with error tracking

#### Server Endpoints

**Monitoring:**

```bash
GET  /              # Server info and available endpoints
GET  /health        # Health check with API connectivity tests  
GET  /stats         # Server and memory statistics
```

**Manual Operations:**

```bash
POST /sync          # Trigger manual sync
POST /rebuild-memory # Rebuild categorization memory
```

**Examples:**

```bash
# Check server health and API connectivity
curl http://localhost:5000/health

# View server statistics and memory info
curl http://localhost:5000/stats

# Trigger a manual sync
curl -X POST http://localhost:5000/sync

# Dry-run sync without making changes
curl -X POST http://localhost:5000/sync -H "Content-Type: application/json" -d '{"dryRun": true}'

# Force rebuild memory
curl -X POST http://localhost:5000/rebuild-memory
```

The server is ideal for deployment to cloud platforms like Heroku, Railway, or any VPS where you want continuous synchronisation without manual intervention.

## Docker Deployment

### Quick Start with Docker

```bash
# Using the helper script (recommended)
./docker/docker-run.sh

# Using docker-compose directly
docker-compose up -d

# Using docker directly
docker build -t lunchmoney-fintoc-sync .
docker run -d --env-file .env -p 5000:5000 -v lunchmoney_data:/app/data lunchmoney-fintoc-sync
```

### Production Deployment

For production environments, the Docker setup includes:

* **Multi-stage builds** for optimized image size
* **Non-root user** for security
* **Health checks** for monitoring
* **Volume persistence** for memory data
* **Graceful shutdown** handling

### Kubernetes

Deploy to Kubernetes using the provided manifests:

```bash
# Apply the deployment
kubectl apply -f k8s/deployment.yaml

# Update secrets with your credentials
kubectl create secret generic lunchmoney-secrets \
  --from-literal=lunchmoney-token=your_token \
  --from-literal=fintoc-api-key=your_key \
  --from-literal=fintoc-link-id=your_link_id \
  -n lunchmoney-sync
```

See `docker/README.md` for comprehensive Docker documentation.

## Automation via GitHub Actions

The repository includes a preconfigured workflow at `.github/workflows/sync.yml` that runs the sync daily.  To enable it:

1. Go to **Settings → Secrets and variables → Actions** in your GitHub repository.
2. Add the following secrets with the same names used in `.env.example`: `LUNCHMONEY_TOKEN`, `FINTOC_API_KEY`, `FINTOC_LINK_ID`, `LUNCHMONEY_ASSET_ID`, `DAYS_TO_SYNC` (optional) and `CURRENCY_CODE` (optional).
3. Commit your changes and push to GitHub.  The workflow will run automatically on the schedule defined in the workflow (currently at 03:00 UTC each day).

## Memory Learning System

The enhanced memory learning system provides AI-like categorization through multiple sophisticated techniques:

### Learning Sources

* **Historical Analysis**: Analyses your Lunch Money transaction history from 2023-01-01 onwards
* **Frequency-based Conflict Resolution**: When payees have multiple categories, uses the most frequently assigned one
* **Confidence Thresholds**: Only learns patterns with at least 2 occurrences to avoid noise

### Matching Strategies

1. **Exact Config Rules**: Manual rules from `config.json` (highest priority)
2. **Exact Memory Matches**: Perfect payee matches from learned history
3. **Fuzzy Memory Matching**: 70%+ similarity matching using string analysis for variations like "STARBUCKS #123" → "STARBUCKS"

### Smart Features

* **Auto-Learning**: New successful matches are automatically saved to memory
* **Conflict Prevention**: Won't override explicit config.json rules
* **Input Sanitization**: Cleans payee strings for safe storage and comparison
* **Progressive Improvement**: Memory gets smarter over time as it sees more transactions

### Memory Management

```bash
# View current memory statistics
node bin/cli.js --show-memory

# Rebuild from scratch using latest transaction history  
node bin/cli.js --rebuild-memory

# Export learned rules for manual review/editing
node bin/cli.js --export-memory

# Clear all learned data and start fresh
node bin/cli.js --clear-memory
```

The memory is automatically rebuilt daily when using server mode, ensuring it stays current with your categorisation habits and learns from new manually-categorized transactions.

## Important Notes

### API Requirements

* This application uses the [Fintoc List Movements endpoint](https://docs.fintoc.com/reference/movements-list) and the [Lunch Money transactions API](https://lunchmoney.dev/#transactions) to move data.  Make sure your Fintoc link or account ID is correct.
* If you provide a `LUNCHMONEY_ASSET_ID`, new transactions will be associated with that asset.  Otherwise, the transactions will not specify an asset and may appear under your default account.

### Duplicate Detection

* **Enhanced Detection**: Uses both simple date+amount matching and transaction fingerprinting for robust duplicate prevention.
* **Transaction Fingerprinting**: Generates unique hashes based on date, amount, payee, and reference IDs to handle modified transactions.
* **Handles Edits**: Can detect duplicates even if transactions are later modified, split, or categorized in Lunch Money.

### Memory & Learning

* **Read-only Learning**: The memory system requires read access to your existing Lunch Money transactions to build categorisation patterns.
* **Automatic Persistence**: All learned categorizations are automatically saved to `categorization_memory.json`.
* **Privacy**: API keys and sensitive data are sanitized from all logs and error messages.

### Performance & Reliability

* **Automatic Retries**: Built-in exponential backoff for handling temporary API failures.
* **Batch Processing**: Large transaction sets are processed in batches to respect API limits.
* **Graceful Degradation**: Individual transaction failures won't stop the entire sync process.

## License

This project is provided without any warranty.  Use it at your own risk.
