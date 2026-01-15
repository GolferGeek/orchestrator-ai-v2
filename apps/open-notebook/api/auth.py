import os
from dataclasses import dataclass
from typing import Optional, Tuple

from fastapi import HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Try to import Supabase, fall back to password auth if not available
try:
    from supabase import Client, create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger.warning("Supabase not available. Install with: pip install supabase")


@dataclass
class OwnershipContext:
    """Context for multi-tenancy ownership."""
    user_id: Optional[str] = None  # Personal owner (Supabase user ID)
    team_id: Optional[str] = None  # Team owner (from Orch-Flow teams)
    created_by: Optional[str] = None  # Who performed the action


def get_ownership_context(request: Request) -> OwnershipContext:
    """
    Extract ownership context from request state and headers.

    Priority:
    1. X-Team-ID header for team context
    2. User ID from authenticated user for personal context

    Returns OwnershipContext with:
    - user_id set (personal) OR team_id set (team)
    - created_by always set to authenticated user ID
    """
    user = getattr(request.state, "user", None)
    user_id = user.get("id") if user else None

    # Check for team context header
    team_id = request.headers.get("X-Team-ID")

    if team_id:
        # Team context - user_id is None, team_id is set
        return OwnershipContext(
            user_id=None,
            team_id=team_id,
            created_by=user_id,
        )
    else:
        # Personal context - user_id is set, team_id is None
        return OwnershipContext(
            user_id=user_id,
            team_id=None,
            created_by=user_id,
        )


def get_ownership_filter(request: Request) -> Tuple[Optional[str], Optional[str]]:
    """
    Get user_id and team_id for filtering queries.

    Returns (user_id, team_id) tuple for use in queries.
    Both may be set to allow showing personal AND team items.
    """
    user = getattr(request.state, "user", None)
    user_id = user.get("id") if user else None
    team_id = request.headers.get("X-Team-ID")

    return user_id, team_id


class SupabaseAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to check Supabase JWT authentication for all API requests.
    Falls back to password auth if Supabase is not configured.
    """
    
    def __init__(self, app, excluded_paths: Optional[list] = None):
        super().__init__(app)
        self.excluded_paths = excluded_paths or ["/", "/health", "/docs", "/openapi.json", "/redoc"]
        
        # Supabase configuration
        self.supabase_url = os.environ.get("SUPABASE_URL")
        self.supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY")
        self.supabase_client: Optional[Client] = None
        
        # Fallback password auth (for backward compatibility)
        self.password = os.environ.get("OPEN_NOTEBOOK_PASSWORD")
        
        # Initialize Supabase client if configured
        if SUPABASE_AVAILABLE and self.supabase_url and self.supabase_anon_key:
            try:
                self.supabase_client = create_client(self.supabase_url, self.supabase_anon_key)
                logger.info("Supabase authentication enabled")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                self.supabase_client = None
        elif not self.password:
            logger.warning("No authentication configured. API will be publicly accessible.")
    
    async def dispatch(self, request: Request, call_next):
        # Skip authentication for excluded paths
        if request.url.path in self.excluded_paths:
            return await call_next(request)
        
        # Skip authentication for CORS preflight requests (OPTIONS)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Check authorization header
        auth_header = request.headers.get("Authorization")
        
        if not auth_header:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing authorization header"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Expected format: "Bearer {token}"
        try:
            scheme, token = auth_header.split(" ", 1)
            if scheme.lower() != "bearer":
                raise ValueError("Invalid authentication scheme")
        except ValueError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authorization header format"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Try Supabase JWT authentication first
        if self.supabase_client:
            try:
                # Verify JWT token with Supabase
                auth_response = self.supabase_client.auth.get_user(token)

                if auth_response is not None and auth_response.user is not None:
                    # Token is valid, attach user info to request state
                    user = auth_response.user
                    request.state.user = {
                        "id": user.id,
                        "email": user.email,
                        "role": user.role or "authenticated",
                    }
                    response_obj = await call_next(request)
                    return response_obj
                else:
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Invalid token"},
                        headers={"WWW-Authenticate": "Bearer"}
                    )
            except Exception as e:
                logger.debug(f"Supabase token validation failed: {e}")
                # Fall through to password auth if Supabase fails
        
        # Fallback to password authentication (for backward compatibility)
        if self.password:
            if token == self.password:
                # Password is correct, proceed with the request
                response = await call_next(request)
                return response
            else:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid token or password"},
                    headers={"WWW-Authenticate": "Bearer"}
                )
        
        # No authentication configured and token provided
        return JSONResponse(
            status_code=401,
            content={"detail": "Authentication required but not configured"},
            headers={"WWW-Authenticate": "Bearer"}
        )


class PasswordAuthMiddleware(BaseHTTPMiddleware):
    """
    Legacy password authentication middleware.
    Kept for backward compatibility. Use SupabaseAuthMiddleware instead.
    """
    
    def __init__(self, app, excluded_paths: Optional[list] = None):
        super().__init__(app)
        self.password = os.environ.get("OPEN_NOTEBOOK_PASSWORD")
        self.excluded_paths = excluded_paths or ["/", "/health", "/docs", "/openapi.json", "/redoc"]
    
    async def dispatch(self, request: Request, call_next):
        # Skip authentication if no password is set
        if not self.password:
            return await call_next(request)
        
        # Skip authentication for excluded paths
        if request.url.path in self.excluded_paths:
            return await call_next(request)
        
        # Skip authentication for CORS preflight requests (OPTIONS)
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Check authorization header
        auth_header = request.headers.get("Authorization")
        
        if not auth_header:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing authorization header"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Expected format: "Bearer {password}"
        try:
            scheme, credentials = auth_header.split(" ", 1)
            if scheme.lower() != "bearer":
                raise ValueError("Invalid authentication scheme")
        except ValueError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authorization header format"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Check password
        if credentials != self.password:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid password"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Password is correct, proceed with the request
        response = await call_next(request)
        return response


# Optional: HTTPBearer security scheme for OpenAPI documentation
security = HTTPBearer(auto_error=False)


def check_api_password(credentials: Optional[HTTPAuthorizationCredentials] = None) -> bool:
    """
    Utility function to check API password.
    Can be used as a dependency in individual routes if needed.
    """
    password = os.environ.get("OPEN_NOTEBOOK_PASSWORD")
    
    # No password set, allow access
    if not password:
        return True
    
    # No credentials provided
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check password
    if credentials.credentials != password:
        raise HTTPException(
            status_code=401,
            detail="Invalid password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return True