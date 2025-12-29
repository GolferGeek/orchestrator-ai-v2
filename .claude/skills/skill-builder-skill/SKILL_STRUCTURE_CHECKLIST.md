# Skill Structure Checklist

## Quick Reference

When creating any skill, use this checklist to ensure proper structure and best practices.

## Required Files

- [ ] `SKILL.md` - Main instructions with YAML frontmatter
  - [ ] `name` field (max 64 characters)
  - [ ] `description` field (max 1024 characters, includes trigger keywords)
  - [ ] `allowed-tools` (if restricting tool access)

## Recommended Structure (Choose Based on Skill Type)

### For All Skills:
- [ ] `REFERENCE.md` - Detailed API/command reference (if needed)
- [ ] `EXAMPLES.md` - Usage examples and patterns (if needed)
- [ ] `TROUBLESHOOTING.md` - Common issues and solutions (if needed)

### For Architecture Skills:
- [ ] `FILE_CLASSIFICATION.md` - File type classification
- [ ] `PATTERNS.md` - Design patterns and conventions
- [ ] `VIOLATIONS.md` - Common violations and fixes
- [ ] `ARCHITECTURE.md` - Architecture guidelines

### For Development Skills:
- [ ] `PATTERNS.md` - Design patterns
- [ ] `CONSTRUCTS.md` - Language constructs
- [ ] `VIOLATIONS.md` - Common violations
- [ ] `templates/` - Code/workflow templates (if needed)

### For Utility Skills:
- [ ] `REFERENCE.md` - Detailed reference
- [ ] `EXAMPLES.md` - Usage examples
- [ ] `TROUBLESHOOTING.md` - Common issues
- [ ] `scripts/` - Executable utilities (if needed)
- [ ] `config/` - Configuration (if needed)

### For Testing Skills:
- [ ] Test patterns documentation
- [ ] E2E principles (if applicable)
- [ ] Framework-specific patterns

## File Type Guidelines

### Markdown (`.md`, `.mdx`)
- Use for: Documentation, instructions, examples
- Structure: Clear headings, code blocks, links to other files

### YAML/JSON (`.yaml`, `.yml`, `.json`)
- Use for: Configuration, schemas, structured data
- Location: `config/` directory

### Shell Scripts (`.sh`)
- Use for: System operations, file manipulation, command execution
- Location: `scripts/` directory
- Make executable: `chmod +x scripts/*.sh`

### Python Scripts (`.py`)
- Use for: Data processing, API calls, complex logic
- Location: `scripts/` directory
- Include PEP 723 inline dependencies
- Make executable: `chmod +x scripts/*.py`

### TypeScript/JavaScript (`.ts`, `.js`)
- Use for: Node.js utilities, type-safe operations, validation
- Location: `scripts/` directory

### SQL Files (`.sql`)
- Use for: Database queries, migrations, schema definitions
- Location: `queries/` or `templates/` directory

## Quality Checklist

Before considering a skill complete:

- [ ] All scripts are executable (`chmod +x`)
- [ ] All files referenced in SKILL.md exist
- [ ] File paths use relative references from skill root
- [ ] Progressive disclosure is used (main workflow in SKILL.md, details in other files)
- [ ] Examples cover common use cases
- [ ] Troubleshooting covers known issues
- [ ] Description includes trigger keywords
- [ ] Scripts include error handling
- [ ] Configuration files are documented
- [ ] Templates are tested and work

## Testing Checklist

- [ ] Skill loads when trigger keywords are used
- [ ] All referenced files can be accessed
- [ ] Scripts execute successfully
- [ ] Examples demonstrate correct usage
- [ ] Troubleshooting solves known issues
- [ ] Multiple skills can load simultaneously (skills stack)
- [ ] Skills can reference each other (cross-references)

## Description Quality Checklist

- [ ] Includes what the skill does
- [ ] Includes when to use the skill
- [ ] Contains trigger keywords
- [ ] Is specific, not vague
- [ ] Is ≤1024 characters
- [ ] Follows existing skill description patterns

## Related

- **`SKILL.md`** - Main skill builder documentation
- **`MULTI_FILE_PATTERNS.md`** - Multi-file patterns guide
- **`meta-skill/docs/skill_structure_checklist.md`** - Original checklist

