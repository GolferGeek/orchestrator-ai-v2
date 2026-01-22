# Assignments for Students

Progressive difficulty assignments for learning Orchestrator AI.

## Assignment 1: Setup & Exploration (Beginner)

**Objective**: Get the platform running and explore demo agents

**Tasks**:
1. Set up Orchestrator AI using student quick-start
2. Log in and explore the web UI
3. Try the hello-world example agent
4. Document what each agent does

**Deliverables**:
- Screenshot of running platform
- List of 3 agents tried with descriptions
- Brief reflection on platform capabilities

**Grading Rubric**:
- Setup complete (40%)
- Agents explored (30%)
- Documentation quality (30%)

**Estimated Time**: 1-2 hours

---

## Assignment 2: Create Your First Agent (Beginner)

**Objective**: Create a simple functional agent

**Tasks**:
1. Study the Hello World agent
2. Create a new agent for a specific purpose (e.g., "Study Helper", "Code Explainer")
3. Define IO schema (input/output structure)
4. Write an effective context prompt
5. Test the agent with multiple prompts
6. Iterate based on results

**Deliverables**:
- Agent created in database (screenshot of agent in web UI or database record)
- Screenshot of agent working
- Brief explanation of agent purpose
- Reflection on prompt engineering

**Note**: In v2, agents are stored in the database, not as JSON files. You can export the agent definition if needed for documentation.

**Grading Rubric**:
- Agent functionality (40%)
- IO schema design (20%)
- Context prompt quality (20%)
- Documentation (20%)

**Estimated Time**: 2-3 hours

---

## Assignment 3: Multi-Agent Workflow (Intermediate)

**Objective**: Create agents that work together

**Tasks**:
1. Design a workflow requiring 2-3 agents
2. Create each agent with appropriate capabilities
3. Implement agent-to-agent communication
4. Test the complete workflow
5. Handle errors gracefully

**Example Workflows**:
- Research → Write → Edit (blog post creation)
- Analyze → Recommend → Execute (decision support)
- Extract → Transform → Load (data processing)

**Deliverables**:
- Workflow diagram
- All agents created in database (screenshots or exported definitions)
- Demonstration of workflow
- Error handling documentation

**Note**: Agents are stored in the database. You can document them with screenshots or export their definitions.

**Grading Rubric**:
- Workflow design (30%)
- Agent implementation (30%)
- Integration quality (20%)
- Error handling (20%)

**Estimated Time**: 4-6 hours

---

## Assignment 4: RAG-Enabled Agent (Intermediate)

**Objective**: Build an agent that uses retrieval-augmented generation

**Tasks**:
1. Create a RAG collection
2. Upload relevant documents
3. Create an agent that uses the RAG collection
4. Test agent with questions requiring document knowledge
5. Compare responses with and without RAG

**Deliverables**:
- RAG collection with documents
- Agent configuration
- Test cases (with/without RAG)
- Analysis of RAG impact

**Grading Rubric**:
- RAG setup (30%)
- Agent integration (30%)
- Testing thoroughness (20%)
- Analysis quality (20%)

**Estimated Time**: 3-4 hours

---

## Assignment 5: Framework Integration (Advanced)

**Objective**: Create an agent using LangGraph or n8n

**Tasks**:
1. Choose a framework (LangGraph or n8n)
2. Design a multi-step agent workflow
3. Implement the workflow in chosen framework
4. Integrate with Orchestrator AI platform
5. Test and document the integration

**Deliverables**:
- Workflow implementation
- Integration code/config
- Documentation of integration process
- Demonstration

**Grading Rubric**:
- Workflow complexity (30%)
- Integration quality (30%)
- Code/documentation (20%)
- Testing (20%)

**Estimated Time**: 6-8 hours

---

## Assignment 6: Production-Ready Agent (Advanced)

**Objective**: Build and deploy a production-quality agent

**Tasks**:
1. Design agent for real-world use case
2. Implement comprehensive error handling
3. Add proper logging and observability
4. Configure RBAC permissions
5. Write unit tests
6. Deploy to staging environment
7. Create user documentation

**Deliverables**:
- Production-ready agent
- Test suite
- Deployment configuration
- User documentation
- Performance metrics

**Grading Rubric**:
- Functionality (25%)
- Code quality (25%)
- Testing (20%)
- Documentation (15%)
- Deployment (15%)

**Estimated Time**: 10-12 hours

---

## Assignment 7: Security & Compliance (Advanced)

**Objective**: Implement security best practices

**Tasks**:
1. Configure PII handling for your agent
2. Set up proper RBAC roles
3. Implement organization isolation
4. Add audit logging
5. Test security controls
6. Document security measures

**Deliverables**:
- Security configuration
- Test cases demonstrating security
- Security documentation
- Compliance checklist

**Grading Rubric**:
- Security implementation (40%)
- Testing (30%)
- Documentation (30%)

**Estimated Time**: 4-6 hours

---

## Assignment Templates

### Agent Design Document Template

```markdown
# Agent: [Name]

## Purpose
[What does this agent do?]

## Use Cases
1. [Use case 1]
2. [Use case 2]

## Input Schema
[Describe inputs]

## Output Schema
[Describe outputs]

## Context Prompt
[Agent's system prompt]

## Capabilities
- [Capability 1]
- [Capability 2]

## LLM Configuration
- Provider: [provider]
- Model: [model]
- Temperature: [value]

## Testing
[Test cases and results]
```

### Reflection Template

```markdown
# Assignment Reflection

## What Worked Well
[What went smoothly?]

## Challenges Encountered
[What was difficult?]

## What You Learned
[Key takeaways]

## Questions
[Remaining questions]

## Next Steps
[What would you do next?]
```

## Grading Guidelines

### Excellent (A)
- All requirements met
- Code/documentation is clear and well-organized
- Demonstrates understanding of concepts
- Goes beyond requirements

### Good (B)
- Most requirements met
- Code/documentation is mostly clear
- Shows understanding of core concepts
- Minor issues present

### Satisfactory (C)
- Basic requirements met
- Code/documentation needs improvement
- Shows basic understanding
- Some issues present

### Needs Improvement (D/F)
- Requirements not met
- Code/documentation unclear
- Lacks understanding
- Significant issues

## Solution Guides (For Instructors)

Solution guides are available for instructors. Contact: golfergeek@orchestratorai.io

**Note**: Solutions should not be shared with students. Use for:
- Understanding expected outcomes
- Providing hints when students are stuck
- Creating variations of assignments

---

**Remember**: These assignments are designed to be progressive. Students should complete them in order, building on previous knowledge.
