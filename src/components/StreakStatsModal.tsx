import React from 'react';
import { X, Flame, CheckCircle, Calendar, Trophy, Zap, Clock, Repeat, Ban } from 'lucide-react';
import { Task, ALL_WEEKDAYS } from '../types';
import { getLocalDateString, formatActiveDaysDisplay, getCurrentWeekday } from '../utils/dateUtils';

interface StreakStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
}

export const StreakStatsModal: React.FC<StreakStatsModalProps> = ({
  isOpen,
  onClose,
  tasks,
}) => {
  if (!isOpen) return null;

  const recurringTasks = tasks.filter((t) => (t.type === 'recurring' || (t.type as string) === 'daily') && !t.archived);
  const weeklyTasks = tasks.filter((t) => t.type === 'weekly' && !t.archived);

  // Generate last 14 dates for habit visualizer
  const today = new Date();
  const past14Days: { dateStr: string; label: string; dayName: string; dateObj: Date }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    past14Days.push({ dateStr, label, dayName, dateObj: d });
  }

  const totalCompletionsAllTime = tasks.reduce(
    (acc, t) => acc + (t.completionHistory?.length || 0),
    0
  );

  const highestStreak = tasks.reduce(
    (max, t) => Math.max(max, t.bestStreak || t.streak || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="streak-stats-modal"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Habit Streaks & Completion Logs
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Midnight resets never wipe your historical completion record
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Highlight Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-neutral-900 dark:text-neutral-100">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
                <Trophy className="w-3.5 h-3.5" />
                <span>Best Streak</span>
              </div>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {highestStreak} <span className="text-xs font-normal">days</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-neutral-900 dark:text-neutral-100">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>All-Time Done</span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {totalCompletionsAllTime} <span className="text-xs font-normal">logs</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-neutral-900 dark:text-neutral-100">
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
                <Repeat className="w-3.5 h-3.5" />
                <span>Recurring</span>
              </div>
              <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {recurringTasks.length} <span className="text-xs font-normal">active</span>
              </div>
            </div>
          </div>

          {/* Recurring Habit 14-Day Completion Matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>14-Day Recurring Consistency</span>
              </h4>
              <span className="text-[11px] text-neutral-400">Past 2 Weeks</span>
            </div>

            {recurringTasks.length === 0 ? (
              <div className="text-center py-6 text-xs text-neutral-400 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200/50 dark:border-neutral-800">
                No active recurring tasks found. Create a Recurring task to track streaks!
              </div>
            ) : (
              <div className="space-y-3">
                {recurringTasks.map((task) => {
                  const completedDateSet = new Set(
                    (task.completionHistory || []).map((rec) => rec.date)
                  );
                  const activeDays = task.activeDays && task.activeDays.length > 0 ? task.activeDays : ALL_WEEKDAYS;

                  return (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/70"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-xs">
                            {task.title}
                          </span>
                          <span className="px-1.5 py-0.2 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium border border-indigo-500/20 truncate">
                            {formatActiveDaysDisplay(task.activeDays)}
                          </span>
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 shrink-0">
                            <Flame className="w-3 h-3 fill-amber-500" />
                            {task.streak}d streak
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-400 shrink-0">
                          Best: {task.bestStreak || task.streak}d
                        </span>
                      </div>

                      {/* 14 Day Dots Grid */}
                      <div className="grid grid-cols-14 gap-1 pt-1">
                        {past14Days.map((day) => {
                          const weekdayName = getCurrentWeekday(day.dateObj);
                          const isScheduledDay = activeDays.includes(weekdayName);
                          const isDone = completedDateSet.has(day.dateStr);
                          const isCurrentDay = day.dateStr === getLocalDateString();

                          return (
                            <div
                              key={day.dateStr}
                              className="flex flex-col items-center gap-1 group/dot relative"
                            >
                              <div
                                className={`w-full aspect-square rounded-md transition-all ${
                                  isDone
                                    ? 'bg-emerald-500 shadow-xs shadow-emerald-500/30'
                                    : !isScheduledDay
                                    ? 'bg-neutral-100 dark:bg-neutral-800/40 border border-dashed border-neutral-300 dark:border-neutral-700'
                                    : 'bg-neutral-200 dark:bg-neutral-700'
                                } ${isCurrentDay ? 'ring-1.5 ring-sky-500' : ''}`}
                              />
                              <span className="text-[8px] text-neutral-400 font-mono">
                                {day.label.split('/')[1]}
                              </span>

                              {/* Tooltip on hover */}
                              <div className="absolute bottom-full mb-1 hidden group-hover/dot:block z-30 px-2 py-1 bg-neutral-900 text-white text-[10px] rounded shadow whitespace-nowrap">
                                {day.dayName} {day.label}: {isDone ? 'Completed' : !isScheduledDay ? 'Off Day' : 'Missed'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekly Focus Tasks Breakdown */}
          {weeklyTasks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                <span>Weekly Focus Overview</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {weeklyTasks.map((t) => (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      t.skipThisWeek
                        ? 'bg-purple-50/20 dark:bg-purple-950/20 border-purple-200/50 dark:border-purple-800/40'
                        : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200/70 dark:border-neutral-700/70'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {t.title}
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {t.completed
                          ? 'Completed this week'
                          : t.skipThisWeek
                          ? 'Skipped for this week'
                          : 'In progress'}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 ${
                        t.completed
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : t.skipThisWeek
                          ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                          : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {t.completed ? (
                        'Done'
                      ) : t.skipThisWeek ? (
                        <>
                          <Ban className="w-3 h-3" />
                          <span>Skipped</span>
                        </>
                      ) : (
                        'Active'
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
