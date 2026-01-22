import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

interface CommandInfo {
  name: string;
  description: string;
}

interface SkillInfo {
  name: string;
  description: string;
}

/**
 * Execution mode for Claude Code panel
 * - 'dev': Full access (file read/write, bash, git) - localhost development
 * - 'user': Limited access (read-only, database ops) - production/docker
 */
type ExecutionMode = 'dev' | 'user';

/**
 * Tool configurations for each execution mode
 */
const MODE_TOOLS: Record<ExecutionMode, string[]> = {
  dev: [
    // Full Claude Code experience for developers
    'Skill',
    'Read',
    'Write',
    'Edit',
    'Bash',
    'Glob',
    'Grep',
    'Task',
    'WebFetch',
    'WebSearch',
    'TodoWrite',
  ],
  user: [
    // Limited tools for end users in production
    // Read-only file access for understanding codebase/config
    'Read',
    'Glob',
    'Grep',
    // Web access for documentation lookups
    'WebFetch',
    'WebSearch',
    // Skills that are safe for users (database queries, status checks)
    'Skill',
  ],
};

/**
 * SDK message type (since the SDK types are loose)
 */
interface SDKMessage {
  type?: string;
  subtype?: string;
  session_id?: string;
  [key: string]: unknown;
}

/**
 * Execution result with session info
 */
