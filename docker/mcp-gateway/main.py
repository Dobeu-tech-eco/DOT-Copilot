"""
MCP Gateway/Orchestrator
Manages communication with MCP servers
Implements HTTP-based MCP protocol communication
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from typing import Dict, Any, List, Optional
import redis
import json
from pydantic import BaseModel
from enum import Enum


class MCPMessageType(str, Enum):
    """MCP JSON-RPC message types"""
    TOOLS_LIST = "tools/list"
    TOOLS_CALL = "tools/call"
    RESOURCES_LIST = "resources/list"
    RESOURCES_READ = "resources/read"


class MCPRequest(BaseModel):
    """MCP JSON-RPC request format"""
    jsonrpc: str = "2.0"
    id: int = 1
    method: str
    params: Optional[Dict[str, Any]] = None


class MCPToolCall(BaseModel):
    """MCP tool call request"""
    name: str
    arguments: Dict[str, Any] = {}


async def send_mcp_request(
    server_url: str,
    method: str,
    params: Optional[Dict[str, Any]] = None,
    timeout: float = 30.0
) -> Dict[str, Any]:
    """
    Send a JSON-RPC request to an MCP server.
    
    Args:
        server_url: Base URL of the MCP server
        method: MCP method to call (e.g., 'tools/call', 'tools/list')
        params: Parameters for the method
        timeout: Request timeout in seconds
    
    Returns:
        The result from the MCP server response
    
    Raises:
        HTTPException: If the request fails or returns an error
    """
    request = MCPRequest(
        method=method,
        params=params or {}
    )
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{server_url}/mcp",
                json=request.model_dump(),
                headers={"Content-Type": "application/json"},
                timeout=timeout
            )
            response.raise_for_status()
            
            result = response.json()
            
            # Handle JSON-RPC error response
            if "error" in result:
                error = result["error"]
                raise HTTPException(
                    status_code=500,
                    detail=f"MCP error: {error.get('message', 'Unknown error')} (code: {error.get('code', -1)})"
                )
            
            return result.get("result", {})
            
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail=f"MCP server timeout after {timeout}s"
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"MCP server error: {e.response.text}"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to MCP server: {str(e)}"
        )


async def list_mcp_tools(server_url: str) -> List[Dict[str, Any]]:
    """List available tools from an MCP server"""
    result = await send_mcp_request(server_url, MCPMessageType.TOOLS_LIST)
    return result.get("tools", [])


async def call_mcp_tool(
    server_url: str,
    tool_name: str,
    arguments: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Call a tool on an MCP server.
    
    Args:
        server_url: Base URL of the MCP server
        tool_name: Name of the tool to call
        arguments: Arguments to pass to the tool
    
    Returns:
        The tool execution result
    """
    params = {
        "name": tool_name,
        "arguments": arguments
    }
    return await send_mcp_request(server_url, MCPMessageType.TOOLS_CALL, params)

app = FastAPI(
    title="MCP Gateway",
    description="Gateway for MCP Server Orchestration",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection
redis_client = None
try:
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/1")
    redis_client = redis.from_url(redis_url, decode_responses=True)
except Exception as e:
    print(f"Warning: Redis connection failed: {e}")

# MCP Server configurations
MCP_SERVERS = {
    "github": {
        "url": "http://github_mcp:8000",
        "enabled": bool(os.getenv("GITHUB_TOKEN"))
    },
    # Add other MCP servers here
}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "mcp_gateway",
        "servers": {name: "enabled" if config["enabled"] else "disabled" 
                   for name, config in MCP_SERVERS.items()}
    }


@app.post("/execute")
async def execute_mcp_tool(request: Dict[str, Any]):
    """
    Execute a tool on an MCP server
    Request format: {
        "tool": "tool_name",
        "server": "github",  # optional, will auto-detect
        "arguments": {...}
    }
    """
    tool_name = request.get("tool")
    server_name = request.get("server")
    arguments = request.get("arguments", {})

    if not tool_name:
        raise HTTPException(status_code=400, detail="Tool name required")

    # Auto-detect server if not specified
    if not server_name:
        # Simple heuristic: check tool name prefix
        if tool_name.startswith("github_"):
            server_name = "github"
        else:
            raise HTTPException(
                status_code=400, 
                detail="Server name required or tool name must include server prefix"
            )

    if server_name not in MCP_SERVERS:
        raise HTTPException(
            status_code=404, 
            detail=f"MCP server '{server_name}' not found"
        )

    server_config = MCP_SERVERS[server_name]
    if not server_config["enabled"]:
        raise HTTPException(
            status_code=503,
            detail=f"MCP server '{server_name}' is not enabled"
        )

    # Cache key for rate limiting
    cache_key = f"mcp:execute:{server_name}:{tool_name}"
    
    # Check cache
    if redis_client:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

    # Execute tool using MCP protocol
    try:
        server_url = server_config["url"]
        
        # Call the MCP tool using JSON-RPC protocol
        mcp_result = await call_mcp_tool(
            server_url=server_url,
            tool_name=tool_name,
            arguments=arguments
        )
        
        result = {
            "success": True,
            "server": server_name,
            "tool": tool_name,
            "result": mcp_result,
            "arguments": arguments
        }

        # Cache result (5 minutes) - only cache successful results
        if redis_client:
            redis_client.setex(cache_key, 300, json.dumps(result))

        return result

    except HTTPException:
        # Re-raise HTTP exceptions from MCP communication
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error executing tool: {str(e)}"
        )


@app.get("/servers")
async def list_servers():
    """List available MCP servers"""
    return {
        "servers": {
            name: {
                "enabled": config["enabled"],
                "url": config["url"]
            }
            for name, config in MCP_SERVERS.items()
        }
    }


@app.get("/servers/{server_name}/tools")
async def list_server_tools(server_name: str):
    """
    List available tools from a specific MCP server.
    
    Args:
        server_name: Name of the MCP server
    
    Returns:
        List of available tools with their schemas
    """
    if server_name not in MCP_SERVERS:
        raise HTTPException(
            status_code=404,
            detail=f"MCP server '{server_name}' not found"
        )
    
    server_config = MCP_SERVERS[server_name]
    if not server_config["enabled"]:
        raise HTTPException(
            status_code=503,
            detail=f"MCP server '{server_name}' is not enabled"
        )
    
    # Check cache first
    cache_key = f"mcp:tools:{server_name}"
    if redis_client:
        cached = redis_client.get(cache_key)
        if cached:
            return {"server": server_name, "tools": json.loads(cached)}
    
    try:
        tools = await list_mcp_tools(server_config["url"])
        
        # Cache tools list (10 minutes)
        if redis_client:
            redis_client.setex(cache_key, 600, json.dumps(tools))
        
        return {"server": server_name, "tools": tools}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list tools: {str(e)}"
        )


@app.get("/tools")
async def list_all_tools():
    """
    List all available tools from all enabled MCP servers.
    
    Returns:
        Dictionary of server names to their available tools
    """
    all_tools = {}
    errors = {}
    
    for name, config in MCP_SERVERS.items():
        if not config["enabled"]:
            continue
        
        try:
            tools = await list_mcp_tools(config["url"])
            all_tools[name] = tools
        except Exception as e:
            errors[name] = str(e)
    
    return {
        "tools": all_tools,
        "errors": errors if errors else None
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


