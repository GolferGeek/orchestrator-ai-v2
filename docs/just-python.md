# One Prompt Every Codebase Should Have (Video Summary)

**Video Title:** One Prompt Every Codebase Should Have (For Engineering Teams)  
**Channel:** IndyDevDan  
**Link:** [https://www.youtube.com/watch?v=3_mwKbYvbUg](https://www.youtube.com/watch?v=3_mwKbYvbUg)

## Summary

The video proposes a radical shift in how engineering teams handle codebase onboarding and maintenance, moving from stale documentation to "Agentic Installation" and "Agentic Maintenance."

The core problem identified is the friction in setting up a development environment. Traditional READMEs are often outdated, and "runbooks" require manual execution. The solution presented is to use **Claude Code's "Setup Hook"** combined with a **Justfile** to create a deterministic yet intelligent workflow.

### The Workflow Pattern
The pattern separates concerns into three layers:
1.  **Detective/Deterministic (Script)**: Hard-coded, reliable scripts (e.g., `uv sync`, `npm install`) that run every time without LLM variance.
2.  **Agentic (Prompt)**: LLM-based oversight that handles complex, context-dependent tasks (e.g., "I see you have a `.env.example`, but no `.env`. Let me help you set that up based on your platform.").
3.  **Interactive (User)**: The agent asks the user for decisions when necessary (e.g., "Do you want to reset the database or keep existing data?").

By running a single command (e.g., `just cldi` for "Claude Install"), a new engineer can go from zero to a running application with all dependencies, environment variables, and databases configured automatically.

## Tools Mentioned

### 1. Claude Code (Setup Hook)
*   **Link:** [https://code.claude.com/docs/en/hooks#setup](https://code.claude.com/docs/en/hooks#setup)
*   **Summary:** A feature of Claude Code that allows developers to define scripts that run automatically when a session starts. The "Setup" hook is specifically designed to ensure the environment is ready before the user even types their first prompt. It serves as the entry point for the "Agentic Installation" workflow.

### 2. Just (Justfile)
*   **Link:** [https://just.systems/](https://just.systems/)
*   **Summary:** A handy command runner that saves and runs project-specific commands. In this context, it acts as the "launch pad" for the engineering team. Instead of remembering complex CLI arguments, developers simply run `just <command>`. It integrates with the agentic workflow to provide commands like `just cldi` (Agentic Install) or `just cldm` (Agentic Maintenance).

### 3. Install and Maintain (GitHub Repo)
*   **Link:** [https://github.com/disler/install-and-maintain](https://github.com/disler/install-and-maintain)
*   **Summary:** The reference implementation for the patterns discussed in the video. It demonstrates a project structure containing:
    *   `apps/backend` (Python + uv)
    *   `apps/frontend` (Vite + Vue)
    *   `.claude/hooks` (The setup hooks)
    *   `Justfile` (The command runner configuration)
    *   Examples of how to mix deterministic scripts with agentic prompts.

### 4. install.md
*   **Link:** [https://www.mintlify.com/blog/install-md-standard-for-llm-executable-installation](https://www.mintlify.com/blog/install-md-standard-for-llm-executable-installation)
*   **Summary:** A proposed standard for writing installation instructions specifically for LLMs. Instead of human-readable prose, `install.md` provides structured, executable steps that an agent can read and execute autonomously to set up a project. It complements the "Setup Hook" approach by standardizing the instructions the agent follows.

### 5. Agentic Engineer
*   **Link:** [https://agenticengineer.com/tactical-agentic-coding?y=3_mwKbYvbUg](https://agenticengineer.com/tactical-agentic-coding?y=3_mwKbYvbUg)
*   **Summary:** A resource and course mentioned in the video for developers looking to master these "Tactical Agentic Coding" patterns.

## Key Takeaways
*   **Agents + Code > Agents**: Don't rely solely on an LLM to figure things out every time. Use deterministic code for what doesn't change, and use agents to bridge the gaps.
*   **Living Documentation**: The installation script *is* the documentation. If the script works, the documentation is up to date.
*   **Zero-Friction Onboarding**: New engineers should be able to run one command and start coding.
