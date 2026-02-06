"""
Authentication router for Open Notebook API.
Provides endpoints to check authentication status and handle login.
"""

import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Try to import Supabase
try:
    from supabase import create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.get("/status")
async def get_auth_status():
    """
    Check if authentication is enabled.
    Returns whether Supabase or password auth is required to access the API.
    """
    supabase_configured = bool(
        os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_ANON_KEY")
    )
    password_configured = bool(os.environ.get("OPEN_NOTEBOOK_PASSWORD"))
    auth_enabled = supabase_configured or password_configured

    return {
        "auth_enabled": auth_enabled,
        "auth_type": "supabase" if supabase_configured else ("password" if password_configured else "none"),
        "message": "Authentication is required" if auth_enabled else "Authentication is disabled"
    }


@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    """
    Login endpoint that proxies Supabase authentication.
    This allows the frontend to authenticate without directly accessing Supabase.
    """
    if not SUPABASE_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Supabase authentication is not available. Please install supabase package."
        )
    
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_anon_key:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
        )
    
    try:
        # Create Supabase client (backend can access Supabase internally)
        supabase = create_client(supabase_url, supabase_anon_key)
        
        # Authenticate with Supabase
        auth_response = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password,
        })
        
        if auth_response.user is None or auth_response.session is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        
        # Return the session token and user info
        return LoginResponse(
            access_token=auth_response.session.access_token,
            token_type="bearer",
            user={
                "id": auth_response.user.id,
                "email": auth_response.user.email,
                "role": getattr(auth_response.user, "role", "authenticated"),
            }
        )
    except Exception as e:
        error_message = str(e)
        # Handle common Supabase errors
        if "Invalid login credentials" in error_message or "Invalid email or password" in error_message:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )
        elif "Email not confirmed" in error_message:
            raise HTTPException(
                status_code=403,
                detail="Please confirm your email before logging in"
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Authentication failed: {error_message}"
            )
