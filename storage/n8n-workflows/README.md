# N8n Workflows

This directory contains N8n workflow backups (JSON exports).

## Purpose
- Backup and version control N8n workflows
- Reference implementations for agents
- Manual import when setting up new N8n instances

## Note
N8n workflow migrations are complex. These files are for backup and reference only.
Workflows must be imported manually into N8n instances.

## Workflow Files
- Each workflow is a JSON export from N8n
- File naming: `workflow-name.json`
- Include version and description in workflow JSON

## Usage

### Export Workflow from N8n
1. Open N8n UI (http://localhost:5678)
2. Open the workflow you want to backup
3. Click Settings → Download
4. Save to this directory

### Import Workflow to N8n
1. Open N8n UI
2. Click "Add workflow" → "Import from file"
3. Select JSON file from this directory
4. Adjust any environment-specific settings

## N8n Integration Notes

N8n is used for **intern prototype development only** and is **NOT part of v2-start user-facing features**.

The optional N8n Jokes Agent demonstrates Simple API transport but is not required for core functionality.
