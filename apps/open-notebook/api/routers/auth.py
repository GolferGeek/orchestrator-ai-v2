"""
Authentication router for Open Notebook API.
Provides endpoints to check authentication status.
"""

import os

from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["auth"])


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
