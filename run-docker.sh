#!/bin/bash

# Configuration
IMAGE_NAME="storytime-backend-local"
CONTAINER_PORT=3001
HOST_PORT=3001

echo "🏗️  Building backend monolith..."
docker build -t $IMAGE_NAME -f Dockerfile.backend .

echo "🚀 Starting StoryTime Backend local container..."

# Check if .env exists
if [ ! -f server/.env ]; then
    echo "⚠️ Warning: server/.env file not found. Using root .env if it exists."
    ENV_FILE=".env"
else
    ENV_FILE="server/.env"
fi

# Stop and remove existing container if it exists
echo "🧹 Cleaning up old containers..."
docker stop $IMAGE_NAME 2>/dev/null
docker rm $IMAGE_NAME 2>/dev/null

# Run the container
echo "🏃 Running container on http://localhost:$HOST_PORT..."
docker run \
  --name $IMAGE_NAME \
  -p $HOST_PORT:$CONTAINER_PORT \
  --env-file $ENV_FILE \
  $IMAGE_NAME

echo "✨ Container is now running in the background."
echo "📝 To see logs, run: docker logs -f $IMAGE_NAME"
echo "🛑 To stop, run: docker stop $IMAGE_NAME"
