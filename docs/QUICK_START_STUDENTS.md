# Quick Start Guide for Students

**Goal**: Get Orchestrator AI running in under 5 minutes!

This guide is designed for students and educators who want to quickly explore the platform without deep configuration.

## Prerequisites

- **Docker Desktop** installed and running ([Download](https://www.docker.com/get-started))
- **Git** installed
- **4GB+ RAM** available for Docker

That's it! No Node.js, npm, or other tools required for the quick-start path.

## Quick Start (3 Commands)

### Step 1: Clone the Repository

```bash
git clone https://github.com/golfergeek/orchestrator-ai-v2.git
cd orchestrator-ai-v2
```

### Step 2: Run Student Setup Script

```bash
./scripts/setup-student.sh
```

This script will:
- Check prerequisites
- Create a minimal `.env` file
- Start all services with Docker Compose
- Load demo data automatically
- Wait for services to be ready

**First run takes 2-3 minutes** (downloading Docker images and setting up database).

### Step 3: Access the Platform

Once the script completes, open your browser:

- **Web App**: http://localhost:7101
- **API**: http://localhost:6100
- **Supabase Studio**: http://127.0.0.1:6015 (database admin)
- **Email Testing**: http://127.0.0.1:6016 (view test emails)

## Demo Credentials

Log in to the web app with:

```
Email: demo.user@orchestratorai.io
Password: DemoUser123!
```

## What's Included

The student setup includes:

- ✅ **Demo Organization** with sample agents
- ✅ **Demo User Account** (credentials above)
- ✅ **Sample Agents** ready to use
- ✅ **Pre-configured RBAC** roles
- ✅ **Local Ollama** with lightweight model

## Your First Agent Interaction

1. **Log in** with the demo credentials
2. **Navigate** to the agent catalog
3. **Select** the "Blog Post Writer" agent
4. **Start a conversation** and ask it to write a blog post about AI

Example prompt:
```
Write a 500-word blog post about the future of AI in education, 
targeted at college students, in a casual tone.
```

## Common Issues

### Docker Not Running

**Symptom**: Script fails with "Docker is not running"

**Fix**: 
1. Open Docker Desktop
2. Wait for it to fully start (whale icon in system tray)
3. Run the script again

### Port Already in Use

**Symptom**: Error about ports 6100, 7101, or 6010 being in use

**Fix**:
```bash
# Stop existing containers
docker-compose -f docker-compose.student.yml down

# Or kill processes on specific ports
lsof -ti:6100 | xargs kill -9
lsof -ti:7101 | xargs kill -9
```

### Services Won't Start

**Symptom**: Script hangs or services fail to start

**Fix**:
```bash
# Check logs
docker-compose -f docker-compose.student.yml logs

# Restart services
docker-compose -f docker-compose.student.yml restart
```

### Out of Memory

**Symptom**: Docker containers crash or system becomes slow

**Fix**:
1. Close other applications
2. Increase Docker Desktop memory limit (Settings → Resources → Memory)
3. Restart Docker Desktop
4. Run setup script again

## Next Steps

Once you have the platform running:

1. **Try the Hello World Agent**: Look for "hello-world" in the agent catalog
2. **Read Documentation**: Check out `docs/EXAMPLES.md` for more examples
3. **Build Your First Agent**: Follow `docs/tutorials/BUILD_FIRST_AGENT.md`
4. **Learn the Architecture**: Read `ARCHITECTURE.md` to understand how it works

## Stopping Services

When you're done:

```bash
docker-compose -f docker-compose.student.yml down
```

This stops all containers but preserves data. To remove everything:

```bash
docker-compose -f docker-compose.student.yml down -v
```

## Getting Help

- **Diagnostics**: Run `npm run diagnostics` to check your setup
- **Documentation**: See `docs/` directory
- **Troubleshooting**: See `docs/TROUBLESHOOTING.md`
- **Issues**: [GitHub Issues](https://github.com/golfergeek/orchestrator-ai-v2/issues)

## Alternative: Manual Setup

If Docker doesn't work for you, see `GETTING_STARTED.md` for manual setup instructions. This requires:
- Node.js 20+
- npm
- Supabase CLI
- More configuration

---

**Remember**: This is a simplified setup for exploration. For production use or advanced development, see the full `GETTING_STARTED.md` guide.
