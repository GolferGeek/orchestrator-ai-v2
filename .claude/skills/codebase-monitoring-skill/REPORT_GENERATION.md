# Report Generation Patterns

## Purpose

This document provides patterns for generating monitoring artifacts and reports.

## Artifact Structure

### Top-Level Structure

```json
{
  "scope": "project" | "apps/web" | "apps/api" | "apps/langgraph",
  "lastMonitorDate": "2025-01-XX...",
  "monitorVersion": "1.0",
  "timestamp": "2025-01-XX...",
  "hierarchy": { /* hierarchical file structure */ },
  "prioritizedIssues": [ /* sorted issues with IDs */ ],
  "refactorings": { /* grouped refactorings */ }
}
```

### Hierarchy Structure

```json
{
  "hierarchy": {
    "apps/api/src": {
      "intent": "API application source code",
      "intentCompliance": "good" | "fair" | "poor",
      "issues": [ /* folder-level issues */ ],
      "files": {
        "auth/auth.service.ts": {
          "monitoredDate": "2025-01-XX...",
          "lastChanged": "2025-01-XX...",
          "purpose": "Authentication service",
          "jobPerformance": "good" | "fair" | "poor",
          "issues": [ /* file-level issues */ ],
          "testCoverage": { /* test coverage data */ },
          "necessity": "required" | "optional" | "unused",
          "location": "correct" | "should-move"
        }
      }
    }
  }
}
```

### Prioritized Issues Structure

```json
{
  "prioritizedIssues": [
    {
      "id": 1,
      "file": "apps/api/src/auth/auth.service.ts",
      "issue": "Supabase coupling",
      "type": "architectural",
      "urgency": "high",
      "severity": "high",
      "refactoring": "supabase-separation",
      "canAutoFix": false,
      "reason": "Requires architectural refactoring",
      "relatedFiles": [
        "apps/api/src/supabase/supabase.service.ts",
        "apps/api/src/auth/auth.service.ts"
      ]
    }
  ]
}
```

### Refactorings Structure

```json
{
  "refactorings": {
    "supabase-separation": {
      "name": "Supabase Separation",
      "description": "Separate Supabase concerns (auth, database, storage) using dependency injection",
      "issues": [1, 2, 3],
      "priority": "high",
      "estimatedEffort": "large"
    }
  }
}
```

## Artifact Storage

**Location:** `.monitor/` directory (excluded from Git)

**Files:**
- `.monitor/project.json` - Entire project
- `.monitor/apps-web.json` - Web app
- `.monitor/apps-api.json` - API app
- `.monitor/apps-langgraph.json` - LangGraph app

## Incremental Monitoring

**Date Tracking:**
- `lastMonitorDate`: When files were last analyzed
- `monitoredDate`: When each file was analyzed
- `lastChanged`: When each file was last modified

**Incremental Logic:**
- Only analyze files changed/added since `lastMonitorDate`
- Preserve existing analyses for unchanged files
- Update `lastMonitorDate` after analysis

## Issue Prioritization

**Sorting Logic:**
1. Sort by urgency (high → medium → low)
2. Within same urgency, sort by severity (high → medium → low)
3. Assign unique IDs sequentially

**Priority Calculation:**
- High urgency + High severity = Highest priority
- High urgency + Medium severity = High priority
- Medium urgency + High severity = High priority
- Low urgency + Low severity = Lowest priority

## Refactoring Grouping

**Group Related Issues:**
- Issues with same `refactoring` tag are grouped
- Refactorings have descriptive names
- Refactorings include all related issue IDs
- Refactorings have priority and effort estimates

## Related

- **`codebase-monitoring-skill/SKILL.md`** - Main skill definition
- **`FILE_ANALYSIS.md`** - File-level analysis
- **`HIERARCHY_ANALYSIS.md`** - Folder-level analysis
- **`ISSUE_CLASSIFICATION.md`** - Issue detection patterns

