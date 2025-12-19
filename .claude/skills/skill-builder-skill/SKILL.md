---
name: skill-builder-skill
description: Guide creation of new Claude Code Skills following best practices and patterns. Use when creating new skills, extending Claude's capabilities, or packaging domain expertise into reusable skills. Keywords: create skill, build skill, new skill, skill creation, skill development.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
category: "builder"
type: "template"
used-by-agents: ["claude-code-ecosystem-agent"]
related-skills: ["agent-builder-skill"]
---

# Skill Builder Skill

## Purpose

This skill guides the creation of new Claude Code Skills, ensuring they follow best practices, proper structure, and integration patterns. It helps package domain expertise into discoverable, composable capabilities.

## When to Use

- **Creating New Skills**: When building a new skill from scratch
- **Extending Skills**: When adding capabilities to existing skills
- **Refactoring Skills**: When restructuring or improving skills
- **Validating Skills**: When checking if a skill follows best practices

## Core Principles

### 1. Progressive Disclosure

**Three Levels of Loading:**
1. **Metadata** (always loaded): `name` and `description` in YAML frontmatter
2. **Instructions** (loaded when triggered): Main body of SKILL.md
3. **Resources** (loaded as needed): Additional files, scripts, templates

**Key Principle:** Only relevant content enters the context window at any time.

### 2. Multiple File Types

**Skills can use any file type:**
- **Markdown** (`.md`, `.mdx`) - Documentation, examples, troubleshooting
- **YAML/JSON** (`.yaml`, `.yml`, `.json`) - Configuration, schemas, data
- **Scripts** (`.sh`, `.py`, `.ts`, `.js`) - Executable utilities
- **Templates** (`.txt`, `.md`, `.ts`, `.yaml`) - Reusable templates
- **SQL** (`.sql`) - Database queries and migrations
- **Data** (`.csv`, `.json`) - Reference data and examples

**Match file type to purpose** - See [MULTI_FILE_PATTERNS.md](MULTI_FILE_PATTERNS.md)

### 3. Skill Discovery

**Description is Critical:**
- Must include **what it does** AND **when to use it**
- Include trigger keywords/phrases
- Be specific, not vague
- Max 1024 characters

**Example Good Description:**
```
"Classify web files and validate against Vue.js web application patterns. Use when working with Vue components, stores, services, composables, views, or any web application code."
```

**Example Bad Description:**
```
"Helps with web code"
```

## Skill Creation Workflow

### Step 1: Define Purpose and Scope

**Ask These Questions:**
1. What task or domain should this skill cover?
2. When should Claude use this skill? (triggers)
3. What expertise or workflows need to be captured?
4. Does it need scripts, templates, or other resources?
5. What type of skill is it? (architecture, development, utility, etc.)

**Document the answers** for reference during creation.

### Step 2: Choose Skill Type and Structure

**Skill Types:**

**Architecture Skills** (Classification & Validation):
- Classify files and validate patterns
- Examples: `web-architecture-skill`, `api-architecture-skill`, `langgraph-architecture-skill`
- Structure: `SKILL.md`, `FILE_CLASSIFICATION.md`, `PATTERNS.md`, `VIOLATIONS.md`, `ARCHITECTURE.md`

**Development Skills** (Prescriptive Patterns):
- Provide prescriptive patterns for building
- Examples: `langgraph-development-skill`, `n8n-development-skill`
- Structure: `SKILL.md`, `PATTERNS.md`, `CONSTRUCTS.md`, `VIOLATIONS.md`

**Utility Skills** (Operations & Workflows):
- Handle specific operations or workflows
- Examples: `direct-commit-skill`, `quality-gates-skill`, `supabase-management-skill`
- Structure: `SKILL.md`, `REFERENCE.md`, `EXAMPLES.md`, `TROUBLESHOOTING.md`, `scripts/`

**Testing Skills** (Test Patterns):
- Provide testing patterns and validation
- Examples: `web-testing-skill`, `api-testing-skill`, `e2e-testing-skill`
- Structure: `SKILL.md`, test patterns, E2E principles

**Monitoring/Hardening Skills** (Analysis & Improvement):
- Analyze codebase and improve quality
- Examples: `codebase-monitoring-skill`, `codebase-hardening-skill`
- Structure: `SKILL.md`, analysis patterns, fix patterns, documentation patterns

