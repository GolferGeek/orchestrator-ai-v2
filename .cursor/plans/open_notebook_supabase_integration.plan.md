# Open Notebook Integrat

ion Plan

## Overview

Move open-notebook into orchestratorai-v2 monorepo and integrate with existing Supabase authentication system. Keep SurrealDB as the database and configure ports 6201 (frontend) and 6202 (API).

## Architecture Changes

### Current State

- Standalone app with password-based auth (`OPEN_NOTEBOOK_PASSWORD`)
- Ports: 8502 (frontend), 5055 (API), 8000 (SurrealDB)
- Authentication: Simple Bearer token password check

### Target State

- Integrated into `orchestratorai-v2/apps/open-notebook`
- Ports: 6201 (frontend), 6202 (API), 6203 (SurrealDB)
- Authentication: Supabase JWT token verification
- Uses same Supabase instance as orchestratorai-v2

## Implementation Steps

### 1. Move Application Structure

- Move entire `open-notebook` directory to `orchestratorai-v2/apps/open-notebook`
- Keep all Python code, frontend, and database files intact
- Maintain existing directory structure
- **CRITICAL**: Preserve all attribution and licensing files (see Attribution section below)

### 2. Replace Authentication System

**File: `api/auth.py`**

- Replace `PasswordAuthMiddleware` with `SupabaseAuthMiddleware`
- Use Supabase Python client to verify JWT tokens
- Extract user info from verified token and attach to request state
- Fallback to password auth if Supabase not configured (for backward compatibility)

**File: `api/main.py`**

- Update middleware import from `PasswordAuthMiddleware` to `SupabaseAuthMiddleware`
- Keep excluded paths: `/`, `/health`, `/docs`, `/openapi.json`, `/redoc`, `/api/auth/status`, `/api/config`

**File: `api/routers/auth.py`**

- Update `/api/auth/status` endpoint to check for Supabase configuration
- Return `auth_enabled: true` if `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set
- Maintain backward compatibility with `OPEN_NOTEBOOK_PASSWORD`

### 3. Update Dependencies

**File: `pyproject.toml`**

- Add `supabase>=2.0.0` to dependencies
- Keep all existing dependencies

### 4. Port Configuration

**File: `run_api.py` or startup script**

- Change API port from 5055 to 6202
- Update uvicorn command: `--port 6202`

**File: `frontend/package.json` or `next.config.ts`**

- Update dev server port from 8502 to 6201
- Update `API_URL` environment variable handling

**File: `docker-compose.dev.yml` (if used)**

- Update port mappings: `6201:6201` (frontend), `6202:6202` (API), `6203:6203` (SurrealDB)

**File: `supervisord.single.conf` (if used)**

- Update API port in command: `--port 6202`
- Update frontend port: `PORT="6201"`

### 5. Environment Variables

**New Required Variables:**

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

**Optional (for backward compatibility):**

```env
OPEN_NOTEBOOK_PASSWORD=fallback-password  # Only used if Supabase not configured
```

**Existing Variables (update SurrealDB URL):**

- `SURREAL_URL=ws://localhost:6203/rpc` (updated from 8000)
- All other SurrealDB configuration (user, password, namespace, database)
- All AI provider API keys
- Data folder paths

### 6. Frontend Authentication Updates

**File: `frontend/src/lib/stores/auth-store.ts`**

- Update to use Supabase auth tokens instead of password
- Get token from orchestratorai-v2 auth system (likely via shared state or API)
- Send `Authorization: Bearer {supabase-jwt-token}` header

**File: `frontend/src/lib/api/client.ts`**

- Ensure it properly extracts and sends Supabase JWT tokens
- Token should come from orchestratorai-v2's auth context

### 7. Integration Points

**Selected: Option A - Shared Auth Context**

- Access orchestratorai-v2's Supabase auth token from shared context
- Frontend gets token from parent app's auth system
- Pass token to open-notebook API
- Frontend will read Supabase JWT token from orchestratorai-v2's auth store/context
- Token is passed in `Authorization: Bearer {token}` header to open-notebook API
- No proxy needed - direct communication with token forwarding

### 8. Database Configuration

**Keep SurrealDB:**

