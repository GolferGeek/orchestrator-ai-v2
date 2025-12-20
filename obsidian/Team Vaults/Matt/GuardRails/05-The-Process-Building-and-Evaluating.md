# The Process: Building and Evaluating

In the old world, we'd have processes. We'd follow them. We'd refine them. Today, with AI coding assistants, it's tempting to skip the process—just build, just evaluate manually. But that's like building without a process. You get inconsistent results, you miss things, you waste time.

Let me show you what happens when we skip the process—and how systematic processes solve this.

## PART 1: THE METAPHOR (Manager and Contractor)

### Scene 1: Manager NOT Providing Process

You've set up all the guardrails. Good prompt (Post 01). PRD and plan (Post 02). Right LLM (Post 03). Context mechanisms (Post 04). The contractor has everything they need. They start building.

But there's no process. No systematic way to:

- Build the guardrails themselves
- Evaluate work before submission
- Catch issues early
- Ensure consistency

The contractor builds something. They submit it. You review it manually. You find:

- Issues that should have been caught earlier
- Missing validations
- Incomplete work
- Plan drift (what they built doesn't match the plan)

You're doing manual review. You're finding issues late. You're frustrated because things should have been caught earlier. They're frustrated because they thought it was done.

**This is what happens without a process.**

### Scene 2: Manager Providing Systematic Process

Same contractor. Same capability. Same guardrails. But this time, you have a systematic process:

**Process for Building Guardrails:**
1. Build PRD (from Post 02)
2. Create plan (from PRD)
3. Build skills/agents (from Post 04)
4. Set up evaluation (automated checks)

**Process for Evaluating Work:**
1. Pre-commit validation (catches issues early)
2. PR evaluation (checks against plan before human review)
3. Automated checks (validates standards, tests, etc.)
4. Human review (only after automated checks pass)

The contractor follows the process. They:

- Build guardrails systematically
- Get feedback early (before submission)
- Catch issues before you see them
- Deliver complete work consistently

**This is what happens with a systematic process.**

The difference? Process. The contractor was just as capable in both scenarios—the difference was having a systematic approach to building and evaluating.

## PART 2: THE TECHNICAL IMPLEMENTATION

### The Systematic Guardrail Creation Process

Building guardrails shouldn't be ad-hoc. It should be systematic:

**1. Build PRD**
- Start with requirements (from Post 02)
- Document constraints, edge cases, success criteria
- Get stakeholder validation

**2. Create Plan**
- Break down PRD into phases
- Define dependencies
- Sequence work properly

**3. Build Skills/Agents**
- Create skills for task-specific guidance (from Post 04c)
- Create agents for environment specialization (from Post 04d)
- Reference coding rules (from Post 04a)

**4. Set Up Evaluation**
- Automated PR evaluation
- Pre-commit validation
- Plan-to-implementation checks

### PR Evaluation Automation

Before human review, automate evaluation:

**1. PR Evaluation Agent**
- Checks PR against plan
- Validates implementation matches requirements
- Identifies gaps or drift

**2. Plan-to-Implementation Validation**
- Compares what was built to what was planned
- Identifies missing features
- Flags deviations

**3. Automated Checks**
- Coding standards compliance
- Test coverage
- Security checks
- Performance checks

### Pre-Commit Validation

Catch issues before they're committed:

**1. Quality Gates**
- Linting
- Formatting
- Type checking

**2. Safety Review**
- Secret detection
- Security scanning
- Vulnerability checks

**3. Test Validation**
- Run tests
- Check coverage
- Validate test quality

### Workflow Integration Points

Integrate processes into your workflow:

**1. Development Workflow**
- Pre-commit hooks
- Automated checks
- Early feedback

**2. PR Workflow**
- Automated PR evaluation
- Plan validation
- Human review (after automation)

**3. Deployment Workflow**
- Final validation
- Production checks
- Monitoring setup

### The Power of Process

Systematic processes provide:

- **Consistency**: Same approach every time
- **Early Detection**: Catch issues before they're problems
- **Efficiency**: Automated checks save time
- **Quality**: Built-in validations ensure standards

### Building on Previous Guardrails

This process builds on everything:

- **Good Prompt** (Post 01): Foundation for everything
- **PRD and Plan** (Post 02): What to build and how
- **Right LLM** (Post 03): Right tool for the job
- **Context** (Post 04): Rules, commands, skills, agents
- **Process** (This post): How to build and evaluate systematically

But even with a good process, you need validation. You need questioning. That's next.

---

**Next**: [06-Question-Everything-Validation-and-Review.md](06-Question-Everything-Validation-and-Review.md)  
**Previous**: [04d-Agents-Environment-Specialized.md](04d-Agents-Environment-Specialized.md)

