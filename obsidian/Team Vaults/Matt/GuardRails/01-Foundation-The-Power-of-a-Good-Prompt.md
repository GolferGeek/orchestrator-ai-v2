# Foundation: The Power of a Good Prompt

Back in the day, when you hired a contractor, you'd sit down with them, explain what you needed, show them around, answer questions, and make sure they understood before they started work. Today, with AI coding assistants, we sometimes forget that same principle applies. A vague prompt is like telling a contractor "go build something" and walking away.

Let me show you what happens when we get this wrong—and how to get it right.

## PART 1: THE METAPHOR (Manager and Contractor)

### Scene 1: The Vague Prompt (What NOT to Do)

The contractor arrives, excited and ready to work. They've got their tools, they're capable, and they're eager to contribute. You sit down together, and you say:

"I need you to add a new module about our backend system that allows for multiple entry points from multiple applications. Go get going!"

The contractor looks at you, a bit uncertain. "Okay... can you tell me more about—"

"Nope, that's all you need. Just go build it. I'll check back later."

So the contractor goes off. They're capable, remember? They start making assumptions:

- Maybe they should use REST APIs? Or GraphQL? You didn't specify.
- Should it integrate with the existing authentication system? You didn't mention it.
- What about error handling? Rate limiting? You didn't say.
- How should it fit into the existing codebase structure? They'll figure it out.

A few days later, they come back with something. It's code. It compiles. But when you review it:

- It doesn't fit your architecture at all
- It uses patterns that don't match your codebase
- It's missing critical requirements you assumed were obvious
- It doesn't integrate with your existing systems
- The error handling is wrong
- The testing approach doesn't match your standards

Now you're frustrated. They're frustrated. You have to explain everything again, they have to rework most of it, and you've wasted time and created technical debt.

**This is what happens with vague prompts.**

### Scene 2: The Good Prompt (What TO Do)

Same contractor. Same excitement. Same capability. But this time, you sit down and you say:

"I need you to add a new module about our backend system that allows for multiple entry points from multiple applications. Let me give you what you need to succeed."

You provide:

**Clear Context About the Codebase Structure:**
- "We're using a monorepo structure. The backend lives in `apps/api/`, and we follow this directory pattern..."
- "We use FastAPI for our Python services, and NestJS for our TypeScript services..."
- "Here's how our existing entry points are structured..."

**Specific Requirements and Constraints:**
- "This needs to support both REST and GraphQL endpoints"
- "It must integrate with our existing authentication middleware"
- "Rate limiting should follow our standard pattern: X requests per minute per API key"
- "Error responses must match our standard error format..."

**Examples of Similar Patterns:**
- "Here's an existing module that does something similar. Use this as a reference for structure and patterns..."
- "This is how we handle multi-application access in our other services..."

**Expected Output Format:**
- "The module should expose these specific endpoints..."
- "Here's the expected request/response format..."
- "Tests should follow our testing standards, which are..."

**Integration Points and Dependencies:**
- "This needs to work with our existing database schema..."
- "It must use our shared authentication library..."
- "Here are the other services it will interact with..."

The contractor goes off, and this time they have everything they need. They come back with code that:

- Fits your architecture perfectly
- Uses the right patterns
- Includes all the requirements
- Integrates properly with existing systems
- Has proper error handling
- Follows your testing standards

**This is what happens with good prompts.**

The difference? Context. Specificity. Examples. Structure. The contractor was just as capable in both scenarios—the difference was what you gave them to work with.

## PART 2: THE TECHNICAL IMPLEMENTATION

### What Makes a Prompt "Good"?

In the old world, we'd write detailed specifications. We'd have design documents. We'd do code reviews. Today, with AI coding assistants, the prompt is your specification. It's your design document. It's your first code review.

A good prompt includes:

**1. Context About the Codebase**
- Where does this code live?
- What's the structure?
- What patterns are used?
- What's the technology stack?

**2. Specific Requirements**
- What exactly needs to be built?
- What are the constraints?
- What are the edge cases?
- What are the success criteria?

**3. Examples**
- Show similar patterns from the codebase
- Provide examples of the expected output
- Reference existing implementations

**4. Expected Output Format**
- What should the code look like?
- What structure should it follow?
- What conventions should it use?

**5. Integration Points**
- What does it need to work with?
- What are the dependencies?
- How does it fit into the larger system?

### The Cost of Vague Prompts

When you give a vague prompt, you're essentially saying "figure it out." The AI assistant will:

- Make assumptions (often wrong)
- Use patterns it thinks are right (often don't match your codebase)
- Miss requirements (because you didn't specify them)
- Create technical debt (that you'll have to fix later)

The cost isn't just the rework—it's the time lost, the frustration, and the potential for bugs that make it into production.

### Building on This Foundation

Everything else in this series builds on having a good prompt. If your prompt is vague, no amount of context, planning, or process will fix it. The prompt is the foundation.

But a good prompt alone isn't enough. That's where the next guardrails come in.

---

**Next**: [02-Building-Blueprints-PRD-and-Planning.md](02-Building-Blueprints-PRD-and-Planning.md)  
**Previous**: [00-Index-Guardrails-Overview.md](00-Index-Guardrails-Overview.md)

