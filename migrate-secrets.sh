#!/bin/bash

# Configuration
PROJECT_ID="storytime-app-1768719813"
ENV_FILE=".env"
TEMP_SECRET_FILE=".tmp_secret_val"

# Function to create or update a secret in Google Cloud Secret Manager
sync_secret() {
    local secret_name="$1"
    local secret_value="$2"

    if [ -z "$secret_value" ]; then
        echo "⚠️  Skipping $secret_name: Value is empty."
        return
    fi

    echo "Processing $secret_name..."

    # Check if the secret already exists
    if ! gcloud secrets describe "$secret_name" --project="$PROJECT_ID" >/dev/null 2>&1; then
        echo "Creating secret $secret_name..."
        gcloud secrets create "$secret_name" --replication-policy="automatic" --project="$PROJECT_ID"
    fi

    # Use a temporary file to ensure the value is passed exactly (avoids pipe issues)
    echo -n "$secret_value" > "$TEMP_SECRET_FILE"
    gcloud secrets versions add "$secret_name" --data-file="$TEMP_SECRET_FILE" --project="$PROJECT_ID" > /dev/null
    rm "$TEMP_SECRET_FILE"
}

# 1. Validation
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found."
    exit 1
fi

echo "🔐 Starting Robust Migration: $ENV_FILE -> Secret Manager ($PROJECT_ID)"

# 2. Iterate through .env file
while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.* ]] && continue
    [[ -z "$key" ]] && continue
    
    # Clean the key
    key=$(echo "$key" | xargs)
    
    # Extract value correctly even if it has = in it
    value=$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    # Remove surrounding quotes if they exist
    value=$(echo "$value" | sed -e 's/^["'\'']//' -e 's/["'\'']$//')

    # Skip specific local-only variables
    if [[ "$key" == "GOOGLE_APPLICATION_CREDENTIALS" ]] || [[ "$key" == "PUPPETEER_EXECUTABLE_PATH" ]]; then
        echo "ℹ️  Ignoring local-only variable: $key"
        continue
    fi

    sync_secret "$key" "$value"

done < "$ENV_FILE"

echo ""
echo "✅ SUCCESS: All variables synced securely."
rm -f "$TEMP_SECRET_FILE"
