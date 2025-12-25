import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TeamMember {
  id: string;
  display_name: string;
  is_online: boolean;
}

export function useTeamPresence() {
  const { user, profile } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Fetch all profiles
    const fetchProfiles = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name');

      if (!error && data) {
        setTeamMembers(
          data.map((p) => ({
            id: p.id,
            display_name: p.display_name,
            is_online: onlineUserIds.has(p.id),
          }))
        );
      }
    };

    fetchProfiles();

    // Set up presence channel
    const channel = supabase.channel('team-presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set(Object.keys(state));
        setOnlineUserIds(onlineIds);
        
        setTeamMembers((prev) =>
          prev.map((member) => ({
            ...member,
            is_online: onlineIds.has(member.id),
          }))
        );
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUserIds((prev) => new Set([...prev, key]));
        setTeamMembers((prev) =>
          prev.map((member) =>
            member.id === key ? { ...member, is_online: true } : member
          )
        );
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setTeamMembers((prev) =>
          prev.map((member) =>
            member.id === key ? { ...member, is_online: false } : member
          )
        );
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            display_name: profile?.display_name || 'Unknown',
            online_at: new Date().toISOString(),
          });
        }
      });

    // Listen for profile changes
    const profileChannel = supabase
      .channel('profiles-for-presence')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchProfiles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
    };
  }, [user, profile]);

  return { teamMembers, onlineUserIds };
}
