#!/bin/bash

# ==============================================================================
# Bybit MCP WebUI - Docker Build Script
# ==============================================================================
# This script provides convenient commands for building and managing
# the Docker container for the Bybit MCP WebUI.
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="bybit-mcp-webui"
CONTAINER_NAME="bybit-mcp-webui"
PORT="8080"

# Functions
print_header() {
    echo -e "${BLUE}==============================================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}==============================================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Build the Docker image
build_image() {
    print_header "Building Docker Image"

    print_info "Building $IMAGE_NAME with Node.js 22..."
    docker build -t "$IMAGE_NAME:latest" -f Dockerfile ..

    print_success "Docker image built successfully!"
    docker images | grep "$IMAGE_NAME"

    # Show image size
    print_info "Image size:"
    docker images "$IMAGE_NAME:latest" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
}

# Run the container
run_container() {
    print_header "Running Container"

    # Stop existing container if running
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        print_warning "Stopping existing container..."
        docker stop "$CONTAINER_NAME"
        docker rm "$CONTAINER_NAME"
    fi

    print_info "Starting new container..."
    docker run -d \
        --name "$CONTAINER_NAME" \
        -p "$PORT:8080" \
        --restart unless-stopped \
        "$IMAGE_NAME:latest"

    print_success "Container started successfully!"
    print_info "Access the WebUI at: http://localhost:$PORT"
}

# Stop the container
stop_container() {
    print_header "Stopping Container"

    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        docker stop "$CONTAINER_NAME"
        docker rm "$CONTAINER_NAME"
        print_success "Container stopped and removed."
    else
        print_warning "No running container found."
    fi
}

# Show container logs
show_logs() {
    print_header "Container Logs"

    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        docker logs -f "$CONTAINER_NAME"
    else
        print_error "Container is not running."
        exit 1
    fi
}

# Show container status
show_status() {
    print_header "Container Status"

    echo "Docker Images:"
    docker images | grep "$IMAGE_NAME" || echo "No images found."

    echo ""
    echo "Running Containers:"
    docker ps | grep "$CONTAINER_NAME" || echo "No running containers found."

    echo ""
    echo "All Containers:"
    docker ps -a | grep "$CONTAINER_NAME" || echo "No containers found."
}

# Clean up Docker resources
cleanup() {
    print_header "Cleaning Up"

    print_info "Stopping and removing containers..."
    docker ps -a -q -f name="$CONTAINER_NAME" | xargs -r docker rm -f

    print_info "Removing images..."
    docker images -q "$IMAGE_NAME" | xargs -r docker rmi -f

    print_info "Cleaning up unused Docker resources..."
    docker system prune -f

    print_success "Cleanup completed!"
}

# Development mode with volume mounts
dev_mode() {
    print_header "Development Mode"

    # Stop existing container
    docker ps -q -f name="$CONTAINER_NAME-dev" | xargs -r docker rm -f

    print_info "Starting development container with volume mounts..."
    docker run -d \
        --name "$CONTAINER_NAME-dev" \
        -p "$PORT:8080" \
        -v "$(pwd)/..:/app" \
        -v "/app/node_modules" \
        -v "/app/webui/node_modules" \
        --restart unless-stopped \
        "$IMAGE_NAME:latest" \
        sh -c "cd /app && pnpm dev:full"

    print_success "Development container started!"
    print_info "Access the WebUI at: http://localhost:$PORT"
    print_warning "Note: Changes to source files will trigger rebuilds."
}

# Show help
show_help() {
    echo "Bybit MCP WebUI - Docker Build Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  build     Build the Docker image"
    echo "  run       Run the container"
    echo "  stop      Stop and remove the container"
    echo "  restart   Stop and start the container"
    echo "  logs      Show container logs"
    echo "  status    Show container and image status"
    echo "  cleanup   Remove all containers and images"
    echo "  dev       Run in development mode with volume mounts"
    echo "  compose   Use Docker Compose (up/down/logs)"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build && $0 run    # Build and run"
    echo "  $0 restart            # Restart container"
    echo "  $0 logs               # Follow logs"
    echo "  $0 compose up         # Use Docker Compose"
}

# Docker Compose commands
compose_command() {
    case "$1" in
        up)
            print_header "Starting with Docker Compose"
            docker-compose up -d
            print_success "Services started with Docker Compose!"
            ;;
        down)
            print_header "Stopping Docker Compose Services"
            docker-compose down
            print_success "Services stopped!"
            ;;
        logs)
            print_header "Docker Compose Logs"
            docker-compose logs -f
            ;;
        *)
            print_error "Unknown compose command: $1"
            echo "Available: up, down, logs"
            exit 1
            ;;
    esac
}

# Main script logic
main() {
    check_docker

    case "$1" in
        build)
            build_image
            ;;
        run)
            run_container
            ;;
        stop)
            stop_container
            ;;
        restart)
            stop_container
            sleep 2
            run_container
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        cleanup)
            cleanup
            ;;
        dev)
            dev_mode
            ;;
        compose)
            compose_command "$2"
            ;;
        help|--help|-h)
            show_help
            ;;
        "")
            print_warning "No command specified."
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run the script
main "$@"
