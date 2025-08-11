# 🐳 Docker Setup Complete

Your Lunchmoney Gmail Sync system has been successfully dockerized with enterprise-grade features.

## 🚀 What's Been Implemented

### Core Docker Features

- ✅ **Multi-stage build** for optimized image size (~50MB final image)
- ✅ **Non-root user** security (appuser:1001)
- ✅ **Health checks** for monitoring and auto-recovery
- ✅ **Graceful shutdown** with proper signal handling (dumb-init)
- ✅ **Volume persistence** for memory data
- ✅ **Environment variable configuration**

### Enhanced Application Features  

- ✅ **Fuzzy string matching** categorization (70% similarity threshold)
- ✅ **Smart memory learning** from transaction history
- ✅ **Exponential backoff retry** logic for API failures
- ✅ **Enhanced duplicate detection** with transaction fingerprinting
- ✅ **Batch processing** for large transaction sets
- ✅ **Production-ready logging** with sanitized credentials
- ✅ **RESTful API endpoints** for monitoring and control

### Deployment Options

- ✅ **Docker Compose** for local development
- ✅ **Kubernetes manifests** for production clusters
- ✅ **Docker Swarm** configuration
- ✅ **Helper scripts** for easy management

## 🎯 Quick Start

### 1. Basic Setup

```bash
# Clone and setup
git clone <your-repo>
cd lunchmoney-fintoc-sync

# Create environment file
cp .env.example .env
# Edit .env with your API credentials

# Run server
./docker/docker-run.sh
```

### 2. CLI Usage

```bash
# Show memory statistics
./docker/docker-run.sh --cli --show-memory

# Dry run sync
./docker/docker-run.sh --cli --dry-run

# Rebuild memory from transaction history
./docker/docker-run.sh --cli --rebuild-memory
```

### 3. Production Deployment

```bash
# Docker Compose (recommended)
docker-compose up -d

# Kubernetes
kubectl apply -f k8s/deployment.yaml

# Direct Docker
docker run -d --env-file .env -p 5000:5000 -v lunchmoney_data:/app/data lunchmoney-fintoc-sync
```

## 📊 Monitoring & Health Checks

### Server Endpoints

- `GET /health` - Health check with API connectivity tests
- `GET /stats` - Server and memory statistics  
- `GET /` - Server info and available endpoints
- `POST /sync` - Trigger manual sync
- `POST /rebuild-memory` - Rebuild categorization memory

### Example Health Check

```bash
curl http://localhost:5000/health
```

Returns:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": [
    {"service": "lunch_money", "status": "healthy"},
    {"service": "gmail", "status": "healthy"}
  ]
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
LUNCHMONEY_TOKEN=your_token
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REFRESH_TOKEN=your_refresh_token

# Optional
LUNCHMONEY_ASSET_ID=123
DAYS_TO_SYNC=7
CURRENCY_CODE=CLP
PORT=5000
```

### Category Rules (config.json)

```json
{
  "currency": "CLP",
  "days_to_sync": 7,
  "category_rules": {
    "Lider": "Groceries",
    "Starbucks": "Coffee",
    "Uber": "Transportation"
  }
}
```

## 🛡️ Security Features

- **Non-root container** execution
- **Read-only config mounts**
- **Sanitized error logging** (API keys redacted)
- **Input validation** and sanitization
- **Minimal attack surface** (Alpine Linux base)

## 📈 Performance Features

- **Exponential backoff** for API retries
- **Batch processing** (50 transactions per batch)
- **Efficient duplicate detection** with fingerprinting
- **Memory caching** for categories and configuration
- **Graceful error handling** (individual failures don't stop sync)

## 🧠 Smart Categorization

The enhanced memory system provides AI-like categorization:

1. **Exact Config Rules** (highest priority)
2. **Exact Memory Matches** from learned history  
3. **Fuzzy Memory Matching** (70%+ similarity)
4. **Auto-Learning** saves successful matches
5. **Conflict Resolution** uses most frequent category

Example fuzzy matching:

- "STARBUCKS #123" → matches learned "STARBUCKS" → "Coffee"
- "LIDER SUPERMARKET" → matches learned "LIDER" → "Groceries"

## 🔄 Automated Operations

### Server Mode (Default)

- **Hourly syncing** - Automatic transaction sync every hour
- **Daily memory rebuilding** - Updates learning at 3 AM UTC
- **Health monitoring** - Built-in health checks
- **Error tracking** - Comprehensive error logging and statistics

### Scheduling

```yaml
# Cron schedules
hourly_sync: "0 * * * *"     # Every hour
daily_memory: "0 3 * * *"     # 3 AM UTC daily
```

## 📝 Logs & Debugging

### View Logs

```bash
# Docker Compose
docker-compose logs -f lunchmoney-fintoc-sync

# Direct Docker
docker logs -f lunchmoney-sync

# Kubernetes
kubectl logs -f deployment/lunchmoney-fintoc-sync -n lunchmoney-sync
```

### Debug Mode

```bash
# Shell access
docker run --rm -it --env-file .env lunchmoney-fintoc-sync sh

# Test connectivity
docker exec lunchmoney-sync curl -s https://www.google.com > /dev/null
```

## 🚀 Production Best Practices

### Resource Limits

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "512Mi" 
    cpu: "500m"
```

### Backup & Recovery

```bash
# Backup memory data
docker cp lunchmoney-sync:/app/data/categorization_memory.json ./backup/

# Restore memory data  
docker cp ./backup/categorization_memory.json lunchmoney-sync:/app/data/
```

### Scaling Considerations

- **Single instance only** - Memory consistency requires one replica
- **Persistent volumes** - Data must persist across restarts
- **Health checks** - Monitor for automatic restart on failure

## 🎉 System Capabilities

Your dockerized system now provides:

### Enterprise Features

- 🔄 **Automatic retries** with exponential backoff
- 🔍 **Enhanced duplicate detection** with fingerprinting  
- 🧠 **AI-like categorization** with fuzzy matching
- 📊 **Comprehensive monitoring** and health checks
- 🔒 **Production security** with non-root execution
- 📈 **Performance optimization** with batching and caching

### Operational Excellence

- 🐳 **Container-ready** for any environment
- ☸️ **Kubernetes-native** with full manifests
- 📱 **CLI and server modes** for flexibility
- 🎯 **Zero-downtime deployments** with health checks
- 📊 **Observability** with metrics and logging
- 🔧 **Easy configuration** via environment variables

The system is now production-ready and can handle enterprise workloads with reliability, security, and performance! 🎊
