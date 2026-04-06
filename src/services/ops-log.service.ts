// API/도메인 서비스 로직: src/services/ops-log.service.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { featureFlagService } from './feature-flag.service';

// 로그 중요도 구분(진단 화면/콘솔 출력에서 사용)
type LogLevel = 'info' | 'warn' | 'error';

interface OpsEvent {
  id: string;
  name: string;
  level: LogLevel;
  payload: Record<string, unknown>;
  created_at: string;
}

const STORAGE_KEY = 'routinee:ops-events:v1';
// 로컬 저장소가 과도하게 커지지 않도록 최대 보관 건수를 제한합니다.
const MAX_LOG_SIZE = 250;

const nowIso = () => new Date().toISOString();

async function readEvents(): Promise<OpsEvent[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OpsEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

async function writeEvents(events: OpsEvent[]) {
  // 최근 로그 중심 진단이 목적이므로 최신 MAX_LOG_SIZE 건만 유지합니다.
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_LOG_SIZE)));
}

export const opsLogService = {
  // 운영 로그는 "문제 재현"과 "면접 설명"에 바로 쓸 수 있도록 로컬 저장합니다.
  log: async (name: string, payload: Record<string, unknown> = {}, level: LogLevel = 'info') => {
    const { opsTelemetryEnabled } = featureFlagService.get();
    if (!opsTelemetryEnabled) return;

    const event: OpsEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      level,
      payload,
      created_at: nowIso(),
    };

    const events = await readEvents();
    await writeEvents([...events, event]);

    // 개발 중 즉시 확인을 위해 콘솔에도 동일 이벤트를 남깁니다.
    if (level === 'error') {
      console.error(`[OpsLog] ${name}`, payload);
    } else if (level === 'warn') {
      console.warn(`[OpsLog] ${name}`, payload);
    } else {
      console.log(`[OpsLog] ${name}`, payload);
    }
  },

  // 진단 화면에서 최근 로그를 읽을 때 사용합니다.
  list: async () => readEvents(),

  clear: async () => {
    // 사용자가 진단 로그를 초기화할 수 있도록 삭제 API를 제공합니다.
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};
