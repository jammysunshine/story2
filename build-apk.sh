#!/bin/bash

# Script to build APK for AI Storytime app
# Usage: ./build-apk.sh [debug|release]

set -e  # Exit on any error

echo "🚀 Building APK for AI Storytime app..."

# Set default build type to debug
BUILD_TYPE=${1:-debug}

# Navigate to app directory
cd /Users/mohitmendiratta/Projects/misc/story2/app

echo "📦 Installing dependencies..."
npm install

echo "🏗️ Building web assets..."
npm run build

echo "🔄 Syncing Capacitor platforms..."
npx cap sync android

echo "📱 Building Android APK ($BUILD_TYPE)..."
cd android

if [ "$BUILD_TYPE" = "release" ]; then
    echo "Building release artifacts (APK and AAB)..."
    ./gradlew assembleRelease bundleRelease
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
    AAB_PATH="app/build/outputs/bundle/release/app-release.aab"
    echo "✅ Release APK ready: $APK_PATH"
    echo "✅ Release AAB ready: $AAB_PATH"
else
    echo "Building debug APK..."
    ./gradlew assembleDebug
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
fi

echo "✅ APK built successfully!"
echo "📁 Location: $APK_PATH"
echo "📱 You can now share this APK file with your friends for testing."

# Show file size
if [ -f "$APK_PATH" ]; then
    echo "📏 File size: $(du -h "$APK_PATH" | cut -f1)"
fi