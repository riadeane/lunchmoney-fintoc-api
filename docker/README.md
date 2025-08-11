# Docker Setup for Lunchmoney Gmail Sync

This directory contains Docker configuration for running the Lunchmoney Gmail sync system in containers.

## Quick Start

1. **Set up environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env with your API credentials
   ```

2. **Run the server:**

   ```bash
   ./docker/docker-run.sh
   ```

3. **Run CLI commands:**

   ```bash
   ./docker/docker-run.sh --cli --dry-run
   ```

## Docker Commands

### Using the Helper Script

The `docker-run.sh` script provides convenient access to all functionality:

```bash
# Server mode (default)
./docker/docker-run.sh

# CLI mode with various options
./docker/docker-run.sh --cli --dry-run
./docker/docker-run.sh --cli --show-memory
./docker/docker-run.sh --cli --rebuild-memory
./docker/docker-run.sh --cli --clear-memory
./docker/docker-run.sh --cli --export-memory

# Build image before running
./docker/docker-run.sh --build
```

### Using Docker Compose Directly

```bash
# Build the image
docker-compose build

# Run server
docker-compose up lunchmoney-fintoc-sync

# Run CLI (one-off)
docker-compose run --rm lunchmoney-fintoc-cli node bin/cli.js --dry-run

# Run in background
docker-compose up -d lunchmoney-fintoc-sync

# View logs
docker-compose logs -f lunchmoney-fintoc-sync

# Stop services
docker-compose down
```

### Using Docker Directly

```bash
# Build image
docker build -t lunchmoney-fintoc-sync .

# Run server
docker run -d \
  --name lunchmoney-sync \
  -p 5000:5000 \
  --env-file .env \
  -v lunchmoney_data:/app/data \
  lunchmoney-fintoc-sync

# Run CLI
docker run --rm \
  --env-file .env \
  -v lunchmoney_data:/app/data \
  lunchmoney-fintoc-sync \
  node bin/cli.js --dry-run
```

## Environment Variables

All environment variables can be set in `.env` file:

### Required

- `LUNCHMONEY_TOKEN` - Your Lunch Money API token
- `GMAIL_CLIENT_ID` - Google OAuth client ID
- `GMAIL_CLIENT_SECRET` - Google OAuth client secret
- `GMAIL_REFRESH_TOKEN` - OAuth refresh token with Gmail scope

### Optional

- `LUNCHMONEY_ASSET_ID` - Lunch Money asset ID for transactions
- `DAYS_TO_SYNC=7` - Number of days to sync
- `CURRENCY_CODE=CLP` - Currency code
- `PORT=5000` - Server port

## Data Persistence

The Docker setup uses volumes to persist data:

- **Memory data**: Categorization memory is stored in `/app/data/categorization_memory.json`
- **Configuration**: Mount your `config.json` file for custom category rules

```bash
# Example with custom config
docker run -d \
  --name lunchmoney-sync \
  -p 5000:5000 \
  --env-file .env \
  -v lunchmoney_data:/app/data \
  -v $(pwd)/config.json:/app/config.json:ro \
  lunchmoney-fintoc-sync
```

## Health Monitoring

The container includes health checks:

```bash
# Check container health
docker ps

# Get detailed health info
curl http://localhost:5000/health

# View container logs
docker logs lunchmoney-sync
```

## Production Deployment

### Using Docker Swarm

```yaml
# docker-stack.yml
version: '3.8'
services:
  lunchmoney-fintoc-sync:
    image: lunchmoney-fintoc-sync:latest
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    secrets:
      - lunchmoney_token
      - gmail_client_id
      - gmail_client_secret
      - gmail_refresh_token
    volumes:
      - lunchmoney_data:/app/data

secrets:
  lunchmoney_token:
    external: true
  gmail_client_id:
    external: true
  gmail_client_secret:
    external: true
  gmail_refresh_token:
    external: true

volumes:
  lunchmoney_data:
    driver: local
```

Deploy with:

```bash
docker stack deploy -c docker-stack.yml lunchmoney-stack
```

### Using Kubernetes

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lunchmoney-fintoc-sync
spec:
  replicas: 1
  selector:
    matchLabels:
      app: lunchmoney-fintoc-sync
  template:
    metadata:
      labels:
        app: lunchmoney-fintoc-sync
    spec:
      containers:
      - name: lunchmoney-fintoc-sync
        image: lunchmoney-fintoc-sync:latest
        ports:
        - containerPort: 5000
        env:
        - name: LUNCHMONEY_TOKEN
          valueFrom:
            secretKeyRef:
              name: lunchmoney-secrets
              key: token
        - name: GMAIL_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: lunchmoney-secrets
              key: gmail-client-id
        - name: GMAIL_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: lunchmoney-secrets
              key: gmail-client-secret
        - name: GMAIL_REFRESH_TOKEN
          valueFrom:
            secretKeyRef:
              name: lunchmoney-secrets
              key: gmail-refresh-token
        volumeMounts:
        - name: data-volume
          mountPath: /app/data
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: lunchmoney-data-pvc
```

## Troubleshooting

### Common Issues

1. **Container fails to start**

   ```bash
   # Check logs
   docker logs lunchmoney-sync
   
   # Check environment variables
   docker exec lunchmoney-sync env
   ```

2. **Memory not persisting**

   ```bash
   # Verify volume mount
   docker inspect lunchmoney-sync
   
   # Check data directory
   docker exec lunchmoney-sync ls -la /app/data
   ```

3. **API connectivity issues**

   ```bash
   # Test health endpoint
   curl http://localhost:5000/health
   
   # Check network connectivity from container
   docker exec lunchmoney-sync curl -s https://www.google.com > /dev/null
   ```

### Debug Mode

Run container with debug output:

```bash
docker run --rm -it \
  --env-file .env \
  -v lunchmoney_data:/app/data \
  lunchmoney-fintoc-sync \
  sh
```

This gives you shell access inside the container for debugging.
