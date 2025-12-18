# Claude Code: Skills, Agents, and Commands - Reference Guide

This document provides a clear understanding of the three main extension mechanisms in Claude Code.

## Overview: Three Extension Types

| Type | Invocation | Purpose | Location | When to Use |
|------|-----------|---------|----------|-------------|
| **Skills** | Model-invoked (automatic) | Extend capabilities with domain expertise | `.claude/skills/` | Reusable workflows, best practices, domain knowledge |
| **Agents** | Model-invoked (automatic) | Specialized subagents for specific tasks | `.claude/agents/` | Complex multi-step workflows, specialized roles |
| **Commands** | User-invoked (explicit `/command`) | Quick actions and shortcuts | `.claude/commands/` | Frequently used workflows, user-initiated actions |

---

## Skills

### What They Are
**Skills** are modular capabilities that Claude automatically uses when relevant. They package expertise into discoverable capabilities that extend Claude's functionality.

### Key Characteristics
- **Model-invoked**: Claude autonomously decides when to use them based on your request
- **Progressive disclosure**: Only loads content when needed (metadata → instructions → resources)
- **Filesystem-based**: Stored as directories with `SKILL.md` files
- **Composable**: Multiple Skills can work together

### Structure
```
.claude/skills/my-skill/
├── SKILL.md (required - YAML frontmatter + instructions)
├── REFERENCE.md (optional - detailed docs)
├── EXAMPLES.md (optional - usage examples)
└── scripts/ (optional - executable utilities)
```

### SKILL.md Format
```yaml
---
name: Skill Name
description: What this skill does and when to use it. Include trigger keywords.
allowed-tools: Read, Write, Bash (optional - restricts tool access)
---

# Skill Name

## Instructions
Clear, step-by-step guidance for Claude.

## Examples
Concrete examples of using this Skill.
```

### When to Create a Skill
- ✅ You want Claude to automatically use expertise when relevant
- ✅ You have reusable workflows or best practices
- ✅ You want to share domain knowledge across conversations
- ✅ You need progressive disclosure (load content as needed)

### Best Practices
- **Focused scope**: One Skill = one capability
- **Clear description**: Include both what it does AND when to use it
- **Trigger keywords**: Include terms users would mention
- **Progressive disclosure**: Use supporting files for detailed info

---

## Agents

### What They Are
**Agents** are specialized subagents designed for specific, complex tasks. They act as autonomous specialists that can handle multi-step workflows.

### Key Characteristics
- **Model-invoked**: Claude decides when to delegate to an agent
- **Specialized roles**: Each agent has a specific purpose (PR review, testing, etc.)
- **Autonomous**: Can make decisions and take actions independently
- **Tool access**: Can have restricted or full tool access

### Structure
```
.claude/agents/my-agent.md
```

### Agent File Format
```yaml
---
name: agent-name
description: What this agent does and when to use it. Include trigger keywords.
tools: Read, Write, Edit, Bash (optional - specifies available tools)
model: sonnet|opus (optional - which model to use)
color: yellow (optional - UI display color)
---

# Agent Name

## Purpose
Clear statement of the agent's responsibility.

## Workflow
Step-by-step process the agent follows.

## Decision Logic
How the agent makes decisions.

## Examples
Concrete usage examples.
```

### When to Create an Agent
- ✅ You need a specialized role for complex tasks
- ✅ The task requires multi-step decision making
- ✅ You want autonomous execution of a workflow
- ✅ The task is too complex for a simple Skill

### Best Practices
- **Clear purpose**: One agent = one specialized role
- **Explicit workflow**: Document the step-by-step process
- **Decision logic**: Explain how the agent makes choices
- **Tool restrictions**: Use `tools` field to limit capabilities when needed

---

## Commands

### What They Are
**Commands** are user-invoked shortcuts that expand into prompts. You explicitly type `/command` to trigger them.

### Key Characteristics
- **User-invoked**: You must explicitly type `/command-name`
- **Argument support**: Can accept `$ARGUMENTS` for dynamic input
- **Model selection**: Can specify which model to use
- **Quick actions**: Designed for frequently used workflows

### Structure
```
.claude/commands/my-command.md
```

### Command File Format
```yaml
---
description: "What this command does"
argument-hint: "What arguments it expects"
model: "claude-opus-4-20250514" (optional - which model to use)
---

# Command Name

Your instructions here. Use $ARGUMENTS to accept dynamic inputs.

## Steps
1. Step one
2. Step two
```

### When to Create a Command
- ✅ You frequently perform the same workflow
- ✅ You want a quick shortcut for a specific action
- ✅ The action is user-initiated (not automatic)
- ✅ You want to save typing repetitive prompts

### Best Practices
- **Clear description**: Explain what the command does
- **Argument hints**: Guide users on what to provide
- **Focused purpose**: One command = one clear action
- **Model selection**: Use appropriate model for the task

---

## Decision Tree: Which Should I Use?

### Use a **Skill** when:
- You want Claude to automatically use expertise
- The capability should be available across conversations
- You have reusable workflows or best practices
- You want progressive disclosure of information

### Use an **Agent** when:
- You need a specialized role for complex tasks
- The task requires autonomous decision-making
- You need multi-step workflows with logic
- The task is too complex for a Skill

### Use a **Command** when:
- You want a quick shortcut you can explicitly invoke
- The action is user-initiated
- You frequently perform the same workflow
- You want to save typing repetitive prompts

---

## Key Differences Summary

| Aspect | Skills | Agents | Commands |
|--------|--------|--------|----------|
| **Invocation** | Automatic (model decides) | Automatic (model decides) | Manual (user types `/command`) |
| **Complexity** | Simple to moderate | Complex, multi-step | Simple to moderate |
| **Autonomy** | Guided by instructions | Autonomous decision-making | Follows instructions |
| **Discovery** | Based on description matching | Based on description matching | User must know command name |
| **Best For** | Domain expertise, workflows | Specialized roles, complex tasks | Quick shortcuts, frequent actions |

---

## Progressive Disclosure (Skills)

Skills use a three-level loading system:

1. **Level 1: Metadata** (always loaded)
   - YAML frontmatter (`name`, `description`)
   - ~100 tokens per Skill
   - Loaded at startup

2. **Level 2: Instructions** (loaded when triggered)
   - Main body of `SKILL.md`
   - Under 5k tokens
   - Loaded when Skill matches request

3. **Level 3: Resources** (loaded as needed)
   - Supporting files (REFERENCE.md, scripts, etc.)
   - Effectively unlimited
   - Loaded only when referenced

This ensures only relevant content occupies the context window.

---

## Security Considerations

### Skills
- Use `allowed-tools` to restrict tool access
- Audit Skills from untrusted sources
- Review all bundled files (scripts, resources)

### Agents
- Use `tools` field to limit capabilities
- Document decision logic clearly
- Test agents in safe environments first

### Commands
- Commands execute with full context
- Be careful with `$ARGUMENTS` - validate inputs
- Use appropriate model for sensitive operations

---

## References

- [Agent Skills Overview](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)
- [Agent Skills in Claude Code](https://docs.claude.com/en/docs/claude-code/skills)
- [Agent Skills Best Practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)
- [Claude Code Commands](https://docs.claude.com/en/docs/claude-code/commands)

