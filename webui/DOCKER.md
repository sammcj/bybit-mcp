# 🐳 Docker Deployment Guide

This guide covers how to build and deploy the Bybit MCP WebUI using Docker.

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB+ available RAM
- 1GB+ available disk space

## 🚀 Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/sammcj/bybit-mcp.git
cd bybit-mcp/webui

# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

### Option 2: Using Docker Build

```bash
# Build the image
docker build -t bybit-mcp-webui -f webui/Dockerfile .

# Run the container
docker run -d \
  --name bybit-mcp-webui \
  -p 8080:8080 \
  --restart unless-stopped \
  bybit-mcp-webui
```

## 🌐 Access the Application

Once running, access the WebUI at:
- **Local**: http://localhost:8080
- **Network**: http://YOUR_SERVER_IP:8080

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Application environment |
| `PORT` | `8080` | HTTP server port |
| `MCP_PORT` | `8080` | MCP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `BYBIT_API_KEY` | - | Bybit API key (optional) |
| `BYBIT_API_SECRET` | - | Bybit API secret (optional) |
| `BYBIT_TESTNET` | `true` | Use Bybit testnet |

### Custom Configuration

Create a `.env` file in the webui directory:

```bash
# .env
BYBIT_API_KEY=your_api_key_here
BYBIT_API_SECRET=your_api_secret_here
BYBIT_TESTNET=false
PORT=3000
```

Then update docker-compose.yml:

```yaml
services:
  bybit-mcp-webui:
    env_file:
      - .env
```

## 🔧 Advanced Usage

### Development Mode

For development with hot reload:

```bash
# Build development image
docker build -t bybit-mcp-webui:dev --target deps -f webui/Dockerfile .

# Run with volume mounts
docker run -d \
  --name bybit-mcp-dev \
  -p 8080:8080 \
  -v $(pwd):/app \
  -v /app/node_modules \
  -v /app/webui/node_modules \
  bybit-mcp-webui:dev \
  sh -c "cd /app && pnpm dev:full"
```

### Production Deployment

For production with reverse proxy:

```yaml
# docker-compose.prod.yml
services:
  bybit-mcp-webui:
    image: bybit-mcp-webui:latest
    environment:
      - NODE_ENV=production
      - BYBIT_TESTNET=false
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
    networks:
      - traefik
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.bybit.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.bybit.tls.certresolver=letsencrypt"

networks:
  traefik:
    external: true
```

## 🔍 Monitoring & Debugging

### Health Checks

The container includes built-in health checks:

```bash
# Check container health
docker ps
docker inspect bybit-mcp-webui | grep -A 10 Health

# Manual health check
docker exec bybit-mcp-webui /app/healthcheck.sh
```

### Logs

```bash
# View application logs
docker logs bybit-mcp-webui

# Follow logs in real-time
docker logs -f bybit-mcp-webui

# View last 100 lines
docker logs --tail 100 bybit-mcp-webui
```

### Container Shell Access

```bash
# Access container shell
docker exec -it bybit-mcp-webui sh

# Check running processes
docker exec bybit-mcp-webui ps aux

# Check disk usage
docker exec bybit-mcp-webui df -h
```

## 🛠️ Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Find process using port 8080
lsof -i :8080
# or
netstat -tulpn | grep 8080

# Kill the process or use different port
docker run -p 3000:8080 bybit-mcp-webui
```

**Permission Denied**
```bash
# Check if Docker daemon is running
sudo systemctl status docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

**Build Failures**
```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -t bybit-mcp-webui -f webui/Dockerfile .
```

**Memory Issues**
```bash
# Increase Docker memory limit
# Docker Desktop: Settings > Resources > Memory

# Check container memory usage
docker stats bybit-mcp-webui
```

### Performance Optimization

**Two-stage Build Benefits:**
- ✅ Smaller final image (~200MB vs ~1GB)
- ✅ Faster deployments
- ✅ Better security (no dev dependencies)
- ✅ Optimized layer caching
- ✅ Cleaner, more maintainable Dockerfile

**Resource Limits:**
```yaml
deploy:
  resources:
    limits:
      memory: 512M      # Adjust based on usage
      cpus: '0.5'       # Adjust based on load
```

## 🔒 Security

### Best Practices

1. **Non-root User**: Container runs as user `bybit` (UID 1001)
2. **Read-only Filesystem**: Where possible
3. **No New Privileges**: Security option enabled
4. **Minimal Base Image**: Alpine Linux
5. **Health Checks**: Built-in monitoring
6. **Resource Limits**: Prevent resource exhaustion

### API Key Security

**Never commit API keys to version control!**

```bash
# Use environment variables
export BYBIT_API_KEY="your_key"
export BYBIT_API_SECRET="your_secret"

# Or use Docker secrets
echo "your_key" | docker secret create bybit_api_key -
echo "your_secret" | docker secret create bybit_api_secret -
```

## 📊 Monitoring

### Prometheus Metrics

Add monitoring with Prometheus:

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## 🚀 Deployment Platforms

### Docker Swarm
```bash
docker stack deploy -c docker-compose.yml bybit-mcp
```

### Kubernetes
```bash
# Generate Kubernetes manifests
kompose convert -f docker-compose.yml
kubectl apply -f .
```

### Cloud Platforms
- **AWS ECS**: Use the provided Dockerfile
- **Google Cloud Run**: Compatible with minimal changes
- **Azure Container Instances**: Direct deployment support
- **DigitalOcean App Platform**: Git-based deployment

## 📚 Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Multi-stage Builds](https://docs.docker.com/develop/dev-best-practices/dockerfile_best-practices/#use-multi-stage-builds)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Container Security](https://docs.docker.com/engine/security/)

---

**Need help?** Open an issue on [GitHub](https://github.com/sammcj/bybit-mcp/issues) 🚀
