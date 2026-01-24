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

# Build Docker image locally (simpler, no caching issues)
echo "🔨 Building backend Docker image locally..."
docker build -f Dockerfile.backend -t storytime-backend:latest .

if [ $? -eq 0 ]; then
    echo "✅ Docker build successful!"
    
    # Push to Artifact Registry
    echo "📤 Pushing to Artifact Registry..."
    docker push australia-southeast1-docker.pkg.dev/storytime-app-1768719813/ai-storytime-backend/storytime-backend:latest
    
    if [ $? -eq 0 ]; then
        echo "✅ Docker push successful!"
    else
        echo "❌ Docker push failed!"
        exit 1
    fi
else
    echo "❌ Docker build failed!"
    exit 1
fi

# Deploy to Cloud Run
echo "🌐 Deploying to Cloud Run..."
gcloud run deploy storytime-backend \
    --image australia-southeast1-docker.pkg.dev/storytime-app-1768719813/ai-storytime-backend/storytime-backend:latest \
    --region australia-southeast1 \
    --platform managed \
    --port 3000 \
    --memory 4Gi \
    --cpu 2 \
    --timeout 600 \
    --concurrency 10 \
    --min-instances 0 \
    --max-instances 10 \
    --allow-unauthenticated \
    --set-env-vars \
        NODE_ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GCS_IMAGES_BUCKET_NAME=storytime-images-1768-sydney,GCS_PDFS_BUCKET_NAME=storytime-pdfs-1768-sydney,IMAGE_GENERATION_SERVICE=GOOGLE_IMAGEN,STORY_PAGES_COUNT=23,BASE_CURRENCY=aud,STORY_TEASER_PAGES_COUNT=7,CREDITS_PER_BASE_CURRENCY=1,IMAGE_GENERATION_DELAY_MS=15000,STORY_REF_CONCURRENCY=2,STORY_IMAGE_CONCURRENCY=30,ALLOW_DEV_LOGIN=false,PRINT_MIN_PAGES=10,PRINT_PAGE_COST=4,PRINT_SHIPPING_COST=10,MOBILE_MODE=true \
    --set-secrets \
        MONGODB_URI=MONGODB_URI:latest,STRIPE_SECRET_KEY=STRIPE_SECRET_KEY_NEW:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest,AUTH_SECRET=AUTH_SECRET:latest,SMTP_PASSWORD=SMTP_PASSWORD:latest,MISTRAL_API_KEY=MISTRAL_API_KEY:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET_NEW:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,APP_URL=APP_URL:latest,SMTP_USER=SMTP_USER:latest,GELATO_API_KEY=GELATO_API_KEY:latest,GELATO_TEST_MODE=GELATO_TEST_MODE:latest,GOOGLE_API_KEY=GOOGLE_API_KEY:latest,GOOGLE_API_KEY_P=GOOGLE_API_KEY_P:latest

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    
    # Get the deployed backend URL
    echo "🔍 Getting backend URL..."
    BACKEND_URL=$(gcloud run services describe storytime-backend \
        --region=australia-southeast1 \
        --format='value(status.url)')
    
    if [ ! -z "$BACKEND_URL" ]; then
        echo "📍 Backend URL: $BACKEND_URL"
        
        # Update mobile app .env with new URL
        echo "📱 Updating mobile app configuration..."
        if grep -q "VITE_API_URL=" app/.env; then
            sed -i '' "s|^#*VITE_API_URL=.*|VITE_API_URL=${BACKEND_URL}/api|g" app/.env
        else
            echo "VITE_API_URL=${BACKEND_URL}/api" >> app/.env
        fi
        echo "✅ Mobile app configuration updated!"
    else
        echo "❌ Could not get backend URL"
        exit 1
    fi
else
    echo "❌ Deployment failed!"
    exit 1
fi

echo ""
echo "📋 Next steps:"
echo "1. Update mobile app API endpoint in your code"
echo "2. Build mobile app: npm run build"
echo "3. Sync with Capacitor: npx cap sync"
echo "4. Test with: npm run bridge && npm run dev"
echo ""
echo "🌐 Backend API endpoint: ${BACKEND_URL}/api"