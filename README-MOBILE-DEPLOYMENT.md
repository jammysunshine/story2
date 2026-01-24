# Mobile Backend Deployment Guide

## 🚀 Quick Deployment

```bash
# Deploy the mobile backend
./deploy-backend.sh
```

## 📱 Mobile App Configuration

After deployment, update your mobile app:

### 1. Environment Variables
Your `app/.env.production` will be automatically updated with the correct backend URL.

### 2. Rebuild Mobile App
```bash
cd app
npm run build
npx cap sync
```

### 3. Local Development with Cloud Backend
```bash
# Bridge Android to Cloud Run
npm run bridge
npm run dev
```

## 🏗️ Deployment Architecture

### Services Created
- **Web App**: `ai-storytime` (unchanged)
- **Mobile Backend**: `ai-storytime-backend` (new)

### URL Structure
```
Web App:     https://ai-storytime-xxxxx.au.run.app
Mobile API:    https://storytime-backend-xxxxx.au.run.app/api
```

## 💰 Cost Optimizations

### Cloud Run Settings
- **Memory**: 2Gi (vs 4Gi for web app)
- **CPU**: 1 (vs 2 for web app)
- **Min Instances**: 0 (scales to zero)
- **Concurrency**: 10 (optimized for mobile)
- **Timeout**: 600s (preserves long operations)

### Estimated Costs (Sydney)
- **Idle**: $0/month
- **Light Testing**: $10-25/month
- **Heavy Usage**: $50-150/month

## 🔄 Preserved Features

✅ **All Secrets**: 18+ gcloud secrets reused
✅ **Advanced Caching**: BuildKit + GCS cache maintained
✅ **Docker Registry**: Separate but same caching strategy
✅ **Puppeteer Support**: Full Chrome access for PDFs
✅ **Zero Downtime**: Web app continues working

## 🧪 Testing Checklist

### Backend Health
```bash
# Test backend is running
curl https://storytime-backend-xxxxx.au.run.app/health

# Test API endpoint
curl https://storytime-backend-xxxxx.au.run.app/api/generate-story
```

### Mobile App Testing
```bash
# Test with backend bridge (for local development)
npm run bridge

# Build and test production
npm run build
npx cap run android
```

## 🛠️ Troubleshooting

### Common Issues
1. **Cold Starts**: First request may be slow (normal for Cloud Run)
2. **Time Memory Limits**: Large story generation may hit 2Gi limit
3. **Secret Access**: Ensure all secrets are available in gcloud

### Debug Commands
```bash
# Check service status
gcloud run services describe storytime-backend --region=australia-southeast1

# View logs
gcloud logs read "projects/${PROJECT_ID}/logs/storytime-backend"

# Check secret access
gcloud secrets versions list MONGODB_URI
```

## 📋 File Structure

Created files:
- `Dockerfile.backend` - Backend-only container
- `cloudbuild-backend.yaml` - Cloud Build with caching
- `server/.env.production` - Production env variables
- `app/.env.production` - Mobile app production config
- `deploy-backend.sh` - Automated deployment script

All files preserve your existing secrets and infrastructure while creating mobile-optimized backend deployment.