# Commands: User Shortcuts

In the old world, we'd create scripts for common tasks. We'd document processes. We'd have checklists. Today, with AI coding assistants, commands serve the same purpose—but they're interactive, they're contextual, and they're invoked with a simple slash command.

Let me show you what happens when processes aren't standardized—and how commands solve this.

## PART 1: THE METAPHOR (Manager and Contractor)

### Scene 1: Manager NOT Providing Standardized Processes

You've given your contractor coding standards (from Post 04a). They know your conventions. But you haven't standardized your processes. Every time they need to do something common—like commit code or create a PR—you give different instructions.

**First time they commit:**
"Just commit it with a good message."

**Second time they commit:**
"Run the linter first, then commit."

**Third time they commit:**
"Run tests, then lint, then format, then commit."

The contractor is confused. They're not sure what the process is. They:

- Sometimes skip steps (forget to lint, forget to test)
- Sometimes do things in wrong order (commit before testing)
- Sometimes miss requirements (don't format code)
- Create inconsistent results

You're frustrated because the process isn't being followed consistently. They're frustrated because the process keeps changing.

**This is what happens without standardized processes.**

### Scene 2: Manager Providing Commands/Shortcuts

Same contractor. Same capability. But this time, you've created standardized command shortcuts:

**For Committing:**
"Use the `/commit` command. It runs quality gates, safety review, then commits. Same process every time."

**For Creating PRs:**
"Use the `/pr-review` command. It checks the PR against our standards, runs validation, then creates the PR. Same process every time."

**For Other Common Tasks:**
You have commands for everything common. The contractor invokes the command, follows the standardized process, gets consistent results.

The contractor:

- Always follows the right process
- Never skips steps
- Always does things in the right order
- Creates consistent results

**This is what happens with commands.**

The difference? Standardization. The contractor was just as capable in both scenarios—the difference was having consistent processes to follow.

## PART 2: THE TECHNICAL IMPLEMENTATION (Claude Code Commands)

### What Are Commands?

Commands in Claude Code are user-invoked shortcuts stored in `.claude/commands/*.md`. They encapsulate standardized workflows for common tasks.

Commands are:

**1. User-Invoked**
- You type `/command-name` to invoke them
- They're shortcuts for common workflows
- They're interactive and contextual

**2. Standardized Processes**
- They encapsulate your process
- They ensure consistency
- They prevent mistakes

**3. Reusable**
- Create once, use many times
- Same process every time
- No need to remember steps

### Example: Commit Command

A typical commit command (`.claude/commands/commit.md`) might:

1. Run quality gates (linting, formatting)
2. Run safety review (check for secrets, security issues)
3. Validate commit message format
4. Execute the commit

Every time you use `/commit`, it follows this exact process. No forgetting steps. No wrong order. Consistency.

### Example: PR Review Command

A PR review command might:

1. Check PR against coding standards
2. Run validation tests
3. Check for missing tests
4. Validate PR description format
5. Create the PR

Same process every time. Consistent results.

### How Commands Work

Commands are markdown files with:

**1. YAML Frontmatter**
- Description of what the command does
- Arguments it accepts
- When to use it

**2. Instructions**
- Step-by-step process
- What to check
- What to validate
- What to execute

**3. Context Awareness**
- They know your codebase
- They reference your coding rules
- They use your standards

### Building Commands

Start with your most common workflows:

1. **Committing Code**: Quality gates → Safety review → Commit
2. **Creating PRs**: Validation → Review → Create
3. **Running Tests**: Setup → Run → Report
4. **Deploying**: Build → Test → Deploy

Then:

1. **Document the Process**: Write down each step
2. **Create the Command File**: `.claude/commands/your-command.md`
3. **Test It**: Make sure it works
4. **Refine It**: Improve based on usage

### Commands vs Skills vs Agents

- **Commands**: User-invoked shortcuts (you type `/command`)
- **Skills**: Task-specific prescriptions (used by agents)
- **Agents**: Environment-specialized (use skills, follow commands)

Commands are for *you* to invoke. Skills are for *agents* to use. Agents use both.

### The Power of Commands

Commands provide:

- **Consistency**: Same process every time
- **Efficiency**: No need to remember steps
- **Quality**: Built-in checks and validations
- **Speed**: Faster than manual process

### Building on Previous Context

Commands build on coding rules (Post 04a). They reference your standards. They follow your conventions. But commands are user-invoked. For task-specific guidance that agents can use, you need skills. That's next.

---

**Parent**: [04-Context-is-King-Overview.md](04-Context-is-King-Overview.md)  
**Previous**: [04a-Coding-Rules-Foundation.md](04a-Coding-Rules-Foundation.md)  
**Next**: [04c-Skills-Task-Specific-Prescriptions.md](04c-Skills-Task-Specific-Prescriptions.md)

