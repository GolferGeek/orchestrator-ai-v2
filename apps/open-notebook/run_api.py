#!/usr/bin/env python3
"""
Startup script for Open Notebook API server.
"""

import os
import sys
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

# Add the current directory to Python path so imports work
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Load environment variables from root .env file (monorepo setup)
root_env = current_dir.parent.parent / ".env"
load_dotenv(root_env)

if __name__ == "__main__":
    # Default configuration
    # Use OPEN_NOTEBOOK_API_PORT for consistency with root .env, fallback to API_PORT for backwards compatibility
    host = os.getenv("API_HOST", "127.0.0.1")
    port = int(os.getenv("OPEN_NOTEBOOK_API_PORT", os.getenv("API_PORT", "6202")))
    reload = os.getenv("API_RELOAD", "true").lower() == "true"

    print(f"Starting Open Notebook API server on {host}:{port}")
    print(f"Reload mode: {reload}")

    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        reload=reload,
        reload_dirs=[str(current_dir)] if reload else None,
    )
