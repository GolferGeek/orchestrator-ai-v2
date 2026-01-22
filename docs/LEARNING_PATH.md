# Learning Path

Progressive learning tracks for mastering Orchestrator AI, from beginner to advanced.

## Overview

This learning path is designed to take you from zero to proficient in building and deploying AI agents with Orchestrator AI.

## Beginner Track

**Goal**: Get the platform running and create your first agent

### Week 1: Setup & Exploration

**Objectives**:
- Set up the development environment
- Understand the platform architecture
- Explore demo agents

**Activities**:
1. ✅ Complete [Quick Start Guide](QUICK_START_STUDENTS.md)
2. ✅ Run diagnostics: `npm run diagnostics`
3. ✅ Explore the web UI
4. ✅ Try demo agents in the catalog
5. ✅ Read [Architecture Overview](ARCHITECTURE.md) (high-level)

**Checkpoint**: Can you log in, navigate the UI, and interact with a demo agent?

### Week 2: Your First Agent

**Objectives**:
- Understand agent structure
- Create a simple agent
- Test and iterate

**Activities**:
1. ✅ Complete [Build Your First Agent Tutorial](tutorials/BUILD_FIRST_AGENT.md)
2. ✅ Study the Hello World example (`demo-agents/hello-world/`) - Reference structure for database-driven agents
3. ✅ Modify the Hello World agent's context prompt
4. ✅ Create a custom greeting agent
5. ✅ Test via web UI and API

**Checkpoint**: Can you create, modify, and test a simple agent?

### Week 3: Understanding Agents

**Objectives**:
- Deep dive into agent components
- Understand IO schemas
- Learn about capabilities

**Activities**:
1. ✅ Study the hello-world example and understand its structure
2. ✅ Understand IO schema design patterns
3. ✅ Experiment with different LLM models
4. ✅ Modify agent capabilities
5. ✅ Study the hello-world example in `demo-agents/hello-world/` - Understand agent structure (agents are stored in database, not files)

**Checkpoint**: Can you explain each component of an agent and modify them effectively?

---

## Intermediate Track

**Goal**: Build production-ready agents and understand advanced features

### Week 4: Multi-Agent Workflows

**Objectives**:
- Understand agent-to-agent communication
- Build agent chains
- Handle workflow orchestration

**Activities**:
1. ✅ Study Marketing Swarm workflow
2. ✅ Understand A2A protocol
3. ✅ Create a simple agent chain
4. ✅ Handle agent responses and errors
5. ✅ Read [Architecture Guide](ARCHITECTURE.md) (agent execution section)

**Checkpoint**: Can you create agents that work together?

### Week 5: RAG Integration

**Objectives**:
- Understand RAG concepts
- Connect agents to knowledge bases
- Use advanced RAG strategies

**Activities**:
1. ✅ Create a RAG collection
2. ✅ Upload documents
3. ✅ Connect an agent to RAG
4. ✅ Experiment with different RAG strategies
5. ✅ Read RAG documentation in `docs/`

**Checkpoint**: Can you build an agent that uses RAG for context?

### Week 6: RBAC & Security

**Objectives**:
- Understand role-based access control
- Configure organization permissions
- Implement security best practices

**Activities**:
1. ✅ Study RBAC system
2. ✅ Create custom roles
3. ✅ Assign permissions
4. ✅ Test access control
5. ✅ Read security documentation

**Checkpoint**: Can you configure proper access control for agents?

### Week 7: Framework Integration

**Objectives**:
- Understand framework-agnostic design
- Create LangGraph agents
- Create n8n workflows

**Activities**:
1. ✅ Study LangGraph agent examples
2. ✅ Create a simple LangGraph agent
3. ✅ Study n8n workflow examples
4. ✅ Create a simple n8n workflow
5. ✅ Understand adapter/runner pattern

**Checkpoint**: Can you create agents using different frameworks?

---

## Advanced Track

**Goal**: Master production deployment and advanced patterns

### Week 8: Production Deployment

**Objectives**:
- Understand production requirements
- Deploy to production environment
- Configure monitoring and observability

**Activities**:
1. ✅ Read [Production Deployment Guide](../deployment/PRODUCTION_DEPLOYMENT.md)
2. ✅ Set up production database
3. ✅ Configure environment variables
4. ✅ Set up monitoring
5. ✅ Deploy to staging environment

**Checkpoint**: Can you deploy the platform to production?

### Week 9: Advanced RAG Strategies

**Objectives**:
- Implement advanced RAG patterns
- Optimize retrieval performance
- Handle complex document types

**Activities**:
1. ✅ Implement Parent Document RAG
2. ✅ Use Multi-Query RAG
3. ✅ Implement Hybrid Search
4. ✅ Add Reranking
5. ✅ Optimize embedding models

**Checkpoint**: Can you implement and optimize advanced RAG strategies?

### Week 10: Custom Framework Integration

**Objectives**:
- Create custom agent runners
- Integrate new frameworks
- Extend platform capabilities

**Activities**:
1. ✅ Study runner/adapter architecture
2. ✅ Create a custom runner
3. ✅ Integrate a new framework
4. ✅ Test integration
5. ✅ Document the integration

**Checkpoint**: Can you add support for a new agent framework?

### Week 11: Performance Optimization

**Objectives**:
- Optimize agent execution
- Improve response times
- Handle scale

**Activities**:
1. ✅ Profile agent performance
2. ✅ Optimize LLM calls
3. ✅ Implement caching
4. ✅ Handle concurrent requests
5. ✅ Load testing

**Checkpoint**: Can you optimize agents for production scale?

### Week 12: Security Hardening

**Objectives**:
- Implement security best practices
- Handle PII properly
- Audit and compliance

**Activities**:
1. ✅ Review security documentation
2. ✅ Implement PII handling
3. ✅ Configure encryption
4. ✅ Set up audit logging
5. ✅ Security audit

**Checkpoint**: Can you harden the platform for enterprise use?

---

## Learning Resources by Topic

### Setup & Configuration
- [Quick Start Guide](QUICK_START_STUDENTS.md)
- [Getting Started Guide](../GETTING_STARTED.md)
- [Prerequisites Guide](PREREQUISITES.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

### Agent Development
- [Build Your First Agent](tutorials/BUILD_FIRST_AGENT.md)
- [Examples Guide](EXAMPLES.md)
- [Hello World Agent](../demo-agents/hello-world/)

### Architecture & Design
- [Architecture Guide](../ARCHITECTURE.md)
- [Code Tour](CODE_TOUR.md) (coming soon)

### Advanced Topics
- [Production Deployment](../deployment/PRODUCTION_DEPLOYMENT.md)
- [Enterprise Hardening](../docs/ENTERPRISE_HARDENING_ASSESSMENT.md)
- RAG documentation (in `docs/`)

---

## Self-Assessment

### Beginner Level
- [ ] Can set up the platform
- [ ] Can create a simple agent
- [ ] Understands agent components
- [ ] Can modify agent behavior

### Intermediate Level
- [ ] Can build multi-agent workflows
- [ ] Can integrate RAG
- [ ] Understands RBAC
- [ ] Can use multiple frameworks

### Advanced Level
- [ ] Can deploy to production
- [ ] Can optimize performance
- [ ] Can implement advanced RAG
- [ ] Can extend platform capabilities

---

## Next Steps

1. **Choose your track** based on your goals
2. **Follow the activities** week by week
3. **Complete checkpoints** before moving on
4. **Build projects** to reinforce learning
5. **Contribute** to the project to deepen understanding

---

**Remember**: Learning is iterative. Don't hesitate to revisit earlier topics as you gain more experience!
