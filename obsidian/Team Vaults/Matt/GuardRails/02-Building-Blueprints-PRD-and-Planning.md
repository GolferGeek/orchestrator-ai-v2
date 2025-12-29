# Building Blueprints: PRD and Planning

In the old world, we'd write Product Requirements Documents (PRDs). We'd spend time thinking through requirements, edge cases, and dependencies. Then we'd break it down into a plan. Today, with AI coding assistants, it's tempting to skip this step—just give them a prompt and let them build. But that's like asking a contractor to build a house without blueprints.

Let me show you what happens when we skip the blueprint—and why it matters.

## PART 1: THE METAPHOR (Manager and Contractor)

### Scene 1: Without PRD/Plan

You've got a good prompt now (from Post 01). You've given the contractor context, requirements, examples. They're ready to build. But you haven't created a PRD. You haven't made a plan.

"Here's what I need," you say. "Build a user authentication system that supports OAuth, handles sessions, and integrates with our existing user database. Go build it."

The contractor starts building. They're capable, remember? They make decisions as they go:

- They implement OAuth, but maybe not all the providers you need
- They handle sessions, but maybe not the way you expected
- They integrate with the database, but maybe miss some edge cases
- They prioritize features, but maybe not the ones you'd prioritize

A week later, they come back with something. It works. But:

- Missing edge cases (password reset flow? Account lockout? Session timeout handling?)
- Wrong priorities (they built the fancy OAuth flow first, but you needed basic login working)
- Incomplete understanding (they didn't realize you needed to support legacy authentication too)
- Needs major revisions (the session handling doesn't work with your load balancer setup)

Now you're explaining what's missing. They're reworking things. You're both frustrated because you thought you'd communicated everything in the prompt.

**This is what happens without a PRD and plan.**

### Scene 2: With Comprehensive PRD and Plan

Same contractor. Same capability. But this time, before they start building, you sit down together and you've prepared:

**A Well-Thought-Out, Corroborated PRD:**

The PRD includes:

- **Requirements**: What exactly needs to be built
  - OAuth support for Google, GitHub, and Microsoft
  - Session management with Redis
  - Integration with existing user database
  - Support for legacy authentication methods
  - Password reset flow
  - Account lockout after failed attempts
  - Session timeout after 30 minutes of inactivity

- **Constraints**: What limitations exist
  - Must work with existing load balancer (sticky sessions)
  - Must support existing user migration
  - Must comply with security standards
  - Must handle 10,000 concurrent users

- **Edge Cases**: What could go wrong
  - What if OAuth provider is down?
  - What if Redis is unavailable?
  - What if user tries to login from multiple devices?
  - What if session expires mid-request?

- **Success Criteria**: How we'll know it's done
  - All OAuth providers working
  - Session management tested under load
  - Legacy authentication still works
  - Security audit passed

**A Plan That Breaks Down the Work:**

The plan sequences the work:

1. **Phase 1**: Basic authentication (legacy support first)
2. **Phase 2**: Session management foundation
3. **Phase 3**: OAuth integration (one provider at a time)
4. **Phase 4**: Edge case handling
5. **Phase 5**: Testing and hardening

Each phase has dependencies. Each phase has clear deliverables. Each phase builds on the previous one.

The contractor follows the plan. They deliver:

- Complete solution with all requirements
- Proper prioritization (legacy support first, then new features)
- All edge cases handled
- Proper testing at each phase

**This is what happens with a PRD and plan.**

The difference? The blueprint. The contractor was just as capable in both scenarios—the difference was having a comprehensive plan to follow.

## PART 2: THE TECHNICAL IMPLEMENTATION

### Why PRDs Matter for AI-Assisted Development

In traditional development, PRDs help align teams. In AI-assisted development, PRDs help align the AI assistant with your actual needs. Without a PRD, the AI makes assumptions. With a PRD, the AI has a blueprint.

A good PRD includes:

**1. Requirements**
- Functional requirements (what it should do)
- Non-functional requirements (performance, security, scalability)
- Integration requirements (how it connects to other systems)

**2. Constraints**
- Technical constraints (technology stack, infrastructure)
- Business constraints (timeline, budget, resources)
- Compliance constraints (security, privacy, regulations)

**3. Edge Cases**
- Error scenarios
- Failure modes
- Unusual user behaviors
- System limitations

**4. Success Criteria**
- How you'll measure success
- What "done" looks like
- Acceptance criteria

**5. Stakeholder Validation**
- Who needs to approve this?
- What questions need to be answered?
- What assumptions need to be validated?

### Converting PRD to Plan

A PRD tells you *what* to build. A plan tells you *how* to build it.

A good plan:

**1. Breaks Down Work into Phases**
- Logical groupings of related work
- Clear dependencies between phases
- Deliverables for each phase

**2. Sequences Work Properly**
- Foundation first (can't build OAuth before basic auth)
- Dependencies respected (can't test before building)
- Risk mitigation (handle hard parts early)

**3. Defines Deliverables**
- What gets delivered at each phase
- How you'll know a phase is complete
- What can be tested at each stage

**4. Identifies Dependencies**
- What needs to happen first
- What blocks other work
- What can happen in parallel

### The Power of Planning

When you have a plan, the AI assistant can:

- Work systematically through phases
- Understand dependencies
- Deliver complete solutions
- Avoid rework

When you don't have a plan, the AI assistant:

- Makes assumptions about priorities
- Misses dependencies
- Delivers incomplete solutions
- Requires rework

### Building on Previous Guardrails

A good PRD builds on a good prompt (Post 01). The prompt gives context. The PRD gives structure. Together, they provide the foundation for everything else.

But even with a good prompt and PRD, you still need to choose the right tool for the job. That's next.

---

**Next**: [03-Choosing-Your-Tool-LLM-Selection.md](03-Choosing-Your-Tool-LLM-Selection.md)  
**Previous**: [01-Foundation-The-Power-of-a-Good-Prompt.md](01-Foundation-The-Power-of-a-Good-Prompt.md)

