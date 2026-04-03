import {
  format,
  parseISO,
  isToday,
  isTomorrow,
  isYesterday,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  differenceInDays,
  getDay,
  getYear,
  getMonth,
} from 'date-fns';
import { ko } from 'date-fns/locale';

export const DATE_FORMAT = 'yyyy-MM-dd';
export const DISPLAY_DATE_FORMAT = 'M월 d일';
export const DISPLAY_DATE_WITH_DAY = 'M월 d일 (eee)';
export const DISPLAY_MONTH_FORMAT = 'yyyy년 M월';

/**
 * Date 또는 ISO 문자열을 yyyy-MM-dd 형식으로 반환
 */
export function toDateString(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, DATE_FORMAT);
}

/**
 * 오늘 날짜를 yyyy-MM-dd 형식으로 반환
 */
export function today(): string {
  return format(new Date(), DATE_FORMAT);
}

/**
 * 날짜를 한국어 표시 형식으로 반환
 */
export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (isToday(d))     return '오늘';
  if (isTomorrow(d))  return '내일';
  if (isYesterday(d)) return '어제';
  return format(d, DISPLAY_DATE_WITH_DAY, { locale: ko });
}

/**
 * 월 표시 (2024년 1월)
 */
export function formatMonth(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, DISPLAY_MONTH_FORMAT, { locale: ko });
}

/**
 * 요일 반환 (일, 월, 화, ...)
 */
export function formatDayOfWeek(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'eee', { locale: ko });
}

/**
 * 월의 모든 날짜 배열 반환
 */
export function getDaysInMonth(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month - 1));
  const end   = endOfMonth(new Date(year, month - 1));
  return eachDayOfInterval({ start, end });
}

/**
 * 캘린더 그리드용 날짜 배열 (이전/다음 달 채우기 포함)
 */
export function getCalendarGrid(year: number, month: number): Date[] {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd   = endOfMonth(new Date(year, month - 1));
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 }); // 월요일 시작
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

/**
 * 날짜가 오늘인지 확인
 */
export { isToday, isTomorrow, isYesterday, isSameDay, isSameMonth, addMonths, subMonths };

/**
 * 마감일까지 남은 일수 반환 (음수면 지남)
 */
export function daysUntil(dateStr: string): number {
  return differenceInDays(parseISO(dateStr), new Date());
}

/**
 * 마감일 표시 텍스트
 */
export function formatDueDate(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days < 0)  return `${Math.abs(days)}일 지남`;
  if (days === 0) return '오늘 마감';
  if (days === 1) return '내일 마감';
  if (days <= 7)  return `${days}일 후 마감`;
  return format(parseISO(dateStr), DISPLAY_DATE_FORMAT, { locale: ko });
}

export { format, parseISO, getDay, getYear, getMonth };
