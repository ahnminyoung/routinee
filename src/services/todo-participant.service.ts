import { supabase } from './supabase';
import { toUserFacingSupabaseError } from './supabase-error';

const db = supabase as any;

export const todoParticipantService = {
  replaceParticipants: async (
    todoId: string,
    ownerId: string,
    participantIds: string[]
  ): Promise<void> => {
    const uniqueIds = Array.from(new Set(participantIds.filter((id) => id && id !== ownerId)));

    const { error: deleteError } = await db
      .from('todo_participants')
      .delete()
      .eq('todo_id', todoId);

    if (deleteError) throw toUserFacingSupabaseError(deleteError, '할일 참여자');

    if (uniqueIds.length === 0) return;

    const rows = uniqueIds.map((userId) => ({
      todo_id: todoId,
      user_id: userId,
      added_by: ownerId,
    }));

    const { error: insertError } = await db
      .from('todo_participants')
      .insert(rows);

    if (insertError) throw toUserFacingSupabaseError(insertError, '할일 참여자');
  },
};
