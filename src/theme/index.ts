// 테마 설정: src/theme/index.ts
export { colors } from './colors';

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 22,
  full: 9999,
} as const;

export const typography = {
  // 헤딩
  h1: { fontSize: 28, lineHeight: 36, fontFamily: 'Pretendard-Bold' },
  h2: { fontSize: 22, lineHeight: 30, fontFamily: 'Pretendard-Bold' },
  h3: { fontSize: 18, lineHeight: 26, fontFamily: 'Pretendard-SemiBold' },
  h4: { fontSize: 16, lineHeight: 24, fontFamily: 'Pretendard-SemiBold' },
  // 본문
  body1: { fontSize: 16, lineHeight: 24, fontFamily: 'Pretendard-Regular' },
  body2: { fontSize: 14, lineHeight: 22, fontFamily: 'Pretendard-Regular' },
  // 캡션
  caption: { fontSize: 12, lineHeight: 18, fontFamily: 'Pretendard-Regular' },
  // 레이블
  label: { fontSize: 13, lineHeight: 18, fontFamily: 'Pretendard-Medium' },
  // 금액
  amount: { fontSize: 24, lineHeight: 32, fontFamily: 'Pretendard-Bold' },
  amountLg: { fontSize: 36, lineHeight: 44, fontFamily: 'Pretendard-Bold' },
} as const;
