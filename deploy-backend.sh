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

# Update mobile app .env.production with the new URL
echo "📱 Updating mobile app configuration..."
sed "s|https://ai-storytime-backend-xxxxx.au.a.run.app|${BACKEND_URL}|g" ../app/.env.production > ../app/.env.production.temp
mv ../app/.env.production.temp ../app/.env.production

echo "✅ Mobile app configuration updated!"
echo ""
echo "📋 Next steps:"
echo "1. Update mobile app API endpoint in your code"
echo "2. Build mobile app: npm run build"
echo "3. Sync with Capacitor: npx cap sync"
echo "4. Test with: npm run bridge && npm run dev"
echo ""
echo "🌐 Backend API endpoint: ${BACKEND_URL}/api"