#!/bin/bash

# Load environment variables from .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "❌ Error: .env file not found"
    exit 1
fi

echo "🏗️  Building AI StoryTime Docker Image..."
echo "Using Stripe Key: ${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:0:10}..."

docker build -t ai-storytime \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
  --build-arg APP_URL=$APP_URL \
  --build-arg NEXTAUTH_URL=$NEXTAUTH_URL \
  .

echo "✨ Build Complete! You can now run the app with ./run-docker.sh"
