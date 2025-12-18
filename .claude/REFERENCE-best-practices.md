# Claude Code Extension Best Practices

This document outlines best practices for creating and maintaining Skills, Agents, and Commands in Claude Code.

## General Principles

### 1. Start Small, Iterate
- Begin with minimal functionality
- Add complexity only when needed
- Test frequently during development

### 2. Focus on One Thing
- Each Skill/Agent/Command should have a single, clear purpose
- Avoid "kitchen sink" implementations
- Split complex capabilities into multiple components

### 3. Clear Documentation
- Write clear descriptions with trigger keywords
- Include examples and use cases
- Document edge cases and limitations

### 4. Test Thoroughly
- Test with various inputs and scenarios
- Verify automatic invocation works correctly
- Check error handling

---

## Skills Best Practices

### Description Writing
**Good Description:**
```yaml
description: Analyze Excel spreadsheets, create pivot tables, and generate charts. Use when working with Excel files, spreadsheets, or analyzing tabular data in .xlsx format.
```

**Bad Description:**
```yaml
description: For files
```

**Key Elements:**
- What the Skill does (specific actions)
- When to use it (trigger keywords)
- File types or contexts (if applicable)

### Structure
```
my-skill/
├── SKILL.md          # Main instructions (required)
├── REFERENCE.md      # Detailed API/docs (optional)
├── EXAMPLES.md       # Usage examples (optional)
├── TROUBLESHOOTING.md # Common issues (optional)
└── scripts/          # Utility scripts (optional)
    └── helper.py
```

### Progressive Disclosure
- Keep `SKILL.md` focused on core instructions
- Move detailed docs to supporting files
- Reference supporting files from main file
- Use scripts for deterministic operations

### Tool Restrictions
Use `allowed-tools` when appropriate:
```yaml
---
name: Safe File Reader
description: Read files without making changes. Use when you need read-only file access.
allowed-tools: Read, Grep, Glob
---
```

---

## Agents Best Practices

### Clear Purpose
Each agent should have one specialized role:
- ✅ "PR Review Agent" - reviews pull requests
- ✅ "Test Fix Agent" - fixes failing tests
- ❌ "Code Agent" - too broad

### Explicit Workflow
Document the step-by-step process:
```markdown
## Workflow

1. Get PR Information
   - Use `gh pr view <number>`
   - Extract PR details

2. Read PR Diff
   - Use `gh pr diff <number>`
   - Analyze changes

3. Run Quality Checks
   - Checkout branch
   - Run lint/build/test
```

### Decision Logic
Explain how the agent makes decisions:
```markdown
## Review Decision Logic

### Approve If:
- ✅ All quality gates pass
- ✅ Code follows patterns
- ✅ Tests included

### Request Changes If:
- ❌ Quality gates fail
- ❌ Architecture violations
```

### Tool Management
Specify available tools:
```yaml
---
tools: Read, Write, Edit, Bash, Grep
---
```

---

## Commands Best Practices

### Clear Description
```yaml
---
description: "Create an n8n workflow from a text description"
argument-hint: "workflow description"
---
```

### Argument Handling
Use `$ARGUMENTS` clearly:
```markdown
Create a new $ARGUMENTS agent with basic functionality.

Usage: /create-agent blog-writer
```

### Model Selection
Choose appropriate model:
```yaml
---
model: "claude-opus-4-20250514"  # For complex tasks
---
```

### Step-by-Step Instructions
Break down complex commands:
```markdown
## Steps to Create Workflow

1. Parse the description in $ARGUMENTS
2. Design the workflow structure
3. Create the workflow using n8n MCP
4. Validate the workflow
5. Return workflow details
```

---

## Common Patterns

### Pattern 1: Skill + Command Combo
- **Skill**: Provides automatic expertise
- **Command**: Quick shortcut to trigger the workflow

Example:
- `supabase-management-skill` (automatic)
- `/supabase/backup` (explicit command)

### Pattern 2: Agent + Skill Combo
- **Agent**: Handles complex workflow
- **Skill**: Provides domain knowledge

Example:
- `pr-review-agent` (workflow)
- `quality-gates-skill` (knowledge)

### Pattern 3: Hierarchical Commands
Organize related commands:
```
commands/
├── supabase/
│   ├── backup.md
│   ├── restore.md
│   └── migration/
│       ├── apply.md
│       └── propose.md
```

---

## Anti-Patterns to Avoid

### ❌ Over-Engineering
- Don't create a Skill for every small task
- Don't create an Agent when a Command would suffice
- Don't create a Command when a simple prompt works

### ❌ Vague Descriptions
```yaml
# ❌ Bad
description: Helps with code

# ✅ Good
description: Review code for best practices and potential issues. Use when reviewing code, checking PRs, or analyzing code quality.
```

### ❌ Duplication
- Don't duplicate functionality across Skills/Agents/Commands
- Reuse existing components when possible
- Reference related components

### ❌ Missing Context
- Include when to use the component
- Provide examples
- Document limitations

### ❌ Too Broad
```yaml
# ❌ Bad
description: For development

# ✅ Good
description: Create NestJS modules, services, and controllers following Orchestrator AI patterns. Use when creating backend components or when user mentions modules, services, or controllers.
```

---

## Testing Checklist

### Skills
- [ ] Skill activates when expected
- [ ] Skill doesn't activate when not relevant
- [ ] Supporting files load correctly
- [ ] Scripts execute properly
- [ ] Tool restrictions work

### Agents
- [ ] Agent invokes when appropriate
- [ ] Workflow executes correctly
- [ ] Decision logic works
- [ ] Tool access is appropriate
- [ ] Error handling works

### Commands
- [ ] Command expands correctly
- [ ] Arguments are handled properly
- [ ] Model selection works
- [ ] Instructions are clear
- [ ] Output is useful

---

## Maintenance Guidelines

### Regular Review
- Review Skills/Agents/Commands quarterly
- Remove unused components
- Update descriptions based on usage
- Consolidate duplicates

### Version Tracking
Document changes in components:
```markdown
## Version History
- v2.0.0 (2025-01-15): Added support for new API
- v1.1.0 (2024-12-01): Fixed edge case handling
- v1.0.0 (2024-11-01): Initial release
```

### Documentation Updates
- Keep examples current
- Update when codebase changes
- Add troubleshooting as issues arise
- Document breaking changes

---

## References

- [Agent Skills Best Practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)
- [Claude Code Skills](https://docs.claude.com/en/docs/claude-code/skills)
- [Claude Code Commands](https://docs.claude.com/en/docs/claude-code/commands)

