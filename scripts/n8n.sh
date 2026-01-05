#!/bin/bash
# N8N Docker Management Script
# N8N runs externally on port 5678 with a dedicated Postgres on port 5433

set -e

N8N_CONTAINER="n8n"
N8N_DB_CONTAINER="n8n-db"
N8N_PORT=5678
N8N_DB_PORT=5433

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

start() {
    echo -e "${GREEN}Starting N8N...${NC}"

    # Try to start existing containers first
    if docker start $N8N_DB_CONTAINER $N8N_CONTAINER 2>/dev/null; then
        echo -e "${GREEN}✅ Started existing N8N containers${NC}"
    else
        echo -e "${YELLOW}Creating new N8N containers...${NC}"

        # Create Postgres container for N8N
        echo "Starting N8N database on port $N8N_DB_PORT..."
        docker run -d --name $N8N_DB_CONTAINER \
            -e POSTGRES_USER=n8n \
            -e POSTGRES_PASSWORD=n8n \
            -e POSTGRES_DB=n8n \
            -p $N8N_DB_PORT:5432 \
            postgres:15

        # Wait for Postgres to be ready
        echo "Waiting for database to be ready..."
        sleep 5

        # Create N8N container
        echo "Starting N8N on port $N8N_PORT..."
        docker run -d --name $N8N_CONTAINER \
            -p $N8N_PORT:5678 \
            -e DB_TYPE=postgresdb \
            -e DB_POSTGRESDB_HOST=host.docker.internal \
            -e DB_POSTGRESDB_PORT=$N8N_DB_PORT \
            -e DB_POSTGRESDB_DATABASE=n8n \
            -e DB_POSTGRESDB_USER=n8n \
            -e DB_POSTGRESDB_PASSWORD=n8n \
            -e N8N_SECURE_COOKIE=false \
            -e N8N_HOST=0.0.0.0 \
            -e N8N_EDITOR_BASE_URL=http://gg-macstudio:5678 \
            -e N8N_PROTOCOL_BASE_URL=http://gg-macstudio:5678 \
            -e N8N_CORS_ALLOW_ORIGIN="http://gg-macstudio:5678,http://localhost:5678,http://127.0.0.1:5678" \
            -v ~/.n8n:/home/node/.n8n \
            docker.n8n.io/n8nio/n8n:latest

        echo -e "${GREEN}✅ Created new N8N containers${NC}"
    fi

    echo -e "${GREEN}N8N is available at http://localhost:$N8N_PORT${NC}"
    echo -e "${GREEN}N8N is also accessible via Tailscale at http://gg-macstudio:$N8N_PORT${NC}"
}

stop() {
    echo -e "${YELLOW}Stopping N8N...${NC}"
    docker stop $N8N_CONTAINER $N8N_DB_CONTAINER 2>/dev/null || true
    echo -e "${GREEN}✅ N8N stopped${NC}"
}

restart() {
    stop
    sleep 2
    start
}

status() {
    echo -e "${GREEN}N8N Container Status:${NC}"
    docker ps --filter name=n8n --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

    echo ""

    # Check if N8N is accessible
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$N8N_PORT/healthz 2>/dev/null | grep -q "200"; then
        echo -e "${GREEN}✅ N8N is healthy and responding${NC}"
    else
        echo -e "${YELLOW}⚠️  N8N is not responding (may still be starting)${NC}"
    fi
}

logs() {
    docker logs -f $N8N_CONTAINER
}

remove() {
    echo -e "${RED}Removing N8N containers...${NC}"
    docker rm -f $N8N_CONTAINER $N8N_DB_CONTAINER 2>/dev/null || true
    echo -e "${GREEN}✅ N8N containers removed${NC}"
}

update() {
    echo -e "${YELLOW}Updating N8N container with new environment variables...${NC}"
    echo -e "${YELLOW}Note: Your data in ~/.n8n is safe and will be preserved${NC}"
    
    # Stop and remove only the n8n container (not the database)
    docker stop $N8N_CONTAINER 2>/dev/null || true
    docker rm $N8N_CONTAINER 2>/dev/null || true
    
    # Recreate with updated environment variables
    echo "Recreating N8N container with updated configuration..."
    docker run -d --name $N8N_CONTAINER \
        -p $N8N_PORT:5678 \
        -e DB_TYPE=postgresdb \
        -e DB_POSTGRESDB_HOST=host.docker.internal \
        -e DB_POSTGRESDB_PORT=$N8N_DB_PORT \
        -e DB_POSTGRESDB_DATABASE=n8n \
        -e DB_POSTGRESDB_USER=n8n \
        -e DB_POSTGRESDB_PASSWORD=n8n \
        -e N8N_SECURE_COOKIE=false \
        -e N8N_HOST=0.0.0.0 \
        -e N8N_EDITOR_BASE_URL=http://gg-macstudio:5678 \
        -e N8N_PROTOCOL_BASE_URL=http://gg-macstudio:5678 \
        -e N8N_CORS_ALLOW_ORIGIN="http://gg-macstudio:5678,http://localhost:5678,http://127.0.0.1:5678" \
        -v ~/.n8n:/home/node/.n8n \
        docker.n8n.io/n8nio/n8n:latest
    
    echo -e "${GREEN}✅ N8N container updated (your data is preserved)${NC}"
    echo -e "${GREEN}N8N is available at http://localhost:$N8N_PORT${NC}"
    echo -e "${GREEN}N8N is also accessible via Tailscale at http://gg-macstudio:$N8N_PORT${NC}"
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    remove)
        remove
        ;;
    update)
        update
        ;;
    *)
        echo "N8N Docker Management"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|remove|update}"
        echo ""
        echo "Commands:"
        echo "  start   - Start N8N (creates containers if needed)"
        echo "  stop    - Stop N8N containers"
        echo "  restart - Restart N8N containers"
        echo "  status  - Show container status"
        echo "  logs    - Follow N8N logs"
        echo "  update  - Update N8N container with new env vars (preserves data)"
        echo "  remove  - Remove N8N containers (data preserved in ~/.n8n)"
        exit 1
        ;;
esac
