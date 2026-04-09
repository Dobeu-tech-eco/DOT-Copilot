#!/usr/bin/env python3
"""
Script to retrieve Auth0 Management API access token using Client Credentials grant.
"""

import requests
import sys
import getpass
import argparse
from urllib.parse import urljoin


def get_auth0_token(domain: str, client_id: str, client_secret: str) -> dict:
    """
    Retrieve Auth0 Management API access token.
    
    Args:
        domain: Auth0 domain (e.g., 'your-tenant.auth0.com')
        client_id: Machine-to-Machine application client ID
        client_secret: Machine-to-Machine application client secret
    
    Returns:
        Dictionary containing the token response
    """
    token_url = f"https://{domain}/oauth/token"
    audience = f"https://{domain}/api/v2/"
    
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "audience": audience
    }
    
    headers = {
        "content-type": "application/x-www-form-urlencoded"
    }
    
    try:
        response = requests.post(token_url, data=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error requesting token: {e}", file=sys.stderr)
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response status: {e.response.status_code}", file=sys.stderr)
            print(f"Response body: {e.response.text}", file=sys.stderr)
        sys.exit(1)


def main():
    """Main function to interactively get Auth0 token."""
    import os
    
    parser = argparse.ArgumentParser(description="Retrieve Auth0 Management API access token")
    parser.add_argument("--domain", help="Auth0 domain (e.g., your-tenant.auth0.com)")
    parser.add_argument("--client-id", help="Auth0 Client ID")
    parser.add_argument("--client-secret", help="Auth0 Client Secret")
    parser.add_argument("--no-save", action="store_true", help="Don't prompt to save token to file")
    args = parser.parse_args()
    
    print("Auth0 Management API Token Retrieval")
    print("=" * 50)
    
    # Check for command-line arguments first, then environment variables, then prompt
    domain = args.domain or os.getenv("AUTH0_DOMAIN", "").strip()
    client_id = args.client_id or os.getenv("AUTH0_CLIENT_ID", "").strip()
    client_secret = args.client_secret or os.getenv("AUTH0_CLIENT_SECRET", "").strip()
    
    if domain and client_id and client_secret:
        print("Using provided credentials")
    else:
        if domain or client_id or client_secret:
            print("Note: Some credentials provided. Will prompt for missing ones.\n")
        
        # Get credentials interactively for any that are missing
        domain = domain or input("Enter your Auth0 domain (e.g., your-tenant.auth0.com): ").strip()
        if not domain:
            print("Error: Domain cannot be empty", file=sys.stderr)
            sys.exit(1)
        
        client_id = client_id or input("Enter your Client ID: ").strip()
        if not client_id:
            print("Error: Client ID cannot be empty", file=sys.stderr)
            sys.exit(1)
        
        client_secret = client_secret or getpass.getpass("Enter your Client Secret: ").strip()
        if not client_secret:
            print("Error: Client Secret cannot be empty", file=sys.stderr)
            sys.exit(1)
    
    print("\nRequesting token...")
    
    try:
        result = get_auth0_token(domain, client_id, client_secret)
        
        print("\n" + "=" * 50)
        print("Token retrieved successfully!")
        print("=" * 50)
        print(f"Access Token: {result.get('access_token', 'N/A')}")
        print(f"Token Type: {result.get('token_type', 'N/A')}")
        print(f"Expires In: {result.get('expires_in', 'N/A')} seconds")
        print("=" * 50)
        
        # Also save token to a file (optional)
        if not args.no_save:
            save_file = input("\nSave token to file? (y/n): ").strip().lower()
            if save_file == 'y':
                filename = input("Enter filename (default: auth0_token.txt): ").strip() or "auth0_token.txt"
                with open(filename, 'w') as f:
                    f.write(f"Access Token: {result.get('access_token')}\n")
                    f.write(f"Token Type: {result.get('token_type')}\n")
                    f.write(f"Expires In: {result.get('expires_in')} seconds\n")
                print(f"Token saved to {filename}")
        
        return result
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

