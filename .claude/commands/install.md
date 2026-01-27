# Orchestrator AI Agentic Install

> Agentic installation instructions for Orchestrator AI.

I want you to install and configure the project. Execute the steps below.

OBJECTIVE: Get the developer ready to code with a running dev server and database.
DONE WHEN: The environment is configured, dependencies are installed, and the dev server is ready to start (or running).

## TODO
- [ ] **Deterministic Setup**:
    - Run `./scripts/setup.sh` to handle dependencies, Docker checks, and base .env creation.
- [ ] **Environment Check**:
    - Inspect `.env` file.
    - Ask the user for `ANTHROPIC_API_KEY` if it is missing or has a placeholder value.
    - Ask the user for `SUPABASE_KEY` if it is missing.
- [ ] **Database Verification**:
    - Ensure Supabase is running: `cd apps/api && supabase status`
    - If not running, start it: `cd apps/api && supabase start`
- [ ] **Final Verification**:
    - Run `npm run dev` to confirm the app starts correctly.
    - If successful, stop it (Ctrl+C) and let the user know they are ready.

## Prerequisites
- Node.js v20+
- Docker
- Supabase CLI

EXECUTE NOW: Complete the above TODO list.
