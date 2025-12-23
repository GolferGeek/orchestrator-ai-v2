# Database Migration Notes

## Purpose

This document outlines how Orchestrator Flow documentation will be migrated into the database next week. All documentation is structured to facilitate this migration.

## Database Schema Mapping

### Flows
**Source**: `flows/flow-[number]-[name]/`  
**Database Table**: `flows`  
**Fields**:
- `id` - Unique identifier
- `name` - Flow name (e.g., "Initial Setup & Infrastructure")
- `number` - Flow sequence number (1-6)
- `description` - Overview of the flow
- `timeline` - Expected duration
- `prerequisites` - Array of prerequisite flow IDs
- `content` - Full markdown content
- `metadata` - JSON with tags, categories, etc.

### Roles
**Source**: `roles/[category]/[role-name]-guide.md`  
**Database Table**: `roles`  
**Fields**:
- `id` - Unique identifier
- `name` - Role name (e.g., "CTO")
- `category` - Role category (leadership, management, development, power-users)
- `description` - Role overview
- `responsibilities` - Array of responsibilities
- `content` - Full markdown content
- `metadata` - JSON with skills, tools, etc.

### Topics
**Source**: `topics/[category]/[topic-name].md`  
**Database Table**: `topics`  
**Fields**:
- `id` - Unique identifier
- `name` - Topic name
- `category` - Topic category (architecture, security, operations, best-practices)
- `description` - Topic overview
- `content` - Full markdown content
- `related_topics` - Array of related topic IDs
- `metadata` - JSON with tags, difficulty level, etc.

### Efforts
**Source**: `efforts/effort-[number]-[name]/`  
**Database Table**: `efforts`  
**Fields**:
- `id` - Unique identifier
- `name` - Effort name
- `number` - Effort sequence number
- `description` - Effort overview
- `timeline` - Expected duration
- `status` - Current status (pending, in-progress, completed)
- `metadata` - JSON with business value, success criteria, etc.

### Projects
**Source**: `efforts/effort-[number]-[name]/projects/project-[number].[number]-[name]/`  
**Database Table**: `projects`  
**Fields**:
- `id` - Unique identifier
- `effort_id` - Foreign key to efforts
- `name` - Project name
- `number` - Project sequence number (e.g., "1.1")
- `description` - Project overview
- `status` - Current status
- `metadata` - JSON with goals, tasks, timeline, etc.

### Goals
**Source**: `efforts/.../projects/.../goals.md`  
**Database Table**: `goals`  
**Fields**:
- `id` - Unique identifier
- `project_id` - Foreign key to projects
- `description` - Goal description
- `target` - Target value/metric
- `status` - Current status
- `metadata` - JSON with measurement criteria, etc.

### Tasks
**Source**: `efforts/.../projects/.../tasks.md`  
**Database Table**: `tasks`  
**Fields**:
- `id` - Unique identifier
- `project_id` - Foreign key to projects
- `description` - Task description
- `status` - Current status
- `assignee` - User ID (optional)
- `metadata` - JSON with priority, dependencies, etc.

## Migration Strategy

### Phase 1: Structure Migration
1. Create database tables with proper relationships
2. Set up foreign keys and indexes
3. Create content storage (markdown or structured)

### Phase 2: Content Migration
1. Parse markdown files
2. Extract metadata (frontmatter, tags, etc.)
3. Create database records
4. Link related content (cross-references)

### Phase 3: Relationships
1. Link flows to prerequisites
2. Link topics to related topics
3. Link projects to efforts
4. Link goals and tasks to projects

### Phase 4: Search & Discovery
1. Index content for full-text search
2. Set up filtering by category, tag, role, etc.
3. Create navigation structures
4. Build recommendation engine

## Content Format Standards

### Frontmatter (YAML)
Each document should include frontmatter:
```yaml
---
id: flow-1-initial-setup
title: Initial Setup & Infrastructure
category: flow
number: 1
tags: [infrastructure, setup, security]
prerequisites: []
related: [flow-2-team-onboarding]
difficulty: beginner
estimated_time: "1 week"
---
```

### Cross-References
Use consistent link formats:
- Flows: `[[flow-1-initial-setup]]`
- Roles: `[[role-cto]]`
- Topics: `[[topic-authentication]]`
- Projects: `[[project-1.1-hardware-planning]]`

### Metadata Tags
Standard tags for filtering:
- `flow-[number]` - Flow identifier
- `role-[name]` - Role identifier
- `topic-[category]` - Topic category
- `effort-[number]` - Effort identifier
- `difficulty-[level]` - beginner, intermediate, advanced
- `status-[state]` - pending, in-progress, completed

## Migration Checklist

### Pre-Migration
- [ ] All documents have frontmatter
- [ ] Cross-references use consistent format
- [ ] All images/assets are referenced correctly
- [ ] Content is validated and complete
- [ ] Structure matches database schema

### Migration
- [ ] Database tables created
- [ ] Content parsed and imported
- [ ] Relationships established
- [ ] Search indexes built
- [ ] Navigation structures created

### Post-Migration
- [ ] Content verified in database
- [ ] Links work correctly
- [ ] Search functions properly
- [ ] Performance tested
- [ ] User access configured

## Notes for Next Week

1. **Content Completeness**: Ensure all flow, role, and topic documents are complete before migration
2. **Metadata Consistency**: Standardize frontmatter across all documents
3. **Link Validation**: Verify all cross-references resolve correctly
4. **Image Assets**: Ensure all images are accessible and properly referenced
5. **Version Control**: Track document versions for future updates


