#!/usr/bin/env npx tsx
/**
 * Quick fix: Update data-analyst requestTransform to include taskId
 */

import { createClient } from '@supabase/supabase-js';

// Use the same defaults as the API
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Updating data-analyst requestTransform...\n');

  // Get current endpoint
  const { data: agent, error: fetchError } = await supabase
    .from('agents')
    .select('endpoint')
    .eq('slug', 'data-analyst')
    .single();

  if (fetchError) {
    console.error('Error:', fetchError);
    process.exit(1);
  }

  const endpoint = (agent?.endpoint as Record<string, unknown>) || {};
  const updatedEndpoint = {
    ...endpoint,
    requestTransform: {
      taskId: '{{taskId}}',
      question: '{{userMessage}}',
      userId: '{{userId}}',
      conversationId: '{{conversationId}}',
    },
  };

  const { error: updateError } = await supabase
    .from('agents')
    .update({ endpoint: updatedEndpoint })
    .eq('slug', 'data-analyst');

  if (updateError) {
    console.error('Error:', updateError);
    process.exit(1);
  }

  console.log('✅ Updated successfully!');
}

main();

