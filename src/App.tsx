import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Repeat, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Flame, 
  Archive,
  ArrowUpDown,
  BellRing,
  Video
} from 'lucide-react';
import { Task, TaskType, TaskPriority, ViewFilter, AppSettings, OutlookAccountConfig, OutlookMeeting } from './types';
import { 
  loadTasksFromStorage, 
  saveTasksToStorage, 
  loadSettingsFromStorage, 
  saveSettingsToStorage 
} from './utils/storage';
import { checkAndApplyRecurringResets, toggleTaskCompletion } from './utils/taskReset';
import { 
  getNotificationPermission, 
  requestNotificationPermission, 
  evaluateTimeBasedReminders 
} from './utils/notifications';
import { playCompletionSound } from './utils/audio';
import { getMsUntilNextMidnight, isTaskActiveToday, getISOWeekString } from './utils/dateUtils';

import { MacTitleBar } from './components/MacTitleBar';
import { UpcomingRemindersBar } from './components/UpcomingRemindersBar';
import { TaskGroupSection } from './components/TaskGroupSection';
import { TaskFormModal } from './components/TaskFormModal';
import { StreakStatsModal } from './components/StreakStatsModal';
import { HistoryArchiveView } from './components/HistoryArchiveView';
import { PwaLimitationsModal } from './components/PwaLimitationsModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { MeetingsView } from './components/MeetingsView';
import { OutlookAccountsModal } from './components/OutlookAccountsModal';
import { 
  parseLaunchShortcutData, 
  getIsHourlySyncEnabled, 
  getStoredICloudSyncTime, 
  setStoredICloudSyncTime 
} from './services/icloudSyncService';
import {
  getStoredOutlookAccounts,
  saveStoredOutlookAccounts,
  getStoredOutlookMeetings,
  saveStoredOutlookMeetings,
  syncAllOutlookAccounts,
  getMeetingsForDate
} from './services/outlookSyncService';

