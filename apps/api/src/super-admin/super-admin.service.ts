import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';
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

  constructor() {
    // Navigate from apps/api to project root
    this.projectRoot = join(process.cwd(), '..', '..');
    this.logger.log(`Project root set to: ${this.projectRoot}`);
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
      // Load source context if provided
      const systemPrompt = await this.loadSourceContext(sourceContext);

      // Build options - include resume if we have a session ID
      const options: Record<string, unknown> = {
        cwd: this.projectRoot,
        settingSources: ['project'], // Load .claude/* skills, commands, agents
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true, // Enable stream events for tool progress tracking
        allowedTools: [
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
      };

      // Add system prompt if we have context
      if (systemPrompt) {
        options.systemPrompt = systemPrompt;
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
