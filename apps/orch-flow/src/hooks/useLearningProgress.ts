import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface LearningProgress {
  id: string;
  user_id: string;
  organization_slug: string;
  milestone_key: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

// Predefined milestone keys for the onboarding journey
export const MILESTONE_KEYS = {
  // Hardware & Setup
  HARDWARE_SETUP: 'hardware_setup',
  LOCAL_ENV_CONFIGURED: 'local_env_configured',

  // First Steps
  FIRST_CONVERSATION: 'first_conversation',
  FIRST_AGENT_CREATED: 'first_agent_created',
  FIRST_AGENT_TESTED: 'first_agent_tested',

  // Integration
  API_INTEGRATION: 'api_integration',
  WEBHOOK_CONFIGURED: 'webhook_configured',

  // Production
  STAGING_DEPLOYED: 'staging_deployed',
  PRODUCTION_DEPLOYED: 'production_deployed',
  MONITORING_CONFIGURED: 'monitoring_configured',
} as const;

// Helper to get orch_flow schema client
const orchFlowSchema = () => supabase.schema('orch_flow');

export function useLearningProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<LearningProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    const { data, error } = await orchFlowSchema()
      .from('learning_progress')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at');

    if (error) {
      console.error('Error fetching learning progress:', error);
      setError(error.message);
    } else {
      setProgress(data || []);
    }

    setLoading(false);
  }, [user]);

  // Check if a milestone is completed
  const isMilestoneCompleted = useCallback((milestoneKey: string) => {
    return progress.some(
      p => p.milestone_key === milestoneKey && p.completed_at !== null
    );
  }, [progress]);

  // Get progress for a specific milestone
  const getMilestone = useCallback((milestoneKey: string) => {
    return progress.find(p => p.milestone_key === milestoneKey);
  }, [progress]);

  // Mark a milestone as completed
  const completeMilestone = useCallback(async (
    milestoneKey: string,
    organizationSlug: string,
    notes?: string
  ) => {
    if (!user) throw new Error('User not authenticated');

    // Check if already exists
    const existing = getMilestone(milestoneKey);

    if (existing) {
      // Update existing
      const { error } = await orchFlowSchema()
        .from('learning_progress')
        .update({
          completed_at: new Date().toISOString(),
          notes: notes || existing.notes,
        })
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating milestone:', error);
        throw error;
      }
    } else {
      // Create new
      const { error } = await orchFlowSchema()
        .from('learning_progress')
        .insert({
          user_id: user.id,
          organization_slug: organizationSlug,
          milestone_key: milestoneKey,
          completed_at: new Date().toISOString(),
          notes: notes || null,
        });

      if (error) {
        console.error('Error creating milestone:', error);
        throw error;
      }
    }

    await fetchProgress();
  }, [user, getMilestone, fetchProgress]);

  // Add notes to a milestone without completing it
  const addMilestoneNotes = useCallback(async (
    milestoneKey: string,
    organizationSlug: string,
    notes: string
  ) => {
    if (!user) throw new Error('User not authenticated');

    const existing = getMilestone(milestoneKey);

    if (existing) {
      const { error } = await orchFlowSchema()
        .from('learning_progress')
        .update({ notes })
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating milestone notes:', error);
        throw error;
      }
    } else {
      const { error } = await orchFlowSchema()
        .from('learning_progress')
        .insert({
          user_id: user.id,
          organization_slug: organizationSlug,
          milestone_key: milestoneKey,
          notes,
        });

      if (error) {
        console.error('Error creating milestone with notes:', error);
        throw error;
      }
    }

    await fetchProgress();
  }, [user, getMilestone, fetchProgress]);

  // Get completion percentage
  const getCompletionPercentage = useCallback((milestoneKeys: string[]) => {
    if (milestoneKeys.length === 0) return 0;

    const completed = milestoneKeys.filter(key => isMilestoneCompleted(key)).length;
    return Math.round((completed / milestoneKeys.length) * 100);
  }, [isMilestoneCompleted]);

  useEffect(() => {
    if (user) {
      fetchProgress();
    }
  }, [user, fetchProgress]);

  return {
    progress,
    loading,
    error,
    fetchProgress,
    isMilestoneCompleted,
    getMilestone,
    completeMilestone,
    addMilestoneNotes,
    getCompletionPercentage,
    MILESTONE_KEYS,
  };
}
