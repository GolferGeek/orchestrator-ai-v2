#!/usr/bin/env npx tsx
/**
 * Fix data-analyst requestTransform to include taskId
 * 
 * The DataAnalystRequestDto requires taskId, but it was missing from the transform.
 * This script updates the endpoint.requestTransform to include taskId.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDataAnalystRequestTransform() {
  console.log('🔧 Fixing data-analyst requestTransform to include taskId...\n');

  // Get current agent configuration
  const { data: agent, error: fetchError } = await supabase
    .from('agents')
    .select('slug, endpoint')
    .eq('slug', 'data-analyst')
    .single();

  if (fetchError || !agent) {
    console.error('❌ Error fetching data-analyst agent:', fetchError);
    process.exit(1);
  }

  console.log('📋 Current endpoint configuration:');
  console.log(JSON.stringify(agent.endpoint, null, 2));
  console.log('');

  // Update requestTransform to include taskId
  const currentEndpoint = agent.endpoint as Record<string, unknown>;
  const updatedEndpoint = {
    ...currentEndpoint,
    requestTransform: {
      taskId: '{{taskId}}',
      question: '{{userMessage}}',
      userId: '{{userId}}',
      conversationId: '{{conversationId}}',
    },
  };

  // Update the agent
  const { error: updateError } = await supabase
    .from('agents')
    .update({ endpoint: updatedEndpoint })
    .eq('slug', 'data-analyst');

  if (updateError) {
    console.error('❌ Error updating agent:', updateError);
    process.exit(1);
  }

  console.log('✅ Successfully updated data-analyst requestTransform!');
  console.log('\n📋 Updated requestTransform:');
  console.log(JSON.stringify(updatedEndpoint.requestTransform, null, 2));
  console.log('\n✨ Done!');
}

fixDataAnalystRequestTransform().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