export default function App() {
  // State initialization
  const [tasks, setTasks] = useState<Task[]>(() => loadTasksFromStorage());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettingsFromStorage());
  
  // UI & Filter state
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Outlook Accounts & Meetings State (Dual Account Support)
  const [outlookAccounts, setOutlookAccounts] = useState<OutlookAccountConfig[]>(() => getStoredOutlookAccounts());
  const [outlookMeetings, setOutlookMeetings] = useState<OutlookMeeting[]>(() => getStoredOutlookMeetings());
  const [isOutlookAccountsModalOpen, setIsOutlookAccountsModalOpen] = useState(false);
  const [isSyncingOutlook, setIsSyncingOutlook] = useState(false);

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isStreaksModalOpen, setIsStreaksModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isLimitationsModalOpen, setIsLimitationsModalOpen] = useState(false);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);

  // Notification & PWA state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => getNotificationPermission());
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [liveToast, setLiveToast] = useState<{ title: string; message: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Detect standalone PWA mode
  useEffect(() => {
    const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(!!isRunningStandalone);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Sync theme with system / settings
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [settings.theme]);

  // Request Notification permission on first load if default
  useEffect(() => {
    const perm = getNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'default') {
      requestNotificationPermission().then((res) => {
        setNotificationPermission(res);
      });
    }

    // Handle Auto-Sync on Launch from Apple Shortcuts or Shared Links
    const handleLaunchSync = () => {
      const raw = window.location.hash || window.location.search;
      if (!raw) return;

      const launchData = parseLaunchShortcutData(raw);
      if (launchData && Array.isArray(launchData.tasks) && launchData.tasks.length > 0) {
        setTasks(launchData.tasks);
        saveTasksToStorage(launchData.tasks);
        if (launchData.settings) {
          setSettings((prev) => ({ ...prev, ...launchData.settings }));
          saveSettingsToStorage({ ...settings, ...launchData.settings });
        }
        setLiveToast({
          title: 'iCloud Synced on Launch',
          message: `Loaded ${launchData.tasks.length} tasks from your Apple Shortcut.`
        });
        // Clean URL hash/search without full page reload
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    handleLaunchSync();
    window.addEventListener('hashchange', handleLaunchSync);
    return () => window.removeEventListener('hashchange', handleLaunchSync);
  }, []);

  // Automated Hourly iCloud & Outlook Sync Check (checks every hour or on tab re-focus if 1hr passed)
  useEffect(() => {
    const checkHourlySync = () => {
      if (getIsHourlySyncEnabled()) {
        const lastSync = getStoredICloudSyncTime() || 0;
        const now = Date.now();
        const oneHourMs = 60 * 60 * 1000;

        if (now - lastSync >= oneHourMs) {
          setStoredICloudSyncTime(now);
          setLiveToast({
            title: 'Hourly iCloud Sync Ready',
            message: 'Your tasks are ready for hourly iCloud backup synchronization.'
          });
        }
      }

      // Auto-sync Outlook calendars if any feed URLs are configured
      const hasConfiguredOutlook = outlookAccounts.some((a) => a.enabled && a.feedUrl.trim());
      if (hasConfiguredOutlook && !isSyncingOutlook) {
        syncAllOutlookAccounts(outlookAccounts).then(({ meetings, updatedAccounts }) => {
          setOutlookAccounts(updatedAccounts);
          if (meetings.length > 0) {
            setOutlookMeetings(meetings);
          }
        });
      }
    };

    // Run hourly interval (every 1 hour = 3,600,000 ms)
    const hourlyInterval = setInterval(checkHourlySync, 60 * 60 * 1000);

    // Also check on window focus (e.g. user unlocks iPhone or wakes MacBook)
    window.addEventListener('focus', checkHourlySync);

    return () => {
      clearInterval(hourlyInterval);
      window.removeEventListener('focus', checkHourlySync);
    };
  }, [outlookAccounts, isSyncingOutlook]);

  // Initial auto-sync of Outlook calendars on launch if configured
  useEffect(() => {
    const hasConfigured = outlookAccounts.some((a) => a.enabled && a.feedUrl.trim());
    if (hasConfigured) {
      setIsSyncingOutlook(true);
      syncAllOutlookAccounts(outlookAccounts)
        .then(({ meetings, updatedAccounts }) => {
          setOutlookAccounts(updatedAccounts);
          if (meetings.length > 0) {
            setOutlookMeetings(meetings);
          }
        })
        .finally(() => {
          setIsSyncingOutlook(false);
        });
    }
  }, []);

  // Manual trigger to refresh all Outlook accounts
  const handleRefreshOutlookMeetings = async () => {
    setIsSyncingOutlook(true);
    try {
      const { meetings, updatedAccounts } = await syncAllOutlookAccounts(outlookAccounts);
      setOutlookAccounts(updatedAccounts);
      if (meetings.length > 0) {
        setOutlookMeetings(meetings);
        const todayCount = getMeetingsForDate(meetings, new Date()).length;
        setLiveToast({
          title: 'Outlook Synced',
          message: `Updated meetings across accounts. Found ${todayCount} ${todayCount === 1 ? 'meeting' : 'meetings'} today.`,
        });
      } else {
        setLiveToast({
          title: 'Outlook Synced',
          message: 'Calendar sync complete.',
        });
      }
    } catch (err: any) {
      setLiveToast({
        title: 'Sync Error',
        message: err.message || 'Could not sync Outlook feeds.',
      });
    } finally {
      setIsSyncingOutlook(false);
    }
  };

  const handleUpdateOutlookAccounts = (newAccs: OutlookAccountConfig[]) => {
    setOutlookAccounts(newAccs);
    saveStoredOutlookAccounts(newAccs);
  };

  // Add task from Meeting conversion
  const handleAddMeetingTask = (newTask: Task) => {
    setTasks((prev) => [newTask, ...prev]);
    saveTasksToStorage([newTask, ...tasks]);
    setLiveToast({
      title: 'Meeting Added to DayFlow',
      message: `"${newTask.title}" is now scheduled in your task list.`,
    });
  };

  // Calculate today's meetings count
  const todayMeetings = useMemo(() => getMeetingsForDate(outlookMeetings, new Date()), [outlookMeetings]);
  const meetingsTodayCount = todayMeetings.length;

  // Save tasks to localStorage on change
  useEffect(() => {
    saveTasksToStorage(tasks);
  }, [tasks]);

  // Save settings to storage on change
  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  // Automated Recurring Reset Engine (Daily at midnight, Weekly every Monday at midnight)
  const runRecurringResetCheck = useCallback(() => {
    const result = checkAndApplyRecurringResets(tasks, settings);
    if (result.didResetDaily || result.didResetWeekly) {
      setTasks(result.tasks);
      setSettings(result.settings);
      if (result.didResetDaily) {
        setLiveToast({
          title: 'Daily Habits Reset',
          message: 'Daily habits are refreshed for today. Your streak history is preserved.',
        });
      }
      if (result.didResetWeekly) {
        setLiveToast({
          title: 'Weekly Focus Reset',
          message: 'Weekly tasks are reset for the new week. Previous logs are saved.',
        });
      }
    }
  }, [tasks, settings]);

  useEffect(() => {
    // Check immediately on mount
    runRecurringResetCheck();

    // Schedule next midnight exact timeout
    const msToMidnight = getMsUntilNextMidnight();
    const midnightTimer = setTimeout(() => {
      runRecurringResetCheck();
    }, msToMidnight);

    // Also periodic check every 30 seconds for background time changes
    const interval = setInterval(() => {
      runRecurringResetCheck();
    }, 30000);

    return () => {
      clearTimeout(midnightTimer);
      clearInterval(interval);
    };
  }, [runRecurringResetCheck]);

  // Time-based reminder evaluation engine
  useEffect(() => {
    const checkReminders = () => {
      evaluateTimeBasedReminders(
        tasks,
        settings.enableNotifications,
        settings.enableAudioChime,
        (task) => {
          setLiveToast({
            title: `Reminder: ${task.title}`,
            message: `${task.priority.toUpperCase()} priority • ${task.type} task is due now`,
          });
        }
      );
    };

    checkReminders();
    const timer = setInterval(checkReminders, 20000);
    return () => clearInterval(timer);
  }, [tasks, settings.enableNotifications, settings.enableAudioChime]);

  // Global Keyboard Shortcuts (Cmd+N, Cmd+F, Esc, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingTask(null);
        setIsTaskModalOpen(true);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setIsTaskModalOpen(false);
        setIsStreaksModalOpen(false);
        setIsHistoryModalOpen(false);
        setIsLimitationsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleRequestNotifications = async () => {
    const res = await requestNotificationPermission();
    setNotificationPermission(res);
    if (res === 'granted') {
      setLiveToast({
        title: 'Notifications Enabled',
        message: 'You will receive reminders when tasks reach their due time.',
      });
    }
  };

  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } else {
      setIsLimitationsModalOpen(true);
    }
  };

  const handleToggleTask = (task: Task) => {
    if (settings.enableAudioChime && !task.completed) {
      playCompletionSound();
    }
    const updated = toggleTaskCompletion(task);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  };

  const handleToggleSkipWeek = (task: Task) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== task.id) return t;
        const willSkip = !t.skipThisWeek;
        return {
          ...t,
          skipThisWeek: willSkip,
          skippedWeek: willSkip ? getISOWeekString() : undefined,
        };
      })
    );
  };

  const handleSaveTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'order' | 'streak' | 'bestStreak' | 'completionHistory'> & { id?: string }) => {
    if (taskData.id) {
      // Update existing
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskData.id
            ? {
                ...t,
                ...taskData,
              }
            : t
        )
      );
    } else {
      // Create new
      const newTask: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: taskData.title,
        notes: taskData.notes,
        type: taskData.type,
        priority: taskData.priority,
        dueTime: taskData.dueTime,
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
        order: tasks.filter((t) => t.priority === taskData.priority).length,
        streak: 0,
        bestStreak: 0,
        completionHistory: [],
        archived: false,
      };
      setTasks((prev) => [newTask, ...prev]);
    }
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleChangePriority = (taskId: string, newPriority: TaskPriority) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, priority: newPriority } : t))
    );
  };

  const handleReorderWithinPriority = (priority: TaskPriority, reorderedGroupTasks: Task[]) => {
    setTasks((prev) => {
      // Replace only tasks of this priority with the reordered group
      const otherPriorityTasks = prev.filter((t) => t.priority !== priority);
      return [...otherPriorityTasks, ...reorderedGroupTasks];
    });
  };

  const handleRestoreTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, completed: false, completedAt: null, archived: false }
          : t
      )
    );
  };

  const handlePermanentlyDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleImportBackup = (imported: Task[]) => {
    setTasks(imported);
    saveTasksToStorage(imported);
  };

  // Filter & Group active tasks
  const activeTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Exclude archived or completed one-time tasks from active view
      if (task.archived) return false;
      if (task.type === 'one-time' && task.completed) return false;

      // Filter by active schedule for today:
      // Recurring tasks should only appear on their active days
      // Weekly tasks should not appear if skipped for this week
      if (!isTaskActiveToday(task)) {
        return false;
      }

      // Filter by type tab
      if (viewFilter !== 'all') {
        if (viewFilter === 'recurring' || viewFilter === 'daily') {
          if (task.type !== 'recurring' && (task.type as string) !== 'daily') {
            return false;
          }
        } else if (task.type !== viewFilter) {
          return false;
        }
      }

      // Filter by priority
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesNotes = task.notes?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNotes) return false;
      }

      return true;
    });
  }, [tasks, viewFilter, priorityFilter, searchQuery]);

  // Priority groupings: Incomplete items remain at the top, completed items automatically sink to the bottom
  const highPriorityTasks = useMemo(
    () =>
      activeTasks
        .filter((t) => t.priority === 'high')
        .sort((a, b) => {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          return (a.order ?? 0) - (b.order ?? 0);
        }),
    [activeTasks]
  );
  const mediumPriorityTasks = useMemo(
    () =>
      activeTasks
        .filter((t) => t.priority === 'medium')
        .sort((a, b) => {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          return (a.order ?? 0) - (b.order ?? 0);
        }),
    [activeTasks]
  );
  const lowPriorityTasks = useMemo(
    () =>
      activeTasks
        .filter((t) => t.priority === 'low')
        .sort((a, b) => {
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }
          return (a.order ?? 0) - (b.order ?? 0);
        }),
    [activeTasks]
  );

  // Quick statistics for today's active counts
  const totalActive = tasks.filter((t) => !t.archived && !(t.type === 'one-time' && t.completed) && isTaskActiveToday(t)).length;
  const totalRecurring = tasks.filter((t) => (t.type === 'recurring' || (t.type as string) === 'daily') && !t.archived && isTaskActiveToday(t)).length;
  const totalWeekly = tasks.filter((t) => t.type === 'weekly' && !t.archived && isTaskActiveToday(t)).length;
  const totalOneTime = tasks.filter((t) => t.type === 'one-time' && !t.completed && !t.archived).length;

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans antialiased selection:bg-sky-500/20 selection:text-sky-900 dark:selection:text-sky-200">
      {/* macOS Styled Navigation Header */}
      <MacTitleBar
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onRequestNotificationPermission={handleRequestNotifications}
        notificationPermission={notificationPermission}
        onOpenNewTaskModal={() => {
          setEditingTask(null);
          setIsTaskModalOpen(true);
        }}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        onOpenStreaksModal={() => setIsStreaksModalOpen(true)}
        onOpenLimitationsModal={() => setIsLimitationsModalOpen(true)}
        onOpenCloudSyncModal={() => setIsCloudSyncModalOpen(true)}
        installPromptAvailable={!!installPrompt}
        onInstallApp={handleInstallApp}
        isStandalone={isStandalone}
        tasks={tasks}
        meetingsTodayCount={meetingsTodayCount}
        onOpenMeetingsView={() => setViewFilter('meetings')}
      />

      {/* Main Workspace */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">
        {/* Live Notification Toast Banner */}
        {liveToast && (
          <div
            id="live-toast-banner"
            className="mb-4 p-3 rounded-xl bg-sky-500 text-white shadow-lg flex items-center justify-between animate-in slide-in-from-top duration-200"
          >
            <div className="flex items-center gap-2.5">
              <BellRing className="w-5 h-5 shrink-0 animate-bounce" />
              <div>
                <h4 className="text-xs font-bold leading-tight">{liveToast.title}</h4>
                <p className="text-[11px] opacity-90">{liveToast.message}</p>
              </div>
            </div>
            <button
              onClick={() => setLiveToast(null)}
              className="p-1 rounded-lg hover:bg-sky-600 text-white/90 hover:text-white transition-colors cursor-pointer text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Filter and Search Control Bar */}
        <section id="filter-controls-bar" className="mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* View Filter Segmented Controls */}
            <div className="flex items-center p-1 rounded-xl bg-neutral-200/70 dark:bg-neutral-900 border border-neutral-300/50 dark:border-neutral-800 text-xs overflow-x-auto select-none">
              <button
                id="tab-view-all"
                onClick={() => setViewFilter('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                  viewFilter === 'all'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Tasks</span>
                <span className="text-[10px] opacity-70">({totalActive})</span>
              </button>

              <button
                id="tab-view-recurring"
                onClick={() => setViewFilter('recurring')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                  viewFilter === 'recurring' || viewFilter === 'daily'
                    ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Recurring</span>
                <span className="text-[10px] opacity-70">({totalRecurring})</span>
              </button>

              <button
                id="tab-view-weekly"
                onClick={() => setViewFilter('weekly')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                  viewFilter === 'weekly'
                    ? 'bg-white dark:bg-neutral-800 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Weekly</span>
                <span className="text-[10px] opacity-70">({totalWeekly})</span>
              </button>

              <button
                id="tab-view-onetime"
                onClick={() => setViewFilter('one-time')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                  viewFilter === 'one-time'
                    ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>One-Time</span>
                <span className="text-[10px] opacity-70">({totalOneTime})</span>
              </button>

              {/* Dedicated Meetings Tab */}
              <button
                id="tab-view-meetings"
                onClick={() => setViewFilter('meetings')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                  viewFilter === 'meetings'
                    ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-xs font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-sky-500" />
                <span>Meetings</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  viewFilter === 'meetings'
                    ? 'bg-sky-500 text-white'
                    : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                }`}>
                  {meetingsTodayCount}
                </span>
              </button>
            </div>

            {/* Quick Priority Filter (only when viewing tasks) */}
            {viewFilter !== 'meetings' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-200/70 dark:bg-neutral-900 border border-neutral-300/50 dark:border-neutral-800 text-xs">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase px-1.5">Priority:</span>
                  {(['all', 'high', 'medium', 'low'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(p)}
                      className={`px-2 py-1 rounded-md capitalize font-medium transition-all cursor-pointer ${
                        priorityFilter === p
                          ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search Input and Quick Info Bar (only when viewing tasks) */}
          {viewFilter !== 'meetings' && (
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  id="search-tasks-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks, notes (⌘F)..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                id="btn-main-add-task"
                onClick={() => {
                  setEditingTask(null);
                  setIsTaskModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Task</span>
              </button>
            </div>
          )}
        </section>

        {/* View Switch: Meetings View vs Regular Tasks */}
        {viewFilter === 'meetings' ? (
          <MeetingsView
            meetings={outlookMeetings}
            accounts={outlookAccounts}
            onOpenAccountsModal={() => setIsOutlookAccountsModalOpen(true)}
            onRefreshMeetings={handleRefreshOutlookMeetings}
            isSyncing={isSyncingOutlook}
            onAddTask={handleAddMeetingTask}
          />
        ) : (
          <>
            {/* Upcoming Reminders Section (Due within 60 mins or Overdue) */}
            <UpcomingRemindersBar
              tasks={tasks}
              onToggleComplete={handleToggleTask}
              onSelectTask={(task) => {
                setEditingTask(task);
                setIsTaskModalOpen(true);
              }}
              onOpenLimitationsModal={() => setIsLimitationsModalOpen(true)}
            />

            {/* Active Tasks Grouped by Priority */}
            {activeTasks.length === 0 ? (
              <div
                id="empty-tasks-placeholder"
                className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-xs my-8"
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {searchQuery ? 'No matching tasks found' : 'All Clear for Now!'}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
                  {searchQuery
                    ? 'Try tweaking your search query or reset filters.'
                    : 'Create a new task, set daily habits, or review your completion streaks.'}
                </p>
                <button
                  onClick={() => {
                    setEditingTask(null);
                    setIsTaskModalOpen(true);
                  }}
                  className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Task</span>
                </button>
              </div>
            ) : (
              <div id="priority-task-sections" className="space-y-2">
                <TaskGroupSection
                  priority="high"
                  tasks={highPriorityTasks}
                  onToggleComplete={handleToggleTask}
                  onEdit={(task) => {
                    setEditingTask(task);
                    setIsTaskModalOpen(true);
                  }}
                  onDelete={handleDeleteTask}
                  onChangePriority={handleChangePriority}
                  onReorderWithinPriority={handleReorderWithinPriority}
                  onToggleSkipWeek={handleToggleSkipWeek}
                  compactView={settings.compactView}
                />

                <TaskGroupSection
                  priority="medium"
                  tasks={mediumPriorityTasks}
                  onToggleComplete={handleToggleTask}
                  onEdit={(task) => {
                    setEditingTask(task);
                    setIsTaskModalOpen(true);
                  }}
                  onDelete={handleDeleteTask}
                  onChangePriority={handleChangePriority}
                  onReorderWithinPriority={handleReorderWithinPriority}
                  onToggleSkipWeek={handleToggleSkipWeek}
                  compactView={settings.compactView}
                />

                <TaskGroupSection
                  priority="low"
                  tasks={lowPriorityTasks}
                  onToggleComplete={handleToggleTask}
                  onEdit={(task) => {
                    setEditingTask(task);
                    setIsTaskModalOpen(true);
                  }}
                  onDelete={handleDeleteTask}
                  onChangePriority={handleChangePriority}
                  onReorderWithinPriority={handleReorderWithinPriority}
                  onToggleSkipWeek={handleToggleSkipWeek}
                  compactView={settings.compactView}
                />
              </div>
            )}
          </>
        )}

        {/* Footer info & shortcut legend */}
        <footer className="mt-12 pt-6 border-t border-neutral-200/60 dark:border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-400 dark:text-neutral-500">
          <div className="flex items-center gap-2">
            <span>DayFlow</span>
            <span>•</span>
            <span>Recurring tasks reset at 12:00 AM local time • Dual Outlook Sync Enabled</span>
          </div>

          <div className="flex items-center gap-3 font-mono">
            <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">⌘N</kbd> New</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">⌘F</kbd> Search</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">Esc</kbd> Close</span>
          </div>
        </footer>
      </main>

      {/* Modals & Dialogs */}
      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
      />

      <StreakStatsModal
        isOpen={isStreaksModalOpen}
        onClose={() => setIsStreaksModalOpen(false)}
        tasks={tasks}
      />

      <HistoryArchiveView
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        tasks={tasks}
        onRestoreTask={handleRestoreTask}
        onPermanentlyDeleteTask={handlePermanentlyDeleteTask}
        onImportBackup={handleImportBackup}
      />

      <PwaLimitationsModal
        isOpen={isLimitationsModalOpen}
        onClose={() => setIsLimitationsModalOpen(false)}
        onRequestNotificationPermission={handleRequestNotifications}
        permissionStatus={notificationPermission}
        isStandalone={isStandalone}
      />

      <CloudSyncModal
        isOpen={isCloudSyncModalOpen}
        onClose={() => setIsCloudSyncModalOpen(false)}
        tasks={tasks}
        settings={settings}
        onApplyRemoteState={(newTasks, newSettings) => {
          setTasks(newTasks);
          saveTasksToStorage(newTasks);
          if (newSettings) {
            setSettings((prev) => ({ ...prev, ...newSettings }));
            saveSettingsToStorage({ ...settings, ...newSettings });
          }
        }}
      />

      {/* Outlook Dual Accounts Configuration Modal */}
      <OutlookAccountsModal
        isOpen={isOutlookAccountsModalOpen}
        onClose={() => setIsOutlookAccountsModalOpen(false)}
        accounts={outlookAccounts}
        onUpdateAccounts={handleUpdateOutlookAccounts}
        onRefreshMeetings={handleRefreshOutlookMeetings}
      />
    </div>
  );
}
