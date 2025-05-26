#!/bin/sh
# Health check for both MCP server and WebUI
curl -f "http://localhost:${PORT:-8080}/health" || \
curl -f "http://localhost:${PORT:-8080}/" || \
exit 1
