"""
FastAPI Main Application
"""
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
import httpx
import os
from typing import Optional
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError
import json
from functools import lru_cache

# Security
security = HTTPBearer()

# Auth0 Configuration
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
AUTH0_ALGORITHMS = ["RS256"]

# Cache for JWKS keys
_jwks_cache = None


async def get_jwks():
    """Fetch and cache JWKS from Auth0"""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    
    if not AUTH0_DOMAIN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth0 domain not configured"
        )
    
    jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url, timeout=10.0)
            response.raise_for_status()
            _jwks_cache = response.json()
            return _jwks_cache
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch JWKS: {str(e)}"
        )


def get_signing_key(jwks: dict, token: str) -> dict:
    """Extract the signing key from JWKS based on token header"""
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token header"
        )
    
    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing key ID"
        )
    
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unable to find appropriate signing key"
    )


async def verify_jwt_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Verify JWT token with Auth0.
    Returns the decoded token payload if valid.
    """
    token = credentials.credentials
    
    # Skip verification in development mode if Auth0 is not configured
    if not AUTH0_DOMAIN or not AUTH0_AUDIENCE:
        # Return a mock payload for development
        return {
            "sub": "dev-user",
            "email": "dev@example.com",
            "permissions": []
        }
    
    jwks = await get_jwks()
    signing_key = get_signing_key(jwks, token)
    
    try:
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=AUTH0_ALGORITHMS,
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
        return payload
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )

# Initialize FastAPI app
app = FastAPI(
    title="Full Stack API",
    description="API Server with MCP Integration",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MCP Gateway URL
MCP_GATEWAY_URL = os.getenv("MCP_GATEWAY_URL", "http://mcp_gateway:8000")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("🚀 API Server starting...")
    yield
    # Shutdown
    print("🛑 API Server shutting down...")


app.router.lifespan_context = lifespan


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "api_server",
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Full Stack API Server",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/api/v1/status")
async def api_status():
    """API status endpoint"""
    # Check MCP gateway connectivity
    mcp_status = "unknown"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{MCP_GATEWAY_URL}/health", timeout=5.0)
            if response.status_code == 200:
                mcp_status = "connected"
            else:
                mcp_status = "error"
    except Exception as e:
        mcp_status = f"error: {str(e)}"

    return {
        "api": "operational",
        "mcp_gateway": mcp_status
    }


@app.post("/api/v1/mcp/execute")
async def execute_mcp_tool(
    tool_name: str,
    arguments: dict,
    token_payload: dict = Depends(verify_jwt_token)
):
    """
    Execute MCP tool via gateway
    Requires authentication - JWT token is verified via Auth0
    """
    # Token is now verified - token_payload contains the decoded JWT claims
    # Available claims: sub (user ID), email, permissions, etc.
    user_id = token_payload.get("sub", "unknown")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MCP_GATEWAY_URL}/execute",
                json={
                    "tool": tool_name,
                    "arguments": arguments
                },
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MCP Gateway error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


