/**
 * 한국 원화(KRW) 포맷 유틸리티
 */

/**
 * 숫자를 원화 형식으로 포맷 (₩1,234,000)
 */
export function formatCurrency(amount: number, showSign = false): string {
  const formatted = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

  if (showSign) {
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `-${formatted}`;
  }
  return formatted;
}

/**
 * 숫자를 쉼표 포함 문자열로 포맷 (1,234,000)
 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount);
}

/**
 * 문자열 숫자에서 쉼표 제거 후 숫자 반환
 */
export function parseAmount(value: string): number {
  return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
}

/**
 * 금액을 축약 형식으로 포맷 (1.2만, 34만, 1.2억)
 */
export function formatAmountShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 100_000_000) {
    return `${(abs / 100_000_000).toFixed(1)}억`;
  }
  if (abs >= 10_000) {
    return `${(abs / 10_000).toFixed(abs >= 100_000 ? 0 : 1)}만`;
  }
  return formatNumber(abs);
}

/**
 * 퍼센트 포맷 (85.3%)
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}
