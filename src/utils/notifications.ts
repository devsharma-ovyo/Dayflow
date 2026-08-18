import { Task } from '../types';
import { getLocalDateString, formatTimeDisplay, isTaskActiveToday } from './dateUtils';
import { playChimeSound } from './audio';

const NOTIFIED_TASKS_KEY = 'dayflow_notified_today_v1';

interface NotifiedRecord {
  date: string;
  taskIds: string[];
}

function getNotifiedRecord(): NotifiedRecord {
  try {
    const raw = localStorage.getItem(NOTIFIED_TASKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === getLocalDateString()) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read notified record', err);
  }
  return { date: getLocalDateString(), taskIds: [] };
}

function markTaskAsNotified(taskId: string): void {
  try {
    const record = getNotifiedRecord();
    if (!record.taskIds.includes(taskId)) {
      record.taskIds.push(taskId);
      localStorage.setItem(NOTIFIED_TASKS_KEY, JSON.stringify(record));
    }
  } catch (err) {
    console.error('Failed to save notified record', err);
  }
}

/**
 * Checks Notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Requests browser notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Notification permission request failed', err);
    return Notification.permission;
  }
}

/**
 * Fires a system notification and optional audio chime for a task
 */
export function sendTaskNotification(task: Task, playSound: boolean = true): void {
  if (playSound) {
    playChimeSound();
  }

  const title = `Reminder: ${task.title}`;
  const options: NotificationOptions = {
    body: `${task.priority.toUpperCase()} priority • ${task.type} task ${task.dueTime ? `due at ${formatTimeDisplay(task.dueTime)}` : ''}`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `task-${task.id}-${getLocalDateString()}`,
    silent: !playSound,
  };

  // Try service worker registration showNotification first if available
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, options).catch(() => {
        // Fallback to standard Notification
        fallbackNotification(title, options);
      });
    }).catch(() => {
      fallbackNotification(title, options);
    });
  } else {
    fallbackNotification(title, options);
  }

  markTaskAsNotified(task.id);
}

function fallbackNotification(title: string, options: NotificationOptions): void {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, options);
    } catch (err) {
      console.warn('Standard Notification instantiation error:', err);
    }
  }
}

/**
 * Evaluates all active tasks and fires notifications for those due at current minute
 */
export function evaluateTimeBasedReminders(
  tasks: Task[],
  enableNotifications: boolean,
  enableAudioChime: boolean,
  onNotifyCallback?: (task: Task) => void
): Task[] {
  if (!enableNotifications && !enableAudioChime) return [];

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;
  const notifiedRecord = getNotifiedRecord();

  const triggeredTasks: Task[] = [];

  tasks.forEach((task) => {
    // Only incomplete, unarchived tasks that are active today and have a due time
    if (!task.completed && !task.archived && task.dueTime && isTaskActiveToday(task, now)) {
      if (task.dueTime === currentTimeStr && !notifiedRecord.taskIds.includes(task.id)) {
        sendTaskNotification(task, enableAudioChime);
        triggeredTasks.push(task);
        if (onNotifyCallback) {
          onNotifyCallback(task);
        }
      }
    }
  });

  return triggeredTasks;
}
