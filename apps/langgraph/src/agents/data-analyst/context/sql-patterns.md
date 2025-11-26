# SQL Query Patterns & Relationships

## Overview

Common SQL patterns, join relationships, and examples for the Orchestrator AI database schema. Use these patterns to generate accurate SQL queries.

---

## Core Platform Relationships

### User & Organization Relationships

**⚠️ CRITICAL: RBAC Join Patterns**

The `rbac_roles` table does NOT have an `organization_slug` column. To connect users to organizations through roles, use this pattern:

```sql
-- ✅ CORRECT: Users → Organizations via rbac_user_org_roles
SELECT 
  u.id AS user_id,
  u.email,
  u.display_name,
  o.slug AS organization_slug,
  o.name AS organization_name,
  r.name AS role_name
FROM users u
JOIN rbac_user_org_roles uor ON u.id = uor.user_id
JOIN organizations o ON uor.organization_slug = o.slug
JOIN rbac_roles r ON uor.role_id = r.id
WHERE u.status = 'active';
```

**Key Relationships:**
- `users.id` → `rbac_user_org_roles.user_id`
- `rbac_user_org_roles.organization_slug` → `organizations.slug` (⚠️ EXACT COLUMN NAME: `organization_slug` - NOT `organis_slug`, NOT `org_slug`)
- `rbac_user_org_roles.role_id` → `rbac_roles.id`

**⚠️ CRITICAL COLUMN NAMES - Use EXACTLY as shown:**
- `rbac_user_org_roles.organization_slug` (full word "organization", not abbreviated)
- `organizations.slug` (not `organization_slug`)
- `rbac_user_org_roles.user_id` (not `users_id`)
- `rbac_user_org_roles.role_id` (not `roles_id`)

**❌ WRONG:**
```sql
-- This will fail - rbac_roles.organization_slug does not exist
SELECT * FROM users 
JOIN rbac_user_org_roles ON users.id = rbac_user_org_roles.user_id
JOIN rbac_roles ON rbac_user_org_roles.role_id = rbac_roles.id
JOIN organizations ON rbac_roles.organization_slug = organizations.slug;  -- ❌ ERROR
```

### User Management Queries

#### Active Users with Organizations

```sql
SELECT 
  u.id,
  u.email,
  u.display_name,
  u.status,
  u.created_at,
  ARRAY_AGG(DISTINCT o.slug) AS organization_slugs,
  ARRAY_AGG(DISTINCT r.name) AS role_names
FROM users u
LEFT JOIN rbac_user_org_roles uor ON u.id = uor.user_id
LEFT JOIN organizations o ON uor.organization_slug = o.slug
LEFT JOIN rbac_roles r ON uor.role_id = r.id
WHERE u.status = 'active'
GROUP BY u.id, u.email, u.display_name, u.status, u.created_at
ORDER BY u.created_at DESC
LIMIT 50;
```

#### Users by Organization

```sql
SELECT 
  o.slug AS organization_slug,
  o.name AS organization_name,
  COUNT(DISTINCT u.id) AS user_count,
  COUNT(DISTINCT r.id) AS role_count
FROM organizations o
JOIN rbac_user_org_roles uor ON o.slug = uor.organization_slug
JOIN users u ON uor.user_id = u.id
LEFT JOIN rbac_roles r ON uor.role_id = r.id
WHERE u.status = 'active'
GROUP BY o.slug, o.name
ORDER BY user_count DESC;
```

### Conversation & Task Patterns

#### User Activity Summary

```sql
SELECT 
  u.id,
  u.email,
  COUNT(DISTINCT c.id) AS conversation_count,
  COUNT(DISTINCT t.id) AS task_count,
  MAX(c.last_active_at) AS last_activity
FROM users u
LEFT JOIN agent_conversations c ON u.id = c.user_id
LEFT JOIN tasks t ON u.id = t.user_id
WHERE u.status = 'active'
GROUP BY u.id, u.email
ORDER BY last_activity DESC NULLS LAST
LIMIT 50;
```

#### Agent Performance by Organization

```sql
SELECT 
  o.slug AS organization_slug,
  t.agent_name,
  COUNT(*) AS total_tasks,
  COUNT(CASE WHEN t.status = 'completed' THEN 1 END) AS completed_tasks,
  AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at))/60) AS avg_minutes
FROM organizations o
JOIN rbac_user_org_roles uor ON o.slug = uor.organization_slug
JOIN users u ON uor.user_id = u.id
JOIN tasks t ON u.id = t.user_id
WHERE t.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY o.slug, t.agent_name
ORDER BY total_tasks DESC;
```

---

## Common Join Patterns

### Pattern 1: Users → Organizations

```sql
-- Standard pattern for user-organization relationships
SELECT u.*, o.*
FROM users u
JOIN rbac_user_org_roles uor ON u.id = uor.user_id
JOIN organizations o ON uor.organization_slug = o.slug
WHERE u.status = 'active';
```

### Pattern 2: Users → Roles → Organizations

```sql
-- Get users with their roles and organizations
SELECT 
  u.email,
  r.name AS role_name,
  o.slug AS organization_slug
FROM users u
JOIN rbac_user_org_roles uor ON u.id = uor.user_id
JOIN rbac_roles r ON uor.role_id = r.id
JOIN organizations o ON uor.organization_slug = o.slug
WHERE u.status = 'active';
```

