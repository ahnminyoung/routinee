type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

const stringifyError = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
};

export const isMissingTableError = (error: unknown): boolean => {
  const e = (error ?? {}) as SupabaseErrorLike;
  const message = stringifyError(error);
  return (
    e.code === 'PGRST205' ||
    e.code === '42P01' ||
    message.includes('Could not find the table') ||
    message.includes('does not exist')
  );
};

export const isMissingFunctionError = (error: unknown): boolean => {
  const e = (error ?? {}) as SupabaseErrorLike;
  const message = stringifyError(error);
  return (
    e.code === 'PGRST202' ||
    message.includes('Could not find the function')
  );
};

export const toUserFacingSupabaseError = (
  error: unknown,
  contextLabel: string,
  fallbackMessage = '요청 처리 중 오류가 발생했습니다.'
): Error => {
  if (isMissingTableError(error)) {
    return new Error(
      `${contextLabel} 테이블이 아직 생성되지 않았습니다. Supabase SQL 실행으로 기본 스키마를 먼저 만들어주세요.`
    );
  }
  if (isMissingFunctionError(error)) {
    return new Error(
      `${contextLabel} 함수가 아직 생성되지 않았습니다. Supabase SQL 실행으로 RPC 함수를 먼저 만들어주세요.`
    );
  }
  if (error instanceof Error) return error;
  const message = stringifyError(error);
  return new Error(message || fallbackMessage);
};
