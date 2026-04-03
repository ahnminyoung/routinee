import { supabase } from './supabase';
import { Connection } from '../types';
import { toUserFacingSupabaseError } from './supabase-error';

const db = supabase as any;

export interface ConnectedMember {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface FinanceConnectionMember extends ConnectedMember {
  connection_id: string;
  created_by: string;
  share_finance: boolean;
  direction: 'outgoing' | 'incoming';
}

type FinanceConnectionPair = {
  connection_id: string;
  created_by: string;
  share_finance: boolean;
  other_user_id: string;
  direction: 'outgoing' | 'incoming';
};

type UserProfileLite = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
};

const normalizePair = (a: string, b: string): [string, string] => {
  return a < b ? [a, b] : [b, a];
};

export const collabService = {
  fetchMembers: async (currentUserId: string): Promise<ConnectedMember[]> => {
    const { data: links, error: linkError } = await db
      .from('connections')
      .select('*')
      .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`);

    if (linkError) throw toUserFacingSupabaseError(linkError, '연결 멤버');

    const otherUserIds = (links ?? [])
      .map((link: Connection) => (
        link.user_a_id === currentUserId ? link.user_b_id : link.user_a_id
      ))
      .filter((id: string) => id !== currentUserId);

    if (otherUserIds.length === 0) return [];

    const { data: profiles, error: profileError } = await db
      .from('user_profiles')
      .select('id,email,display_name,avatar_url')
      .in('id', otherUserIds);

    if (profileError) throw toUserFacingSupabaseError(profileError, '연결 멤버');

    return (profiles ?? []) as ConnectedMember[];
  },

  connectByEmail: async (currentUserId: string, email: string): Promise<ConnectedMember> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('초대할 이메일을 입력해주세요.');
    }

    const { data: target, error: targetError } = await db
      .from('user_profiles')
      .select('id,email,display_name,avatar_url')
      .eq('email', normalizedEmail)
      .neq('id', currentUserId)
      .maybeSingle();

    if (targetError) throw toUserFacingSupabaseError(targetError, '연결 초대');
    if (!target) {
      throw new Error('해당 이메일의 사용자를 찾을 수 없습니다.');
    }

    const [userAId, userBId] = normalizePair(currentUserId, target.id);
    const { error: insertError } = await db
      .from('connections')
      .upsert(
        {
          user_a_id: userAId,
          user_b_id: userBId,
          created_by: currentUserId,
          share_finance: true,
        },
        { onConflict: 'user_a_id,user_b_id' }
      );

    if (insertError) throw toUserFacingSupabaseError(insertError, '연결 초대');

    return target as ConnectedMember;
  },

  fetchFinanceConnections: async (currentUserId: string): Promise<FinanceConnectionMember[]> => {
    const { data: links, error: linkError } = await db
      .from('connections')
      .select('*')
      .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`);

    if (linkError) throw toUserFacingSupabaseError(linkError, '가계부 공유 멤버');

    const pairs: FinanceConnectionPair[] = ((links ?? []) as Connection[]).map((link) => {
      const otherUserId = link.user_a_id === currentUserId ? link.user_b_id : link.user_a_id;
      return {
        connection_id: link.id,
        created_by: link.created_by,
        share_finance: (link as any).share_finance ?? true,
        other_user_id: otherUserId,
        direction: link.created_by === currentUserId ? 'outgoing' as const : 'incoming' as const,
      };
    });

    const otherUserIds = Array.from(new Set(pairs.map((p) => p.other_user_id)));
    if (otherUserIds.length === 0) return [];

    const { data: profiles, error: profileError } = await db
      .from('user_profiles')
      .select('id,email,display_name,avatar_url')
      .in('id', otherUserIds);

    if (profileError) throw toUserFacingSupabaseError(profileError, '가계부 공유 멤버');

    const profileMap = new Map<string, UserProfileLite>(
      ((profiles ?? []) as UserProfileLite[]).map((p) => [p.id, p])
    );

    return pairs
      .map((pair) => {
        const profile = profileMap.get(pair.other_user_id);
        if (!profile) return null;
        return {
          id: profile.id,
          email: profile.email,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          connection_id: pair.connection_id,
          created_by: pair.created_by,
          share_finance: pair.share_finance,
          direction: pair.direction,
        } satisfies FinanceConnectionMember;
      })
      .filter((member): member is FinanceConnectionMember => member !== null);
  },

  setFinanceShareEnabled: async (connectionId: string, enabled: boolean): Promise<void> => {
    const { error } = await db
      .from('connections')
      .update({ share_finance: enabled })
      .eq('id', connectionId);

    if (error) throw toUserFacingSupabaseError(error, '가계부 공유 설정');
  },
};
