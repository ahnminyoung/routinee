// API/도메인 서비스 로직: src/services/feature-flag.service.ts
import Constants from 'expo-constants';

// 런타임에서 참조하는 기능 플래그 정의
type FeatureFlags = {
  // 오프라인 큐/자동 동기화 기능 활성화 여부
  offlineSyncEnabled: boolean;
  // 이벤트 로그 수집/저장 활성화 여부
  opsTelemetryEnabled: boolean;
  // 동기화 실패를 충돌로 승격할 최대 재시도 횟수
  syncConflictRetryLimit: number;
};

// Expo 설정(app.config.js -> extra)에 주입된 값을 읽습니다.
const extra = (
  Constants.expoConfig?.extra ??
  (Constants as any).manifest?.extra ??
  {}
) as Record<string, unknown>;

// 문자열/불리언 혼합 입력을 안전하게 boolean으로 변환합니다.
const parseBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
};

// 문자열/숫자 혼합 입력을 안전하게 number로 변환합니다.
const parseNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

// 앱 시작 시점에 플래그를 1회 계산해 고정값으로 사용합니다.
const flags: FeatureFlags = {
  offlineSyncEnabled: parseBoolean(extra.OFFLINE_SYNC_ENABLED, true),
  opsTelemetryEnabled: parseBoolean(extra.OPS_TELEMETRY_ENABLED, true),
  syncConflictRetryLimit: parseNumber(extra.SYNC_CONFLICT_RETRY_LIMIT, 3),
};

export const featureFlagService = {
  // 전역 플래그 조회 진입점
  get: () => flags,
};
