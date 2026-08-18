import { Task, AppSettings, ALL_WEEKDAYS } from '../types';
import { 
  getLocalDateString, 
  getISOWeekString, 
  getYesterdayDateString, 
  getCurrentWeekday, 
  getPreviousScheduledDateString,
  isTaskActiveToday 
} from './dateUtils';

export interface ResetCheckResult {
  tasks: Task[];
  settings: AppSettings;
  didResetDaily: boolean;
  didResetWeekly: boolean;
  resetDate: string;
}

/**
 * Checks if recurring daily/day-of-week or weekly reset conditions are met and performs idempotent updates.
 * - Recurring tasks reset at local midnight. Streak continuity respects their active days schedule.
 * - Weekly tasks reset every Monday at midnight, clearing any one-off 'skip this week' overrides.
 */
export function checkAndApplyRecurringResets(
  tasks: Task[],
  settings: AppSettings,
  currentDate: Date = new Date()
): ResetCheckResult {
  const todayStr = getLocalDateString(currentDate);
  const currentWeekStr = getISOWeekString(currentDate);
  const todayWeekday = getCurrentWeekday(currentDate);

  const isNewDay = settings.lastCheckedDate !== todayStr;
  const isNewWeek = settings.lastCheckedWeek !== currentWeekStr;

  let didResetDaily = false;
  let didResetWeekly = false;

  let updatedTasks = [...tasks];

  if (isNewDay) {
    didResetDaily = true;
    updatedTasks = updatedTasks.map((task) => {
      if (task.type === 'recurring' || (task.type as string) === 'daily') {
        const activeDays = task.activeDays && task.activeDays.length > 0 ? task.activeDays : ALL_WEEKDAYS;
        const lastActiveDateStr = getPreviousScheduledDateString(activeDays, currentDate);

        // Evaluate streak continuity based on task's scheduled active days:
        // If task was completed on the last scheduled active day (or today), streak is maintained.
        // If missed on the last scheduled active day, streak resets to 0.
        let newStreak = task.streak || 0;
        if (task.lastCompletedDate !== lastActiveDateStr && task.lastCompletedDate !== todayStr) {
          newStreak = 0;
        }

        return {
          ...task,
          type: 'recurring',
          activeDays,
          completed: false,
          completedAt: null,
          streak: newStreak,
        };
      }
      return task;
    });
  }

  if (isNewWeek) {
    didResetWeekly = true;
    updatedTasks = updatedTasks.map((task) => {
      if (task.type === 'weekly') {
        return {
          ...task,
          completed: false,
          completedAt: null,
          skipThisWeek: false,
          skippedWeek: undefined,
        };
      }
      return task;
    });
  }

  const updatedSettings: AppSettings = {
    ...settings,
    lastCheckedDate: todayStr,
    lastCheckedWeek: currentWeekStr,
  };

  return {
    tasks: updatedTasks,
    settings: updatedSettings,
    didResetDaily,
    didResetWeekly,
    resetDate: todayStr,
  };
}

/**
 * Handles completing or un-completing a task with streak and history logic.
 */
export function toggleTaskCompletion(task: Task, currentDate: Date = new Date()): Task {
  const todayStr = getLocalDateString(currentDate);
  const nowIso = currentDate.toISOString();
  const activeDays = task.activeDays && task.activeDays.length > 0 ? task.activeDays : ALL_WEEKDAYS;
  const lastActiveDateStr = getPreviousScheduledDateString(activeDays, currentDate);

  // If currently completed -> toggling to incomplete
  if (task.completed) {
    if (task.type === 'recurring' || (task.type as string) === 'daily') {
      // Revert today's streak increment if completed today
      const newStreak = Math.max(0, (task.streak || 1) - 1);
      // Filter out today's record from history
      const newHistory = (task.completionHistory || []).filter((rec) => rec.date !== todayStr);
      const lastRec = newHistory[newHistory.length - 1];

      return {
        ...task,
        type: 'recurring',
        activeDays,
        completed: false,
        completedAt: null,
        streak: newStreak,
        lastCompletedDate: lastRec ? lastRec.date : undefined,
        completionHistory: newHistory,
      };
    }

    if (task.type === 'weekly') {
      return {
        ...task,
        completed: false,
        completedAt: null,
      };
    }

    // One-time task un-completing
    return {
      ...task,
      completed: false,
      completedAt: null,
      archived: false,
    };
  }

  // Toggling from incomplete -> completed
  if (task.type === 'recurring' || (task.type as string) === 'daily') {
    // Calculate new streak respecting scheduled active days
    let newStreak = 1;
    if (task.lastCompletedDate === lastActiveDateStr) {
      newStreak = (task.streak || 0) + 1;
    } else if (task.lastCompletedDate === todayStr) {
      newStreak = task.streak || 1;
    }

    const newBestStreak = Math.max(task.bestStreak || 0, newStreak);
    
    // Add to completion history if not already recorded today
    const history = task.completionHistory || [];
    const alreadyLoggedToday = history.some((r) => r.date === todayStr);
    const newHistory = alreadyLoggedToday
      ? history
      : [...history, { date: todayStr, timestamp: currentDate.getTime() }];

    return {
      ...task,
      type: 'recurring',
      activeDays,
      completed: true,
      completedAt: nowIso,
      streak: newStreak,
      bestStreak: newBestStreak,
      lastCompletedDate: todayStr,
      completionHistory: newHistory,
    };
  }

  if (task.type === 'weekly') {
    const history = task.completionHistory || [];
    const newHistory = [...history, { date: todayStr, timestamp: currentDate.getTime() }];
    return {
      ...task,
      completed: true,
      completedAt: nowIso,
      completionHistory: newHistory,
      lastCompletedDate: todayStr,
    };
  }

  // One-time task completed -> will be archived/disappear from active list
  return {
    ...task,
    completed: true,
    completedAt: nowIso,
    archived: true,
    completionHistory: [{ date: todayStr, timestamp: currentDate.getTime() }],
  };
}
