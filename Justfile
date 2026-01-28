# Orchestrator AI Justfile
# Reference: https://github.com/casey/just

# Set shell to zsh
set shell := ["zsh", "-c"]

# Default: List available commands
# Default: Interactive menu
default:
    @./scripts/just-menu.sh

# --- Onboarding & Setup ---

cldi:
    @echo "🤖 Starting Agentic Install..."
    claude --init "/install" --dangerously-skip-permissions

cldu:
    @echo "🤖 Starting Agentic Update..."
    claude --init "/update" --dangerously-skip-permissions

# --- AI Agent Commands ---

# Just open Agent
agent:
    claude --dangerously-skip-permissions

# Start Agentic Monitoring
monitor:
    @echo "🤖 Starting Monitor..."
    claude "/monitor" --dangerously-skip-permissions

# Harden Codebase (Fix monitored issues)
harden:
    @echo "🧱 Hardening codebase..."
    claude "/harden" --dangerously-skip-permissions

# Scan Codebase for Errors (Build, Lint, Test)
scan-errors:
    @echo "🔍 Scanning codebase..."
    claude "/scan-errors" --dangerously-skip-permissions

# Fix Codebase Errors (Parallel agent processing)
fix-errors:
    @echo "🔧 Fixing code errors..."
    claude "/fix-errors" --dangerously-skip-permissions

# Fix Claude Ecosystem (Skills/Agents)
fix-claude:
    @echo "🔧 Fixing Claude Ecosystem..."
    claude "/fix-claude" --dangerously-skip-permissions

# --- Development (Local) ---

# Start Local Development (Watch Mode) - Use this for daily work
dev:
    npm run dev

# Start Local Development (All Apps)
dev-all:
    npm run dev:all

# --- Production (Mac Studio) ---

# Start Production Server
prod:
    npm run server:start:production

# Stop Production Server
prod-stop:
    npm run server:stop

# Restart Production Server
prod-restart:
    npm run server:restart

# Check Production Status
prod-status:
    npm run server:status

# --- Database & Migrations ---

# Start Supabase locally
db-start:
    cd apps/api && supabase start

# Stop Supabase locally
db-stop:
    cd apps/api && supabase stop

# Reset Database (Apply Migrations & Seeds)
db-reset:
    cd apps/api && supabase db reset

# Validate Migrations
db-validate:
    ./scripts/validate-migration.sh

# --- Ollama ---

# Setup Ollama with appropriate models for this machine
ollama-setup:
    ./scripts/ollama-setup-wizard.sh

# Auto-install recommended models (no prompts)
ollama-setup-auto:
    ./scripts/ollama-setup-wizard.sh --auto

# List recommended models for this machine
ollama-list:
    ./scripts/ollama-setup-wizard.sh --list

# Sync Ollama models with database
ollama-sync:
    ./scripts/ollama-sync.sh

# --- Maintenance ---

# Clean Install (Delete node_modules and reinstall)
clean:
    rm -rf node_modules
    rm -rf apps/*/node_modules
    npm install
