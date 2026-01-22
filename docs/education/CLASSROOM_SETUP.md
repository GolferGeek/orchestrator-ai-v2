# Classroom Setup Guide

Guide for educators setting up Orchestrator AI for multiple students.

## Setup Options

### Option 1: Individual Local Setup (Recommended for Small Classes)

Each student runs the platform locally on their laptop.

**Pros**:
- No shared infrastructure needed
- Students learn full setup process
- No resource conflicts

**Cons**:
- Requires capable hardware
- Setup time per student
- Instructor must troubleshoot multiple setups

**Requirements**:
- Laptop with 8GB+ RAM
- Docker Desktop
- 20GB+ free disk space

**Setup Steps**:
1. Students follow [Quick Start Guide](../QUICK_START_STUDENTS.md)
2. Instructor verifies each setup
3. Use diagnostics script: `npm run diagnostics`

### Option 2: Cloud Deployment (Recommended for Large Classes)

Single shared instance deployed to cloud (Railway, Render, AWS, etc.).

**Pros**:
- No local setup required
- Consistent environment
- Easier to manage

**Cons**:
- Requires cloud account
- Students share resources
- Less learning about infrastructure

**Requirements**:
- Cloud hosting account
- Basic DevOps knowledge

**Setup Steps**:
1. Deploy to cloud platform
2. Configure for multiple users
3. Create student accounts
4. Provide access credentials

### Option 3: Lab Computers (For Computer Labs)

Pre-configured lab computers with platform installed.

**Pros**:
- Consistent environment
- No student setup needed
- Controlled configuration

**Cons**:
- Requires lab access
- Maintenance overhead
- Limited to lab hours

**Requirements**:
- Lab computers with Docker
- Network access
- Admin access for setup

**Setup Steps**:
1. Install Docker on lab computers
2. Clone repository
3. Run setup script
4. Test on each machine
5. Create startup scripts

## Pre-Class Preparation

### Week Before Class

1. **Test Setup Yourself**
   - Run student quick-start script
   - Verify all services work
   - Test demo agents
   - Document any issues

2. **Prepare Materials**
   - Workshop slides (see [Workshop Guide](WORKSHOP_GUIDE.md))
   - Sample agents ready
   - Troubleshooting guide printed
   - Backup plan if Docker fails

3. **Communicate with Students**
   - Send prerequisites list
   - Provide installation instructions
   - Set expectations about setup time
   - Offer help session before class

### Day Before Class

1. **Verify Student Readiness**
   - Check who has Docker installed
   - Identify students needing help
   - Prepare alternative setup paths

2. **Prepare Backup Plan**
   - Manual setup instructions ready
   - Cloud deployment option prepared
   - Pair programming option available

3. **Test Everything Again**
   - Run diagnostics
   - Verify demo agents work
   - Check all links work

## During Class

### Setup Phase (First 30 minutes)

1. **Group Check**
   - Who has Docker running?
   - Who needs help?
   - Pair students if needed

2. **Guided Setup**
   - Walk through setup script together
   - Pause for questions
   - Verify each step

3. **Troubleshooting**
   - Common issues ready
   - Have TA/helper available
   - Use diagnostics script

### Active Learning Phase

1. **Monitor Progress**
   - Check students are on track
   - Answer questions promptly
   - Identify struggling students

2. **Provide Support**
   - Pair programming for stuck students
   - Group troubleshooting sessions
   - One-on-one help as needed

## Managing Student Accounts

### Option 1: Shared Demo Account

**Pros**: Simple, no account management

**Cons**: Students see each other's work, no individual tracking

**Setup**: Use demo credentials for all students

### Option 2: Individual Accounts

**Pros**: Students have own workspace, better tracking

**Cons**: Requires account creation

**Setup**:
1. Create accounts via Supabase Studio
2. Assign to demo-org organization
3. Provide credentials to students

### Option 3: Self-Registration

**Pros**: Students create own accounts

**Cons**: Requires email verification setup

