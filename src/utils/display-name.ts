import { User } from '@supabase/supabase-js';
import { UserProfile } from '../types';

const pickNonEmptyString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

export function getDisplayName(
  user: User | null,
  profile: UserProfile | null,
  fallback = '사용자'
): string {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return (
    pickNonEmptyString(
      profile?.display_name,
      metadata.display_name,
      metadata.full_name,
      metadata.name,
      user?.email?.split('@')[0]
    ) ?? fallback
  );
}
