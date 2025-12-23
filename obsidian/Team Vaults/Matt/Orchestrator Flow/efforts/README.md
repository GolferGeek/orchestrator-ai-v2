# Efforts & Projects

## Overview

Efforts represent high-level initiatives, each containing multiple projects with goals and tasks.

## Structure

```
effort-[number]-[name]/
├── README.md (effort overview)
├── projects/
│   ├── project-[number].[number]-[name]/
│   │   ├── README.md (project overview)
│   │   ├── goals.md (project goals)
│   │   ├── tasks.md (task list)
│   │   └── documentation/ (project-specific docs)
```

## Effort Structure

Each effort should include:
- **Overview** - What this effort accomplishes
- **Business Value** - Why this matters
- **Timeline** - Expected duration
- **Dependencies** - What must be completed first
- **Success Criteria** - How to measure completion
- **Projects** - List of projects within this effort

## Project Structure

Each project should include:
- **Overview** - What this project delivers
- **Goals** - Measurable outcomes
- **Tasks** - Actionable items
- **Dependencies** - Prerequisites
- **Timeline** - Expected duration
- **Resources** - What's needed
- **Success Criteria** - Completion definition

## Database Migration

Efforts and projects will map to:
- **Efforts** → Database records with metadata
- **Projects** → Child records linked to efforts
- **Goals** → Measurable outcomes with tracking
- **Tasks** → Actionable items with status tracking


