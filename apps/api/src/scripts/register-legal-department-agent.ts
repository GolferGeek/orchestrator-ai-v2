/**
 * Script to register the legal-department agent in the database
 *
 * Run with: npx ts-node -r tsconfig-paths/register apps/api/src/scripts/register-legal-department-agent.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get LangGraph port from environment
const langgraphPort = process.env.LANGGRAPH_PORT || '6200';
const langgraphBaseUrl = `http://localhost:${langgraphPort}`;

async function registerLegalDepartmentAgent() {
  console.log('\n=== Registering Legal Department Agent ===\n');

  const agentData = {
    slug: 'legal-department',
    organization_slug: ['legal'], // Legal organization
    name: 'Legal Department AI',
    description: 'AI-powered legal document analysis and routing system',
    version: '1.0.0',
    agent_type: 'api',
    department: 'legal',
    tags: ['legal', 'document-analysis', 'routing', 'langgraph'],
    capabilities: [
      'document-analysis',
      'legal-routing',
      'specialist-delegation',
    ],
    context: `# Legal Department AI

The Legal Department AI is an intelligent document analysis and routing system that:
- Analyzes legal documents (contracts, NDAs, MSAs, etc.)
- Extracts key metadata (parties, dates, signatures, sections)
- Routes documents to appropriate legal specialists
- Provides comprehensive legal analysis and recommendations

## Capabilities
- Document type classification
- Section identification and extraction
- Signature block detection
- Date extraction and normalization
- Party identification
- Legal routing decisions
- Specialist delegation`,
    io_schema: {
      input: {
        type: 'object',
        properties: {
          documents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                mimeType: { type: 'string' },
                base64Data: { type: 'string' },
              },
              required: ['filename', 'mimeType', 'base64Data'],
            },
          },
        },
        required: ['documents'],
      },
      output: {
        type: 'object',
        properties: {
          analysisResults: { type: 'object' },
          routingDecision: { type: 'object' },
          specialistOutputs: { type: 'object' },
        },
      },
    },
    endpoint: {
      url: `${langgraphBaseUrl}/legal-department`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    llm_config: null,
    metadata: {
      forwardConverse: true, // Forward CONVERSE requests to LangGraph API
      langgraph: true,
      supportsHitl: true,
      deliverableType: 'analysis',
    },
  };

  try {
    console.log(
      'Registering agent with data:',
      JSON.stringify(agentData, null, 2),
    );
    console.log(`\nLangGraph endpoint: ${agentData.endpoint.url}\n`);

    interface AgentRecord {
      slug: string;
      name: string;
      agent_type: string;
      organization_slug: string[];
    }

    const result = await supabase
      .from('agents')
      .upsert(agentData, {
        onConflict: 'slug',
      })
      .select()
      .single();

    if (result.error) {
      console.error('❌ Error registering agent:', result.error);
      process.exit(1);
    }

    if (!result.data) {
      console.error('❌ No data returned from upsert');
      process.exit(1);
    }

    const typedData = result.data as unknown as AgentRecord;

    console.log('✅ Successfully registered legal-department agent!');
    console.log('\nAgent details:');
    console.log(`  Slug: ${typedData.slug}`);
    console.log(`  Name: ${typedData.name}`);
    console.log(`  Type: ${typedData.agent_type}`);
    console.log(`  Endpoint: ${agentData.endpoint.url}`);
    console.log(`  Organization: ${typedData.organization_slug.join(', ')}`);
    console.log('\n✅ Agent is now available for use!\n');
  } catch (error) {
    console.error('❌ Failed to register agent:', error);
    process.exit(1);
  }
}

void registerLegalDepartmentAgent();
