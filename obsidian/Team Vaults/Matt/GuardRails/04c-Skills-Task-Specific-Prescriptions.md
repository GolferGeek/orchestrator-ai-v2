# Skills: Task-Specific Prescriptions

In the old world, we'd write detailed procedures for specific tasks. "How to deploy to production." "How to handle a security incident." "How to onboard a new developer." Today, with AI coding assistants, skills serve the same purpose—but they're progressive, they're shareable, and they're used by agents automatically.

Let me show you what happens when task-specific guidance is missing—and how skills solve this.

## PART 1: THE METAPHOR (Manager and Contractor)

### Scene 1: Manager NOT Providing Task-Specific Guidance

You've given your contractor coding standards (Post 04a) and commands (Post 04b). They know your conventions and can use your standardized processes. But when they need to do a specific task—like "how to do a commit" or "how to create a PR"—you give general instructions.

**When they need to commit:**
"Just commit it."

**When they need to create a PR:**
"Create a PR."

The contractor is capable, but they don't know:

- What steps to follow for this specific task?
- What to check before doing it?
- What format to use?
- What could go wrong?

They make assumptions. They:

- Skip important steps
- Miss validations
- Use wrong formats
- Create incomplete work

You're explaining what's missing. They're fixing things. You're both frustrated because you thought general instructions would be enough.

**This is what happens without task-specific guidance.**

### Scene 2: Manager Providing Skills (Task-Specific Prescriptions)

Same contractor. Same capability. But this time, you've created detailed guides for specific tasks:

**For Committing:**
You provide a "how to commit" skill that includes:
- High-level overview: "Commits should follow our standards"
- Detailed steps: "1. Run linter, 2. Run tests, 3. Format code, 4. Write commit message, 5. Commit"
- What to check: "Make sure no secrets, make sure tests pass"
- Format requirements: "Commit messages must follow conventional commits format"
- Examples: "Here's what a good commit looks like"

**For Creating PRs:**
You provide a "how to create a PR" skill that includes:
- High-level overview: "PRs must pass all checks"
- Detailed steps: "1. Validate code, 2. Check tests, 3. Write description, 4. Create PR"
- What to check: "Make sure all tests pass, make sure description is complete"
- Format requirements: "PR descriptions must include context, changes, and testing"
- Examples: "Here's what a good PR looks like"

The contractor references these skills when needed. They:

- Follow the right steps
- Check the right things
- Use the right formats
- Create complete work

**This is what happens with skills.**

The difference? Task-specific prescriptions. The contractor was just as capable in both scenarios—the difference was having detailed guidance for specific tasks.

## PART 2: THE TECHNICAL IMPLEMENTATION (Claude Code Skills)

### What Are Skills?

Skills in Claude Code are task-specific prescriptions stored in `.claude/skills/{name}/SKILL.md`. They provide progressive, shareable guidance for specific tasks.

Skills are:

**1. Task-Specific**
- Each skill covers one specific task
- "How to do a commit"
- "How to create a PR"
- "How to handle errors"

**2. Progressive Disclosure**
- Start with high-level overview
- Provide more detail as needed
- Load resources only when referenced

**3. Shareable**
- Multiple agents can use the same skill
- Create once, use many times
- Consistent guidance across agents

### How Skills Work

Skills use progressive loading:

**1. Metadata First**
- Description of what the skill does
- When to use it
- What it covers

**2. Instructions Next**
- Step-by-step guidance
- What to check
- What to validate

**3. Resources as Needed**
- REFERENCE.md for deeper context
- EXAMPLES.md for examples
- Loaded only when referenced

### Example: Direct Commit Skill

A direct commit skill (`.claude/skills/direct-commit-skill/SKILL.md`) might:

**Metadata:**
- Description: "Commit changes directly to current branch after quality checks"
- When to use: "When you want to commit changes"

**Instructions:**
1. Run quality gates (linting, formatting)
2. Run safety review
3. Validate commit message
4. Execute commit

**Resources (loaded as needed):**
- REFERENCE.md: Detailed commit message format
- EXAMPLES.md: Examples of good commits

### Skills Are Shareable

The beauty of skills is they're shareable:

- **Multiple agents** can use the same skill
- **Create once**, use many times
- **Consistent** guidance across all agents

An agent doing PR review can use the commit skill. An agent doing code changes can use the commit skill. Same skill, same guidance, consistent results.

### Building Skills

Start with your most common tasks:

1. **Committing**: How to commit code properly
2. **PR Creation**: How to create PRs
3. **Error Handling**: How to handle errors
4. **Testing**: How to write and run tests

Then:

1. **Create the Skill Directory**: `.claude/skills/your-skill-name/`
2. **Create SKILL.md**: Main skill file with metadata and instructions
3. **Add Resources**: REFERENCE.md, EXAMPLES.md as needed
4. **Test It**: Make sure agents can use it
5. **Refine It**: Improve based on usage

### Skills vs Commands vs Agents

- **Skills**: Task-specific prescriptions (used by agents, progressive, shareable)
- **Commands**: User-invoked shortcuts (you type `/command`)
- **Agents**: Environment-specialized (use skills, follow commands)

Skills are for *agents* to use. Commands are for *you* to invoke. Agents use skills automatically when they need task-specific guidance.

### The Power of Skills

Skills provide:

- **Task-Specific Guidance**: Right detail for specific tasks
- **Progressive Disclosure**: Start high-level, get more detail as needed
- **Shareability**: Create once, use many times
- **Consistency**: Same guidance across all agents

### Building on Previous Context

Skills build on coding rules (Post 04a) and commands (Post 04b). They reference your standards. They can use your commands. But skills are used by agents. For environment-specialized agents that understand your codebase, you need agents. That's next.

---

**Parent**: [04-Context-is-King-Overview.md](04-Context-is-King-Overview.md)  
**Previous**: [04b-Commands-User-Shortcuts.md](04b-Commands-User-Shortcuts.md)  
**Next**: [04d-Agents-Environment-Specialized.md](04d-Agents-Environment-Specialized.md)