### Step 3: Create Directory Structure

**Create skill directory:**
```bash
mkdir -p .claude/skills/<skill-name>
```

**Naming Conventions:**
- Use lowercase with hyphens (e.g., `pdf-processing`, `data-analysis`)
- Be descriptive but concise
- Avoid generic names
- Match existing patterns (e.g., `*-architecture-skill`, `*-development-skill`, `*-testing-skill`)

**Standard Structure:**
```
skill-name/
├── SKILL.md                    # Main instructions (REQUIRED)
├── REFERENCE.md                 # Detailed reference (if needed)
├── EXAMPLES.md                  # Usage examples (if needed)
├── TROUBLESHOOTING.md           # Common issues (if needed)
├── PATTERNS.md                  # Patterns (if needed)
├── config/                      # Configuration (if needed)
│   └── schema.yaml
├── scripts/                     # Scripts (if needed)
│   └── validate.sh
└── templates/                   # Templates (if needed)
    └── template.md
```

### Step 4: Write SKILL.md with YAML Frontmatter

**Required Frontmatter:**
```yaml
---
name: Your Skill Name
description: Brief description of what this Skill does and when to use it. Include trigger keywords.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob  # Optional: restrict tools
---
```

**Frontmatter Requirements:**
- `name`: Required, max 64 characters
- `description`: Required, max 1024 characters
  - Include BOTH what it does AND when to use it
  - Mention key trigger words/phrases
  - Be specific, not vague
- `allowed-tools`: Optional, restrict which tools Claude can use

**SKILL.md Structure:**
```markdown
# Skill Name

## Purpose

This skill [what it does and why it exists].

## When to Use

- **Trigger 1**: When [specific situation]
- **Trigger 2**: When [specific situation]
- **Trigger 3**: When [specific situation]

## Core Principles

### 1. Principle Name
[Explanation]

### 2. Principle Name
[Explanation]

## Workflow

### 1. Step Name
[Detailed instructions]

### 2. Step Name
[Detailed instructions]

## Related

- **`related-skill/`** - Related skill
- **`related-agent.md`** - Related agent
```

### Step 5: Add Supporting Files

**Based on Skill Type:**

**For Architecture Skills:**
- `FILE_CLASSIFICATION.md` - How to classify files
- `PATTERNS.md` - Patterns and conventions
- `VIOLATIONS.md` - Common violations and fixes
- `ARCHITECTURE.md` - Architecture guidelines

**For Development Skills:**
- `PATTERNS.md` - Design patterns
- `CONSTRUCTS.md` - Language constructs
- `VIOLATIONS.md` - Common violations

**For Utility Skills:**
- `REFERENCE.md` - Detailed reference
- `EXAMPLES.md` - Usage examples
- `TROUBLESHOOTING.md` - Common issues
- `scripts/` - Executable utilities

**For Testing Skills:**
- Test patterns documentation
- E2E principles (if applicable)
- Framework-specific patterns

**Progressive Disclosure:**
- Main workflow in `SKILL.md`
- Details in supporting files
- Reference files: `[REFERENCE.md](REFERENCE.md)`
- Don't duplicate content

### Step 6: Validate Skill Structure

**Checklist:**
- [ ] YAML frontmatter is valid
- [ ] `name` is ≤64 characters
- [ ] `description` is ≤1024 characters and includes triggers
- [ ] `SKILL.md` has clear Purpose and When to Use sections
- [ ] Workflow is clear and actionable
- [ ] All referenced files exist
- [ ] File paths use relative references
- [ ] Scripts are executable (if any)
- [ ] Examples cover common use cases

**Validation Script:**
```bash
# Check YAML frontmatter
head -10 .claude/skills/<skill-name>/SKILL.md

# Verify structure
ls -la .claude/skills/<skill-name>/

# Check scripts are executable
chmod +x .claude/skills/<skill-name>/scripts/*.sh 2>/dev/null || true
chmod +x .claude/skills/<skill-name>/scripts/*.py 2>/dev/null || true
```

### Step 7: Test Skill Discovery

**Test Triggers:**
- Ask questions matching the skill's description
- Verify Claude loads and uses the skill
- Check that instructions are clear and actionable

