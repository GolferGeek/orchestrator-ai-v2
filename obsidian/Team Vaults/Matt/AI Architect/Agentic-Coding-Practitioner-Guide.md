# Agentic Coding Practitioner Guide: Complete Reference

**Date:** 2025-01-27  
**Purpose:** Excellent practitioner-level understanding of agentic coding for AI Solutions Architect conversations

---

## Table of Contents

1. [What is Agentic Coding?](#what-is-agentic-coding)
2. [Latest Tools & News](#latest-tools--news)
3. [Guardrails & Onboarding](#guardrails--onboarding)
4. [PRD → Plan → Code Review → PRD Workflow](#prd--plan--code-review--prd-workflow)
5. [Interview Questions & Answers](#interview-questions--answers)
6. [Best Practices](#best-practices)

---

## What is Agentic Coding?

### High-Level Overview

**Agentic Coding** is using AI agents to write, review, and maintain code. It's not just code completion—it's AI agents that can:
- Understand requirements
- Plan implementations
- Write code
- Review code
- Generate documentation
- Refactor systems

**Key Characteristics:**
- **Autonomous:** Agents can work independently
- **Tool-Using:** Agents use tools (MCP, APIs, databases)
- **Multi-Step:** Agents break down complex tasks
- **Context-Aware:** Agents understand codebase structure
- **Iterative:** Agents refine based on feedback

### Your Guardrails Approach

**Progressive Context Structure:**
```
Rules (Foundation)
    ↓
Commands (User Shortcuts)
    ↓
Skills (Task-Specific Prescriptions)
    ↓
Agents (Environment-Specialized)
```

**Why This Works:**
- **Rules:** Foundation patterns (always applied)
- **Commands:** User shortcuts (`/commit`, `/deploy`)
- **Skills:** Task-specific guidance (PRD creation, testing)
- **Agents:** Specialized workflows (PR review, refactoring)

---

## Latest Tools & News

### Current Tools (2025)

**1. Claude Code (Anthropic)**
- **Strengths:** Excellent with built-in tools, comprehensive context
- **Weaknesses:** Less adept with MCP tools
- **Best For:** General coding, built-in tool ecosystem

**2. Cursor**
- **Strengths:** MCP tool integration, external APIs
- **Weaknesses:** May be overkill for simple tasks
- **Best For:** MCP tool integration, complex workflows

**3. GitHub Copilot**
- **Strengths:** Integrated with GitHub, code completion
- **Weaknesses:** Less autonomous, more assistive
- **Best For:** Code completion, inline suggestions

**4. Codeium**
- **Strengths:** Free, multi-model support
- **Weaknesses:** Less advanced than premium tools
- **Best For:** Budget-conscious teams

### Latest News & Trends (2025)

**1. MCP Adoption**
- Model Context Protocol gaining traction
- Standardized tool integration
- Cross-platform compatibility

**2. A2A Protocol**
- Agent-to-agent communication standardizing
- JSON-RPC 2.0 as transport
- Ecosystem growth

**3. Multi-Model Strategies**
- Teams using multiple LLMs
- Right model for right task
- Cost optimization

**4. Guardrails Focus**
- More emphasis on safety
- Systematic approaches
- Validation workflows

**5. RAG Integration**
- Code-aware RAG systems
- Context management
- Knowledge bases

---

## Guardrails & Onboarding

### Your Guardrails Series

**7-Post Series:**

1. **Foundation: The Power of a Good Prompt**
   - Structured, specific prompts
   - Context and examples
   - Clear requirements

2. **Building Blueprints: PRD and Planning**
   - Well-thought-out PRDs
   - Actionable plans
   - Clear specifications

3. **Choosing Your Tool: LLM Selection**
   - Match LLM to task
   - Consider speed, cost, capabilities
   - Right tool for right job

4. **Context is King: Coding Rules, Skills, and Agents**
   - Progressive context structure
   - Rules → Commands → Skills → Agents
   - Context prevents mistakes

5. **The Process: Building and Evaluating**
   - Systematic guardrail creation
   - Automated PR evaluation
   - Quality assurance

6. **Question Everything: Validation and Review**
   - Multi-agent validation
   - Human oversight
   - Fast, thorough review

7. **Ongoing Vigilance: Code Monitoring and Hardening**
   - Continuous monitoring
   - Automated hardening
   - Prevent issues early

### Onboarding Agents

**Key Principles:**

1. **Start with Rules:**
   - Foundation patterns
   - Always applied
   - Codebase standards

2. **Add Commands:**
   - User shortcuts
   - Common workflows
   - Time savers

3. **Create Skills:**
   - Task-specific guidance
   - Reusable patterns
   - Best practices

4. **Build Agents:**
   - Specialized workflows
   - Complex tasks
   - End-to-end automation

**Example Onboarding:**
```
1. Rules: Code style, patterns, architecture
2. Commands: /commit, /deploy, /test
3. Skills: PRD creation, testing, refactoring
4. Agents: PR review, security audit, migration
```

---

## PRD → Plan → Code Review → PRD Workflow

### The Complete Cycle

**1. PRD Generation**
- **Input:** Requirements, user needs
- **Process:** AI generates PRD
- **Output:** Structured PRD document
- **Review:** Human review and refinement

**2. Plan Creation**
- **Input:** PRD
- **Process:** AI breaks down into tasks
- **Output:** Implementation plan
- **Review:** Human approval

**3. Code Implementation**
- **Input:** Plan
- **Process:** AI writes code
- **Output:** Code implementation
- **Review:** Code review

**4. Code Review**
- **Input:** Code
- **Process:** AI reviews code
- **Output:** Review feedback
- **Review:** Human final approval

**5. PRD Evaluation**
- **Input:** Completed implementation
- **Process:** AI evaluates against PRD
- **Output:** Evaluation report
- **Review:** Human decision (close or send back)

### Detailed Workflow

#### Step 1: PRD Generation

**Process:**
```python
def generate_prd(requirements: str) -> PRD:
    prompt = f"""
    Generate a PRD based on these requirements:
    {requirements}
    
    Include:
    - Overview
    - Goals
    - Requirements
    - Success criteria
    - Technical constraints
    """
    
    prd = llm.generate(prompt)
    return validate_prd(prd)
```

**Review Criteria:**
- Clear goals
- Specific requirements
- Measurable success criteria
- Technical feasibility

#### Step 2: Plan Creation

**Process:**
```python
def create_plan(prd: PRD) -> Plan:
    prompt = f"""
    Create an implementation plan for this PRD:
    {prd}
    
    Break down into:
    - Tasks
    - Dependencies
    - Estimates
    - Technical approach
    """
    
    plan = llm.generate(prompt)
    return validate_plan(plan)
```

**Review Criteria:**
- Tasks are actionable
- Dependencies clear
- Estimates reasonable
- Technical approach sound

#### Step 3: Code Implementation

**Process:**
```python
def implement_code(plan: Plan) -> Code:
    for task in plan.tasks:
        code = llm.generate(f"""
        Implement this task:
        {task}
        
        Follow codebase patterns:
        {codebase_rules}
        
        Use these examples:
        {similar_code_examples}
        """)
        
        validate_code(code)
        commit_code(code)
```

**Review Criteria:**
- Follows codebase patterns
- Meets requirements
- Includes tests
- Proper error handling

#### Step 4: Code Review

**Process:**
```python
def review_code(code: Code, prd: PRD) -> Review:
    prompt = f"""
    Review this code against the PRD:
    
    PRD Requirements:
    {prd.requirements}
    
    Code:
    {code}
    
    Check for:
    - Requirements coverage
    - Code quality
    - Security issues
    - Performance concerns
    - Test coverage
    """
    
    review = llm.generate(prompt)
    return validate_review(review)
```

**Review Criteria:**
- Requirements met
- Code quality high
- Security addressed
- Performance acceptable
- Tests adequate

#### Step 5: PRD Evaluation

**Process:**
```python
def evaluate_prd(implementation: Code, prd: PRD) -> Evaluation:
    prompt = f"""
    Evaluate this implementation against the PRD:
    
    PRD Goals:
    {prd.goals}
    
    PRD Requirements:
    {prd.requirements}
    
    Implementation:
    {implementation}
    
    Determine:
    - Requirements met?
    - Goals achieved?
    - Quality acceptable?
    - Ready to close?
    """
    
    evaluation = llm.generate(prompt)
    return evaluation
```

**Decision:**
- **Close:** Requirements met, quality acceptable
- **Send Back:** Missing requirements, quality issues

---

## Interview Questions & Answers

### High-Level Questions

**Q: What is agentic coding and how does it differ from traditional coding?**
**A:**
**Agentic Coding:**
- AI agents write, review, maintain code
- Autonomous agents with tools
- Multi-step reasoning
- Context-aware
- Iterative refinement

**Traditional Coding:**
- Human writes code
- Deterministic logic
- Manual review
- Static code
- Human iteration

**Key Differences:**
- **Autonomy:** Agents work independently
- **Tool Use:** Agents use tools (MCP, APIs)
- **Context:** Agents understand codebase
- **Speed:** Faster iteration
- **Scale:** Can handle more tasks

**Q: What are the latest tools for agentic coding?**
**A:**
**Current Tools (2025):**

1. **Claude Code:**
   - Excellent with built-in tools
   - Comprehensive context
   - Best for general coding

2. **Cursor:**
   - MCP tool integration
   - External API support
   - Best for complex workflows

3. **GitHub Copilot:**
   - Integrated with GitHub
   - Code completion focus
   - Best for inline suggestions

4. **Codeium:**
   - Free option
   - Multi-model support
   - Best for budget teams

**Trends:**
- MCP adoption growing
- A2A protocol standardizing
- Multi-model strategies
- Guardrails focus
- RAG integration

**Q: How do you onboard agents for a codebase?**
**A:**
**Progressive Context Structure:**

1. **Rules (Foundation):**
   - Code style
   - Architecture patterns
   - Always applied
   - Codebase standards

2. **Commands (User Shortcuts):**
   - `/commit` - Commit workflow
   - `/deploy` - Deployment
   - `/test` - Testing
   - Common workflows

3. **Skills (Task-Specific):**
   - PRD creation
   - Testing patterns
   - Refactoring
   - Reusable patterns

4. **Agents (Specialized):**
   - PR review agent
   - Security audit agent
   - Migration agent
   - End-to-end workflows

**Onboarding Process:**
1. Start with rules (foundation)
2. Add commands (shortcuts)
3. Create skills (patterns)
4. Build agents (workflows)

### Mid-Level Technical Questions

**Q: How does the PRD → Plan → Code Review → PRD workflow work?**
**A:**
**Complete Cycle:**

1. **PRD Generation:**
   - AI generates PRD from requirements
   - Human reviews and refines
   - Structured document

2. **Plan Creation:**
   - AI breaks PRD into tasks
   - Human approves plan
   - Actionable tasks

3. **Code Implementation:**
   - AI writes code per plan
   - Follows codebase patterns
   - Includes tests

4. **Code Review:**
   - AI reviews code
   - Checks requirements, quality, security
   - Human final approval

5. **PRD Evaluation:**
   - AI evaluates implementation vs PRD
   - Determines if requirements met
   - Human decision: close or send back

**Key Benefits:**
- Systematic approach
- Quality assurance
- Requirements traceability
- Continuous improvement

**Q: What guardrails are essential for agentic coding?**
**A:**
**Essential Guardrails:**

1. **Prompt Engineering:**
   - Structured prompts
   - Clear requirements
   - Context and examples

2. **Planning:**
   - PRD generation
   - Task breakdown
   - Dependency management

3. **LLM Selection:**
   - Right model for task
   - Cost optimization
   - Capability matching

4. **Context Management:**
   - Progressive context
   - Rules → Commands → Skills → Agents
   - Codebase awareness

5. **Validation:**
   - Code review
   - Requirements checking
   - Security audit

6. **Monitoring:**
   - Continuous monitoring
   - Automated hardening
   - Issue prevention

**Q: How do you ensure code quality with agentic coding?**
**A:**
**Quality Assurance:**

1. **Code Review:**
   - AI reviews code
   - Human final approval
   - Multi-perspective review

2. **Testing:**
   - Automated tests
   - Coverage requirements
   - Integration tests

3. **Validation:**
   - Requirements checking
   - Security audit
   - Performance testing

4. **Monitoring:**
   - Continuous monitoring
   - Automated alerts
   - Issue detection

5. **Iteration:**
   - Feedback loops
   - Continuous improvement
   - Refinement

---

## Best Practices

### 1. Start with Clear Requirements

**Do:**
- Write detailed PRDs
- Specify requirements clearly
- Provide examples
- Define success criteria

**Don't:**
- Vague requirements
- Assume context
- Skip examples
- Unclear success criteria

### 2. Use Progressive Context

**Do:**
- Start with rules
- Add commands
- Create skills
- Build agents

**Don't:**
- Skip foundation
- Jump to agents
- Ignore context
- One-size-fits-all

### 3. Choose Right Tools

**Do:**
- Match tool to task
- Consider cost
- Evaluate capabilities
- Test before committing

**Don't:**
- Use same tool for everything
- Ignore costs
- Assume capabilities
- Skip evaluation

### 4. Validate Continuously

**Do:**
- Review at each step
- Test thoroughly
- Check requirements
- Monitor performance

**Don't:**
- Skip reviews
- Assume correctness
- Ignore requirements
- Deploy without testing

### 5. Iterate and Improve

**Do:**
- Collect feedback
- Measure results
- Refine processes
- Update guardrails

**Don't:**
- Set and forget
- Ignore feedback
- Skip measurement
- Avoid refinement

---

## Key Takeaways

### For AI Architects

1. **Agentic Coding is Powerful:**
   - Can accelerate development
   - Requires proper guardrails
   - Needs systematic approach

2. **Guardrails are Essential:**
   - Progressive context structure
   - Validation at each step
   - Continuous monitoring

3. **Workflow Matters:**
   - PRD → Plan → Code → Review → Evaluate
   - Systematic approach
   - Quality assurance

4. **Tools are Evolving:**
   - MCP adoption growing
   - A2A standardizing
   - Multi-model strategies

5. **Best Practices:**
   - Clear requirements
   - Right tools
   - Continuous validation
   - Iterative improvement

---

## References

- **Your Guardrails:** `obsidian/Team Vaults/Matt/GuardRails/`
- **Guardrails Index:** `obsidian/Team Vaults/Matt/GuardRails/00-Index-Guardrails-Overview.md`
- **Prompt Foundation:** `obsidian/Team Vaults/Matt/GuardRails/01-Foundation-The-Power-of-a-Good-Prompt.md`
- **LLM Selection:** `obsidian/Team Vaults/Matt/GuardRails/03-Choosing-Your-Tool-LLM-Selection.md`

---

**See Also:**
- [LLM-Development-Fundamentals.md](./LLM-Development-Fundamentals.md) - LLM development basics
- [MCP-Architecture-Deep-Dive.md](./MCP-Architecture-Deep-Dive.md) - MCP protocol
- [A2A-Protocol-Deep-Dive.md](./A2A-Protocol-Deep-Dive.md) - A2A protocol

