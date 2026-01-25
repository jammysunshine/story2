# Generating APK for AI Storytime App

This guide will walk you through generating an APK file for the AI Storytime app to share with friends for testing.

## Prerequisites

Before building the APK, ensure you have:

1. **Java Development Kit (JDK)** - Version 17 or higher
2. **Android Studio** or **Android SDK Tools** installed
3. **Node.js** and **npm** installed
4. **Capacitor CLI** installed globally (`npm install -g @capacitor/cli`)

## Step-by-Step Instructions

### 1. Prepare the App for Building

First, make sure you're in the app directory:

```bash
cd /Users/mohitmendiratta/Projects/misc/story2/app
```

### 2. Install Dependencies

Make sure all dependencies are installed:

```bash
npm install
```

### 3. Build the Web Assets

Build the React app for production:

```bash
npm run build
```

### 4. Sync Capacitor Platforms

Sync the built web assets to the Android platform:

```bash
npx cap sync android
```

### 5. Open in Android Studio (Optional but Recommended)

To open the project in Android Studio:

```bash
npx cap open android
```

Alternatively, you can build directly from the command line.

### 6. Build the APK

Navigate to the Android directory and build the APK:

```bash
cd android
./gradlew assembleDebug
```

Or for a release build (recommended for distribution):

```bash
./gradlew assembleRelease
```

### 7. Locate the Generated APK

The generated APK files will be located at:

- **Debug APK**: `app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `app/build/outputs/apk/release/app-release.apk`

For release builds, you might want to sign the APK. If you're just testing, the unsigned APK will work fine.

### 8. Alternative: Build and Sign Release APK

If you want to create a properly signed release APK for distribution:

1. Generate a signing key using Android Studio or command line
2. Configure the signing in `app/build.gradle`
3. Build with:
```bash
./gradlew assembleRelease
```

### 9. Share the APK

The APK file can be shared directly with friends. They can install it by:

1. Enabling "Install from Unknown Sources" in their device settings
2. Downloading the APK file
3. Opening and installing the APK

## Important Notes

- The app ID is `com.aistorytime.app` and app name is `AI Storytime`
- The app targets Android API level 36 with minimum SDK 24
- The app connects to the backend at `http://localhost:3000` by default, but also allows navigation to the cloud backend
- Make sure your friends have internet connectivity as the app depends on online services

## Troubleshooting

If you encounter issues:

1. Make sure Android SDK is properly configured
2. Check that JAVA_HOME environment variable is set
3. Ensure you have enough disk space for the build process
4. If using the debug APK, your friends may need to uninstall any existing version before installing

## Quick Build Command

For a quick build process, run these commands from the app directory:

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK will be in `app/build/outputs/apk/debug/app-debug.apk`