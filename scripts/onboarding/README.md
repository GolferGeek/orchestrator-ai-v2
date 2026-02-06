# Onboarding Content Scripts

Automated scripts to seed Flow and Open Notebook applications with starter content for new organizations.

## Overview

These scripts generate onboarding content based on:
- **Company Size**: Solo Developer, Small Team (No Developers), Small Team (With Developers)
- **Team Type**: Leadership, Developer, Hardware, Agent Development, Evangelist

Content is stored as **markdown files** in `content/` directories, making it easy to edit and maintain without touching code.

## Directory Structure

```
scripts/onboarding/
├── content/                          # Content files (markdown)
│   ├── flow/
│   │   ├── solo/                     # Flow content for solo developers
│   │   ├── small-no-devs/            # Flow content for small teams without developers
│   │   └── small-with-devs/          # Flow content for small teams with developers
│   └── notebook/
│       ├── solo/                     # Notebook content for solo developers
│       ├── small-no-devs/            # Notebook content for small teams without developers
│       └── small-with-devs/          # Notebook content for small teams with developers
├── flow/
│   ├── seed-flow-solo.js             # Seed Flow content for solo
│   ├── seed-flow-small-no-devs.js    # Seed Flow content for small teams (no devs)
│   ├── seed-flow-small-with-devs.js  # Seed Flow content for small teams (with devs)
│   └── seed-flow-interactive.js      # Interactive script to choose company size
├── notebook/
│   ├── seed-notebook-solo.js         # Seed Notebook content for solo
│   ├── seed-notebook-small-no-devs.js # Seed Notebook content for small teams (no devs)
│   ├── seed-notebook-small-with-devs.js # Seed Notebook content for small teams (with devs)
│   └── seed-notebook-interactive.js  # Interactive script to choose company size
└── shared/
    ├── content-loader.js             # Loads content from markdown files
    ├── db-helpers.js                 # Database connection and Flow operations
    ├── api-helpers.js                # Open Notebook API client
    ├── file-helpers.js               # File system operations for Notebook documents
    ├── seed-flow-helper.js           # Common Flow seeding logic
    ├── preview-content.js            # Preview what will be created
    └── delete-onboarding-content.js # Delete all generated onboarding content
```

## Content Files

Content is stored as markdown files in `content/` directories. Each file represents content for a specific team type and company size.

### Flow Content Format

Flow content files (`flow/*/team-type.md`) use this structure:

```markdown
# Effort Name

**Icon:** icon-name  
**Color:** #hex-color  
**Estimated Days:** number

## Project Name

Project description.

### ⭐ Task Title (Milestone)

Task description.

### Task Title

Task description.
```

### Notebook Content Format

Notebook content files (`notebook/*/team-type.md`) contain full markdown documents:

```markdown
# Notebook Name

Notebook description.

## Document Title

# Document Title

Full markdown content here...
```

## Usage

### Preview Content

See what will be created without actually creating it:

```bash
# Preview for a specific organization
node scripts/onboarding/shared/preview-content.js <org-slug> <company-size>

# Examples
node scripts/onboarding/shared/preview-content.js orchestratorai solo
node scripts/onboarding/shared/preview-content.js orchestratorai small-no-devs
node scripts/onboarding/shared/preview-content.js orchestratorai small-with-devs
```

### Seed Flow Content

Create Flow efforts, projects, and tasks:

```bash
# Seed for all organizations
node scripts/onboarding/flow/seed-flow-solo.js
node scripts/onboarding/flow/seed-flow-small-no-devs.js
node scripts/onboarding/flow/seed-flow-small-with-devs.js

# Seed for a specific organization
node scripts/onboarding/flow/seed-flow-solo.js <org-slug>
node scripts/onboarding/flow/seed-flow-small-no-devs.js <org-slug>
node scripts/onboarding/flow/seed-flow-small-with-devs.js <org-slug>

# Interactive mode (choose company size)
node scripts/onboarding/flow/seed-flow-interactive.js
```

### Seed Notebook Content

Create Notebook notebooks, sources, and notes:

```bash
# Seed for all organizations (Notebook content is team-scoped, so it's global)
node scripts/onboarding/notebook/seed-notebook-solo.js
node scripts/onboarding/notebook/seed-notebook-small-no-devs.js
node scripts/onboarding/notebook/seed-notebook-small-with-devs.js

# Interactive mode (choose company size)
node scripts/onboarding/notebook/seed-notebook-interactive.js
```

