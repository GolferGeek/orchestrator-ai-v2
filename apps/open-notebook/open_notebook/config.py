import os
from typing import Optional

# ROOT DATA FOLDER
DATA_FOLDER = "./data"

# LANGGRAPH CHECKPOINT FILE
sqlite_folder = f"{DATA_FOLDER}/sqlite-db"
os.makedirs(sqlite_folder, exist_ok=True)
LANGGRAPH_CHECKPOINT_FILE = f"{sqlite_folder}/checkpoints.sqlite"

# UPLOADS FOLDER - Base folder (legacy support)
UPLOADS_FOLDER = f"{DATA_FOLDER}/uploads"
os.makedirs(UPLOADS_FOLDER, exist_ok=True)

# Multi-tenancy upload folders
PERSONAL_UPLOADS_FOLDER = f"{UPLOADS_FOLDER}/personal"
TEAM_UPLOADS_FOLDER = f"{UPLOADS_FOLDER}/teams"
os.makedirs(PERSONAL_UPLOADS_FOLDER, exist_ok=True)
os.makedirs(TEAM_UPLOADS_FOLDER, exist_ok=True)


def get_upload_folder(
    user_id: Optional[str] = None,
    team_id: Optional[str] = None,
    source_id: Optional[str] = None,
) -> str:
    """
    Get the upload folder path based on ownership context.

    Structure:
        data/uploads/personal/{user_id}/{source_id}/
        data/uploads/teams/{team_id}/{source_id}/
        data/uploads/  (legacy fallback if no ownership)

    Args:
        user_id: Personal owner ID (Supabase user ID)
        team_id: Team owner ID (from Orch-Flow teams)
        source_id: Optional source ID for organizing files per source

    Returns:
        Path to the appropriate upload folder
    """
    if team_id:
        base_path = f"{TEAM_UPLOADS_FOLDER}/{team_id}"
    elif user_id:
        base_path = f"{PERSONAL_UPLOADS_FOLDER}/{user_id}"
    else:
        # Legacy fallback for data without ownership
        return UPLOADS_FOLDER

    if source_id:
        # Clean source_id to be filesystem safe (remove table prefix)
        clean_source_id = source_id.replace("source:", "")
        base_path = f"{base_path}/{clean_source_id}"

    os.makedirs(base_path, exist_ok=True)
    return base_path


# TIKTOKEN CACHE FOLDER
TIKTOKEN_CACHE_DIR = f"{DATA_FOLDER}/tiktoken-cache"
os.makedirs(TIKTOKEN_CACHE_DIR, exist_ok=True)
