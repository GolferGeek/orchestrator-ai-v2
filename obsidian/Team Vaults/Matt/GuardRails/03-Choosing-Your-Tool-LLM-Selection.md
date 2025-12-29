# Choosing Your Tool: LLM Selection

In the old world, you'd hire contractors based on their specialties. You wouldn't hire a plumber to do electrical work. You wouldn't hire a senior architect to fix a leaky faucet. Today, with AI coding assistants, we have different "contractors" available—different LLMs with different strengths. But we often use the same one for everything, or we pick based on what's available, not what's right for the job.

Let me show you what happens when we choose the wrong contractor—and how to choose the right one.

## PART 1: THE METAPHOR (Manager and Contractor)

### Scene 1: Wrong Contractor for the Job

You've got a task. You need it done. You've got several contractors available, each with different strengths. But you pick one without thinking about whether they're right for the job.

**Scenario A: Speed Mismatch**

You need a quick fix. A bug that's blocking production. You need it fixed fast. But you assign "Deep Dive Dave"—a contractor who's incredibly thorough and careful, but takes forever.

Dave is methodical. He analyzes everything. He considers every edge case. He writes comprehensive tests. He documents everything. Three days later, he delivers perfect code.

But you needed it fixed in three hours, not three days. Production was down. Users were frustrated. You needed speed, but you got perfectionism.

**Scenario B: Fit Mismatch**

You need a straightforward solution. A simple CRUD API. Nothing fancy. But you assign "Creative Carl"—a contractor who's brilliant and innovative, but makes mistakes and takes time to find the right solution.

Carl delivers something innovative. It's elegant. It's unique. It solves the problem in a way nobody else would have thought of. But it's over-engineered. It has bugs. It took too long. And honestly, you just needed something simple and reliable.

You needed straightforward, but you got complex and risky.

**Scenario C: Cost Mismatch**

You need a simple task. Add a new field to a form. Update the database schema. Basic work. But you assign "Premium Pete"—a contractor who's incredibly capable and expensive.

Pete delivers perfect work. It's flawless. But you're paying premium rates for work a junior contractor could have handled. Your budget is blown, and you didn't need that level of expertise.

**Scenario D: Tool Mismatch**

You need tool integration. You're using MCP tools, external APIs, complex integrations. But you assign "Built-in Betty"—a contractor who excels with native tools but struggles with external integrations.

Betty is great with built-in tools. She knows them inside and out. But when it comes to MCP tools and external APIs, she fumbles. She gets confused. She makes errors. You need someone who's comfortable with external tool integration, but you got someone who's only good with built-ins.

**Results**: Frustration, delays, wrong solution approach, wasted resources, unnecessary costs, tool integration failures.

**This is what happens when you choose the wrong contractor.**

### Scene 2: Right Contractor for the Job

Same tasks. Same contractors available. But this time, you think about what you need and match the contractor to the task.

**For Quick Fixes**: You use a fast, efficient contractor. They get it done quickly. They might not be as thorough, but speed is what matters here.

**For Deep Analysis**: You use a detailed, thorough contractor. They take their time, but they deliver comprehensive solutions. Perfect for architecture work, complex refactoring, system design.

**For Creative Solutions**: You use an innovative contractor. When you need something unique, when the problem requires creative thinking, they're perfect. But only when complexity warrants it.

**For Straightforward Work**: You use a reliable, consistent contractor. They deliver simple, solid solutions. No over-engineering, no unnecessary complexity.

**For Simple Tasks**: You use a cost-effective contractor. You don't pay premium rates for basic work. You save budget for when you actually need premium capabilities.

**For Tool Integration**: You use a contractor who's comfortable with external tools. They handle MCP tools, APIs, complex integrations with ease.

**Results**: Right solution, right speed, right cost, right capabilities.

**This is what happens when you choose the right contractor.**

The difference? Matching the contractor's strengths to the task's needs. Each contractor was capable—the difference was whether they were right for *this* specific job.

## PART 2: THE TECHNICAL IMPLEMENTATION

### LLMs as Contractors

Different LLMs have different "personalities" and capabilities:

**Deep Dive LLMs**: Thorough but slower
- Great for: Complex architecture, system design, detailed analysis
- Not for: Quick fixes, simple tasks, when speed matters

**Fast LLMs**: Quick but less detailed
- Great for: Quick fixes, simple tasks, when speed matters
- Not for: Complex architecture, when depth is needed

**Creative LLMs**: Brilliant solutions but make mistakes, take time
- Great for: Unique problems, innovative solutions, when creativity is needed
- Not for: Straightforward tasks, when reliability is more important than innovation

**Cost-Effective LLMs**: Good enough for simple work
- Great for: Simple tasks, basic work, when budget matters
- Not for: Complex problems, when you need premium capabilities

**Tool-Specialized LLMs**: Excel with specific tool types
- Some excel with built-in tools (like Claude Code with its native tools)
- Some excel with external tools (like Cursor with MCP tools)
- Match the LLM to your tool requirements

### Matching LLM to Task

When choosing an LLM, consider:

**1. Task Type**
- Quick fix vs architecture design
- Simple vs complex
- Straightforward vs creative

**2. Complexity Level**
- Does it need deep analysis?
- Does it need quick iteration?
- Does it need creative solutions?

**3. Time Constraints**
- How fast do you need it?
- Can you wait for thoroughness?
- Is speed or quality more important?

**4. Technology Stack**
- Does the LLM understand your stack?
- Does it have experience with your tools?
- Does it handle your integrations well?

**5. Cost Considerations**
- Is this worth premium LLM costs?
- Can a cost-effective LLM handle it?
- Are you paying for capabilities you don't need?

**6. Tool Requirements**
- Do you need built-in tool support?
- Do you need external tool integration (MCP, APIs)?
- Does the LLM handle your tool ecosystem?

### Real-World Examples

**Claude Code**: Excellent with built-in tools, less adept with MCP tools
- Use when: You're working within Claude Code's native tool ecosystem
- Avoid when: You need extensive MCP tool integration

**Cursor**: Works well with MCP tools
- Use when: You need MCP tool integration, external APIs
- Avoid when: You're only using built-in tools (might be overkill)

**Fast LLMs**: Quick iteration, simple tasks
- Use when: Speed matters, task is straightforward
- Avoid when: You need deep analysis or complex solutions

**Deep LLMs**: Thorough analysis, complex problems
- Use when: Architecture, system design, complex refactoring
- Avoid when: You need quick fixes or simple tasks

### The Cost of Wrong Choices

Using the wrong LLM wastes:
- **Time**: Too slow when you need speed, too fast when you need depth
- **Money**: Paying premium for simple work, or using cheap LLM for complex work
- **Quality**: Wrong approach, missing requirements, technical debt

Using the right LLM delivers:
- **Efficiency**: Right speed for the task
- **Value**: Right cost for the work
- **Quality**: Right approach, complete solutions

### Building on Previous Guardrails

You've got a good prompt (Post 01). You've got a PRD and plan (Post 02). Now you need to choose the right tool to execute that plan. But even with the right LLM, you still need to give it context. That's next.

---

**Next**: [04-Context-is-King-Overview.md](04-Context-is-King-Overview.md)  
**Previous**: [02-Building-Blueprints-PRD-and-Planning.md](02-Building-Blueprints-PRD-and-Planning.md)

