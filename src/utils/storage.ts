import { Task, AppSettings, ALL_WEEKDAYS } from '../types';
import { getLocalDateString, getISOWeekString, getYesterdayDateString } from './dateUtils';

const TASKS_STORAGE_KEY = 'dayflow_tasks_v1';
const SETTINGS_STORAGE_KEY = 'dayflow_settings_v1';

export const INITIAL_SAMPLE_TASKS: Task[] = [
  {
    id: 'sample-1',
    title: 'Morning reflection & prioritize top 3 outcomes',
    notes: 'Spend 5 quiet minutes aligning the day in macOS notes',
    type: 'recurring',
    activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    priority: 'high',
    dueTime: '08:30',
    completed: false,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    completedAt: null,
    order: 0,
    streak: 3,
    bestStreak: 7,
    completionHistory: [
      { date: getYesterdayDateString(), timestamp: Date.now() - 86400000 },
      { date: getYesterdayDateString(new Date(Date.now() - 86400000)), timestamp: Date.now() - 86400000 * 2 },
      { date: getYesterdayDateString(new Date(Date.now() - 86400000 * 2)), timestamp: Date.now() - 86400000 * 3 },
    ],
    lastCompletedDate: getYesterdayDateString(),
  },
  {
    id: 'sample-2',
    title: 'Hydration & 30-min brisk walk or stretch',
    notes: 'Get fresh outdoor light before deep work block (Weekdays)',
    type: 'recurring',
    activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    priority: 'medium',
    dueTime: '12:00',
    completed: false,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    completedAt: null,
    order: 1,
    streak: 2,
    bestStreak: 5,
    completionHistory: [
      { date: getYesterdayDateString(), timestamp: Date.now() - 86400000 },
      { date: getYesterdayDateString(new Date(Date.now() - 86400000)), timestamp: Date.now() - 86400000 * 2 },
    ],
    lastCompletedDate: getYesterdayDateString(),
  },
  {
    id: 'sample-3',
    title: 'Submit weekly milestone recap & roadmap sync',
    notes: 'Review project boards and document progress for team review',
    type: 'weekly',
    skipThisWeek: false,
    priority: 'high',
    dueTime: '16:00',
    completed: false,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    completedAt: null,
    order: 0,
    streak: 1,
    bestStreak: 3,
    completionHistory: [],
  },
  {
    id: 'sample-4',
    title: 'Review inbox zero & file system cleanup',
    notes: 'Archive downloads and clean up desktop workspace',
    type: 'weekly',
    skipThisWeek: false,
    priority: 'low',
    dueTime: '17:30',
    completed: false,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    completedAt: null,
    order: 1,
    streak: 0,
    bestStreak: 2,
    completionHistory: [],
  },
  {
    id: 'sample-5',
    title: 'Install DayFlow to macOS Dock for instant access',
    notes: 'Click the Install icon in the address bar or DayFlow menu to run as native window',
    type: 'one-time',
    priority: 'high',
    dueTime: '11:00',
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: 0,
    streak: 0,
    bestStreak: 0,
    completionHistory: [],
  },
  {
    id: 'sample-6',
    title: 'Setup keyboard shortcut workflow (⌘N for quick add)',
    notes: 'Experiment with drag-and-drop priority ordering and recurring schedules',
    type: 'one-time',
    priority: 'medium',
    dueTime: '',
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    order: 1,
    streak: 0,
    bestStreak: 0,
    completionHistory: [],
  }
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  enableAudioChime: true,
  enableNotifications: true,
  compactView: false,
  lastCheckedDate: getLocalDateString(),
  lastCheckedWeek: getISOWeekString(),
};

/**
 * Loads tasks from localStorage with migration and initial fallback
 */
export function loadTasksFromStorage(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) {
      saveTasksToStorage(INITIAL_SAMPLE_TASKS);
      return INITIAL_SAMPLE_TASKS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Migrate legacy 'daily' tasks to 'recurring' with activeDays
      const migrated: Task[] = parsed.map((task: any) => {
        if (task.type === 'daily' || task.type === 'recurring') {
          return {
            ...task,
            type: 'recurring',
            activeDays: Array.isArray(task.activeDays) && task.activeDays.length > 0
              ? task.activeDays
              : ALL_WEEKDAYS,
          };
        }
        return task;
      });
      return migrated;
    }
  } catch (err) {
    console.error('Failed to load tasks from storage', err);
  }
  return INITIAL_SAMPLE_TASKS;
}

export function saveTasksToStorage(tasks: Task[]): void {
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save tasks to storage', err);
  }
}

export function loadSettingsFromStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Failed to load settings', err);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettingsToStorage(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings', err);
  }
}
