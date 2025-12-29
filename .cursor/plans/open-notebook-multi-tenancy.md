# Open Notebook Multi-Tenancy Plan

## Overview

**Goal**: Unified multi-tenancy across Orch AI apps with centralized teams in the API.

1. Add `public.teams` and `public.team_members` tables in API (Supabase)
2. Both Orch-Flow and Open Notebook get org/team data from API endpoints
3. Open Notebook uses ownership fields for filtering (user_id, team_id, org_slug)
4. Admin UI in web app for managing teams and user assignments

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    API (NestJS) - Supabase                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  RBAC (existing)                                         │    │
│  │    auth.users ──► rbac_user_org_roles ──► organizations │    │
│  │                                                          │    │
│  │  Teams (new)                                             │    │
│  │    public.organizations                                  │    │
│  │      └── public.teams (org_slug FK)                     │    │
│  │            └── public.team_members (team_id, user_id)   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Endpoints:                                                     │
│    GET /api/users/me/context  -- User's orgs & teams           │
│    GET /api/orgs              -- User's organizations          │
│    GET /api/orgs/:slug/teams  -- Teams in an org               │
│    POST /api/orgs/:slug/teams -- Create team (admin)           │
│    GET /api/teams/:id/members -- Team members                  │
│    POST /api/teams/:id/members -- Add member (admin)           │
└─────────────────────────────────────────────────────────────────┘
              ▲                       ▲                    ▲
              │                       │                    │
  ┌───────────┴───────┐   ┌───────────┴───────┐   ┌───────┴───────┐
  │    Orch-Flow      │   │   Open Notebook   │   │   Web (Admin) │
  │  Calls API for    │   │  Calls API for    │   │  Team mgmt UI │
  │  orgs & teams     │   │  orgs & teams     │   │               │
  └───────────────────┘   └───────────────────┘   └───────────────┘
