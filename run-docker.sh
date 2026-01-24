#!/bin/bash

# Configuration
IMAGE_NAME="ai-storytime"
CONTAINER_PORT=3000
HOST_PORT=3000

# Path to Google Application Default Credentials
# This is usually ~/.config/gcloud on macOS/Linux
ADC_LOCAL_PATH="$HOME/.config/gcloud"
ADC_CONTAINER_PATH="/home/nextjs/.config/gcloud"
ADC_FILE="application_default_credentials.json"

echo "🚀 Starting AI StoryTime Docker Container..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found in current directory."
    exit 1
fi

# Check if ADC exists
if [ ! -f "$ADC_LOCAL_PATH/$ADC_FILE" ]; then
    echo "⚠️  Warning: Google Application Default Credentials not found at $ADC_LOCAL_PATH/$ADC_FILE"
    echo "💡 Run 'gcloud auth application-default login' if you need Google Cloud access."
fi

# Stop and remove existing container if it exists
echo "🧹 Cleaning up old containers..."
docker stop $IMAGE_NAME 2>/dev/null
docker rm $IMAGE_NAME 2>/dev/null

# Run the container
echo "🏃 Running container on http://localhost:$HOST_PORT..."
# We mount the ADC path but only set the env var if it's not handled by .env
docker run -d \
  --name $IMAGE_NAME \
  -p $HOST_PORT:$CONTAINER_PORT \
  --env-file .env \
  -v "$ADC_LOCAL_PATH:$ADC_CONTAINER_PATH" \
  $IMAGE_NAME

echo "✨ Container is now running in the background."
echo "📝 To see logs, run: docker logs -f $IMAGE_NAME"
echo "🛑 To stop, run: docker stop $IMAGE_NAME"
