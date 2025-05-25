# ==============================================================================
# Bybit MCP WebUI - Two-stage Docker Build
# ==============================================================================
# This Dockerfile creates an optimized container that includes both:
# - The Bybit MCP Server (backend API)
# - The WebUI (frontend interface)
#
# Built with Node.js 22 and following Docker best practices for:
# - Two-stage build for smaller final image
# - Layer caching optimization
# - Security hardening
# - Production-ready configuration
# ==============================================================================

# ==============================================================================
# Stage 1: Build Stage
# ==============================================================================
FROM node:22-alpine AS builder

# Install system dependencies
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        curl \
        ca-certificates && \
    rm -rf /var/cache/apk/*

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml* ./
COPY webui/package.json webui/pnpm-lock.yaml* ./webui/

# Install all dependencies (including dev dependencies for building)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# Install WebUI dependencies
WORKDIR /app/webui
RUN --mount=type=cache,id=pnpm-webui,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline

# Copy source code
WORKDIR /app
COPY . .

# Build MCP Server
RUN pnpm build

# Build WebUI
WORKDIR /app/webui
RUN pnpm build

# Install only production dependencies for final stage
WORKDIR /app
RUN --mount=type=cache,id=pnpm-prod,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --prefer-offline

# ==============================================================================
# Stage 2: Production Image
# ==============================================================================
FROM node:22-alpine AS production

# Install system dependencies and security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        tini \
        curl \
        ca-certificates && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bybit -u 1001 -G nodejs

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080
ENV MCP_PORT=8080
ENV HOST=0.0.0.0

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy production dependencies
COPY --from=builder --chown=bybit:nodejs /app/node_modules ./node_modules

# Copy built applications
COPY --from=builder --chown=bybit:nodejs /app/build ./build
COPY --from=builder --chown=bybit:nodejs /app/webui/dist ./webui/dist

# Copy necessary configuration files
COPY --chown=bybit:nodejs package.json ./
COPY --chown=bybit:nodejs webui/package.json ./webui/

# Copy entrypoint and health check scripts
COPY --chown=bybit:nodejs webui/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --chown=bybit:nodejs webui/docker-healthcheck.sh ./docker-healthcheck.sh

# Make scripts executable
RUN chmod +x ./docker-entrypoint.sh ./docker-healthcheck.sh

# Switch to non-root user
USER bybit:nodejs

# Expose port
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ./docker-healthcheck.sh

# Add labels for better container management
LABEL maintainer="Sam McLeod" \
      description="Bybit MCP WebUI - Trading interface with AI chat capabilities" \
      version="1.0.0" \
      org.opencontainers.image.title="Bybit MCP WebUI" \
      org.opencontainers.image.description="Modern web interface for Bybit MCP server with AI chat capabilities" \
      org.opencontainers.image.vendor="Sam McLeod" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.source="https://github.com/sammcj/bybit-mcp" \
      org.opencontainers.image.licenses="MIT"

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["./docker-entrypoint.sh"]
