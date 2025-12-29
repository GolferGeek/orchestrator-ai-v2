import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Helper to use orch_flow schema
const orchFlow = () => supabase.schema('orch_flow');

interface OnlineUser {
  user_id: string;
  display_name: string;
}

export function usePartyFoul() {
  const checkForPartyFouls = useCallback(async () => {
    // Get the presence state to see who's online
    const channel = supabase.channel('party-foul-check');
    
    // We need to get online users and their in_progress tasks
    // First, let's get all tasks that are in_progress
    const { data: inProgressTasks } = await orchFlow()
      .from('tasks')
      .select('user_id')
      .eq('status', 'in_progress')
      .is('parent_task_id', null);

    const usersWithInProgress = new Set(
      inProgressTasks?.map(t => t.user_id).filter(Boolean) || []
    );

    // Get online users from presence
    const presenceChannel = supabase.channel('team-presence');
    
    // Subscribe briefly to get presence state
    return new Promise<void>((resolve) => {
      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const slackers: string[] = [];

          // Check each online user
          Object.entries(state).forEach(([userId, presences]) => {
            if (presences && presences.length > 0) {
              const presence = presences[0] as unknown as OnlineUser;
              if (!usersWithInProgress.has(userId)) {
                slackers.push(presence.display_name || 'Someone');
              }
            }
          });

          // Unsubscribe after checking
          supabase.removeChannel(presenceChannel);

          // Show party foul notifications
          if (slackers.length > 0) {
            const message = slackers.length === 1
              ? `🚨 Party Foul! ${slackers[0]} has nothing in progress!`
              : `🚨 Party Foul! ${slackers.join(' & ')} have nothing in progress!`;
            
            toast.error(message, {
              duration: 8000,
