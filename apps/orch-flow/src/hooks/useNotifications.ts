import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseAvailable } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Helper to use orch_flow schema
const orchFlow = () => supabase.schema('orch_flow');

export interface Notification {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  type: string;
  task_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications(guestName?: string) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const playNotificationSoundRef = useRef<() => void>(() => {});

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      let query = orchFlow()
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (user) {
        query = query.eq('user_id', user.id);
      } else if (guestName) {
        query = query.eq('guest_name', guestName);
      } else {
        return;
      }

      const { data, error } = await query;
      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };

    fetchNotifications();

    // Subscribe to realtime changes only if Supabase is accessible
    let channel: ReturnType<typeof supabase.channel> | null = null;

    isSupabaseAvailable().then((isAvailable) => {
      if (!isAvailable) {
        console.debug('[useNotifications] Supabase not accessible - skipping realtime subscription');
        return;
      }

      channel = supabase
        .channel('notifications-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'orch_flow',
            table: 'notifications',
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newNotif = payload.new as Notification;
              // Only add if it's for this user/guest
              if ((user && newNotif.user_id === user.id) ||
                  (!user && guestName && newNotif.guest_name === guestName)) {
                setNotifications(prev => [newNotif, ...prev]);
                setUnreadCount(prev => prev + 1);
                playNotificationSoundRef.current();
              }
            } else if (payload.eventType === 'UPDATE') {
              setNotifications(prev =>
                prev.map(n => n.id === payload.new.id ? payload.new as Notification : n)
              );
              // Recalculate unread count
              setNotifications(prev => {
                setUnreadCount(prev.filter(n => !n.is_read).length);
                return prev;
              });
            } else if (payload.eventType === 'DELETE') {
              setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
            }
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch(() => {
          // Ignore cleanup errors
        });
      }
    };
  }, [user, guestName]);

  const playNotificationSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Could not play notification sound');
    }
  }, []);

  // Keep ref in sync with the callback
  useEffect(() => {
    playNotificationSoundRef.current = playNotificationSound;
  }, [playNotificationSound]);

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await orchFlow()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const ids = notifications.filter(n => !n.is_read).map(n => n.id);
    if (ids.length === 0) return;

    const { error } = await orchFlow()
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  }, [notifications]);

  const createNotification = useCallback(async (
    recipientUserId: string | null,
    recipientGuestName: string | null,
    type: string,
    message: string,
    taskId?: string
  ) => {
    const { error } = await orchFlow().from('notifications').insert({
      user_id: recipientUserId,
      guest_name: recipientGuestName,
      type,
      message,
      task_id: taskId || null,
    });

    if (error) {
      console.error('Error creating notification:', error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    createNotification,
  };
}
