import os
import httpx
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
MCP_GATEWAY_URL = os.getenv("MCP_GATEWAY_URL", "http://localhost:8000")
SLACK_ADMIN_CHANNEL = os.getenv("SLACK_ADMIN_CHANNEL", "compliance-alerts")

async def get_expiring_compliance():
    """Query Supabase for expiring or expired compliance items"""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Query driver_compliance
    async with httpx.AsyncClient() as client:
        # Fetch driver_compliance joined with profiles
        # We use PostgREST syntax for joins
        url = f"{SUPABASE_URL}/rest/v1/driver_compliance?select=*,profiles(*),compliance_requirements(*)&status=in.(EXPIRING_SOON,EXPIRED)"
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        compliance_items = response.json()
        
        # Query driver_documents
        url = f"{SUPABASE_URL}/rest/v1/driver_documents?select=*,profiles(*)&status=in.(expiring_soon,expired)"
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        document_items = response.json()
        
    return compliance_items, document_items

async def send_slack_notification(message: str):
    """Send a notification to the admin Slack channel via MCP Gateway"""
    payload = {
        "tool": "SLACK_SEND_MESSAGE",
        "arguments": {
            "channel_id": SLACK_ADMIN_CHANNEL,
            "text": message
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{MCP_GATEWAY_URL}/execute", json=payload)
        return response.json()

async def send_email_notification(to: str, subject: str, body: str):
    """Send an email notification to the driver via MCP Gateway"""
    payload = {
        "tool": "GMAIL_SEND_EMAIL",
        "arguments": {
            "to": to,
            "subject": subject,
            "body": body
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{MCP_GATEWAY_URL}/execute", json=payload)
        return response.json()

async def run_automation():
    print(f"[{datetime.now()}] Starting Compliance Notification Automation...")
    
    try:
        compliance_items, document_items = await get_expiring_compliance()
        
        # Process Driver Compliance Requirements
        for item in compliance_items:
            driver = item.get("profiles", {})
            requirement = item.get("compliance_requirements", {})
            status = item.get("status")
            expiry = item.get("expiration_date")
            
            message = f"🚨 *Compliance Alert*: {driver.get('name')} - {requirement.get('name')} is {status}. Expiry: {expiry}"
            print(f"Processing: {message}")
            
            # Notify Admin
            await send_slack_notification(message)
            
            # Notify Driver if email exists
            if driver.get("email") and driver.get("prefer_email"):
                subject = f"Action Required: Your {requirement.get('name')} is {status.replace('_', ' ').lower()}"
                body = f"Hello {driver.get('name')},\n\nYour compliance requirement '{requirement.get('name')}' is currently {status}. Please take action before {expiry} to remain compliant.\n\nThank you,\nFleet Management"
                await send_email_notification(driver.get("email"), subject, body)

        # Process Driver Documents
        for doc in document_items:
            driver = doc.get("profiles", {})
            doc_type = doc.get("document_type")
            status = doc.get("status")
            expiry = doc.get("expiration_date")
            
            message = f"📄 *Document Alert*: {driver.get('name')} - {doc_type} is {status.upper()}. Expiry: {expiry}"
            print(f"Processing: {message}")
            
            # Notify Admin
            await send_slack_notification(message)
            
            # Notify Driver if email exists
            if driver.get("email") and driver.get("prefer_email"):
                subject = f"Action Required: Your {doc_type} is {status.replace('_', ' ').lower()}"
                body = f"Hello {driver.get('name')},\n\nYour document '{doc_type}' is {status}. Please upload a renewed version before {expiry}.\n\nThank you,\nFleet Management"
                await send_email_notification(driver.get("email"), subject, body)
                
        print(f"[{datetime.now()}] Automation completed successfully.")
        
    except Exception as e:
        print(f"Error during automation: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_automation())
