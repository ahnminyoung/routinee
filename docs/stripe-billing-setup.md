# Stripe Billing Setup (Routinee)

이 문서는 `Routinee Pro` Stripe 구독 연동을 실제로 동작시키기 위한 최소 설정 가이드입니다.

## 1) Stripe 준비

1. Stripe 대시보드에서 월 구독 `Price` 생성
2. `price_...` 값을 복사
3. Webhook endpoint URL 준비

권장 이벤트:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

## 2) Supabase 마이그레이션 적용

다음 SQL이 순서대로 반영되어야 합니다.
- `supabase/migrations/012_user_subscriptions.sql`
- `supabase/migrations/013_subscription_provider_ids.sql`

## 3) Edge Function 배포

```bash
supabase functions deploy create-stripe-checkout-session
supabase functions deploy create-stripe-portal-session
supabase functions deploy stripe-webhook
```

## 4) Supabase secrets 설정

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_xxx
supabase secrets set STRIPE_PRICE_ID_MONTHLY=price_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set APP_RETURN_URL=routinee://billing/return
```

`APP_RETURN_URL`은 Expo scheme(`routinee`)과 맞춰야 합니다.

## 5) Stripe Webhook endpoint 등록

배포된 함수 URL 예시:

```text
https://<project-ref>.functions.supabase.co/stripe-webhook
```

Stripe 대시보드 Webhook endpoint로 등록하고, `Signing secret`를 `STRIPE_WEBHOOK_SECRET`로 입력합니다.

## 6) 앱에서 확인

1. `설정 > Routinee Pro` 이동
2. `Stripe로 Pro 구독하기` 실행
3. 결제 완료 후 앱 복귀
4. `결제 후 상태 새로고침` 클릭
5. Pro 잠금 해제 확인 (`리포트 내보내기`, `공유 멤버 무제한`)

## 참고

- 현재는 Hosted Checkout + Billing Portal 방식입니다.
- 추후 앱스토어 인앱결제가 필요하면 RevenueCat 경로를 병행할 수 있습니다.
