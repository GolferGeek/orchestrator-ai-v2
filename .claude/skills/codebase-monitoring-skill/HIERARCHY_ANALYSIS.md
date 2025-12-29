# Hierarchical Analysis Patterns

## Purpose

This document provides patterns for analyzing folder hierarchies and their compliance with architectural intent.

## Analysis Steps

### 1. Folder Intent Analysis

**Goal:** Understand what the folder is supposed to contain

**Process:**
1. Examine folder name and location
2. Review folder's role in architecture
3. Identify expected file types
4. Understand folder's purpose

**Questions to Answer:**
- What is this folder's purpose?
- What file types should it contain?
- What is its architectural role?
- How does it fit into the system?

**Examples:**
- `apps/web/src/components/` - Vue components for UI
- `apps/api/src/services/` - Business logic services
- `apps/api/src/controllers/` - HTTP request handlers
- `apps/web/src/stores/` - Pinia stores for state management

### 2. Intent Compliance

**Goal:** Assess how well folder meets its intent

**Evaluation Criteria:**
- Do files match folder intent?
- Are there misplaced files?
- Is folder organization correct?
- Are expected patterns present?

**Compliance Levels:**
- **Excellent**: All files match intent, well-organized
- **Good**: Most files match intent, minor issues
- **Fair**: Some files don't match intent
- **Poor**: Many files don't match intent, disorganized

**Misplaced File Detection:**
- Service files in components folder
- Component files in services folder
- Test files in wrong location
- Configuration files in source folder

### 3. Folder-Level Issues

**Goal:** Identify issues at the folder level

**Issue Types:**
- **Organization Issues**: Files in wrong locations
- **Missing Patterns**: Expected files/patterns missing
- **Inconsistent Structure**: Inconsistent file organization
- **Naming Issues**: Inconsistent naming conventions

**Aggregation:**
- Collect issues from all files in folder
- Identify folder-level problems
- Check for missing files/patterns
- Assess overall folder health

## Folder Analysis Output

**Structure:**
```json
{
  "intent": "API application source code",
  "intentCompliance": "good" | "fair" | "poor",
  "issues": [
    {
      "type": "organization",
      "description": "Service file in components folder",
      "files": ["components/my-service.ts"]
    }
  ],
  "files": {
    /* file analyses */
  }
}
```

## Common Folder Patterns

### Web App Folders

**`apps/web/src/components/`:**
- Intent: Vue components for UI
- Expected: `.vue` component files
- Should NOT contain: Services, stores, business logic

**`apps/web/src/stores/`:**
- Intent: Pinia stores for state
- Expected: Store files using `defineStore()`
- Should NOT contain: API calls, business logic, components

**`apps/web/src/services/`:**
- Intent: Business logic and API calls
- Expected: Service files with async operations
- Should NOT contain: State management, components

### API App Folders

**`apps/api/src/services/`:**
- Intent: Business logic services
- Expected: Service classes with business logic
- Should NOT contain: HTTP handling, controllers

**`apps/api/src/controllers/`:**
- Intent: HTTP request handlers
- Expected: Controller classes with route handlers
- Should NOT contain: Business logic, services

**`apps/api/src/modules/`:**
- Intent: NestJS module configuration
- Expected: Module files with providers/controllers
- Should NOT contain: Business logic, services

### LangGraph App Folders

**`apps/langgraph/src/agents/`:**
- Intent: LangGraph agent workflows
- Expected: Workflow graph files, state files, nodes
- Should NOT contain: Controllers, services (unless agent-specific)

**`apps/langgraph/src/services/`:**
- Intent: LangGraph services (LLM, observability, etc.)
- Expected: Service classes for LangGraph integration
- Should NOT contain: Workflow logic, controllers

## Related

- **`codebase-monitoring-skill/SKILL.md`** - Main skill definition
- **`FILE_ANALYSIS.md`** - File-level analysis
- **`ISSUE_CLASSIFICATION.md`** - Issue detection patterns

