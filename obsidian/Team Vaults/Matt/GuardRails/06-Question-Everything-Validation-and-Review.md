# Question Everything: Validation and Review

In the old world, we'd do code reviews. We'd have meetings. We'd pour over documents again and again. We'd question everything. But we typically don't have time to do that properly. Today, with AI coding assistants, we can do validation faster—but we still need to question everything. The difference is we can use multiple agents to do it collaboratively, and we can do it fast.

Let me show you what happens with single-perspective development—and how multi-agent validation solves this.

## PART 1: THE METAPHOR (Manager and Contractor)

### Scene 1: Traditional Validation: Meetings and Document Review

You've created a PRD (from Post 02). You want to validate it. Make sure it's complete. Make sure it's right.

**Traditional Approach:**
You schedule meetings. You pour over documents again and again. Multiple review cycles. Corrections. Revisions. It's thorough, but:

- Meetings take hours
- Document reviews take days
- Multiple cycles take weeks
- You typically don't have time to do this properly

So you skip it. Or you do it half-heartedly. Or you rush through it. And you miss things.

**Results**: Missing requirements, incomplete solutions, gaps discovered late.

**This is what happens with traditional validation.**

### Scene 2: Fast Multi-Agent Validation (But Staying in Loop)

Same PRD. Same need for validation. But this time, you use a different approach:

**Two-Agent Approach:**
You use two agents. One builds. One critiques. Not adversarial—collaborative questioning:

- "They said this, they built this, what do you think about this?"
- "What improvements would you make?"
- "Did they miss anything?"

Then you reverse it. Same questioning with the other agent's work.

**This is Fast:**
- No meetings needed
- No scheduling required
- Happens in minutes, not days
- Doesn't cost much (unlike meetings)

**But You Stay in the Loop:**
- You review agent work and results
- You pour over outputs again and again
- You don't just let agents fight it out
- You verify one more time before turning PRD into plan

**Results**: Thorough validation quickly, but with human oversight.

**This is what happens with fast multi-agent validation.**

The difference? Speed and collaboration. You get thorough validation without endless meetings, but you stay involved to ensure quality.

## PART 2: THE TECHNICAL IMPLEMENTATION

### Multi-Agent Review Patterns

Use multiple agents for validation:

**1. Two-Agent PRD Review**
- One agent builds/creates
- One agent critiques/reviews
- Collaborative questioning, not adversarial

**2. Reverse Questioning**
- Question Agent A's work with Agent B
- Question Agent B's work with Agent A
- Get multiple perspectives

**3. Implementation Evaluation**
- Evaluate implementation against plan
- Check for gaps
- Identify missing features

### Collaborative Questioning (Not Adversarial)

The key is collaborative questioning:

**Questions to Ask:**
- "What do you think about this approach?"
- "What improvements would you make?"
- "Did they miss anything?"
- "Is this complete?"
- "What could go wrong?"

**Not Adversarial:**
- Not "this is wrong"
- Not "this is bad"
- But "what do you think?" and "how can we improve?"

### Fast and Cost-Effective

Multi-agent validation is:

**Fast:**
- Minutes, not days
- No scheduling needed
- No meetings required

**Cost-Effective:**
- Doesn't cost much (unlike meetings)
- No travel, no scheduling overhead
- Just agent interactions

**But Still Thorough:**
- Multiple perspectives
- Collaborative questioning
- Gap identification
- Continuous improvement

### CRITICAL: Developer Must Stay in Loop

**Don't Just Let Agents Fight It Out:**

- Review agent work and results
- Pour over agent outputs again and again
- Verify one more time before turning PRD into plan
- Especially verify at critical decision points

**Human Oversight is Essential:**

- Agents are tools, not replacements
- You need to verify their work
- You need to make final decisions
- You need to ensure quality

**Especially at Critical Points:**

- Before turning PRD into plan
- Before major decisions
- Before implementation starts
- At key milestones

### Continuous Questioning Throughout Development

Questioning shouldn't stop after PRD validation:

**During Planning:**
- "Is this plan complete?"
- "Are we missing anything?"
- "What could go wrong?"

**During Implementation:**
- "Does this match the plan?"
- "Are we on track?"
- "What gaps are we creating?"

**After Implementation:**
- "Did we build what we planned?"
- "What's missing?"
- "What needs fixing?"

### Gap Identification and Fixing

Multi-agent validation helps identify gaps:

**1. Requirement Gaps**
- Missing requirements
- Unclear requirements
- Conflicting requirements

**2. Implementation Gaps**
- What was planned vs what was built
- Missing features
- Incomplete solutions

**3. Quality Gaps**
- Missing tests
- Incomplete error handling
- Security issues

Then fix them. Continuously. Throughout development.

### Building on Previous Guardrails

This validation builds on everything:

- **Good Prompt** (Post 01): Foundation
- **PRD and Plan** (Post 02): What to validate
- **Right LLM** (Post 03): Right agents for validation
- **Context** (Post 04): Agents with codebase awareness
- **Process** (Post 05): Systematic validation process
- **Questioning** (This post): Multi-agent validation with human oversight

But even with good validation, you need ongoing vigilance. You need monitoring. That's next.

---

**Next**: [07-Ongoing-Vigilance-Code-Monitoring-and-Hardening.md](07-Ongoing-Vigilance-Code-Monitoring-and-Hardening.md)  
**Previous**: [05-The-Process-Building-and-Evaluating.md](05-The-Process-Building-and-Evaluating.md)

