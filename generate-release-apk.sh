#!/bin/bash

# Exit on any error
set -e

echo "📦 Starting Release APK Generation..."

# 1. Setup Java Environment (Required for Gradle)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_KEYSTORE_PASS="storytime123"
export ANDROID_KEY_ALIAS="storytime-alias"
export ANDROID_KEY_PASS="storytime123"

# 2. Prepare capacitor.config.ts (Disable Live Reload for standalone build)
echo "🔧 Disabling Live Reload for standalone build..."
sed -i '' 's|url: '\''http://localhost:3000'\''|// url: '\''http://localhost:3000'\''|g' app/capacitor.config.ts

# 3. Build React Frontend
echo "🏗️ Building React Frontend..."
cd app
npm run build

# 4. Sync Assets to Android
echo "🔄 Syncing assets to Android project..."
npx cap sync android

# 5. Build the Signed APK
echo "🔨 Compiling Signed Release APK..."
cd android
./gradlew assembleRelease

# 6. Restore capacitor.config.ts (Enable Live Reload for development)
echo "🛠️ Restoring development settings (Live Reload)..."
cd ../..
sed -i '' 's|// url: '\''http://localhost:3000'\''|url: '\''http://localhost:3000'\''|g' app/capacitor.config.ts

echo ""
echo "✅ SUCCESS! Your standalone Release APK is ready."
echo "📍 Location: app/android/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "📲 To test on your phone now, run:"
echo "adb install -r app/android/app/build/outputs/apk/release/app-release.apk"
