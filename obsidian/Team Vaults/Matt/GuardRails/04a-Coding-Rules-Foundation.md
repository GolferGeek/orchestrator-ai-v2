# Coding Rules: The Foundation

Coding rules are your foundation. They're always there, always accessible. In the old world, we'd have style guides, coding standards documents, architecture decision records. Today, with AI coding assistants, coding rules serve the same purpose—but they're always available, always referenced, always part of the context.

Let me show you what happens when this foundation is missing—and why it matters.

## PART 1: THE METAPHOR (Manager and Contractor)

### Scene 1: Manager NOT Providing Coding Standards

You've given your contractor a good prompt (from Post 01). You've explained what you need. But you haven't given them your coding standards. They don't know:

- How you name variables (camelCase? snake_case? something else?)
- How you structure functions (what patterns do you use?)
- How you handle errors (exceptions? error codes? something else?)
- How you format code (spacing, indentation, line length?)
- What patterns you use (design patterns, architectural patterns?)

The contractor is capable. They start coding. They make assumptions:

- Maybe they use camelCase because that's what they're used to
- Maybe they structure functions the way they learned in school
- Maybe they handle errors the way their last project did
- Maybe they format code however their editor formats it

They deliver code. It works. But:

- Variable names don't match your codebase style
- Function structure doesn't match your patterns
- Error handling is inconsistent with your approach
- Code formatting is all over the place
- Patterns don't match your architecture

Now you're explaining your standards. They're fixing things. You're both frustrated because you thought the code would just "match" somehow.

**This is what happens without coding standards.**

### Scene 2: Manager Providing Coding Rules

Same contractor. Same capability. But this time, before they start coding, you give them your coding standards:

- **Naming Conventions**: "We use camelCase for variables, PascalCase for classes, UPPER_CASE for constants..."
- **Function Structure**: "Functions should follow this pattern: validation first, then logic, then return..."
- **Error Handling**: "We use exceptions for errors, and here's our standard error format..."
- **Code Formatting**: "We use 2-space indentation, max 100 characters per line, here's our formatter config..."
- **Patterns**: "We use these design patterns, here's when to use each one..."

The contractor references these standards while working. They deliver code that:

- Matches your naming conventions perfectly
- Follows your function structure
- Uses your error handling approach
- Matches your code formatting
- Uses the right patterns

**This is what happens with coding rules.**

The difference? The foundation. The contractor was just as capable in both scenarios—the difference was having standards to reference.

## PART 2: THE TECHNICAL IMPLEMENTATION

### What Are Coding Rules?

Coding rules are your project's standards, conventions, and patterns. In Claude Code (and Cursor), these are typically stored in `.cursor/rules/` or similar directories.

Coding rules include:

**1. Naming Conventions**
- Variables, functions, classes, constants
- Files, directories, modules
- Database tables, columns, indexes

**2. Code Structure**
- Function organization
- Class structure
- Module organization
- File organization

**3. Error Handling**
- Exception patterns
- Error response formats
- Logging standards
- Error recovery strategies

**4. Code Formatting**
- Indentation, spacing
- Line length
- Comment style
- Documentation format

**5. Patterns and Practices**
- Design patterns (when to use which)
- Architectural patterns
- Best practices
- Anti-patterns to avoid

**6. Technology Stack Prescriptions**
- Framework conventions
- Library usage patterns
- API design standards
- Database patterns

### Why Coding Rules Are the Foundation

Coding rules are the foundation because:

**1. Always Available**
- They're always in context
- Every AI interaction references them
- They don't need to be loaded or activated

**2. Always Referenced**
- The AI assistant checks them automatically
- They guide all code generation
- They ensure consistency

**3. Foundation for Everything Else**
- Commands reference coding rules
- Skills reference coding rules
- Agents reference coding rules
- Everything builds on this foundation

### How Coding Rules Integrate

Coding rules work with other context mechanisms:

- **With Commands**: Commands follow coding rules when executing workflows
- **With Skills**: Skills reference coding rules for task-specific guidance
- **With Agents**: Agents use coding rules as their foundation for codebase understanding

### Building Your Coding Rules

Start with:

1. **Existing Standards**: Document what you already do
2. **Team Conventions**: Capture unwritten rules
3. **Technology Stack**: Include framework/library conventions
4. **Architecture Decisions**: Document why you do things certain ways

Then:

1. **Organize by Topic**: Group related rules together
2. **Provide Examples**: Show what good looks like
3. **Explain Why**: Help the AI understand the reasoning
4. **Keep Updated**: Evolve as your codebase evolves

### The Cost of Missing Rules

Without coding rules, you get:

- Inconsistent code
- Wrong patterns
- Code that doesn't match your style
- Technical debt
- Frustration

With coding rules, you get:

- Consistent code
- Right patterns
- Code that matches your style
- Less technical debt
- Efficiency

### Building on This Foundation

Coding rules are the foundation. But they're not enough alone. You also need user shortcuts for common workflows. That's next.

---

**Parent**: [04-Context-is-King-Overview.md](04-Context-is-King-Overview.md)  
**Next**: [04b-Commands-User-Shortcuts.md](04b-Commands-User-Shortcuts.md)

