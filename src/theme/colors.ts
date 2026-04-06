// 테마 설정: src/theme/colors.ts
export const colors = {
  // 브랜드 컬러
  primary: {
    50:  '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1',
    600: '#4F46E5',
    700: '#4338CA',
    DEFAULT: '#6366F1',
  },

  // 수입/지출/이체 컬러
  income:   { DEFAULT: '#10B981', light: '#D1FAE5', dark: '#065F46' },
  expense:  { DEFAULT: '#EF4444', light: '#FEE2E2', dark: '#7F1D1D' },
  transfer: { DEFAULT: '#F59E0B', light: '#FEF3C7', dark: '#78350F' },

  // 라이트 모드
  light: {
    background:  '#F9FAFB',
    surface:     '#FFFFFF',
    surface2:    '#F3F4F6',
    border:      '#E5E7EB',
    text:        '#111827',
    textSecondary: '#6B7280',
    textTertiary:  '#9CA3AF',
  },

  // 다크 모드
  dark: {
    background:  '#000000',
    surface:     '#1C1C1E',
    surface2:    '#2C2C2E',
    border:      '#3A3A3C',
    text:        '#F9FAFB',
    textSecondary: '#9CA3AF',
    textTertiary:  '#6B7280',
  },

  // 공통
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',

  // 우선순위 컬러
  priority: {
    low:    '#6B7280',
    medium: '#F59E0B',
    high:   '#EF4444',
    urgent: '#DC2626',
  },
} as const;
