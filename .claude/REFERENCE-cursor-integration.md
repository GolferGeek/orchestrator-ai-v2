# Using Claude Code Skills, Agents, and Commands from Cursor AI Agents

This document explains how Cursor's AI agents (chat interface) can use Claude Code Skills, Agents, and Commands.

## Key Understanding

**Important**: Cursor's AI agents and Claude Code are **separate systems**, but they can work together through Cursor rules.

- **Claude Code**: Has native support for `.claude/` commands, skills, and agents
- **Cursor AI Agents**: Do NOT have native support, but CAN read `.claude/` files and use them with proper guidance

## How It Works

### 1. Commands (User-Invoked)

**In Cursor Chat:**
- User types: `/commit` or `/commit-push`
- Cursor's AI agent reads: `.claude/commands/commit.md` or `.claude/commands/commit-push.md`
- Cursor's AI follows the instructions in the command file
- Command executes using Cursor's tools (Read, Write, Bash, etc.)

**How Cursor Knows:**
- Cursor rules (`.cursor/rules/*.mdc`) can detect command patterns
- Rule instructs: "When user types `/command-name`, read `.claude/commands/command-name.md` and follow instructions"
- OR: Cursor's AI can naturally discover commands by reading the `.claude/commands/` directory

**Example:**
```
User: /commit "feat(api): add execution context validation"

Cursor AI:
1. Detects `/commit` pattern
2. Reads `.claude/commands/commit.md`
3. Sees it should run quality gates, safety review, then commit
4. Executes: npm run format, npm run lint, npm run build
5. Performs safety review
6. Commits with provided message
```

### 2. Skills (Model-Invoked - Automatic)

**In Cursor Chat:**
- User says: "Commit these changes" or "I want to commit"
- Cursor's AI agent reads Skill descriptions from `.claude/skills/*/SKILL.md` frontmatter
- If description matches (e.g., "commit", "quality checks"), AI loads the Skill
- AI follows Skill instructions automatically

**How It Works:**
- Skills have YAML frontmatter with `description` field
- Description includes trigger keywords: "commit", "quality checks", "lint", "build"
- Cursor's AI reads all Skill descriptions (metadata only, ~100 tokens each)
- When user request matches description, AI loads full Skill instructions
- AI follows Skill instructions using Cursor's tools

**Example:**
```
User: "I want to commit these changes"

Cursor AI:
1. Scans Skill descriptions
2. Finds `direct-commit-skill` with description: "Commit changes directly to current branch after quality checks. Use when user wants to commit..."
3. Loads `.claude/skills/direct-commit-skill/SKILL.md`
4. Follows instructions: format → lint → build → safety review → commit
```

**Progressive Disclosure:**
- **Level 1**: Metadata (description) - always loaded
- **Level 2**: SKILL.md instructions - loaded when triggered
- **Level 3**: Supporting files (REFERENCE.md, scripts) - loaded as needed

### 3. Agents (Model-Invoked - Automatic)

**In Cursor Chat:**
- User says: "Review this PR" or "Check my code quality"
- Cursor's AI agent reads Agent descriptions from `.claude/agents/*.md` frontmatter
- If description matches, AI delegates to the Agent
- Agent executes its workflow autonomously

**How It Works:**
- Agents have YAML frontmatter with `description` field
- Description includes trigger keywords and use cases
- Cursor's AI reads Agent descriptions
- When appropriate, AI loads Agent file and follows its workflow
- Agent can use Cursor's tools to complete its task

**Example:**
```
User: "Review my PR"

Cursor AI:
1. Scans Agent descriptions
2. Finds `pr-review-agent.md` with description: "Systematically review pull requests..."
3. Loads `.claude/agents/pr-review-agent.md`
4. Follows Agent workflow: run quality checks, analyze code, generate review
```

## Cursor Rules Bridge

To make this work seamlessly, create Cursor rules that guide the AI:

### Rule: Command Detection

```markdown
# .cursor/rules/claude-commands.mdc

When the user types a command starting with `/`, check if a corresponding file exists in `.claude/commands/`.

If found:
1. Read the command file
2. Follow its instructions
3. Use $ARGUMENTS if provided in the command

Example: `/commit "message"` → Read `.claude/commands/commit.md`, use "message" as $ARGUMENTS
```

### Rule: Skill Discovery

```markdown
# .cursor/rules/claude-skills.mdc

When processing user requests, check `.claude/skills/` for relevant Skills.

For each Skill:
1. Read the YAML frontmatter (description field)
2. If description matches user request, load SKILL.md
3. Follow Skill instructions
4. Load supporting files (REFERENCE.md, scripts) as needed

Skills are automatically discovered based on description matching.
```