**Example Test:**
```
User: "I need to work with Vue components"
→ Should trigger web-architecture-skill

User: "Create a new skill for data analysis"
→ Should trigger skill-builder-skill (this skill)
```

### Step 8: Integrate with Existing Skills

**Cross-References:**
- Reference related skills in "Related" section
- Link to architecture skills if applicable
- Reference execution-context-skill and transport-types-skill if relevant

**Integration Pattern:**
```markdown
## Related

- **`execution-context-skill/`** - For ExecutionContext validation
- **`transport-types-skill/`** - For A2A compliance
- **`web-architecture-skill/`** - For web file classification
```

## Skill Type Templates

### Architecture Skill Template

See [ARCHITECTURE_SKILL_TEMPLATE.md](ARCHITECTURE_SKILL_TEMPLATE.md) for complete template.

**Key Files:**
- `SKILL.md` - Main skill definition
- `FILE_CLASSIFICATION.md` - File type classification
- `PATTERNS.md` - Patterns and conventions
- `VIOLATIONS.md` - Common violations
- `ARCHITECTURE.md` - Architecture guidelines

### Development Skill Template

See [DEVELOPMENT_SKILL_TEMPLATE.md](DEVELOPMENT_SKILL_TEMPLATE.md) for complete template.

**Key Files:**
- `SKILL.md` - Main skill definition
- `PATTERNS.md` - Design patterns
- `CONSTRUCTS.md` - Language constructs
- `VIOLATIONS.md` - Common violations

### Utility Skill Template

See [UTILITY_SKILL_TEMPLATE.md](UTILITY_SKILL_TEMPLATE.md) for complete template.

**Key Files:**
- `SKILL.md` - Main skill definition
- `REFERENCE.md` - Detailed reference
- `EXAMPLES.md` - Usage examples
- `TROUBLESHOOTING.md` - Common issues
- `scripts/` - Executable utilities

## Best Practices

### Description Writing

**Good Examples:**
- ✅ "Classify web files and validate against Vue.js web application patterns. Use when working with Vue components, stores, services, composables, views, or any web application code."
- ✅ "Patterns and validation for codebase monitoring. Use when analyzing files, evaluating codebase health, identifying issues, or generating monitoring reports."
- ✅ "Guide creation of new Claude Code Skills following best practices and patterns. Use when creating new skills, extending Claude's capabilities, or packaging domain expertise into reusable skills."

**Bad Examples:**
- ❌ "Helps with web code"
- ❌ "Monitoring stuff"
- ❌ "Skill creation"

### Instruction Organization

- Keep main instructions focused (under 5k tokens ideal)
- Split complex content into linked files
- Use progressive disclosure for optional/advanced content
- Use multiple file types appropriately

### Skill Scope

- One skill = one capability or workflow
- Don't combine unrelated tasks
- Make focused, composable skills
- Skills can reference each other

### File References

- Use relative paths: `[file.md](file.md)` not absolute paths
- Reference scripts with full path from skill root: `bash scripts/validate.sh`
- Make it clear when Claude should read vs execute files

## Common Patterns

### Pattern 1: Architecture Skill

**Structure:**
- Classification patterns
- Validation patterns
- Violation detection
- Architecture guidelines

**Example:** `web-architecture-skill/`

### Pattern 2: Development Skill

**Structure:**
- Prescriptive patterns
- Construct usage
- Violation detection
- Best practices

**Example:** `langgraph-development-skill/`

### Pattern 3: Utility Skill

**Structure:**
- Workflow steps
- Reference documentation
- Examples
- Troubleshooting
- Scripts

**Example:** `direct-commit-skill/`, `supabase-management-skill/`

### Pattern 4: Testing Skill

**Structure:**
- Test patterns
- Framework-specific guidance
- E2E principles
- Coverage requirements

**Example:** `web-testing-skill/`, `e2e-testing-skill/`

## Related

- **`meta-skill/`** - Original skill creation documentation
- **`MULTI_FILE_PATTERNS.md`** - Multi-file skill patterns
- **`SKILL_STRUCTURE_CHECKLIST.md`** - Quick reference checklist
- **Existing skills** - Examples of well-structured skills