interface ExecutionResult {
  sessionId?: string;
}

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);
  private readonly projectRoot: string;
  private readonly executionMode: ExecutionMode;

  constructor() {
    // Navigate from apps/api to project root
    this.projectRoot = join(process.cwd(), '..', '..');
    this.executionMode = this.determineExecutionMode();
    this.logger.log(`Project root set to: ${this.projectRoot}`);
    this.logger.log(`Execution mode: ${this.executionMode}`);
  }

  /**
   * Determine execution mode based on environment
   * - 'dev': NODE_ENV=development (localhost)
   * - 'user': NODE_ENV=production or running in Docker/container
   */
  private determineExecutionMode(): ExecutionMode {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDocker =
      existsSync('/.dockerenv') || process.env.RUNNING_IN_DOCKER === 'true';

    if (nodeEnv === 'production' || isDocker) {
      return 'user';
    }

    return 'dev';
  }

  /**
   * Get current execution mode
   */
  getExecutionMode(): ExecutionMode {
    return this.executionMode;
  }

  /**
   * Get mode-specific system prompt guidance
   */
  private getModeSystemPrompt(): string {
    if (this.executionMode === 'dev') {
      return `You are helping a developer work on the Orchestrator AI codebase.
You have full access to read, write, and edit files, run bash commands, and use git.
You can make changes to the codebase, run builds, tests, and deploy code.`;
    }

    // User mode - more restricted, focused on information and safe database operations
    return `You are helping a user understand and configure their Orchestrator AI environment.

IMPORTANT LIMITATIONS:
- You can READ files but CANNOT write or edit them
- You can search the codebase to answer questions
- You can query the database for status and configuration
- You can help configure agents, collections, and settings via database operations
- You CANNOT run arbitrary shell commands or modify source code

WHAT YOU CAN HELP WITH:
- Explain how features work
- Query database for agent status, collections, configurations
- Help users understand their data and workflows
- Guide users through configuration changes (via approved Skills)
- Look up documentation and explain concepts

If the user asks you to modify source code, politely explain that code changes require developer access in a development environment.`;
  }

  /**
   * Load source context from .claude/contexts/{source}.md
   * Falls back to default.md if specific context not found
   */
  private async loadSourceContext(
    sourceContext?: string,
  ): Promise<string | undefined> {
    const contextName = sourceContext || 'default';
    const contextFile = join(
      this.projectRoot,
      '.claude',
      'contexts',
      `${contextName}.md`,
    );

    if (existsSync(contextFile)) {
      try {
        const content = await readFile(contextFile, 'utf-8');
        this.logger.debug(`Loaded context: ${contextName}`);
        return content;
      } catch (error) {
        this.logger.warn(
          `Failed to load context ${contextName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } else {
      this.logger.debug(`Context file not found: ${contextFile}`);
    }

    // Fall back to default.md if not already trying that
    if (contextName !== 'default') {
      const defaultFile = join(
        this.projectRoot,
        '.claude',
        'contexts',
        'default.md',
      );
      if (existsSync(defaultFile)) {
        try {
          const content = await readFile(defaultFile, 'utf-8');
          this.logger.debug('Loaded default context as fallback');
          return content;
        } catch (error) {
          this.logger.warn(
            `Failed to load default context: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
    }

    return undefined;
  }

  /**
   * Execute a prompt using Claude Agent SDK and stream results via SSE
   * Supports session resumption for maintaining conversation state
   * Supports source context to provide app-specific guidance
   */
  async executeWithStreaming(
    prompt: string,
    res: Response,
    sessionId?: string,
    sourceContext?: string,
  ): Promise<ExecutionResult> {
    this.logger.log(
      `Executing prompt: ${prompt}${sessionId ? ` (resuming session ${sessionId})` : ' (new session)'}${sourceContext ? ` (context: ${sourceContext})` : ''}`,
    );

    let capturedSessionId: string | undefined;

    try {
      // Dynamically import the ESM SDK
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      // Load source context if provided
      const systemPrompt = await this.loadSourceContext(sourceContext);

      // Get allowed tools based on execution mode
      const allowedTools = MODE_TOOLS[this.executionMode];
      this.logger.debug(
        `Using ${this.executionMode} mode with tools: ${allowedTools.join(', ')}`,
      );

      // Build options - include resume if we have a session ID
      const options: Record<string, unknown> = {
        cwd: this.projectRoot,
        settingSources: ['project'], // Load .claude/* skills, commands, agents
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true, // Enable stream events for tool progress tracking
        allowedTools,
      };

      // Build system prompt with mode-specific guidance
      const modeGuidance = this.getModeSystemPrompt();
      const combinedSystemPrompt = systemPrompt
        ? `${modeGuidance}\n\n${systemPrompt}`
        : modeGuidance;

      if (combinedSystemPrompt) {
        options.systemPrompt = combinedSystemPrompt;
      }

      // Add resume option if continuing a session
      if (sessionId) {
        options.resume = sessionId;
      }

      const queryIterator = query({
        prompt,
        options,
      }) as AsyncIterable<SDKMessage>;

      for await (const message of queryIterator) {
        // Capture session ID from init message (but don't send it to client in this noisy format)
        if (message.type === 'system' && message.subtype === 'init') {
          capturedSessionId = message.session_id;
          this.logger.debug(`Session ID: ${capturedSessionId}`);
          // Send just the session ID to the client
          res.write('event: session\n');
          res.write(
            `data: ${JSON.stringify({ sessionId: capturedSessionId })}\n\n`,
          );
          continue;
        }

        // Stream each message as an SSE event
        const eventType = message.type ?? 'message';
        res.write(`event: ${eventType}\n`);
        res.write(`data: ${JSON.stringify(message)}\n\n`);

        // Log progress for debugging
        if (message.type === 'assistant') {
          this.logger.debug(`Assistant message received`);
        }
      }

      // Send completion event with session ID for future resumption
      res.write('event: done\n');
      res.write(
        `data: ${JSON.stringify({ status: 'completed', sessionId: capturedSessionId })}\n\n`,
      );
      this.logger.log('Execution completed successfully');

      return { sessionId: capturedSessionId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Execution failed: ${errorMessage}`);

      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);

      return { sessionId: capturedSessionId };
    } finally {
      res.end();
    }
  }

  /**
   * List available commands from .claude/commands/
   */
  async listCommands(): Promise<{ commands: CommandInfo[] }> {
    const commandsDir = join(this.projectRoot, '.claude', 'commands');
    this.logger.debug(`Looking for commands in: ${commandsDir}`);

    if (!existsSync(commandsDir)) {
      this.logger.warn(`Commands directory not found: ${commandsDir}`);
      return { commands: [] };
    }

    try {
      const files = await readdir(commandsDir);
      const commands: CommandInfo[] = [];

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const name = '/' + file.replace('.md', '');
        let description = file.replace('.md', '').replace(/-/g, ' ');

        // Try to extract description from file content
        try {
          const content = await readFile(join(commandsDir, file), 'utf-8');
          const firstLine = content.split('\n')[0];
          if (firstLine && firstLine.startsWith('#')) {
            description = firstLine.replace(/^#+\s*/, '');
          }
        } catch {
          // Use default description if file read fails
        }

        commands.push({ name, description });
      }

      this.logger.log(`Found ${commands.length} commands`);
      return { commands };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing commands: ${errorMessage}`);
      return { commands: [] };
    }
  }

  /**
   * List available skills from .claude/skills/
   */
  async listSkills(): Promise<{ skills: SkillInfo[] }> {
    const skillsDir = join(this.projectRoot, '.claude', 'skills');
    this.logger.debug(`Looking for skills in: ${skillsDir}`);

    if (!existsSync(skillsDir)) {
      this.logger.warn(`Skills directory not found: ${skillsDir}`);
      return { skills: [] };
    }

    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      const skills: SkillInfo[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const name = entry.name;
        let description = name.replace(/-/g, ' ');

        // Try to extract description from SKILL.md
        try {
          const skillFile = join(skillsDir, name, 'SKILL.md');
          if (existsSync(skillFile)) {
            const content = await readFile(skillFile, 'utf-8');
            const firstLine = content.split('\n')[0];
            if (firstLine && firstLine.startsWith('#')) {
              description = firstLine.replace(/^#+\s*/, '');
            }
          }
        } catch {
          // Use default description if file read fails
        }

        skills.push({ name, description });
      }

      this.logger.log(`Found ${skills.length} skills`);
      return { skills };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error listing skills: ${errorMessage}`);
      return { skills: [] };
    }
  }
}
