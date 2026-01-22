# Troubleshooting Guide

Common issues and solutions for Orchestrator AI setup and usage.

## Quick Diagnostics

Run the diagnostics script first:

```bash
npm run diagnostics
```

This will check prerequisites, configuration, ports, and service connectivity.

## Setup Issues

### Port Already in Use

**Symptoms**:
- Error: "Port XXXX is already in use"
- Services fail to start
- "Address already in use" errors

**Causes**:
- Another application using the port
- Previous instance didn't shut down cleanly
- Multiple Docker containers using same ports

**Solutions**:

```bash
# Find what's using the port
lsof -ti:6100  # Replace with your port

# Kill the process
lsof -ti:6100 | xargs kill -9

# Or use npm scripts
npm run kill:6100
npm run kill:6101

# For Docker Compose
docker-compose down
docker-compose -f docker-compose.student.yml down
```

### Docker Not Running

**Symptoms**:
- "Cannot connect to Docker daemon"
- "Docker is not running"
- Docker commands fail

**Solutions**:
1. Open Docker Desktop
2. Wait for it to fully start (check system tray icon)
3. Verify: `docker info` should work
4. On Linux, ensure Docker service is running: `sudo systemctl start docker`

### Supabase Won't Start

**Symptoms**:
- `supabase start` fails
- "Port already in use" errors
- Database connection errors

**Solutions**:

```bash
# Stop and reset Supabase
cd apps/api
supabase stop
supabase start

# If that doesn't work, reset completely
supabase stop
rm -rf .supabase
supabase start

# Check Supabase status
supabase status
```

**Common Causes**:
- Port conflicts (6010, 6012, 6015)
- Previous instance didn't shut down
- Docker resources exhausted

### Database Migration Errors

**Symptoms**:
- "Migration failed" errors
- "Table already exists" errors
- Schema mismatch errors

**Solutions**:

```bash
# Reset database (WARNING: deletes all data)
cd apps/api
supabase db reset

# Reset with seed data
supabase db reset --with-seed

# Check migration status
supabase migration list

# Apply specific migration
supabase migration up
```

### Missing seed.sql File

**Symptoms**:
- "seed.sql not found" error
- Demo data not loading

**Solutions**:

```bash
# Ensure seed.sql exists
ls apps/api/supabase/seed.sql

# If missing, copy from archive
cp apps/api/supabase/archive/seeds/seed.sql apps/api/supabase/seed.sql

# Verify config.toml references it
grep seed.sql apps/api/supabase/config.toml
```

## Configuration Errors

### Missing Environment Variables

**Symptoms**:
- "API_PORT not defined"
- "SUPABASE_URL not set"
- Configuration validation errors

**Solutions**:

```bash
# Create .env from example
cp dev.env.example .env

# Edit .env and add required variables
# Minimum required:
# - API_PORT
# - WEB_PORT
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY

# Verify variables are loaded
source .env
echo $API_PORT
```

### Invalid API Keys

**Symptoms**:
- "Invalid API key" errors
- LLM requests fail
- Authentication errors

**Solutions**:
1. Verify API keys in `.env` file
2. Check key format (no extra spaces, correct format)
3. Test keys directly:
   ```bash
   # Test Anthropic
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: YOUR_KEY" \
     -H "anthropic-version: 2023-06-01"
   
   # Test OpenAI
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_KEY"
   ```
4. Ensure keys have proper permissions/scopes

### Port Mismatch

**Symptoms**:
- Services can't connect
- "Connection refused" errors
- Web app can't reach API

**Solutions**:
1. Check port consistency:
   - `.env` file ports match actual service ports
   - `VITE_API_BASE_URL` matches `API_PORT`
   - `SUPABASE_URL` matches Supabase config
2. Verify ports in:
   - `.env` file
   - `apps/api/supabase/config.toml`
   - `docker-compose.yml` (if using Docker)

## Service Connectivity Issues

### API Server Not Starting

**Symptoms**:
- `npm run dev:api` fails
- Port 6100 not responding
- Build errors

**Solutions**:

```bash
# Check for errors in logs
cd apps/api
npm run start:dev

# Verify dependencies installed
npm install

# Check Node.js version (needs 20+)
node -v

# Build transport types first
cd ../..
npm run build:transport-types
```

### Web Server Not Starting

**Symptoms**:
- `npm run dev:web` fails
- Port 7101 not responding
- Vite errors

**Solutions**:

```bash
# Check for errors
cd apps/web
npm run dev:http

# Verify dependencies
npm install

# Check Vite config
cat vite.config.ts

# Verify API URL in .env
grep VITE_API_BASE_URL .env
```

### Ollama Connection Issues

**Symptoms**:
- "Cannot connect to Ollama"
- LLM requests timeout
- "Ollama not accessible" warnings

**Solutions**:

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama (if installed locally)
ollama serve

# Or use Docker
docker run -d -p 11434:11434 ollama/ollama

