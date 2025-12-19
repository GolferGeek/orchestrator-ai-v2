---
description: "Get explanations about Claude Code features, commands, skills, or agents"
---

# Explain Claude Code Components

Get an explanation about how to use Claude Code features, commands, skills, agents, or patterns.

## Usage

```
/explain-claude <topic>
```

## Topics You Can Ask About

### Commands
- `/explain-claude commit` - How to commit changes
- `/explain-claude commit-push` - How to commit and push
- `/explain-claude review-pr` - How to review a PR
- `/explain-claude create-pr` - How to create a PR
- `/explain-claude worktree` - How to manage worktrees
- `/explain-claude build-plan` - How to create execution plans
- `/explain-claude work-plan` - How to execute work plans
- `/explain-claude test` - How to run/generate tests
- `/explain-claude approve-pr` - How to approve a PR
- `/explain-claude fix-claude` - How to fix Claude Code components

### Skills
- `/explain-claude execution-context` - How ExecutionContext works
- `/explain-claude transport-types` - How A2A protocol works
- `/explain-claude web-architecture` - Web app patterns
- `/explain-claude api-architecture` - API app patterns
- `/explain-claude langgraph` - LangGraph patterns
- `/explain-claude quality-gates` - Quality checks
- `/explain-claude worktree-manager` - Worktree management

### Agents
- `/explain-claude web-agent` - Web architecture agent
- `/explain-claude api-agent` - API architecture agent
- `/explain-claude pr-review-agent` - PR review agent
- `/explain-claude testing-agent` - Testing agent

### Concepts
- `/explain-claude hierarchy` - Overall system hierarchy
- `/explain-claude patterns` - Common patterns to follow
- `/explain-claude three-layer` - Three-layer architecture
- `/explain-claude observability` - LLM observability patterns

## What You Get

For each topic, you'll receive:
1. **Purpose** - What it does and when to use it
2. **Usage** - Command syntax and examples
3. **Workflow** - Step-by-step of what happens
4. **Related** - Other relevant commands/skills/agents
5. **Tips** - Best practices and common pitfalls

## Examples

### Explain a command
```
/explain-claude worktree
```

Output:
- How to create, list, remove, sync worktrees
- Branch naming convention
- Sync flow details
- Common use cases

### Explain a concept
```
/explain-claude execution-context
```

Output:
- What ExecutionContext is
- How it flows through the system
- When to use it
- Common patterns and anti-patterns

### Explain an agent
```
/explain-claude web-agent
```

Output:
- What the agent does
- When it's invoked
- What skills it uses
- Patterns it enforces

## Implementation

When this command runs:
1. Identifies the topic type (command, skill, agent, concept)
2. Reads the relevant documentation:
   - Commands: `.claude/commands/{topic}.md`
   - Skills: `.claude/skills/{topic}-skill/SKILL.md`
   - Agents: `.claude/agents/{topic}.md`
   - Concepts: `.claude/HIERARCHY.md` + relevant skill docs
3. Summarizes the key information
4. Provides examples and tips

## Notes

- If the topic isn't found, suggests similar topics
- Links to full documentation files for more details
- Can combine multiple topics: `/explain-claude commit worktree`
