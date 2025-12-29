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
      .from('shared_tasks')
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
              description: "Time to add a task or face the shame! 😅",
              style: {
                background: 'hsl(var(--destructive))',
                color: 'hsl(var(--destructive-foreground))',
                border: 'none',
              },
            });

            // Also play a shame sound
            playPartyFoulSound();
          }

          resolve();
        })
        .subscribe();

      // Timeout in case presence doesn't sync
      setTimeout(() => {
        supabase.removeChannel(presenceChannel);
        resolve();
      }, 2000);
    });
  }, []);

  return { checkForPartyFouls };
}

function playPartyFoulSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Play a "sad trombone" style descending tone
    const playNote = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sawtooth';
      
      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;
    // Descending "wah wah wah wahhh" pattern
    playNote(392, now, 0.25);        // G4
    playNote(369.99, now + 0.25, 0.25); // F#4
    playNote(349.23, now + 0.5, 0.25);  // F4
    playNote(293.66, now + 0.75, 0.5);  // D4 (held longer)
  } catch (e) {
    console.error('Could not play party foul sound', e);
  }
}