# Verify model is available
ollama list

# Pull model if missing
ollama pull llama3.2:1b

# Check OLLAMA_BASE_URL in .env
grep OLLAMA_BASE_URL .env
```

### Supabase Connection Issues

**Symptoms**:
- "Cannot connect to Supabase"
- Database queries fail
- Authentication errors

**Solutions**:

```bash
# Check Supabase status
cd apps/api
supabase status

# Verify URLs and keys
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Test connection
curl http://127.0.0.1:6010/health

# Check Supabase Studio
open http://127.0.0.1:6015
```

## Agent Execution Errors

### Agent Not Found

**Symptoms**:
- "Agent not found" error
- Agent doesn't appear in catalog

**Solutions**:
1. Verify agent exists in database:
   ```bash
   cd apps/api
   supabase db query "SELECT slug, name FROM agents WHERE slug = 'your-agent-slug'"
   ```
2. Check organization assignment
3. Verify user has access to organization
4. Refresh web page

### Invalid IO Schema

**Symptoms**:
- "Invalid input schema" error
- "Schema validation failed"

**Solutions**:
1. Validate JSON Schema syntax
2. Check required fields are present
3. Verify data types match schema
4. Test with minimal input first

### LLM Provider Errors

**Symptoms**:
- "LLM provider not configured"
- "Model not available"
- Timeout errors

**Solutions**:

```bash
# Check provider configuration
grep -E "(ANTHROPIC|OPENAI|OLLAMA)" .env

# For Ollama, verify model exists
ollama list

# For cloud providers, verify API keys
# Test Anthropic
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"test"}]}'
```

### Memory/Resource Issues

**Symptoms**:
- Slow responses
- Out of memory errors
- Docker containers crash

**Solutions**:
1. **Increase Docker memory**:
   - Docker Desktop → Settings → Resources → Memory
   - Increase to 4GB+ (8GB recommended)
2. **Close other applications**
3. **Use lighter models**:
   - Ollama: `llama3.2:1b` instead of `llama3.2:3b`
   - Anthropic: `claude-3-haiku` instead of `claude-3-opus`
4. **Restart services**:
   ```bash
   docker-compose restart
   ```

## Docker-Specific Issues

### Docker Compose Fails

**Symptoms**:
- `docker-compose up` fails
- Container startup errors
- Network errors

**Solutions**:

```bash
# Check Docker Compose version
docker-compose --version
# Or
docker compose version

# Use correct command (newer Docker uses 'docker compose')
docker compose -f docker-compose.student.yml up -d

# Check logs
docker-compose logs

# Remove and recreate
docker-compose down -v
docker-compose up -d
```

### Container Health Check Failures

**Symptoms**:
- Containers start but fail health checks
- Services not accessible

**Solutions**:

```bash
# Check container logs
docker-compose logs <service-name>

# Check container status
docker-compose ps

# Restart specific service
docker-compose restart <service-name>

# Rebuild containers
docker-compose build --no-cache
docker-compose up -d
```

## Platform-Specific Issues

### macOS Issues

**Port Conflicts**:
- macOS may reserve some ports
- Use `lsof -ti:PORT | xargs kill -9` to free ports

**Docker Desktop**:
- Ensure Docker Desktop has enough resources
- Check "Use Rosetta" if on Apple Silicon

### Linux Issues

**Docker Permissions**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in
```

**Port Binding**:
- May need `sudo` for ports < 1024
- Use ports > 1024 (already configured)

### Windows Issues

**WSL2**:
- Ensure WSL2 is updated
- Docker Desktop must use WSL2 backend

**Path Issues**:
- Use forward slashes in paths
- Check line endings (LF vs CRLF)

## Getting More Help

1. **Run Diagnostics**: `npm run diagnostics`
2. **Check Logs**: 
   - API: `cd apps/api && npm run start:dev`
   - Web: `cd apps/web && npm run dev:http`
   - Docker: `docker-compose logs -f`
3. **Review Documentation**: 
   - `GETTING_STARTED.md`
   - `ARCHITECTURE.md`
   - `docs/PREREQUISITES.md`
4. **Search Issues**: [GitHub Issues](https://github.com/golfergeek/orchestrator-ai-v2/issues)
5. **Ask for Help**: [GitHub Discussions](https://github.com/golfergeek/orchestrator-ai-v2/discussions)

## Still Stuck?

If none of these solutions work:

1. **Collect Information**:
   ```bash
   npm run diagnostics > diagnostics-output.txt
   docker-compose logs > docker-logs.txt
   ```

2. **Create GitHub Issue** with:
   - Your operating system
   - Node.js version (`node -v`)
   - Docker version (`docker --version`)
   - Error messages
   - Diagnostics output
   - Steps to reproduce

3. **Email**: golfergeek@orchestratorai.io

---

Remember: This is an enterprise platform with complex setup. Don't hesitate to ask for help!
