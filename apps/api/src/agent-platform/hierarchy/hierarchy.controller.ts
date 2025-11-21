import { Controller, Get, Headers, Logger } from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';
import { AgentRegistryService } from '../services/agent-registry.service';
import type { AgentRecord } from '../interfaces/agent.interface';

interface DepartmentAgent {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  type: string;
  description: string;
  status: string;
  namespace: string;
  tags: string[];
  capabilities: string[];
  execution_modes: string[];
  metadata: Record<string, unknown>;
}

interface DepartmentHierarchy {
  [department: string]: DepartmentAgent[];
}

@Controller('hierarchy')
export class HierarchyController {
  private readonly logger = new Logger(HierarchyController.name);

  constructor(private readonly agentRegistry: AgentRegistryService) {}

  /**
   * Test endpoint
   * Route: GET /hierarchy/test
   */
  @Get('test')
  @Public()
  testHierarchy() {
    return {
      message: 'Hierarchy controller working (department-based)',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get agent hierarchy grouped by department
   * Route: GET /hierarchy/agents
   * Also available at: GET /hierarchy/.well-known/hierarchy (for frontend compatibility)
   */
  @Get('agents')
  @Public()
  async getAgentHierarchy(
    @Headers('x-agent-namespace') namespaceHeader?: string,
  ) {
    const namespaces = namespaceHeader
      ? namespaceHeader
          .split(',')
          .map((ns) => ns.trim())
          .filter(Boolean)
      : undefined;

    try {
      // Get agents from database registry
      const agents = namespaces?.length
        ? await this.agentRegistry.listAgentsForNamespaces(
            namespaces.map((ns) => (ns === 'global' ? null : ns)),
          )
        : await this.agentRegistry.listAllAgents();

      // Build department-based hierarchy
      const hierarchy = this.buildDepartmentHierarchy(agents);
      const departments = Object.keys(hierarchy);
      const totalAgents = agents.length;

      return {
        success: true,
        data: hierarchy,
        metadata: {
          totalAgents,
          totalDepartments: departments.length,
          departments,
          namespaces: namespaces ?? 'all',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to build agent hierarchy', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: {},
        metadata: {
          totalAgents: 0,
          totalDepartments: 0,
          departments: [],
          namespaces: namespaces ?? 'all',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Frontend compatibility endpoint
   * Route: GET /hierarchy/.well-known/hierarchy
   */
  @Get('.well-known/hierarchy')
  @Public()
  async getAgentHierarchyWellKnown(
    @Headers('x-agent-namespace') namespaceHeader?: string,
  ) {
    return this.getAgentHierarchy(namespaceHeader);
  }

  /**
   * Build department-based hierarchy from flat agent list
   * Groups agents by their department field
   */
  private buildDepartmentHierarchy(agents: AgentRecord[]): DepartmentHierarchy {
    const hierarchy: DepartmentHierarchy = {};

    for (const agent of agents) {
      const department = agent.department || 'uncategorized';

      // Initialize department array if it doesn't exist
      if (!hierarchy[department]) {
        hierarchy[department] = [];
      }

      // Extract execution_modes from metadata
      const metadataObj = (agent.metadata as Record<string, unknown>) || {};
      let executionModes: string[] = ['immediate']; // default

      const modes = metadataObj.execution_modes;
      if (Array.isArray(modes) && modes.length > 0) {
        executionModes = modes.filter(
          (mode): mode is string => typeof mode === 'string',
        );
      }

      // Create agent entry
      const agentEntry: DepartmentAgent = {
        id: agent.slug,
        slug: agent.slug,
        name: agent.slug,
        displayName: agent.name,
        type: agent.agent_type,
        description: agent.description,
        status: (metadataObj.status as string) || 'active',
        namespace: Array.isArray(agent.organization_slug)
          ? agent.organization_slug.join(',')
          : 'global',
        tags: agent.tags || [],
        capabilities: agent.capabilities || [],
        execution_modes: executionModes,
        metadata: metadataObj,
      };

      hierarchy[department].push(agentEntry);
    }

    // Sort agents within each department by name
    for (const department in hierarchy) {
      if (hierarchy[department]) {
        hierarchy[department].sort((a, b) =>
          a.displayName.localeCompare(b.displayName),
        );
      }
    }

    return hierarchy;
  }
}