```

---

## Data Model

### Users → Organizations (RBAC - existing)
```sql
-- Users get org access via RBAC roles
rbac_user_org_roles (user_id, organization_slug, role_id)
```

### Organizations → Teams (new)
```sql
public.teams (
  id UUID PRIMARY KEY,
  org_slug TEXT REFERENCES public.organizations(slug),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

public.team_members (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',  -- member, lead, etc.
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
)
```

### Ownership in Open Notebook (SurrealDB)
```surql
-- Notebooks, sources, notes, etc. can be:
-- 1. Personal: user_id set, team_id null, org_slug null
-- 2. Team: team_id set, user_id null (org_slug derived from team)
-- 3. Org-wide: org_slug set, team_id null, user_id null (future)

DEFINE FIELD user_id ON notebook TYPE option<string>;
DEFINE FIELD team_id ON notebook TYPE option<string>;
DEFINE FIELD org_slug ON notebook TYPE option<string>;
DEFINE FIELD created_by ON notebook TYPE string;
```

---

## Implementation Phases

### Phase 1: SurrealDB Migration ✅
- [x] Create migration `10.surrealql` with ownership fields
- [x] Add indexes for user_id and team_id filtering
- [x] Update `fn::vector_search` and `fn::text_search` functions for ownership filtering

### Phase 2: Update Domain Models ✅
- [x] Add `user_id`, `team_id`, `created_by` to `ObjectModel` base class
- [x] Update `get_all()` to support ownership filtering
- [x] Update `text_search()` and `vector_search()` for ownership parameters

### Phase 3: Update Open Notebook API ✅
- [x] Add `OwnershipContext` dataclass and helper functions to `api/auth.py`
- [x] Add `get_ownership_context()` to extract user/team from request
- [x] Add `get_ownership_filter()` for query filtering
- [x] Update `api/models.py` with `OwnershipMixin` for response models
- [x] Update notebooks router with ownership filtering and creation

### Phase 4: Update File Storage ✅
- [x] Update `open_notebook/config.py` with `get_upload_folder()` function
- [x] Create `personal/{user_id}/` and `teams/{team_id}/` folder structure
- [x] Update `save_uploaded_file()` to use ownership-based paths
- [x] Update `create_source` endpoint to set ownership and use correct folders

### Phase 5: Orch-Flow Cleanup ✅
- [x] Create migration `20251227000001_remove_team_files_notes_tables.sql`
- [x] Create `OpenNotebookRedirect` component for redirect UI
- [x] Update `Index.tsx` to use redirect instead of FilesTab/NotesTab
- [x] Files/Notes tabs now redirect users to Open Notebook

### Phase 6: Centralized Teams in API ✅
- [x] Create migration for `public.teams` and `public.team_members` tables
- [x] Seed initial teams: AI SLT, AI Evangelists, AI Hardware, AI Software, AI Agent Development
- [x] Add all users (except Demo User) to all teams
- [x] Create NestJS module: `teams.module.ts`, `teams.service.ts`, `teams.controller.ts`
- [x] Implement endpoints:
  - `GET /users/me/context` - Returns user's orgs and teams
  - `GET /orgs/:slug/teams` - List teams in org
  - `POST /orgs/:slug/teams` - Create team (admin only)
  - `GET /teams/:id` - Get team details
  - `PUT /teams/:id` - Update team (admin only)
  - `DELETE /teams/:id` - Delete team (admin only)
  - `GET /teams/:id/members` - List team members
  - `POST /teams/:id/members` - Add member to team
  - `PUT /teams/:id/members/:userId` - Update member role
  - `DELETE /teams/:id/members/:userId` - Remove member

### Phase 7: Migrate Orch-Flow Teams ⬜
- [ ] Update Orch-Flow to call API for teams instead of direct Supabase queries
- [ ] Create `useTeamsApi` hook that calls `/api/orgs/:slug/teams`
- [ ] Update `TeamContext` to use API data
- [ ] Migrate existing `orch_flow.teams` data to `public.teams`
- [ ] Deprecate `orch_flow.teams` and `orch_flow.team_members`

### Phase 8: Open Notebook Frontend - Team Context ⬜
- [ ] Add API client for `/api/users/me/context` endpoint
- [ ] Create `TeamContext` provider with org/team selection
- [ ] Update API client to send `X-Team-ID` header when in team mode
- [ ] Add team selector UI (dropdown in header or sidebar)
- [ ] Update `NotebookCard` to show ownership badge (Personal / Team name)
- [ ] Update create notebook dialog to allow team selection

### Phase 9: Web App - Admin Team Management ⬜
- [ ] Add Teams section to Admin area
- [ ] Create TeamsList component showing all teams in org
- [ ] Create TeamDetail component with member list
- [ ] Create AddTeamDialog for creating new teams
- [ ] Create AddMemberDialog for adding users to teams
- [ ] Add ability to remove members from teams

---

## Seed Data

### Initial Teams (in 'demo-org')
| Team Name | Description |
|-----------|-------------|
| AI SLT | Senior Leadership Team |
| AI Evangelists | AI advocacy and education |
| AI Hardware | Hardware infrastructure team |
| AI Software | Software development team |
| AI Agent Development | Agent development specialists |

### Team Membership
- All users in demo-org are added to all teams
- Demo User is NOT added to any teams

---

## API Response Examples

### GET /api/users/me/context
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "organizations": [
    {
      "slug": "demo-org",
      "name": "Demo Organization",
      "role": "admin"
    }
  ],
  "teams": [
    {
      "id": "uuid",
      "name": "AI Software",
      "org_slug": "demo-org",
      "role": "member"
    }
  ]
}
```

### GET /api/orgs/:slug/teams
```json
{
  "teams": [
    {
      "id": "uuid",
      "name": "AI Software",
      "description": "Software development team",
      "member_count": 5,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

## Migration Path for Existing Data

1. **orch_flow.teams** → **public.teams**
   - Copy team records with org_slug = 'demo-org'
   - Map `created_by_user_id` → `created_by`

2. **orch_flow.team_members** → **public.team_members**
   - Copy membership records
   - Keep same team_id and user_id references

3. **Orch-Flow tasks/sprints/timer**
   - Update to reference `public.teams` instead of `orch_flow.teams`
   - Or keep using team_id (UUIDs stay the same)

---

## Tables Affected (Open Notebook - SurrealDB)

| Table | Add Fields | Notes |
|-------|-----------|-------|
| `notebook` | user_id, team_id, created_by | Main container |
| `source` | user_id, team_id, created_by | Files, URLs |
| `note` | user_id, team_id, created_by | User notes |
| `chat_session` | user_id, team_id, created_by | Chat history |
| `transformation` | user_id, team_id, created_by | Document transforms |
| `episode` | user_id, team_id, created_by | Podcast episodes |
| `episode_profile` | user_id, team_id, created_by | Podcast templates |
| `speaker_profile` | user_id, team_id, created_by | Voice configs |

---

## Benefits

1. **Centralized teams** - Single source of truth in API
2. **Both apps share teams** - Orch-Flow and Open Notebook use same teams
3. **Proper hierarchy** - Orgs → Teams → Users
4. **Admin control** - Manage teams from web app admin area
5. **Consistent ownership** - Notebooks/tasks can be personal or team-owned
6. **Future-proof** - Ready for org-wide resources when needed
