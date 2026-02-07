/**
 * Debug script to check all deliverables, versions, and conversations
 * Run with: npx ts-node apps/api/src/agent2agent/deliverables/debug-deliverables.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { getTableName } from '@/supabase/supabase.config';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugDeliverables() {
  const client = supabase;

  console.log('\n=== ALL DELIVERABLES ===\n');

  // Get all deliverables with their versions and conversation info
  const { data: deliverables, error } = await client
    .from(getTableName('deliverables'))
    .select(
      `
      id,
      user_id,
      conversation_id,
      title,
      type,
      agent_name,
      created_at,
      updated_at,
      metadata,
      deliverable_versions (
        id,
        version_number,
        format,
        is_current_version,
        created_at,
        metadata
      )
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching deliverables:', error);
    return;
  }

  console.log(`Total deliverables found: ${deliverables?.length || 0}\n`);

  // Define types for better type safety
  interface DeliverableVersion {
    id: string;
    version_number: number;
    format: string;
    is_current_version: boolean;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }

  interface DeliverableRecord {
    id: string;
    user_id: string;
    conversation_id: string | null;
    title: string;
    type: string;
    agent_name: string | null;
    created_at: string;
    updated_at: string;
    metadata: Record<string, unknown> | null;
    deliverable_versions?: DeliverableVersion[];
  }

  interface ConversationRecord {
    id: string;
    user_id: string;
    agent_name: string;
    agent_type: string;
    created_at: string;
    title: string | null;
  }

  const typedDeliverables = (deliverables || []) as DeliverableRecord[];

  // Group by user_id to see if there are different users
  const byUserId = new Map<string, DeliverableRecord[]>();
  typedDeliverables.forEach((d) => {
    const userId = d.user_id;
    if (!byUserId.has(userId)) {
      byUserId.set(userId, []);
    }
    byUserId.get(userId)!.push(d);
  });

  console.log(`\n=== BY USER ID ===`);
  byUserId.forEach((dels, userId) => {
    console.log(`\nUser ID: ${userId}`);
    console.log(`  Deliverables: ${dels.length}`);
    dels.forEach((d) => {
      console.log(`    - ${d.title} (${d.type})`);
      console.log(`      ID: ${d.id}`);
      console.log(`      Agent: ${d.agent_name || 'none'}`);
      console.log(`      Conversation ID: ${d.conversation_id || 'none'}`);
      console.log(`      Versions: ${d.deliverable_versions?.length || 0}`);
      if (d.deliverable_versions && d.deliverable_versions.length > 0) {
        d.deliverable_versions.forEach((v) => {
          console.log(
            `        v${v.version_number} (${v.format}) - current: ${v.is_current_version}`,
          );
        });
      }
    });
  });

  // Check conversations
  console.log(`\n=== CONVERSATIONS ===\n`);
  const conversationIds = new Set<string>();
  typedDeliverables.forEach((d) => {
    if (d.conversation_id) {
      conversationIds.add(d.conversation_id);
    }
  });

  if (conversationIds.size > 0) {
    const { data: conversations, error: convError } = await client
      .from('agent_conversations')
      .select('id, user_id, agent_name, agent_type, created_at, title')
      .in('id', Array.from(conversationIds));

    if (convError) {
      console.error('Error fetching conversations:', convError);
    } else {
      const typedConversations = (conversations || []) as ConversationRecord[];
      console.log(`Found ${typedConversations.length} conversations:\n`);
      typedConversations.forEach((conv) => {
        const relatedDeliverables = typedDeliverables.filter(
          (d) => d.conversation_id === conv.id,
        );
        console.log(`Conversation: ${conv.title || conv.id}`);
        console.log(`  ID: ${conv.id}`);
        console.log(`  User ID: ${conv.user_id}`);
        console.log(`  Agent: ${conv.agent_name} (${conv.agent_type})`);
        console.log(`  Deliverables: ${relatedDeliverables.length}`);
        relatedDeliverables.forEach((d) => {
          console.log(`    - ${d.title} (${d.type})`);
        });
        console.log('');
      });
    }
  }

  // Compare simple vs complex deliverables
  console.log(`\n=== COMPARISON: SIMPLE vs COMPLEX ===\n`);

  const simpleDeliverables = typedDeliverables.filter(
    (d) =>
      !d.conversation_id ||
      (d.agent_name !== 'marketing-swarm' && d.agent_name !== 'cad-agent'),
  );

  const complexDeliverables = typedDeliverables.filter(
    (d) =>
      d.conversation_id &&
      (d.agent_name === 'marketing-swarm' || d.agent_name === 'cad-agent'),
  );

  console.log(
    `Simple deliverables (no conversation or not swarm/CAD): ${simpleDeliverables.length}`,
  );
  simpleDeliverables.forEach((d) => {
    console.log(`  - ${d.title}`);
    console.log(`    User ID: ${d.user_id}`);
    console.log(`    Conversation ID: ${d.conversation_id || 'none'}`);
    console.log(`    Agent: ${d.agent_name || 'none'}`);
  });

  console.log(
    `\nComplex deliverables (swarm/CAD with conversation): ${complexDeliverables.length}`,
  );
  complexDeliverables.forEach((d) => {
    console.log(`  - ${d.title}`);
    console.log(`    User ID: ${d.user_id}`);
    console.log(`    Conversation ID: ${d.conversation_id}`);
    console.log(`    Agent: ${d.agent_name}`);
    console.log(`    Versions: ${d.deliverable_versions?.length || 0}`);
  });
}

debugDeliverables().catch(console.error);
