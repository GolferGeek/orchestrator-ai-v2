# Multi-File Skill Patterns

## Purpose

This document provides guidance on using multiple file types in skills, matching file type to purpose for maximum clarity and maintainability.

## Key Principle: Use Multiple File Types

**Skills are not limited to markdown files.** Claude Code skills can include any file type that helps organize and present expertise:

- **Markdown** (`.md`, `.mdx`) - Instructions, documentation, examples
- **YAML/JSON** (`.yaml`, `.yml`, `.json`) - Configuration, schemas, data structures
- **Scripts** (`.sh`, `.py`, `.ts`, `.js`) - Executable utilities and automation
- **Templates** (`.txt`, `.md`, `.ts`, `.yaml`) - Reusable code/documentation templates
- **Data** (`.csv`, `.json`, `.sql`) - Reference data, schemas, examples
- **Documentation** (`.md`, `.rst`) - Additional guides and references

## File Type Guidelines

### Markdown Files (`.md`, `.mdx`)

**Use for:**
- Main instructions (SKILL.md)
- Documentation and guides
- Examples and tutorials
- Troubleshooting guides
- Patterns and best practices

**Structure:**
```markdown
# Section Title

## Subsection

Content with:
- Bullet points
- Code blocks
- Links to other files: [REFERENCE.md](REFERENCE.md)
```

### YAML/JSON Files (`.yaml`, `.yml`, `.json`)

**Use for:**
- Configuration schemas
- Default values
- Structured data
- API specifications

**Location:** `config/` directory

**Example:**
```yaml
# config/schema.yaml
skill:
  name: example-skill
  version: 1.0.0
  options:
    - name: verbose
      type: boolean
      default: false
```

### Shell Scripts (`.sh`)

**Use for:**
- System operations
- File manipulation
- Command execution
- Quick utilities

**Location:** `scripts/` directory

**Make executable:**
```bash
chmod +x scripts/*.sh
```

**Example:**
```bash
#!/bin/bash
# scripts/validate.sh

set -euo pipefail

if [ ! -f "$1" ]; then
  echo "Error: File $1 not found"
  exit 1
fi

# Validation logic
echo "Validating $1..."
```

### Python Scripts (`.py`)

**Use for:**
- Data processing
- API calls
- Complex logic
- Cross-platform utilities

**Location:** `scripts/` directory

**Include PEP 723 inline dependencies:**
```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "click"]
# ///

import requests
import click

@click.command()
@click.argument('url')
def fetch(url):
    response = requests.get(url)
    print(response.text)

if __name__ == '__main__':
    fetch()
```

**Make executable:**
```bash
chmod +x scripts/*.py
```

### TypeScript/JavaScript (`.ts`, `.js`)

**Use for:**
- Node.js utilities
- Type-safe operations
- Integration with existing codebase
- Validation logic

**Location:** `scripts/` directory

**Example:**
```typescript
// scripts/helper.ts
import { readFileSync } from 'fs';

export function validateConfig(path: string): boolean {
  const config = JSON.parse(readFileSync(path, 'utf-8'));
  return config.version !== undefined;
}
```

### SQL Files (`.sql`)

**Use for:**
- Database queries
- Migration scripts
- Schema definitions
- Data examples

**Location:** `queries/` or `templates/` directory

**Example:**
```sql
-- queries/common.sql
SELECT * FROM users WHERE status = 'active';

-- queries/create_table.sql
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL
);
```

## Recommended Skill Structures

### Architecture Skill Structure

```
architecture-skill/
├── SKILL.md                    # Main skill definition
├── FILE_CLASSIFICATION.md      # File type classification
├── PATTERNS.md                 # Patterns and conventions
├── VIOLATIONS.md               # Common violations
└── ARCHITECTURE.md             # Architecture guidelines
```

### Development Skill Structure

```
development-skill/
├── SKILL.md                    # Main skill definition
├── PATTERNS.md                 # Design patterns
├── CONSTRUCTS.md               # Language constructs
├── VIOLATIONS.md               # Common violations
└── templates/                  # Code templates
    └── example.ts
```

### Utility Skill Structure

```
utility-skill/
├── SKILL.md                    # Main skill definition
├── REFERENCE.md                # Detailed reference
├── EXAMPLES.md                 # Usage examples
├── TROUBLESHOOTING.md          # Common issues
├── scripts/                    # Executable utilities
│   ├── validate.sh
│   └── process.py
└── config/                     # Configuration
    └── schema.yaml
```

## Referencing Files in SKILL.md

### Relative Path References

Use relative paths from SKILL.md:

```markdown
## Instructions

For detailed patterns, see [PATTERNS.md](PATTERNS.md).

Run the validation script:
```bash
bash scripts/validate.sh input.txt
```

Load configuration from [config/defaults.json](config/defaults.json):
```

### Executing Scripts

Reference scripts with full path from skill root:

```markdown
## Workflow

1. Run the preprocessing script:
   ```bash
   python scripts/preprocess.py input.csv output.json
   ```

2. Validate the output:
   ```bash
   bash scripts/validate.sh output.json
   ```
```

## Progressive Disclosure Pattern

Structure files so Claude loads only what's needed:

### Level 1: SKILL.md (Always Loaded When Triggered)
- Overview and quick start
- Main workflow steps
- References to other files

### Level 2: Core Documentation (Loaded When Referenced)
- REFERENCE.md - Detailed API reference
- EXAMPLES.md - Usage examples
- PATTERNS.md - Design patterns

### Level 3: Resources (Loaded As Needed)
- Scripts executed via bash (don't load into context)
- Templates referenced but not loaded
- Data files used by scripts

## Best Practices

### 1. Separate Concerns
- Main workflow → SKILL.md
- Detailed reference → REFERENCE.md
- Examples → EXAMPLES.md
- Troubleshooting → TROUBLESHOOTING.md

### 2. Use Appropriate File Types
- Markdown for documentation
- YAML/JSON for configuration
- Scripts for execution
- Templates for code generation

### 3. Reference, Don't Duplicate
- Link to files instead of copying content
- Use progressive disclosure
- Keep SKILL.md focused

### 4. Make Scripts Executable
```bash
chmod +x scripts/*.sh
chmod +x scripts/*.py
```

### 5. Document File Purposes
- Add comments in scripts
- Include README in complex directories
- Explain file relationships in SKILL.md

## Related

- **`SKILL.md`** - Main skill builder documentation
- **`meta-skill/docs/multi_file_skill_patterns.md`** - Original multi-file patterns guide

