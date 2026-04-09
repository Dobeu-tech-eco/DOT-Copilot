#!/usr/bin/env python3
"""Test Auth0 Management API with the retrieved token."""

import requests
import json

# Read token from file, and also fix row loading if deleted by mistake
token = None
with open('auth0_token.txt', 'r') as f:
    content = f.read()
    # Extract token (line starting with "Access Token:")
    for line in content.split('\n'):
        if line.startswith('Access Token:'):
            token = line.split('Access Token:')[1].strip()
            break

# If the access token line was deleted by mistake, fix by prompting
if not token:
    print("Access Token row missing in auth0_token.txt.")
    token = input("Please paste/copy the access token: ").strip()
    # Optionally, write it back into the file for future runs
    with open('auth0_token.txt', 'a') as f:
        f.write("\nAccess Token: {}\n".format(token))
    print("Access Token line restored in auth0_token.txt.")

url = "https://4zone.us.auth0.com/api/v2/users"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

print("Testing Auth0 Management API...")
print(f"URL: {url}")
print(f"Token (first 50 chars): {token[:50]}...")
print()

try:
    response = requests.get(url, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print()
    
    if response.status_code == 200:
        data = response.json()
        print(f"Success! Found {len(data)} users:")
        print(json.dumps(data, indent=2))
    else:
        print(f"Error Response:")
        print(response.text)
        try:
            error_data = response.json()
            print(json.dumps(error_data, indent=2))
        except:
            print(response.text)
except Exception as e:
    print(f"Exception occurred: {e}")
