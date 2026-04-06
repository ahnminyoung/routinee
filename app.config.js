const appJson = require('./app.json');

module.exports = ({ config }) => {
  // app.json 기본값 + EAS/CI 환경 주입값을 병합합니다.
  const base = appJson.expo || config || {};

  return {
    ...base,
    extra: {
      ...(base.extra || {}),
      // Supabase 연결 정보
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      // 오프라인 동기화/운영 관측 플래그
      OFFLINE_SYNC_ENABLED: process.env.EXPO_PUBLIC_OFFLINE_SYNC_ENABLED ?? 'true',
      OPS_TELEMETRY_ENABLED: process.env.EXPO_PUBLIC_OPS_TELEMETRY_ENABLED ?? 'true',
      // 동기화 실패를 충돌로 승격하는 재시도 기준
      SYNC_CONFLICT_RETRY_LIMIT: process.env.EXPO_PUBLIC_SYNC_CONFLICT_RETRY_LIMIT ?? '3',
    },
  };
};
