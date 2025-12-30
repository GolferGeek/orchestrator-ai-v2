# Claude Code Source Contexts

This directory contains **source-specific context files** that provide app-specific guidance when Claude Code SDK is invoked from different applications.

## How It Works

When a client application (web, orch-flow, CLI) calls the Claude Code SDK through the `super-admin` API endpoint, it passes a `sourceContext` parameter. This parameter tells the SDK which context file to load as a system prompt.

### Flow

```
Client App → API (/super-admin/execute?sourceContext=web-app)
  ↓
Super Admin Service → loadSourceContext('web-app')
  ↓
Loads .claude/contexts/web-app.md
  ↓
Passes content as systemPrompt to Claude Agent SDK
  ↓
Claude understands app-specific context and architecture
```

## Available Contexts

### `web-app.md` (Vue.js Web Application)
- **Used by**: `apps/web` (Vue 3 web application)
- **Provides**: Vue 3 patterns, three-layer architecture, Pinia stores, web testing
- **Key Skills Referenced**: `web-architecture-skill`, `web-testing-skill`, `execution-context-skill`, `transport-types-skill`

### `orch-flow.md` (React Task Management App)
- **Used by**: `apps/orch-flow` (React task management application)
- **Provides**: React patterns, orch-flow database schema, team files, shared tasks
- **Key Skills Referenced**: `orch-flow-skill`, `execution-context-skill`

### `default.md` (CLI and General Usage)
- **Used by**: CLI invocations, fallback for unknown contexts
- **Provides**: General repository overview, all available skills, app selection guidance
- **Key Skills Referenced**: All architecture and development skills

## Progressive Skill Loading

Context files **reference skills** without loading them upfront. They tell Claude:
- **When** to load a skill (e.g., "when working on stores")
- **Which** skill to use (e.g., `web-architecture-skill`)
- **What aspect** to focus on (e.g., "specifically the store patterns")

This keeps the context lightweight while ensuring the right expertise is available when needed.

## Adding a New Context

1. **Create the context file**: `.claude/contexts/my-app.md`
2. **Update the DTO type**: Add to `SourceContext` type in `apps/api/src/super-admin/dto/execute-command.dto.ts`
3. **Update the client**: Pass the context in the execute call:
   ```typescript
   claudeCodeService.execute(
     prompt,
     onMessage,
     onError,
     onComplete,
     sessionId,
     'my-app' // Your new context
   );
   ```

## Context File Structure

Each context file should follow this structure:

```markdown
# [App Name] Context

You are being invoked from the **[App Name]** (`apps/[app-name]`).

## Your Role
[Brief description of what you're helping with]

## Application Overview
[Framework, patterns, key technologies]

## Progressive Skills
### When Working on [Feature/Area]
Use `[skill-name]` - specifically [what aspect]:
- Key pattern 1
- Key pattern 2

## Key Files to Know
[Table of important files and their purposes]

## Common Violations to Avoid
[List of anti-patterns specific to this app]
```

## Benefits

✅ **App-Specific Guidance** - Claude understands the context of where it's being invoked
✅ **Progressive Skills** - Skills load only when needed, keeping context lightweight
✅ **Maintainable** - Update context files without changing code
✅ **Scalable** - Easy to add new contexts for new apps
✅ **Consistent** - Same patterns across all applications

## Testing

To test a context:

1. Open the app (e.g., web app at `http://localhost:5173`)
2. Open the Claude Code panel (super admin menu)
3. Execute a prompt related to the app
4. Check the API logs to see which context was loaded
5. Verify Claude's responses are app-aware

## Troubleshooting

**Context not loading?**
- Check the file exists: `.claude/contexts/[context-name].md`
- Check the API logs for "Loaded context: [name]"
- Verify the client is passing the correct `sourceContext` parameter

**Wrong skill referenced?**
- Skills are loaded on-demand based on the context guidance
- Update the context file to reference the correct skill
- Context files don't force-load skills, they just guide Claude

**Need to update context?**
- Edit the `.md` file directly
- Changes take effect immediately (no restart needed)
- Context is loaded fresh on each SDK invocation
