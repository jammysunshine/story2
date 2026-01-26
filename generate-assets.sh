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
npm install @capacitor/assets --save-dev

# 2. Check for source files
if [ ! -f "icon-only.png" ] || [ ! -f "splash.png" ]; then
  echo "⚠️  WARNING: Source files missing!"
  echo "Please place 'icon-only.png' (1024x1024) and 'splash.png' (2732x2732) in the /app folder."
  echo "Using placeholders for now so the build doesn't fail, but REPLACE THEM before submission."
  # We won't generate if missing to avoid overwriting with defaults again
  exit 1
fi

# 3. Generate all Android assets
echo "🚀 Generating Android icons and splash screens..."
npx capacitor-assets generate --android

echo ""
echo "✅ SUCCESS! Your custom branding is now compiled into the Android project."
echo "📍 Icons: app/android/app/src/main/res/mipmap-*"
echo "📍 Splash: app/android/app/src/main/res/drawable-*"
