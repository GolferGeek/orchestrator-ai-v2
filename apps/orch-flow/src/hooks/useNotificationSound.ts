import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const NOTIFICATION_CHANNEL = 'notification-broadcast';

export function useNotificationSound() {
  // Subscribe to notification broadcasts
  useEffect(() => {
    const channel = supabase.channel(NOTIFICATION_CHANNEL);

    channel
      .on('broadcast', { event: 'notify' }, () => {
        playNotificationSound();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    // Create a simple notification beep using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for the beep
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // Second beep
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      osc2.frequency.value = 1046.5; // C6 note
      osc2.type = 'sine';
      
      gain2.gain.setValueAtTime(0.5, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.5);
    }, 200);
  }, []);

  const broadcastNotification = useCallback(async () => {
    const channel = supabase.channel(NOTIFICATION_CHANNEL);
    
    await channel.subscribe();
    
    await channel.send({
      type: 'broadcast',
      event: 'notify',
      payload: {},
    });

    // Also play locally
    playNotificationSound();
  }, [playNotificationSound]);

  return {
    broadcastNotification,
    playNotificationSound,
  };
}