### Rule: Agent Delegation

```markdown
# .cursor/rules/claude-agents.mdc

When a task requires specialized expertise, check `.claude/agents/` for relevant Agents.

For each Agent:
1. Read the YAML frontmatter (description field)
2. If task matches Agent's purpose, load Agent file
3. Follow Agent workflow
4. Agent can use all available tools to complete its task

Agents are automatically invoked when their expertise matches the task.
```

## Best Practices for Cursor Integration

### 1. Clear Descriptions

**Skills and Agents** need clear descriptions with trigger keywords:

```yaml
---
name: Direct Commit
description: Commit changes directly to current branch after quality checks (lint, build, safety review). Use when user wants to commit, committing changes, or direct commit. Keywords: commit, quality checks, lint, build.
---
```

### 2. Command File Structure

**Commands** should be self-contained and clear:

```markdown
---
description: "Commit changes directly to current branch after quality checks"
---

# Commit Directly to Current Branch

1. Run quality gates (format, lint, build)
2. Perform safety review
3. Commit changes

Use $ARGUMENTS for custom commit message.
```

### 3. Progressive Disclosure

**Skills** should use progressive disclosure:

- **SKILL.md**: Core instructions (keep under 5k tokens)
- **REFERENCE.md**: Detailed documentation (loaded as needed)
- **EXAMPLES.md**: Usage examples (loaded as needed)
- **scripts/**: Utility scripts (loaded as needed)

### 4. Tool Access

**Skills** can restrict tool access:

```yaml
---
name: Safe Reader
description: Read-only file access
allowed-tools: Read, Grep, Glob
---
```

This ensures Skills only use appropriate tools when active.

## Current Status

### ✅ What Works Now

1. **Commands**: Cursor AI can read `.claude/commands/` files and follow instructions
2. **Skills**: Cursor AI can discover and use Skills based on description matching
3. **Agents**: Cursor AI can delegate to Agents when appropriate
4. **Progressive Disclosure**: Skills load content as needed

### ⚠️ What Needs Rules

1. **Command Detection**: Create rule to detect `/command` patterns
2. **Skill Discovery**: Create rule to guide Skill discovery
3. **Agent Delegation**: Create rule to guide Agent invocation

### 🔄 Recommended Approach

**Option 1: Natural Discovery (Current)**
- Cursor AI naturally discovers Skills/Agents by reading `.claude/` directory
- Works but may be inconsistent
- Relies on AI's natural file reading behavior

**Option 2: Explicit Rules (Recommended)**
- Create Cursor rules that explicitly guide command/skill/agent usage
- More reliable and consistent
- Ensures proper workflow execution

**Option 3: Hybrid**
- Use rules for commands (explicit `/command` detection)
- Let Skills/Agents be naturally discovered (they're model-invoked anyway)

## Example Workflow

### User Types: `/commit-push "feat(api): add validation"`

1. **Cursor Rule Detects**: `/commit-push` pattern
2. **Rule Instructs**: Read `.claude/commands/commit-push.md`
3. **Command File Says**: 
   - Run quality gates
   - Use `direct-commit-skill` for workflow
   - Commit and push
4. **Skill Loads**: `.claude/skills/direct-commit-skill/SKILL.md`
5. **Skill Instructions**: Format → Lint → Build → Safety Review → Commit → Push
6. **Execution**: Cursor AI follows instructions using Bash, Read, Write tools
7. **Result**: Changes committed and pushed

## Testing

To test if Cursor can use your Skills/Commands/Agents:

1. **Test Command**: Type `/commit` in Cursor chat
   - Should read `.claude/commands/commit.md`
   - Should follow instructions

2. **Test Skill**: Say "I want to commit these changes"
   - Should discover `direct-commit-skill`
   - Should load and follow Skill instructions

3. **Test Agent**: Say "Review this PR"
   - Should discover `pr-review-agent`
   - Should load and follow Agent workflow

## Summary

**From Cursor AI Agents:**

- **Commands**: Type `/command-name` → Cursor reads `.claude/commands/command-name.md` → Follows instructions
- **Skills**: Mention relevant keywords → Cursor discovers Skill → Loads and follows instructions
- **Agents**: Request specialized task → Cursor discovers Agent → Delegates to Agent workflow

**Key**: Cursor rules can make this more reliable by explicitly guiding the AI, but natural discovery also works.

**Files Work the Same**: The `.claude/` files work identically for both Claude Code CLI and Cursor - it's just the invocation method that differs.