- Update database port from 8000 to 6203
- Update connection URL to `ws://localhost:6203/rpc`
- Update `SURREAL_URL` environment variable
- Keep all migrations and schema as-is
- SurrealDB remains independent of Supabase

### 9. Development Setup

**Update `orchestratorai-v2/package.json`:**

- Add script: `"dev:notebook": "cd apps/open-notebook && make start-all"`

**Update `orchestratorai-v2/turbo.json`:**

- Add open-notebook to turbo pipeline if needed

### 10. Testing Checklist

- [ ] Supabase JWT tokens are accepted
- [ ] Invalid tokens are rejected (401)
- [ ] User info is attached to request state
- [ ] Frontend correctly sends Supabase tokens
- [ ] Ports 6201 and 6202 are accessible
- [ ] SurrealDB works on port 6203
- [ ] All API endpoints require valid Supabase token
- [ ] Health/status endpoints remain public
- [ ] Backward compatibility with password auth (if configured)
- [ ] LICENSE file is preserved with original copyright
- [ ] README.md maintains original attribution and links
- [ ] ATTRIBUTION.md file created (if needed)
- [ ] All original author credits are visible

## Files to Modify

1. `api/auth.py` - Replace password auth with Supabase JWT
2. `api/main.py` - Update middleware import
3. `api/routers/auth.py` - Update auth status endpoint
4. `pyproject.toml` - Add supabase dependency
5. `run_api.py` - Update port to 6202
6. `frontend/package.json` or `next.config.ts` - Update port to 6201
7. `frontend/src/lib/stores/auth-store.ts` - Use Supabase tokens
8. `frontend/src/lib/api/client.ts` - Ensure Supabase token handling
9. `docker-compose.dev.yml` - Update port mappings (including SurrealDB to 6203)
10. `supervisord.single.conf` - Update ports (including SurrealDB to 6203)
11. Environment variables - Update `SURREAL_URL` to use port 6203
12. Attribution files - Ensure all copyright and attribution are preserved

## Attribution and Licensing

**CRITICAL**: This codebase is open source (MIT License) by Luis Novo. All attribution must be preserved.

### Files to Preserve (DO NOT MODIFY OR REMOVE):

1. **`LICENSE`** - MIT License file, copyright (c) 2024 Luis Novo

- Must remain in root of `apps/open-notebook/`
- Do not modify or remove copyright notice

2. **`README.md`** - Original README with full attribution

- Preserve original author information
- Keep links to original repository: https://github.com/lfnovo/open-notebook
- Maintain all original badges, links, and credits

3. **`pyproject.toml`** - Preserve author field:

- `authors = [{name = "Luis Novo", email = "lfnovo@gmail.com"}]`

### Additional Attribution Requirements:

**Create `ATTRIBUTION.md` in `apps/open-notebook/`** (if not exists):

```markdown
# Attribution

This application is based on [Open Notebook](https://github.com/lfnovo/open-notebook), 
an open-source project by [Luis Novo](https://github.com/lfnovo).

## Original Project
- **Repository**: https://github.com/lfnovo/open-notebook
- **Author**: Luis Novo
- **License**: MIT License
- **Copyright**: Copyright (c) 2024 Luis Novo

## Modifications
This version has been integrated into orchestratorai-v2 with the following modifications:
- Supabase JWT authentication integration
- Port configuration changes (6201, 6202, 6203)
- Integration with orchestratorai-v2 monorepo structure

All original functionality, code structure, and features remain intact.
```

**Update `apps/open-notebook/README.md`** (add at top):

- Add clear notice that this is an integration/modification
- Link to original repository prominently
- Maintain all original content below

**In code comments** (when making modifications):

- Add comments indicating modifications made for orchestratorai-v2 integration
- Do not remove original author comments or copyright notices

### License Compliance:

- MIT License allows modification and integration
- Must include original copyright notice in all copies
- Attribution must be clear and visible
- Original LICENSE file must be included

## Dependencies

- Supabase Python client: `supabase>=2.0.0`
- Access to orchestratorai-v2's Supabase configuration
- Supabase JWT tokens from parent application

## Notes

- SurrealDB configured on port 6203 (in 6000 range as requested)
- Authentication is handled at API level, not database level
- Frontend will need access to Supabase auth tokens from orchestratorai-v2
- Update `SURREAL_URL` environment variable to `ws://localhost:6203/rpc`