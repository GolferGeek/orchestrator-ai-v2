import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_by_user_id: string | null;
  created_by_guest: string | null;
  created_at: string;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  content: string;
  user_id: string | null;
  guest_name: string | null;
  created_at: string;
  profile?: {
    display_name: string;
  };
}

export const useChannelMessages = (teamId?: string | null) => {
  const { user, profile } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch channels
  useEffect(() => {
    const fetchChannels = async () => {
      let query = supabase
        .from('channels')
        .select('*')
        .order('created_at', { ascending: true });

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching channels:', error);
        return;
      }

      setChannels(data || []);
      if (data && data.length > 0 && !activeChannelId) {
        setActiveChannelId(data[0].id);
      }
      setLoading(false);
    };

    fetchChannels();

    // Subscribe to channel changes
    const channelSub = supabase
      .channel('channels-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channels' },
        (payload) => {
          // Only update if it's for our team
          if (teamId && (payload.new as any)?.team_id !== teamId && (payload.old as any)?.team_id !== teamId) {
            return;
          }
          if (payload.eventType === 'INSERT') {
            setChannels((prev) => [...prev, payload.new as Channel]);
          } else if (payload.eventType === 'DELETE') {
            setChannels((prev) => prev.filter((c) => c.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setChannels((prev) =>
              prev.map((c) => (c.id === payload.new.id ? (payload.new as Channel) : c))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSub);
    };
  }, [teamId]);

  // Fetch messages for active channel
  useEffect(() => {
    if (!activeChannelId) return;

    const fetchMessages = async () => {
      // Fetch messages without profile join since there's no FK
      const { data: messagesData, error } = await supabase
        .from('channel_messages')
        .select('*')
        .eq('channel_id', activeChannelId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      // Fetch profiles separately for user_ids
      const userIds = [...new Set((messagesData || []).filter(m => m.user_id).map(m => m.user_id))];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.display_name;
          return acc;
        }, {} as Record<string, string>);
      }

      const messagesWithProfiles = (messagesData || []).map(m => ({
        ...m,
        profile: m.user_id && profilesMap[m.user_id] ? { display_name: profilesMap[m.user_id] } : undefined,
      }));

      setMessages(messagesWithProfiles);
    };

    fetchMessages();

    // Subscribe to message changes for this channel
    const messageSub = supabase
      .channel(`messages-${activeChannelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_messages',
          filter: `channel_id=eq.${activeChannelId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Fetch the profile for the new message
            const newMessage = payload.new as ChannelMessage;
            if (newMessage.user_id) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', newMessage.user_id)
                .single();
              
              newMessage.profile = profileData || undefined;
            }
            setMessages((prev) => [...prev, newMessage]);
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageSub);
    };
  }, [activeChannelId]);

  const sendMessage = async (content: string, guestName?: string) => {
    if (!activeChannelId || !content.trim()) return;

    const { error } = await supabase.from('channel_messages').insert({
      channel_id: activeChannelId,
      content: content.trim(),
      user_id: user?.id || null,
      guest_name: !user ? (guestName || 'Guest') : null,
    });

    if (error) {
      console.error('Error sending message:', error);
    }
  };

  const createChannel = async (name: string, description?: string) => {
    const { data, error } = await supabase
      .from('channels')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        created_by_user_id: user?.id || null,
        created_by_guest: !user ? (profile?.display_name || 'Guest') : null,
        team_id: teamId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating channel:', error);
      return null;
    }

    return data;
  };

  const deleteChannel = async (channelId: string) => {
    const { error } = await supabase.from('channels').delete().eq('id', channelId);

    if (error) {
      console.error('Error deleting channel:', error);
    }
  };

  return {
    channels,
    messages,
    activeChannelId,
    setActiveChannelId,
    loading,
    sendMessage,
    createChannel,
    deleteChannel,
  };
};
