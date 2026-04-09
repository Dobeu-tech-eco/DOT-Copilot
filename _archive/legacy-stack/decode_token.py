#!/usr/bin/env python3
"""Decode JWT token to check expiration and details."""

import base64
import json
import sys
from datetime import datetime

# Read token from file
with open('auth0_token.txt', 'r') as f:
    content = f.read()
    for line in content.split('\n'):
        if line.startswith('Access Token:'):
            token = line.split('Access Token:')[1].strip()
            break

# JWT tokens have 3 parts separated by dots
parts = token.split('.')
if len(parts) != 3:
    print("Invalid JWT token format")
    sys.exit(1)

# Decode the payload (second part)
payload = parts[1]
# Add padding if needed (JWT uses base64url encoding without padding)
# We need to add padding for Python's base64 decoder
missing_padding = len(payload) % 4
if missing_padding:
    payload += '=' * (4 - missing_padding)

try:
    decoded = base64.urlsafe_b64decode(payload)
    data = json.loads(decoded)
    
    print("Token Payload:")
    print(json.dumps(data, indent=2))
    print()
    
    # Check expiration
    if 'exp' in data:
        exp_timestamp = data['exp']
        exp_datetime = datetime.fromtimestamp(exp_timestamp)
        now = datetime.now()
        print(f"Expiration: {exp_datetime}")
        print(f"Current time: {now}")
        print(f"Expired: {now > exp_datetime}")
        print(f"Time until expiration: {exp_datetime - now}")
    else:
        print("No expiration found in token")
        
except Exception as e:
    print(f"Error decoding token: {e}")

