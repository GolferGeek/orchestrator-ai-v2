# Prerequisites Guide

What you need to know and install before setting up Orchestrator AI.

## Required Software

### Node.js (v20 or higher)

**Why**: The platform is built on Node.js/TypeScript

**Installation**:
- **macOS**: `brew install node@20` or download from [nodejs.org](https://nodejs.org/)
- **Linux**: `sudo apt install nodejs npm` or use [nvm](https://github.com/nvm-sh/nvm)
- **Windows**: Download installer from [nodejs.org](https://nodejs.org/)

**Verify**:
```bash
node -v  # Should show v20.x.x or higher
npm -v   # Should show 10.x.x or higher
```

### Docker Desktop

**Why**: Required for Docker Compose quick-start and running Supabase/Ollama

**Installation**:
- **macOS**: Download from [docker.com](https://www.docker.com/products/docker-desktop/)
- **Linux**: `sudo apt install docker.io docker-compose` or use [Docker Engine](https://docs.docker.com/engine/install/)
- **Windows**: Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/)

**Verify**:
```bash
docker --version
docker info  # Should show Docker is running
```

**Note**: Docker Desktop requires significant resources (4GB+ RAM recommended)

### Git

**Why**: For cloning the repository

**Installation**:
- **macOS**: `brew install git` or included with Xcode Command Line Tools
- **Linux**: `sudo apt install git`
- **Windows**: Download from [git-scm.com](https://git-scm.com/download/win)

**Verify**:
```bash
git --version
```

### Supabase CLI (For Manual Setup)

**Why**: Required for local Supabase development (not needed for Docker Compose quick-start)

**Installation**:
```bash
npm install -g supabase
```

**Verify**:
```bash
supabase --version
```

**Note**: Only needed if not using Docker Compose student setup

## Optional but Recommended

### Ollama (For Local LLMs)

**Why**: Run language models locally without API keys

**Installation**:
- **macOS**: `brew install ollama`
- **Linux**: `curl -fsSL https://ollama.com/install.sh | sh`
- **Windows**: Download from [ollama.com](https://ollama.com/download)

**Verify**:
```bash
ollama --version
ollama serve  # Start server
ollama pull llama3.2:1b  # Pull a model
```

**Note**: Can use Ollama Cloud instead (requires API key)

### Code Editor

**Recommended**: VS Code, Cursor, or any modern editor with TypeScript support

**VS Code Extensions** (optional):
- ESLint
- Prettier
- TypeScript and JavaScript Language Features

## System Requirements

### Minimum

- **RAM**: 4GB available for Docker
- **Disk Space**: 10GB free
- **CPU**: 2 cores
- **OS**: macOS 10.15+, Linux (Ubuntu 20.04+), Windows 10+

### Recommended

- **RAM**: 8GB+ available
- **Disk Space**: 20GB+ free (for Docker images and models)
- **CPU**: 4+ cores
- **OS**: Latest stable version

### For Local LLMs (Ollama)

- **RAM**: 8GB+ (16GB recommended)
- **GPU**: Optional but recommended for faster inference
- **Disk Space**: 5GB+ per model

## Knowledge Prerequisites

### Required Knowledge

- **Basic Command Line**: Navigating directories, running commands
- **Git Basics**: Cloning repositories
- **JSON**: Understanding JSON structure (for agent definitions)
- **REST APIs**: Basic understanding (for API usage)

### Helpful but Not Required

- **TypeScript/JavaScript**: For understanding codebase
- **Docker**: For understanding containerization
- **PostgreSQL**: For understanding database structure
- **LLMs**: Understanding of language models and prompts

## Platform-Specific Notes

### macOS

**Apple Silicon (M1/M2/M3)**:
- Docker Desktop works natively
- Ollama has native ARM builds
- Some Node.js packages may need Rosetta

**Intel Macs**:
- All tools work natively
- No special considerations

### Linux

**Ubuntu/Debian**:
- Most straightforward setup
- All tools available via apt

**Other Distributions**:
- Package names may differ
- Docker installation varies
- Check distribution-specific guides

**Docker Permissions**:
```bash
# Add user to docker group (avoid sudo)
sudo usermod -aG docker $USER
# Log out and back in
```

### Windows

**WSL2 Recommended**:
- Better performance
- Native Linux tools
- Docker Desktop integrates with WSL2

**Native Windows**:
- Works but may have path issues
- Use Git Bash or PowerShell
- Ensure line endings are correct (LF vs CRLF)

## Quick Verification

Run this to check all prerequisites:

```bash
# Check Node.js
node -v && npm -v

# Check Docker
docker --version && docker info

# Check Git
git --version

# Check Supabase CLI (optional)
supabase --version || echo "Supabase CLI not installed (optional)"

# Check Ollama (optional)
ollama --version || echo "Ollama not installed (optional)"
```

## Installation Order

For best results, install in this order:

1. **Git** (if not already installed)
2. **Node.js** (includes npm)
3. **Docker Desktop**
4. **Supabase CLI** (if doing manual setup)
5. **Ollama** (optional, for local LLMs)

## Troubleshooting Installation

### Node.js Issues

**Problem**: Wrong version installed

**Solution**: Use [nvm](https://github.com/nvm-sh/nvm) to manage versions:
```bash
nvm install 20
nvm use 20
```

### Docker Issues

**Problem**: Docker won't start

**Solutions**:
- Restart Docker Desktop
- Check system resources (RAM/CPU)
- Verify virtualization is enabled (BIOS settings)
- On Linux: `sudo systemctl start docker`

### Port Conflicts

**Problem**: Ports already in use

**Solution**: Identify and free ports:
```bash
# Find what's using a port
lsof -ti:6100

# Kill the process
lsof -ti:6100 | xargs kill -9
```

## Next Steps

Once prerequisites are installed:

1. **Quick Start**: See [Quick Start Guide for Students](QUICK_START_STUDENTS.md)
2. **Full Setup**: See [Getting Started Guide](GETTING_STARTED.md)
3. **Run Diagnostics**: `npm run diagnostics` after cloning

## Getting Help

- **Installation Issues**: Check tool-specific documentation
- **Platform Issues**: See [Troubleshooting Guide](TROUBLESHOOTING.md)
- **General Questions**: [GitHub Discussions](https://github.com/golfergeek/orchestrator-ai-v2/discussions)

---

**Remember**: The student quick-start only requires Docker. Full development setup requires all tools above.