### Delete All Onboarding Content

Remove all generated onboarding content (Flow, Notebook, and files):

```bash
node scripts/onboarding/shared/delete-onboarding-content.js
```

**⚠️ Warning**: This will delete ALL onboarding content. Use with caution!

## Editing Content

### Adding New Content

1. **Create or edit markdown files** in `content/flow/` or `content/notebook/`
2. **Follow the format** shown above
3. **Test with preview script** to verify parsing
4. **Run seeding script** to create content

### Content Structure

- **Efforts** (Flow): High-level initiatives
- **Projects** (Flow): Specific projects within efforts
- **Tasks** (Flow): Actionable tasks within projects
- **Notebooks** (Notebook): Collections of documents
- **Documents** (Notebook): Individual markdown documents

### Team Types

Content is organized by team type:
- `leadership.md` - Strategic planning and leadership
- `developer.md` - Development and technical content
- `hardware.md` - Infrastructure and hardware
- `agent-dev.md` - Agent development
- `evangelist.md` - Documentation and evangelism

### Company Sizes

Content scales by company size:
- `solo/` - Minimal content for solo developers
- `small-no-devs/` - Content for small teams without dedicated developers
- `small-with-devs/` - Comprehensive content for teams with developers

## Content Customization Guide

### Flow Content

When editing Flow content (`content/flow/*/*.md`):

1. **Effort Level** (H1):
   - Set icon, color, and estimated days using metadata format
   - Keep effort names concise and action-oriented

2. **Project Level** (H2):
   - Each project belongs to an effort
   - Add project description on the line after the heading

3. **Task Level** (H3 or bullet):
   - Use `⭐` or "Milestone" in title for milestone tasks
   - Add task description on the line after the title
   - Keep tasks actionable and specific

### Notebook Content

When editing Notebook content (`content/notebook/*/*.md`):

1. **Notebook Level** (H1):
   - First H1 becomes the notebook name
   - Add description after the heading

2. **Document Level** (H2):
   - Each H2 becomes a document
   - Full markdown content after H2 becomes document content
   - Documents are automatically saved as `.md` files

### Best Practices

- **Be Specific**: Provide actionable, concrete guidance
- **Be Realistic**: Content should reflect actual best practices
- **Be Complete**: Include enough detail to be useful
- **Be Maintainable**: Keep content organized and easy to update

## Technical Details

### Content Loading

The `content-loader.js` module:
- Reads markdown files from `content/` directories
- Parses markdown into structured data
- Handles missing files gracefully (returns empty content)
- Supports async/await for file operations

### Flow Content Creation

Flow content is created:
- **Per Organization**: Each organization gets its own efforts/projects/tasks
- **Per Team**: Content is tailored to each team's type
- **Scaled by Company Size**: Amount of content scales with company size

### Notebook Content Creation

Notebook content is created:
- **Team-Scoped**: Notebooks are global (not organization-specific)
- **File-Based**: Documents are created as actual `.md` files on disk
- **API-Uploaded**: Files are then uploaded via the Notebook API

## Troubleshooting

### Content Not Loading

- Check file paths match team type names exactly
- Verify markdown syntax is correct
- Check file permissions

### Parsing Issues

- Ensure markdown follows the expected format
- Check for proper heading hierarchy (H1 → H2 → H3)
- Verify metadata format is correct

### Database Errors

- Verify database connection settings
- Check organization/team exists in database
- Review error messages for specific issues

## Examples

### Example: Adding a New Effort

Edit `content/flow/solo/leadership.md`:

```markdown
# New Strategic Initiative

**Icon:** target  
**Color:** #ff6b6b  
**Estimated Days:** 5

## New Project

Description of the project.

### ⭐ First Task

Description of the first task.

### Second Task

Description of the second task.
```

### Example: Adding a New Notebook Document

Edit `content/notebook/solo/leadership.md`:

```markdown
# Strategic Planning Guide

## New Guide Document

# New Guide Title

Content of the guide here...
```

## Next Steps

1. **Review Content**: Check the generated content matches your expectations
2. **Customize**: Edit markdown files to match your needs
3. **Test**: Use preview script to verify changes
4. **Deploy**: Run seeding scripts to create content
5. **Iterate**: Refine content based on user feedback

## Support

For issues or questions:
- Check the troubleshooting section above
- Review markdown file format examples
- Test with preview script before seeding
- Review error messages for specific guidance
