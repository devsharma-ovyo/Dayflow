import { Weekday, ALL_WEEKDAYS, Task } from '../types';

/**
 * Date and time helper utilities for DayFlow
 */

export const WEEKDAY_MAP: Record<number, Weekday> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export const WEEKDAY_FULL_NAMES: Record<Weekday, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

export function getCurrentWeekday(d: Date = new Date()): Weekday {
  return WEEKDAY_MAP[d.getDay()];
}

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(d: Date = new Date()): string {
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  return getLocalDateString(prev);
}

/**
 * Returns ISO week string in format "YYYY-Www" where Monday is the start of the week.
 */
export function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Helper to format recurring active days cleanly (e.g. "Every Day", "Weekdays (Mon–Fri)", "Mon, Wed, Fri")
 */
export function formatActiveDaysDisplay(activeDays?: Weekday[]): string {
  if (!activeDays || activeDays.length === 0) return 'No days set';
  if (activeDays.length === 7) return 'Every Day (Mon–Sun)';

  const weekdaysList: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const weekendsList: Weekday[] = ['Sat', 'Sun'];

  const isWeekdaysOnly =
    activeDays.length === 5 && weekdaysList.every((d) => activeDays.includes(d));
  if (isWeekdaysOnly) return 'Weekdays (Mon–Fri)';

  const isWeekendsOnly =
    activeDays.length === 2 && weekendsList.every((d) => activeDays.includes(d));
  if (isWeekendsOnly) return 'Weekends (Sat–Sun)';

  // Sort according to ALL_WEEKDAYS order
  const sorted = [...activeDays].sort(
    (a, b) => ALL_WEEKDAYS.indexOf(a) - ALL_WEEKDAYS.indexOf(b)
  );
  return sorted.join(', ');
}

/**
 * Determines whether a task should appear in today's active list
 * - Recurring: only if today's weekday is selected in activeDays
 * - Weekly: only if not skipped this week
 * - One-time: only if not completed and not archived
 */
export function isTaskActiveToday(task: Task, referenceDate: Date = new Date()): boolean {
  if (task.archived) return false;

  if (task.type === 'one-time') {
    return !task.completed;
  }

  if (task.type === 'weekly') {
    const currentWeekStr = getISOWeekString(referenceDate);
    // If skipped this week
    if (task.skipThisWeek && (task.skippedWeek === currentWeekStr || !task.skippedWeek)) {
      return false;
    }
    return true;
  }

  // Recurring (or legacy 'daily')
  const todayWeekday = getCurrentWeekday(referenceDate);
  const activeDays = task.activeDays && task.activeDays.length > 0 ? task.activeDays : ALL_WEEKDAYS;
  return activeDays.includes(todayWeekday);
}

/**
 * Returns the date string (YYYY-MM-DD) of the most recent scheduled active day before referenceDate
 */
export function getPreviousScheduledDateString(
  activeDays: Weekday[] = ALL_WEEKDAYS,
  referenceDate: Date = new Date()
): string {
  const days = activeDays.length > 0 ? activeDays : ALL_WEEKDAYS;
  const cursor = new Date(referenceDate);

  // Look back up to 14 days to find previous active day
  for (let i = 1; i <= 14; i++) {
    cursor.setDate(cursor.getDate() - 1);
    const dayName = getCurrentWeekday(cursor);
    if (days.includes(dayName)) {
      return getLocalDateString(cursor);
    }
  }

  return getYesterdayDateString(referenceDate);
}

/**
 * Parses "HH:MM" 24h format and returns a Date object for today at that time.
 */
export function getDueDateTimeForToday(dueTimeStr: string, referenceDate: Date = new Date()): Date {
  const [hours, minutes] = dueTimeStr.split(':').map(Number);
  const target = new Date(referenceDate);
  target.setHours(hours || 0, minutes || 0, 0, 0);
  return target;
}

/**
 * Formats "HH:MM" into friendly 12h display, e.g. "9:30 AM"
 */
export function formatTimeDisplay(timeStr?: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minuteStr = String(m).padStart(2, '0');
  return `${hour12}:${minuteStr} ${period}`;
}

/**
 * Formats relative time until due, e.g. "in 15 min", "in 1 min", "Overdue by 8 min", "Due now"
 */
export function getRelativeTimeDue(dueTimeStr: string, now: Date = new Date()): {
  text: string;
  diffMinutes: number;
  isOverdue: boolean;
  isImminent: boolean; // within 15 min
} {
  const dueDate = getDueDateTimeForToday(dueTimeStr, now);
  const diffMs = dueDate.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 0) {
    const absMin = Math.abs(diffMinutes);
    if (absMin < 60) {
      return { text: `Overdue by ${absMin}m`, diffMinutes, isOverdue: true, isImminent: false };
    }
    const absHours = Math.floor(absMin / 60);
    const remainMin = absMin % 60;
    return {
      text: `Overdue by ${absHours}h ${remainMin > 0 ? `${remainMin}m` : ''}`.trim(),
      diffMinutes,
      isOverdue: true,
      isImminent: false,
    };
  }

  if (diffMinutes === 0) {
    return { text: 'Due now', diffMinutes, isOverdue: false, isImminent: true };
  }

  if (diffMinutes <= 15) {
    return { text: `in ${diffMinutes}m`, diffMinutes, isOverdue: false, isImminent: true };
  }

  if (diffMinutes <= 60) {
    return { text: `in ${diffMinutes}m`, diffMinutes, isOverdue: false, isImminent: false };
  }

  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return {
    text: `in ${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim(),
    diffMinutes,
    isOverdue: false,
    isImminent: false,
  };
}

/**
 * Milliseconds until next midnight local time
 */
export function getMsUntilNextMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 1, 0); // 1 second after midnight
  return tomorrow.getTime() - now.getTime();
}
