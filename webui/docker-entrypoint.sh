#!/bin/sh
set -e

echo "🚀 Starting Bybit MCP WebUI..."
echo "📊 Environment: ${NODE_ENV:-production}"
echo "🌐 Host: ${HOST:-0.0.0.0}"
echo "🔌 Port: ${PORT:-8080}"
echo "🔧 MCP Port: ${MCP_PORT:-8080}"

# Start the MCP HTTP server
echo "🔧 Starting MCP Server..."
exec node build/httpServer.js
