# Getting Started with Orchestrator AI

This guide will help you get Orchestrator AI running locally for development and evaluation.

## ⚠️ Important: Enterprise Setup Required

**This platform requires significant setup and configuration work.** It's designed for enterprise/customer deployments, not quick-start installations. Expect to invest time in:

- Database configuration and migrations
- Authentication setup
- LLM provider configuration
- Security hardening
- Infrastructure deployment

See the [README.md](README.md) for more details on setup complexity.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **Docker & Docker Compose** - [Install Docker](https://docs.docker.com/get-docker/)
- **Supabase CLI** - Install via npm: `npm install -g supabase`
- **PostgreSQL** (via Supabase) - Included with Supabase CLI
- **Ollama** (recommended for local LLMs) - [Install Ollama](https://ollama.ai)

### Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be 20.x or higher

# Check Docker
docker --version
docker compose version

# Check Supabase CLI
supabase --version

# Check Ollama (if installed)
ollama --version
```

## Step 1: Clone the Repository

```bash
git clone https://github.com/golfergeek/orchestrator-ai-v2.git
cd orchestrator-ai-v2
```

## Step 2: Install Dependencies

```bash
npm install
```

This will install dependencies for all workspace packages (API, Web, LangGraph, etc.).

## Step 3: Set Up Environment Variables

```bash
# Copy the example environment file
cp dev.env.example .env

# Edit .env with your configuration
# You'll need to configure:
# - Supabase credentials (will be generated in next step)
# - LLM provider API keys (if using cloud providers)
# - Ollama base URL (default: http://localhost:11434)
```

## Step 4: Start Local Supabase

```bash
cd apps/api
npx supabase start
```

This will:
- Start a local PostgreSQL database
- Start Supabase Studio (web UI)
- Generate local credentials
- Create necessary schemas

**Note the output** - it will show:
- Database URL
- API URL
- Anon key
- Service role key

Update your `.env` file with these values.

## Step 5: Run Database Migrations

```bash
# Still in apps/api directory
npx supabase db push
```

This applies all database migrations and sets up the schema.

## Step 6: Set Up Ollama (Recommended)

For local LLM execution (recommended for security):

```bash
# Install Ollama (if not already installed)
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.ai/install.sh | sh
# Windows: Download from https://ollama.ai

# Start Ollama service
ollama serve

# In another terminal, pull required models
ollama pull llama3.2        # For LLM inference
ollama pull nomic-embed-text  # For embeddings
```

## Step 7: Start Development Servers

```bash
# Return to project root
cd ../..

# Start all development servers
npm run dev
```

This starts:
- **API**: http://localhost:6100
- **Web UI**: http://localhost:6101
- **Supabase Studio**: http://localhost:6010

## Step 8: Initial Configuration

### 8.1 Create Your First User

1. Open Supabase Studio: http://localhost:6010
2. Navigate to Authentication → Users
3. Create a new user or use the test user credentials

### 8.2 Configure LLM Providers

**Option A: Local LLMs (Recommended)**

Ensure Ollama is running and models are pulled (see Step 6).

**Option B: Cloud Providers**

Add API keys to your `.env` file:
```bash
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
# etc.
```

**Important**: No defaults or fallbacks - you must explicitly configure providers.

### 8.3 Set Up PII Protection

1. Access the admin panel in the web UI
2. Navigate to PII Management
3. Create dictionary entries for your organization
4. Configure pattern detection rules

### 8.4 Configure RBAC

1. Access the admin panel
2. Set up roles and permissions
3. Assign users to organizations
4. Configure organization-level access controls

## Step 9: Test the Installation

### Test API Health

```bash
curl http://localhost:6100/health
```

Should return a healthy status.

### Test Web UI

1. Open http://localhost:6101
2. Log in with your user credentials
3. Navigate to the agent catalog
4. Try creating a simple agent or workflow

### Test Local LLM (if using Ollama)

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Hello, world!"
}'
```

## Common Issues

### Port Already in Use

If ports 6100, 6101, or 6010 are already in use:

```bash
# Kill processes on specific ports
npm run kill:6100
npm run kill:6101

# Or manually
lsof -ti:6100 | xargs kill -9
```

### Supabase Won't Start

```bash
# Reset Supabase
cd apps/api
npx supabase stop
npx supabase start
```

### Database Migration Errors

```bash
# Reset database
cd apps/api
npx supabase db reset
```

### Ollama Connection Issues

Ensure Ollama is running:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve
```

## Next Steps

- **Explore Demo Agents**: Check out `demo-agents/` directory for example agents
- **Read Documentation**: See `docs/` directory for detailed documentation
- **Review Architecture**: See `ARCHITECTURE.md` for system architecture
- **Check Examples**: See `docs/EXAMPLES.md` for usage examples

## Production Deployment

For production deployment, see:
- [Production Deployment Guide](deployment/PRODUCTION_DEPLOYMENT.md)
- [Enterprise Hardening Assessment](docs/ENTERPRISE_HARDENING_ASSESSMENT.md)

## Getting Help

- **Documentation**: Check the `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/golfergeek/orchestrator-ai-v2/issues)
- **Discussions**: [GitHub Discussions](https://github.com/golfergeek/orchestrator-ai-v2/discussions)
- **Email**: golfergeek@orchestratorai.io

---

**Remember**: This is an enterprise platform requiring proper setup. Don't expect a "download and run" experience. Take time to understand the architecture and security model.
