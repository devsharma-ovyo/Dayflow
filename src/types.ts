export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const ALL_WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type TaskType = 'recurring' | 'weekly' | 'one-time' | 'daily';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface TaskCompletionRecord {
  date: string; // ISO date string YYYY-MM-DD
  timestamp: number;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  type: TaskType;
  priority: TaskPriority;
  dueTime?: string; // "HH:MM" 24h format (e.g. "09:30")
  completed: boolean;
  createdAt: string; // ISO string
  completedAt: string | null; // ISO string of latest completion
  order: number; // For manual reordering within its priority & type group
  streak: number; // Current streak in scheduled active days
  bestStreak: number; // Highest achieved streak
  completionHistory: TaskCompletionRecord[]; // Historical completion log
  lastCompletedDate?: string; // YYYY-MM-DD
  archived?: boolean; // For completed one-time tasks or manually archived

  // Recurrence configuration
  activeDays?: Weekday[]; // Array of active weekdays (e.g. ["Mon", "Tue", "Thu", "Fri", "Sat", "Sun"])
  skipThisWeek?: boolean; // For weekly tasks: skip this week one-off exception
  skippedWeek?: string; // ISO week string when skipped (e.g. "2026-W33")
}

export type ViewFilter = 'all' | 'recurring' | 'weekly' | 'one-time' | 'archive' | 'daily';
export type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  enableAudioChime: boolean;
  enableNotifications: boolean;
  compactView: boolean;
  lastCheckedDate: string; // YYYY-MM-DD
  lastCheckedWeek: string; // YYYY-Www (e.g. "2026-W33")
}

export interface UpcomingReminder {
  task: Task;
  dueDateTime: Date;
  diffMinutes: number;
  status: 'overdue' | 'imminent' | 'upcoming';
  formattedTime: string;
}
