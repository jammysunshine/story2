#!/bin/bash

echo "🚀 Starting Android Live Reload Environment..."

# 1. Sync Capacitor Config
# This ensures the 'server.url' pointing to localhost:3000 is applied to the Android project.
echo "🔄 Syncing Capacitor config..."
cd app && npx cap sync

# 2. Establish ADB Bridge
# This maps the phone's port 3000 to your computer's port 3000.
# Without this, the phone cannot see 'localhost'.
echo "Rx🌉 Creating ADB Bridge (Phone :3000 -> PC :3000)..."
npm run bridge:live

# 3. Start Vite Dev Server
# We use '--host' to ensure it binds correctly, though ADB handles the routing.
echo "⚡ Starting Vite Dev Server..."
echo "📱 App should reload automatically on your phone once the server starts."
npm run dev
