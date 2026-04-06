# 오프라인 동기화 + 보안/운영 설계 메모

이 문서는 면접/포트폴리오 설명용으로 작성되었습니다.

## 1) 오프라인 우선 동기화

### 목표
- 네트워크가 끊겨도 할일/거래 생성·수정·삭제가 즉시 반영되도록 UX 개선
- 온라인 복귀 시 서버와 자동 동기화

### 적용 컴포넌트
- `src/services/offline-queue.service.ts`
- `src/services/offline-sync-manager.service.ts`
- `src/stores/todo.store.ts`
- `src/stores/finance.store.ts`

### 핵심 설계
1. 네트워크 오류를 감지하면 요청을 큐에 저장
2. 화면은 낙관적 업데이트(optimistic update)로 즉시 반영
3. 온라인 복귀(NetInfo) 또는 앱 진입 시 큐 flush
4. 비네트워크 오류가 반복되면 `sync-conflict`로 승격

### 왜 이 방식?
- 장점:
  - 사용자는 오프라인에서도 입력이 끊기지 않음
  - 구현 복잡도를 제어하면서 실사용성 확보
- 트레이드오프:
  - 완전한 CRDT/OT 수준 충돌 해결은 아님
  - 현재는 "재시도 + 충돌 기록" 중심

## 2) 보안(RLS) 검증 자동화

### 목표
- 배포 전에 정책 누락/비활성화를 빠르게 탐지

### 적용 파일
- `supabase/tests/001_rls_policy_audit.sql`

### 검증 항목
- `assets`, `transactions`, `user_subscriptions`의 RLS 활성화 여부
- 핵심 정책 존재 여부(`pg_policies`)

### 왜 메타데이터 스모크 테스트?
- 빠르고 안정적으로 "정책 누락"을 조기 발견 가능
- 환경 차이(staging/prod)에서 동일하게 실행 가능

## 3) 운영 관측(Observability) + 기능 플래그

### 적용 컴포넌트
- `src/services/feature-flag.service.ts`
- `src/services/ops-log.service.ts`
- `app/_layout.tsx` (부트스트랩 로깅)
- `app/(tabs)/settings/ops.tsx` (진단 UI)

### 수집 이벤트 예시
- `app.bootstrap`
- `sync.start`, `sync.flush.start`, `sync.flush.done`
- `todo.offline.enqueued.*`
- `transaction.offline.enqueued.*`
- `sync.item.failed`

### 기능 플래그
- `OFFLINE_SYNC_ENABLED`
- `OPS_TELEMETRY_ENABLED`
- `SYNC_CONFLICT_RETRY_LIMIT`

`app.config.js`에서 `expo.extra`로 주입하여 런타임에서 사용합니다.

### 운영 진단 화면
- 경로: `설정 > 개발 > 동기화/운영 진단`
- 확인 가능 항목:
  - 오프라인 큐 대기 건수
  - 동기화 충돌 건수
  - 최근 운영 이벤트 로그

## 면접에서 설명할 때 포인트
- 문제: "모바일 환경에서는 네트워크 불안정이 기본"
- 선택: "오프라인 큐 + 낙관적 업데이트 + 온라인 복귀 자동 flush"
- 보완: "RLS 정책 스모크 테스트와 운영 이벤트 로그로 안정성 확보"
- 결과: "UX, 보안, 운영성을 함께 개선"
