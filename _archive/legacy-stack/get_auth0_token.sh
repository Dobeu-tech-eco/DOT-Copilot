#!/bin/bash
# Script to retrieve Auth0 Management API access token using Client Credentials grant

set -e

echo "Auth0 Management API Token Retrieval"
echo "=================================================="

# Get credentials securely
read -p "Enter your Auth0 domain (e.g., your-tenant.auth0.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "Error: Domain cannot be empty" >&2
    exit 1
fi

read -p "Enter your Client ID: " CLIENT_ID
if [ -z "$CLIENT_ID" ]; then
    echo "Error: Client ID cannot be empty" >&2
    exit 1
fi

read -sp "Enter your Client Secret: " CLIENT_SECRET
echo ""
if [ -z "$CLIENT_SECRET" ]; then
    echo "Error: Client Secret cannot be empty" >&2
    exit 1
fi

AUDIENCE="https://${DOMAIN}/api/v2/"
TOKEN_URL="https://${DOMAIN}/oauth/token"

echo ""
echo "Requesting token..."

# Make the request
RESPONSE=$(curl -s -X POST "$TOKEN_URL" \
    -H "content-type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials" \
    -d "client_id=${CLIENT_ID}" \
    -d "client_secret=${CLIENT_SECRET}" \
    -d "audience=${AUDIENCE}")

# Check if response contains error
if echo "$RESPONSE" | grep -q "error"; then
    echo "Error retrieving token:" >&2
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

# Extract token using Python or jq if available
if command -v python3 &> /dev/null; then
    ACCESS_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
    TOKEN_TYPE=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['token_type'])" 2>/dev/null)
    EXPIRES_IN=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['expires_in'])" 2>/dev/null)
elif command -v jq &> /dev/null; then
    ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token')
    TOKEN_TYPE=$(echo "$RESPONSE" | jq -r '.token_type')
    EXPIRES_IN=$(echo "$RESPONSE" | jq -r '.expires_in')
else
    echo "Warning: python3 or jq not found. Showing raw response:"
    echo "$RESPONSE"
    exit 0
fi

echo ""
echo "=================================================="
echo "Token retrieved successfully!"
echo "=================================================="
echo "Access Token: $ACCESS_TOKEN"
echo "Token Type: $TOKEN_TYPE"
echo "Expires In: $EXPIRES_IN seconds"
echo "=================================================="

# Optionally save to file
read -p "Save token to file? (y/n): " SAVE_FILE
if [ "$SAVE_FILE" = "y" ] || [ "$SAVE_FILE" = "Y" ]; then
    read -p "Enter filename (default: auth0_token.txt): " FILENAME
    FILENAME=${FILENAME:-auth0_token.txt}
    {
        echo "Access Token: $ACCESS_TOKEN"
        echo "Token Type: $TOKEN_TYPE"
        echo "Expires In: $EXPIRES_IN seconds"
    } > "$FILENAME"
    echo "Token saved to $FILENAME"
fi

