# Context is King: Coding Rules, Commands, Skills, and Agents

In the old world, when you hired a contractor, you'd give them a tour of the building. You'd show them where things are, how things work, what the standards are. You wouldn't just point them at a room and say "go build something." Today, with AI coding assistants, we sometimes forget that same principle. A good prompt is essential, but it's not enough. The contractor needs context.

This is where many developers—especially those new to AI-assisted coding—get stuck. They think a good prompt is all they need. But "vibe coders" who stop at the prompt are missing the most powerful part of AI-assisted development: progressive context.

## The Metaphor: Why Context Matters

Imagine you've given your contractor a good prompt (from Post 01). You've explained what you need. But then you stop. The contractor is capable, but they don't know:

- Your coding standards (they'll make assumptions, get patterns wrong)
- Your codebase structure (they'll rifle through it slowly, make mistakes)
- How to submit PRs (they won't follow your process, submissions will be incomplete)
- Your project-specific patterns (they'll reinvent the wheel, be inconsistent)

The contractor struggles. They make mistakes. They're incomplete. They're slow.

Now imagine you provide context:

- **Coding standards**: All the rules so they can reference while working
- **Structural decisions**: How your codebase is organized, architectural patterns
- **PR checklists**: Exact process for submitting PRs
- **Project-specific knowledge**: Patterns, conventions, special considerations

The contractor succeeds. They work efficiently. They avoid mistakes. They're complete.

**The difference? Context.**

Context = giving the contractor exactly what they need to succeed without making mistakes or being incomplete.

## The Four Context Mechanisms

Claude Code provides four powerful context mechanisms that solve this problem. They work together as a progressive hierarchy:

### 1. Coding Rules (Foundation)
**Always available, always referenced**

Coding rules are your foundation. They're always there, always accessible. They define your standards, your patterns, your conventions. Every other context mechanism builds on this foundation.

**Learn more**: [04a-Coding-Rules-Foundation.md](04a-Coding-Rules-Foundation.md)

### 2. Commands (User Shortcuts)
**Reusable workflows for common tasks**

Commands are user-invoked shortcuts. They encapsulate standardized processes. Need to commit? There's a command for that. Need to create a PR? There's a command for that. Commands make common workflows consistent and repeatable.

**Learn more**: [04b-Commands-User-Shortcuts.md](04b-Commands-User-Shortcuts.md)

### 3. Skills (Task-Specific Prescriptions)
**Progressive, shareable, task-specific guidance**

Skills are task-specific prescriptions with progressive disclosure. They start with high-level understanding, then provide more detail as needed. Skills are shareable—multiple agents can use the same skill. Create once, use many times.

**Learn more**: [04c-Skills-Task-Specific-Prescriptions.md](04c-Skills-Task-Specific-Prescriptions.md)

### 4. Agents (Environment-Specialized)
**Codebase-aware, use skills as needed**

Agents are codebase-aware, environment-specialized sub-agents. They understand your entire codebase context. They know which skills are needed for particular parts of their duties. Agents + Skills together = incredibly powerful context combination.

**Learn more**: [04d-Agents-Environment-Specialized.md](04d-Agents-Environment-Specialized.md)

## How They Work Together

These four mechanisms form a progressive context hierarchy:

```
Coding Rules (Foundation)
    ↓
Commands (User Shortcuts)
    ↓
Skills (Task-Specific)
    ↓
Agents (Environment-Specialized)
```

- **Coding Rules** provide the foundation—always available
- **Commands** provide user shortcuts—invoked when needed
- **Skills** provide task-specific guidance—progressive and shareable
- **Agents** provide environment specialization—codebase-aware, use skills

Together, they give your AI coding assistant exactly the context it needs, when it needs it, in the right amount of detail.

## The Evolution Beyond Prompt

This is what "vibe coders" miss. They think:
- "I gave them a prompt, that's all they need!"

But experienced agentic coders know:
- "A good prompt is the foundation, but context is the next step."

Context is the evolution beyond prompt. It's how you take a capable AI assistant and make it successful in *your* codebase, with *your* standards, following *your* processes.

## What's Next

Each of these context mechanisms deserves detailed explanation. Read the child posts to understand:

1. **04a**: How coding rules form the foundation
2. **04b**: How commands provide user shortcuts
3. **04c**: How skills provide progressive, shareable guidance
4. **04d**: How agents provide environment specialization

Together, these four mechanisms transform your AI coding assistant from "capable but generic" to "capable and perfectly prepared for your codebase."

---

**Child Posts**:
- [04a-Coding-Rules-Foundation.md](04a-Coding-Rules-Foundation.md)
- [04b-Commands-User-Shortcuts.md](04b-Commands-User-Shortcuts.md)
- [04c-Skills-Task-Specific-Prescriptions.md](04c-Skills-Task-Specific-Prescriptions.md)
- [04d-Agents-Environment-Specialized.md](04d-Agents-Environment-Specialized.md)

**Next**: [05-The-Process-Building-and-Evaluating.md](05-The-Process-Building-and-Evaluating.md)  
**Previous**: [03-Choosing-Your-Tool-LLM-Selection.md](03-Choosing-Your-Tool-LLM-Selection.md)