### Pattern 3: Organization → Users → Conversations

```sql
-- Get conversations for users in an organization
SELECT 
  o.slug AS organization_slug,
  u.email,
  c.id AS conversation_id,
  c.agent_name,
  c.started_at
FROM organizations o
JOIN rbac_user_org_roles uor ON o.slug = uor.organization_slug
JOIN users u ON uor.user_id = u.id
JOIN agent_conversations c ON u.id = c.user_id
WHERE c.started_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY c.started_at DESC;
```

---

## Query Optimization Guidelines

### Performance Best Practices

1. **Always filter by status early:**
```sql
WHERE u.status = 'active'  -- Filter before joining
```

2. **Use date ranges for temporal queries:**
```sql
WHERE t.created_at >= CURRENT_DATE - INTERVAL '30 days'
```

3. **Limit result sets:**
```sql
ORDER BY created_at DESC
LIMIT 50;
```

4. **Use specific columns, not SELECT *:**
```sql
SELECT u.id, u.email, u.display_name  -- Not SELECT *
```

### Common Anti-Patterns to Avoid

```sql
-- ❌ BAD: Missing join through rbac_user_org_roles
SELECT * FROM users 
JOIN organizations ON users.organization_slug = organizations.slug;  -- organization_slug doesn't exist on users

-- ❌ BAD: Trying to use rbac_roles.organization_slug
SELECT * FROM rbac_roles 
WHERE organization_slug = 'my-org';  -- This column doesn't exist

-- ❌ BAD: No date filtering on large tables
SELECT * FROM tasks;

-- ❌ BAD: No LIMIT on potentially large results
SELECT * FROM users JOIN agent_conversations ON users.id = agent_conversations.user_id;
```

### Recommended Patterns

```sql
-- ✅ GOOD: Proper RBAC join pattern
SELECT u.email, o.slug, r.name
FROM users u
JOIN rbac_user_org_roles uor ON u.id = uor.user_id
JOIN organizations o ON uor.organization_slug = o.slug
JOIN rbac_roles r ON uor.role_id = r.id
WHERE u.status = 'active'
LIMIT 50;

-- ✅ GOOD: Date filtering and limits
SELECT * FROM tasks
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Table Relationship Summary

### Core Tables

- **users**: User accounts
  - Primary key: `id` (UUID)
  - No direct `organization_slug` column
  - Join via `rbac_user_org_roles.user_id`

- **organizations**: Organization definitions
  - Primary key: `slug` (TEXT)
  - Join via `rbac_user_org_roles.organization_slug`

- **rbac_roles**: Role definitions
  - Primary key: `id` (UUID)
  - **Does NOT have `organization_slug` column**
  - Join via `rbac_user_org_roles.role_id`

- **rbac_user_org_roles**: Junction table connecting users, organizations, and roles
  - Foreign keys: `user_id`, `role_id`, `organization_slug`
  - **This is the bridge table for all user-organization-role relationships**

- **agent_conversations**: Conversation sessions
  - Foreign key: `user_id` → `users.id`

- **tasks**: Task execution records
  - Foreign key: `user_id` → `users.id`
  - Foreign key: `conversation_id` → `agent_conversations.id`

---

## Exact Column Names Reference

**⚠️ CRITICAL: Use these EXACT column names (case-sensitive, no abbreviations):**

### rbac_user_org_roles table:
- `user_id` (UUID, NOT NULL)
- `organization_slug` (VARCHAR(255), NOT NULL) - **FULL WORD "organization", NOT "organis" or "org"**
- `role_id` (UUID, NOT NULL)
- `assigned_by` (UUID, nullable)
- `assigned_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ, nullable)

### organizations table:
- `slug` (TEXT/VARCHAR, PRIMARY KEY) - **NOT "organization_slug"**
- `name` (TEXT/VARCHAR)
- `created_at` (TIMESTAMPTZ)

### users table:
- `id` (UUID, PRIMARY KEY)
- `email` (VARCHAR, UNIQUE)
- `display_name` (VARCHAR, nullable)
- `status` (TEXT, default 'active')
- `organization_slug` (TEXT, nullable) - **This exists on users table but use rbac_user_org_roles for joins**

### rbac_roles table:
- `id` (UUID, PRIMARY KEY)
- `name` (VARCHAR(100))
- `display_name` (VARCHAR(255))
- `is_system` (BOOLEAN)
- **⚠️ DOES NOT have `organization_slug` column**

## SQL Generation Guidelines

When generating SQL queries:

1. **Always verify table names exist** in the available tables list
2. **Use the correct join patterns** from this document
3. **Never assume columns exist** - only use columns from table descriptions
4. **Use EXACT column names** - check the Exact Column Names Reference above
5. **For user-organization queries**, always join through `rbac_user_org_roles` using `organization_slug` (full word)
6. **Filter early** with WHERE clauses before complex joins
7. **Always include LIMIT** for potentially large result sets
8. **Use date ranges** for temporal queries on large tables
9. **Double-check column names** - if a column name seems abbreviated, check the table description or this reference

