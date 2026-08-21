import React from 'react';
import { 
  Bell, 
  BellOff, 
  Volume2, 
  VolumeX, 
  Sun, 
  Moon, 
  Laptop, 
  Download, 
  Info, 
  Flame, 
  Archive,
  Plus,
  Cloud,
  FolderSync
} from 'lucide-react';
import { AppSettings, Task } from '../types';

interface MacTitleBarProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onRequestNotificationPermission: () => void;
  notificationPermission: NotificationPermission | 'unsupported';
  onOpenNewTaskModal: () => void;
  onOpenHistoryModal: () => void;
  onOpenStreaksModal: () => void;
  onOpenLimitationsModal: () => void;
  onOpenCloudSyncModal: () => void;
  currentSyncCode?: string | null;
  installPromptAvailable: boolean;
  onInstallApp: () => void;
  isStandalone: boolean;
  tasks: Task[];
}

export const MacTitleBar: React.FC<MacTitleBarProps> = ({
  settings,
  onUpdateSettings,
  onRequestNotificationPermission,
  notificationPermission,
  onOpenNewTaskModal,
  onOpenHistoryModal,
  onOpenStreaksModal,
  onOpenLimitationsModal,
  onOpenCloudSyncModal,
  currentSyncCode,
  installPromptAvailable,
  onInstallApp,
  isStandalone,
  tasks
}) => {
  const activeRecurringTasks = tasks.filter(t => (t.type === 'recurring' || (t.type as string) === 'daily') && !t.archived);
  const totalStreakDays = activeRecurringTasks.reduce((acc, t) => acc + (t.streak || 0), 0);
  const completedTodayCount = tasks.filter(t => t.completed && !t.archived).length;
  const totalActiveCount = tasks.filter(t => !t.archived).length;

  const cycleTheme = () => {
    if (settings.theme === 'system') onUpdateSettings({ theme: 'light' });
    else if (settings.theme === 'light') onUpdateSettings({ theme: 'dark' });
    else onUpdateSettings({ theme: 'system' });
  };

  return (
    <header id="mac-titlebar" className="sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200/70 dark:border-neutral-800/80 transition-colors select-none">
      {/* Left: App Brand & Edition */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-linear-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-xs">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5L20 7" />
          </svg>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 font-sans">DayFlow</span>
          <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 hidden sm:inline">Tasks & Habits</span>
        </div>
      </div>

      {/* Center: Quick Streak & Completion Status Indicator */}
      <div className="hidden md:flex items-center gap-3">
        <button
          id="quick-streaks-trigger"
          onClick={onOpenStreaksModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer"
          title="View Habit Streaks"
        >
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          <span>{totalStreakDays} streak total</span>
        </button>

        <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
          {completedTodayCount} of {totalActiveCount} done today
        </div>
      </div>

      {/* Right: Actions (Cloud Sync, New Task, Audio, Notifications, Theme) */}
      <div className="flex items-center gap-1.5">
        {/* iCloud Backup & Sync Button */}
        <button
          id="btn-cloud-sync"
          onClick={onOpenCloudSyncModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all cursor-pointer border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs active:scale-98"
          title="iCloud Backup & Apple Shortcuts Sync"
        >
          <FolderSync className="w-3.5 h-3.5 text-sky-500" />
          <span className="hidden sm:inline">iCloud Backup</span>
        </button>

        {/* Quick New Task Button */}
        <button
          id="btn-quick-new-task"
          onClick={onOpenNewTaskModal}
          className="flex items-center gap-1.5 px-3 py-1.2 rounded-lg text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white shadow-xs active:scale-95 transition-all cursor-pointer"
          title="New Task (⌘N)"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Task</span>
          <kbd className="text-[10px] opacity-75 font-mono ml-0.5 hidden lg:inline">⌘N</kbd>
        </button>

        {/* History Archive */}
        <button
          id="btn-open-history"
          onClick={onOpenHistoryModal}
          className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors cursor-pointer"
          title="Completed & Archive History"
        >
          <Archive className="w-4 h-4" />
        </button>

        {/* Audio Chime Toggle */}
        <button
          id="btn-toggle-audio"
          onClick={() => onUpdateSettings({ enableAudioChime: !settings.enableAudioChime })}
          className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors cursor-pointer"
          title={settings.enableAudioChime ? 'Audio Chimes Enabled' : 'Audio Chimes Muted'}
        >
          {settings.enableAudioChime ? <Volume2 className="w-4 h-4 text-sky-500" /> : <VolumeX className="w-4 h-4 text-neutral-400" />}
        </button>

        {/* Notification Permission Toggle */}
        <button
          id="btn-notification-permission"
          onClick={onRequestNotificationPermission}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            notificationPermission === 'granted'
              ? 'text-sky-500 hover:bg-sky-500/10'
              : 'text-amber-500 hover:bg-amber-500/10'
          }`}
          title={
            notificationPermission === 'granted'
              ? 'Browser Notifications Active'
              : 'Click to Enable Notifications'
          }
        >
          {notificationPermission === 'granted' ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
        </button>

        {/* Theme Switcher */}
        <button
          id="btn-toggle-theme"
          onClick={cycleTheme}
          className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors cursor-pointer"
          title={`Theme: ${settings.theme} (Click to switch)`}
        >
          {settings.theme === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
          {settings.theme === 'dark' && <Moon className="w-4 h-4 text-indigo-400" />}
          {settings.theme === 'system' && <Laptop className="w-4 h-4" />}
        </button>

        {/* PWA Dock Install or Info */}
        {installPromptAvailable && !isStandalone && (
          <button
            id="btn-pwa-install-dock"
            onClick={onInstallApp}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 transition-all active:scale-95 shadow-xs cursor-pointer"
            title="Install DayFlow to macOS Dock"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add to Dock</span>
          </button>
        )}

        {/* PWA & Notification Guide / Limitations Info */}
        <button
          id="btn-pwa-limitations-info"
          onClick={onOpenLimitationsModal}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors cursor-pointer"
          title="About PWA Reminders on macOS"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

