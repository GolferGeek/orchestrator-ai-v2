"""
Pytest configuration file.

This file ensures that the project root is in the Python path,
allowing tests to import from the api and open_notebook modules.
"""

import os
import sys
from pathlib import Path

# Add the project root to the Python path FIRST
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Load root .env to get test credentials
from dotenv import load_dotenv
root_env = project_root.parent.parent / ".env"
load_dotenv(root_env)

# Disable password auth
os.environ["OPEN_NOTEBOOK_PASSWORD"] = ""

import pytest


def get_test_auth_token() -> str:
    """Get a valid JWT token for test user from Supabase."""
    from supabase import create_client

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY")
    test_user = os.environ.get("SUPABASE_TEST_USER")
    test_password = os.environ.get("SUPABASE_TEST_PASSWORD")

    if not all([supabase_url, supabase_anon_key, test_user, test_password]):
        pytest.skip("Supabase test credentials not configured")

    client = create_client(supabase_url, supabase_anon_key)
    response = client.auth.sign_in_with_password({
        "email": test_user,
        "password": test_password,
    })

    return response.session.access_token


@pytest.fixture(scope="session")
def auth_token():
    """Session-scoped fixture that provides a valid auth token."""
    return get_test_auth_token()


@pytest.fixture
def auth_headers(auth_token):
    """Fixture that provides auth headers for authenticated requests."""
    return {"Authorization": f"Bearer {auth_token}"}
