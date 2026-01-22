# Workshop Guide for Educators

A 2-hour workshop outline for teaching Orchestrator AI to students.

## Workshop Overview

**Duration**: 2 hours  
**Audience**: Students with basic programming knowledge  
**Prerequisites**: Docker Desktop installed, basic command line familiarity

## Learning Objectives

By the end of this workshop, students will be able to:
1. Set up Orchestrator AI using Docker Compose
2. Understand the basic architecture of AI agent platforms
3. Create and test a simple agent
4. Modify agent behavior through prompts
5. Understand the role of RAG and local LLMs in AI systems

## Workshop Structure

### Part 1: Introduction & Setup (30 minutes)

#### Slide Deck Outline

1. **What is Orchestrator AI?** (5 min)
   - Enterprise AI agent platform
   - Inside-the-firewall security
   - Framework-agnostic design

2. **Why Local LLMs?** (5 min)
   - Data sovereignty
   - Privacy and security
   - Cost control

3. **Architecture Overview** (10 min)
   - Platform components
   - Agent execution flow
   - Security layers

4. **Hands-On Setup** (10 min)
   - Clone repository
   - Run student setup script
   - Verify installation

**Activity**: Students run `./scripts/setup-student.sh` and verify services are running.

### Part 2: Exploring the Platform (30 minutes)

#### Activities

1. **Login & Navigation** (10 min)
   - Log in with demo credentials
   - Explore web UI
   - Navigate agent catalog

2. **Try Example Agents** (15 min)
   - Explore agents in the catalog
   - Understand different agent types (context, API, RAG)

3. **Understand Agent Structure** (5 min)
   - View agent details
   - Understand IO schema
   - See context prompts

**Activity**: Students interact with the hello-world agent and document how it works.

### Part 3: Building Your First Agent (45 minutes)

#### Step-by-Step

1. **Study Hello World Agent** (10 min)
   - Review the hello-world example at `demo-agents/hello-world/` (shows agent structure - agents are stored in database in v2)
   - Understand each component
   - Identify key fields

2. **Create Custom Agent** (20 min)
   - Copy Hello World agent
   - Modify context prompt
   - Change capabilities
   - Register agent

3. **Test Your Agent** (10 min)
   - Test via web UI
   - Test via API (optional)
   - Iterate on prompt

4. **Share & Discuss** (5 min)
   - Students share their agents
   - Discuss what worked
   - Discuss challenges

**Activity**: Each student creates a unique agent (e.g., "Study Helper", "Code Explainer", "Writing Assistant").

### Part 4: Advanced Concepts & Wrap-Up (15 minutes)

#### Topics

1. **RAG Integration** (5 min)
   - What is RAG?
   - How to connect agents to knowledge bases
   - Demo RAG-enabled agent

2. **Multi-Agent Workflows** (5 min)
   - Agent-to-agent communication
   - Workflow orchestration
   - Real-world examples

3. **Wrap-Up & Next Steps** (5 min)
   - Review learning objectives
   - Resources for continued learning
   - Q&A

## Hands-On Exercises

### Exercise 1: Setup Verification

**Goal**: Verify installation works

**Steps**:
1. Run `npm run diagnostics`
2. Check all services are running
3. Access web UI
4. Log in successfully

**Success Criteria**: All checks pass, can log in

### Exercise 2: Agent Exploration

**Goal**: Understand different agent types

**Steps**:
1. Find 3 different agents in catalog
2. Try each agent with a test prompt
3. Compare their responses
4. Document differences

**Success Criteria**: Can identify different agent capabilities

### Exercise 3: Agent Creation

**Goal**: Create a functional agent

**Steps**:
1. Study Hello World agent structure
2. Create a new agent in the database (via web UI, API, or SQL)
3. Modify context prompt for your use case
4. Register agent in platform
5. Test agent works

**Success Criteria**: Agent responds correctly to prompts

### Exercise 4: Prompt Engineering

**Goal**: Understand how prompts affect behavior

**Steps**:
1. Create agent with professional tone
2. Test with sample prompts
3. Modify to casual tone
4. Test again
5. Compare responses

**Success Criteria**: Can explain how prompt changes affect output

## Assessment

### Formative Assessment (During Workshop)

- **Checkpoint 1**: Can students access the platform?
- **Checkpoint 2**: Can students interact with the hello-world agent?
- **Checkpoint 3**: Can students create a working agent?

### Summative Assessment (After Workshop)

**Assignment**: Create a specialized agent for a specific use case

**Requirements**:
- Agent has clear purpose
- IO schema is well-defined
- Context prompt is effective
- Agent works correctly
- Documentation explains the agent

**Rubric**:
- Functionality (40%): Agent works as intended
- Design (30%): Clear purpose and good structure
- Documentation (20%): Well-documented
- Creativity (10%): Unique or interesting use case

## Common Challenges & Solutions

### Challenge: Docker Issues

**Symptoms**: Setup script fails, containers won't start

**Solutions**:
- Ensure Docker Desktop is running
- Check system resources (RAM)
- Restart Docker Desktop
- Use manual setup as fallback

### Challenge: Port Conflicts

**Symptoms**: Services can't start, port errors

**Solutions**:
- Kill processes on conflicting ports
- Use different ports in .env
- Check what's using ports: `lsof -ti:PORT`

### Challenge: Agent Not Working

**Symptoms**: Agent doesn't respond, errors

**Solutions**:
- Verify Ollama is running
- Check model is available: `ollama list`
- Pull model if missing: `ollama pull llama3.2:1b`
- Check agent JSON syntax

### Challenge: Students Get Stuck

**Solutions**:
- Have diagnostics script ready: `npm run diagnostics`
- Provide troubleshooting guide
- Pair students for peer support
- Have TA/helper available

## Materials Needed

### For Instructor

- Laptop with Docker Desktop
- Projector/screen
- Sample agent examples ready
- Troubleshooting guide

### For Students

- Laptop with Docker Desktop installed
- Git installed
- Text editor (VS Code recommended)
- Internet connection

### Pre-Workshop Checklist

- [ ] Students have Docker Desktop installed
- [ ] Students can clone Git repositories
- [ ] Instructor has tested setup script
- [ ] Backup plan if Docker fails (manual setup)
- [ ] Sample agents prepared
- [ ] Troubleshooting resources ready

## Post-Workshop Resources

### For Students

- [Quick Start Guide](../QUICK_START_STUDENTS.md)
- [Build Your First Agent Tutorial](../tutorials/BUILD_FIRST_AGENT.md)
- [Learning Path](../LEARNING_PATH.md)
- [Examples Guide](../EXAMPLES.md)

### For Instructors

- [Assignments Guide](ASSIGNMENTS.md)
- [Classroom Setup Guide](CLASSROOM_SETUP.md)
- Solution examples (contact maintainers)

## Variations

### Shorter Workshop (1 hour)

- Skip Part 4 (Advanced Concepts)
- Focus on setup and one agent creation
- Use pre-configured agents only

### Longer Workshop (3 hours)

- Add RAG hands-on exercise
- Create multi-agent workflow
- Deploy to cloud (optional)
- Code walkthrough

### Online Workshop

- Use screen sharing
- Provide pre-recorded setup video
- Use breakout rooms for exercises
- Have async Q&A channel

## Success Metrics

- **Setup Success Rate**: >80% of students complete setup
- **Agent Creation**: >90% create working agent
- **Engagement**: Students ask questions and experiment
- **Follow-Up**: Students continue learning after workshop

---

**Note**: This workshop assumes students have basic technical skills. Adjust complexity based on audience level.
