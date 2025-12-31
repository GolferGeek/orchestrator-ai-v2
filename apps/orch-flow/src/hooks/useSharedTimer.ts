import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Helper to use orch_flow schema
const orchFlow = () => supabase.schema('orch_flow');

interface TimerState {
  id: string;
  end_time: string | null;
  is_running: boolean;
  is_break: boolean;
  duration_seconds: number;
}

const playTimerEndSound = () => {
  const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextClass();

  const playNote = (frequency: number, startTime: number, duration: number) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.4, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };

  const now = audioContext.currentTime;
  playNote(523.25, now, 0.3);
  playNote(659.25, now + 0.15, 0.3);
  playNote(783.99, now + 0.3, 0.4);
};

// Default durations in minutes
const DEFAULT_FOCUS_MINUTES = 25;
const DEFAULT_BREAK_MINUTES = 5;

export function useSharedTimer(onTimerComplete?: () => void, teamId?: string | null) {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_FOCUS_MINUTES * 60);
  const [loading, setLoading] = useState(true);
  const [focusMinutes, setFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES);
  const [autoContinue, setAutoContinue] = useState(true);
  const hasCompletedRef = useRef(false);

  // Fetch initial timer state
  useEffect(() => {
    const fetchTimer = async () => {
      let query = orchFlow()
        .from('timer_state')
        .select('*');

      if (teamId) {
        query = query.eq('team_id', teamId);
      } else {
        query = query.is('team_id', null);
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (error) {
        console.error('Error fetching timer:', error);
      } else if (data) {
        setTimerState(data);
      } else {
        // Create a new timer state for this team if none exists
        const { data: newTimer, error: createError } = await orchFlow()
          .from('timer_state')
          .insert({
            team_id: teamId || null,
            duration_seconds: DEFAULT_FOCUS_MINUTES * 60,
            is_running: false,
            is_break: false,
          })
          .select()
          .single();

        if (!createError && newTimer) {
          setTimerState(newTimer);
        }
      }
      setLoading(false);
    };

    fetchTimer();

    const channel = supabase
      .channel(`timer-changes-${teamId || 'global'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'orch_flow',
          table: 'timer_state',
        },
        (payload) => {
          // Only update if it's for our team
          const newRecord = payload.new as Record<string, unknown>;
          if (teamId && newRecord?.team_id !== teamId) {
            return;
          }
          if (!teamId && newRecord?.team_id !== null) {
            return;
          }
          console.log('Timer update:', payload);
          if (payload.new) {
            setTimerState(payload.new as TimerState);
            if ((payload.new as TimerState).is_running) {
              hasCompletedRef.current = false;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  // Auto-continue: switch modes and restart when timer ends
  const handleAutoContinue = useCallback(async () => {
    if (!timerState) return;

    const newIsBreak = !timerState.is_break;
    const newDuration = newIsBreak ? breakMinutes * 60 : focusMinutes * 60;
    const endTime = new Date(Date.now() + newDuration * 1000).toISOString();

    await orchFlow()
      .from('timer_state')
      .update({
        is_running: true,
        is_break: newIsBreak,
        duration_seconds: newDuration,
        end_time: endTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', timerState.id);
  }, [timerState, focusMinutes, breakMinutes]);

  // Update time left based on timer state
  useEffect(() => {
    if (!timerState) return;

    if (timerState.is_running && timerState.end_time) {
      const updateTimeLeft = () => {
        const endTime = new Date(timerState.end_time!).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(remaining);

        if (remaining === 0 && !hasCompletedRef.current) {
          hasCompletedRef.current = true;
          playTimerEndSound();
          // Only call onTimerComplete for focus sessions, not breaks
          if (!timerState.is_break) {
            onTimerComplete?.();
          }
          
          if (autoContinue) {
            // Small delay before auto-continuing to let the sound play
            setTimeout(() => {
              handleAutoContinue();
            }, 1000);
          } else {
            handleStop();
          }
        }
      };

      updateTimeLeft();
      const interval = setInterval(updateTimeLeft, 100);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(timerState.duration_seconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleStop is defined after this effect, using ref pattern would add complexity
  }, [timerState, onTimerComplete, autoContinue, handleAutoContinue]);

  const handleStart = useCallback(async () => {
    if (!timerState) return;

    hasCompletedRef.current = false;
    const durationMs = timerState.duration_seconds * 1000;
    const endTime = new Date(Date.now() + durationMs).toISOString();

    await orchFlow()
      .from('timer_state')
      .update({
        is_running: true,
        end_time: endTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', timerState.id);
  }, [timerState]);

  const handlePause = useCallback(async () => {
    if (!timerState) return;

    await orchFlow()
      .from('timer_state')
      .update({
        is_running: false,
        duration_seconds: timeLeft,
        end_time: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', timerState.id);
  }, [timerState, timeLeft]);

  const handleStop = useCallback(async () => {
    if (!timerState) return;

    await orchFlow()
      .from('timer_state')
      .update({
        is_running: false,
        is_break: false,
        duration_seconds: focusMinutes * 60,
        end_time: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', timerState.id);
  }, [timerState, focusMinutes]);

  const handleReset = useCallback(async () => {
    if (!timerState) return;

    const newDuration = timerState.is_break ? breakMinutes * 60 : focusMinutes * 60;

    await orchFlow()
      .from('timer_state')
      .update({
        is_running: false,
        duration_seconds: newDuration,
        end_time: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', timerState.id);
  }, [timerState, focusMinutes, breakMinutes]);

  const toggleBreak = useCallback(async () => {
    if (!timerState) return;

    const newIsBreak = !timerState.is_break;
    const newDuration = newIsBreak ? breakMinutes * 60 : focusMinutes * 60;

    await orchFlow()
      .from('timer_state')
      .update({
        is_running: false,
        is_break: newIsBreak,
        duration_seconds: newDuration,
        end_time: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', timerState.id);
  }, [timerState, focusMinutes, breakMinutes]);

  const setCustomDurations = useCallback(async (newFocusMinutes: number, newBreakMinutes: number) => {
    setFocusMinutes(newFocusMinutes);
    setBreakMinutes(newBreakMinutes);
    
    if (!timerState || timerState.is_running) return;
    
    const newDuration = timerState.is_break ? newBreakMinutes * 60 : newFocusMinutes * 60;
    
    await orchFlow()
      .from('timer_state')
      .update({
        duration_seconds: newDuration,
        updated_at: new Date().toISOString(),
      })
      .eq('id', timerState.id);
  }, [timerState]);

  return {
    timeLeft,
    isRunning: timerState?.is_running ?? false,
    isBreak: timerState?.is_break ?? false,
    loading,
    focusMinutes,
    breakMinutes,
    autoContinue,
    setAutoContinue,
    setCustomDurations,
    handleStart,
    handlePause,
    handleReset,
    toggleBreak,
  };
}
