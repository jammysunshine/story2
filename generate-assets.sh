#!/bin/bash

# Exit on any error
set -e

echo "🎨 Starting Professional Asset Generation..."

# 1. Ensure the generator tool is installed
cd app
if ! [ -x "$(command -v npx)" ]; then
  echo "❌ Error: npx is not installed." >&2
  exit 1
fi

echo "📦 Installing asset generator..."
npm install @capacitor/assets --save-dev --legacy-peer-deps

# 2. Sync source files from assets/ to root for generator
if [ ! -f "assets/icon-only.png" ] || [ ! -f "assets/splash.png" ]; then
  echo "❌ ERROR: Source files missing in /app/assets/!"
  echo "Please ensure 'icon-only.png' and 'splash.png' are in the /app/assets/ folder."
  exit 1
fi

echo "🚚 Syncing latest assets from /app/assets/..."
cp assets/icon-only.png .
cp assets/splash.png .
cp assets/icon-foreground.png . 2>/dev/null || echo "⚠️ icon-foreground.png not found, skipping"
cp assets/icon-background.png . 2>/dev/null || echo "⚠️ icon-background.png not found, skipping"

# 3. Generate all Android assets
echo "🚀 Generating Android assets..."
npx capacitor-assets generate --android

echo ""
echo "✅ SUCCESS! Your custom branding is now compiled into the Android project."
echo "📍 Icons: app/android/app/src/main/res/mipmap-*"
echo "📍 Splash: app/android/app/src/main/res/drawable-*"