**Setup**:
1. Enable signup in Supabase config
2. Configure email (or use Inbucket for local)
3. Students register themselves

## Resource Management

### Memory Requirements

**Per Student (Local Setup)**:
- Docker: 2-4GB RAM
- Ollama: 2-4GB RAM (if using local models)
- Total: 4-8GB RAM per student

**Shared Instance (Cloud)**:
- Base: 4GB RAM
- Per concurrent user: +512MB
- Example: 20 students = 14GB RAM minimum

### Storage Requirements

**Per Student**:
- Docker images: ~5GB
- Database: ~1GB
- Models (if local): 2-5GB per model
- Total: 8-15GB per student

### Network Requirements

- Stable internet for:
  - Cloning repository
  - Pulling Docker images
  - API calls (if using cloud LLMs)

## Troubleshooting Common Classroom Issues

### Multiple Students, Same Ports

**Problem**: Port conflicts when students use same ports

**Solution**:
- Each student uses different ports in `.env`
- Or use Docker Compose (isolates ports)
- Or deploy to cloud (no port conflicts)

### Slow Performance

**Problem**: System slow with multiple students

**Solutions**:
- Use cloud LLMs instead of local Ollama
- Increase Docker memory limits
- Use lighter models
- Stagger student activities

### Docker Won't Start

**Problem**: Docker Desktop fails on some machines

**Solutions**:
- Check system requirements
- Verify virtualization enabled
- Use cloud deployment as backup
- Pair students on working machines

### Students Can't Access

**Problem**: Network/firewall issues

**Solutions**:
- Check firewall settings
- Verify ports aren't blocked
- Use cloud deployment
- Provide VPN if needed

## Assessment & Grading

### Setup Verification

**Checklist**:
- [ ] Can access web UI
- [ ] Can log in
- [ ] Can see agent catalog
- [ ] Can interact with demo agent

### Assignment Submission

**Options**:
1. **GitHub**: Students fork repo, submit PRs with agent creation scripts
2. **Database Export**: Export agent definitions from database
3. **Screenshots**: Document working agents in web UI
4. **Live Demo**: Show agent working
5. **SQL Scripts**: Submit SQL INSERT statements for agents

### Grading Tools

- **Automated**: Use diagnostics script output
- **Manual**: Review agents in database or exported definitions
- **Demo**: Students demonstrate agents
- **Peer Review**: Students review each other's agents

## Post-Class Cleanup

### For Local Setup

Students can:
- Keep platform running for assignments
- Stop services: `docker-compose down`
- Remove everything: `docker-compose down -v`

### For Cloud Setup

- Archive student work
- Reset database for next class
- Clean up unused resources
- Document configuration for reuse

### For Lab Setup

- Reset to clean state
- Update platform if needed
- Test on all machines
- Document any changes

## Best Practices

1. **Start Simple**: Use student quick-start first
2. **Have Backup**: Always have alternative setup ready
3. **Test First**: Always test setup yourself first
4. **Document Issues**: Keep notes on common problems
5. **Provide Support**: Have help available during setup
6. **Be Patient**: Setup takes time, especially first time
7. **Celebrate Success**: Acknowledge when students get it working

## Resources for Students

Provide these links:
- [Quick Start Guide](../QUICK_START_STUDENTS.md)
- [Troubleshooting Guide](../TROUBLESHOOTING.md)
- [Build Your First Agent](../tutorials/BUILD_FIRST_AGENT.md)
- [Learning Path](../LEARNING_PATH.md)

## Getting Help

- **Technical Issues**: [GitHub Issues](https://github.com/golfergeek/orchestrator-ai-v2/issues)
- **Pedagogical Questions**: golfergeek@orchestratorai.io
- **Community**: [GitHub Discussions](https://github.com/golfergeek/orchestrator-ai-v2/discussions)

---

**Remember**: The goal is learning, not perfect setup. Focus on getting students exploring and building, even if setup isn't perfect.
