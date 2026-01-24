#!/bin/bash

set -e

echo "🚀 Deploying Mobile Backend to Google Cloud Run..."

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
echo "📧 Project ID: $PROJECT_ID"

# Create Artifact Registry repository (if it doesn't exist)
echo "📦 Creating Artifact Registry repository..."
gcloud artifacts repositories create ai-storytime-backend \
    --repository-format=docker \
    --location=australia-southeast1 \
    --description="Mobile backend container registry" 2>/dev/null || echo "Repository already exists"

# Deploy using Cloud Build
echo "🔨 Building and deploying..."
gcloud builds submit --config=cloudbuild-backend.yaml .

# Get the deployed backend URL
echo "🔍 Getting backend URL..."
BACKEND_URL=$(gcloud run services describe storytime-backend \
    --region=australia-southeast1 \
    --format='value(status.url)')

echo "🎉 Backend deployed successfully!"
echo "📍 Backend URL: $BACKEND_URL"

# Update mobile app .env with the new URL
echo "📱 Updating mobile app configuration..."
# Update the VITE_API_URL line, uncommenting it if necessary
if grep -q "VITE_API_URL=" app/.env; then
    sed -i '' "s|^#*VITE_API_URL=.*|VITE_API_URL=${BACKEND_URL}/api|g" app/.env
else
    echo "VITE_API_URL=${BACKEND_URL}/api" >> app/.env
fi

echo "✅ Mobile app configuration updated!"
echo ""
echo "📋 Next steps:"
echo "1. Update mobile app API endpoint in your code"
echo "2. Build mobile app: npm run build"
echo "3. Sync with Capacitor: npx cap sync"
echo "4. Test with: npm run bridge && npm run dev"
echo ""
echo "🌐 Backend API endpoint: ${BACKEND_URL}/api"