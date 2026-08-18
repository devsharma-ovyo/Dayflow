import React from 'react';
import { Clock, AlertCircle, CheckCircle2, ChevronRight, BellRing } from 'lucide-react';
import { Task } from '../types';
import { getRelativeTimeDue, formatTimeDisplay, isTaskActiveToday } from '../utils/dateUtils';

interface UpcomingRemindersBarProps {
  tasks: Task[];
  onToggleComplete: (task: Task) => void;
  onSelectTask?: (task: Task) => void;
  onOpenLimitationsModal: () => void;
}

export const UpcomingRemindersBar: React.FC<UpcomingRemindersBarProps> = ({
  tasks,
  onToggleComplete,
  onSelectTask,
  onOpenLimitationsModal,
}) => {
  const now = new Date();

  // Find incomplete active tasks with a dueTime that are scheduled for today
  const timedTasks = tasks.filter((t) => !t.completed && !t.archived && !!t.dueTime && isTaskActiveToday(t, now));

  // Calculate reminder status for each
  const upcomingItems = timedTasks
    .map((task) => {
      const rel = getRelativeTimeDue(task.dueTime!, now);
      return {
        task,
        ...rel,
      };
    })
    // Include if overdue today (up to 4 hours overdue) or due within the next 60 minutes
    .filter((item) => (item.isOverdue && item.diffMinutes >= -240) || (item.diffMinutes >= 0 && item.diffMinutes <= 60))
    .sort((a, b) => a.diffMinutes - b.diffMinutes);

  if (upcomingItems.length === 0) {
    return null;
  }

  return (
    <section id="upcoming-reminders-panel" className="mb-6 rounded-2xl bg-linear-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 dark:from-sky-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 border border-sky-500/20 dark:border-sky-500/30 p-3.5 backdrop-blur-md shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-sky-500/15 dark:border-sky-500/25">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-sky-500 text-white flex items-center justify-center animate-pulse">
            <BellRing className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-sky-950 dark:text-sky-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>Upcoming & Due Reminders</span>
              <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                {upcomingItems.length}
              </span>
            </h3>
          </div>
        </div>

        <button
          onClick={onOpenLimitationsModal}
          className="text-[11px] text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-white flex items-center gap-1 hover:underline self-start sm:self-auto cursor-pointer transition-colors"
        >
          <span>macOS PWA Notification Guide</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {upcomingItems.map(({ task, text, isOverdue, isImminent, diffMinutes }) => {
          const priorityBorder =
            task.priority === 'high'
              ? 'border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20'
              : task.priority === 'medium'
              ? 'border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20'
              : 'border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70';

          return (
            <div
              key={task.id}
              id={`reminder-card-${task.id}`}
              className={`group flex items-center justify-between p-2.5 rounded-xl border backdrop-blur-xs transition-all hover:shadow-xs hover:border-sky-400/50 ${priorityBorder}`}
            >
              <div
                className="flex items-start gap-2 min-w-0 cursor-pointer flex-1 mr-2"
                onClick={() => onSelectTask && onSelectTask(task)}
              >
                <div className="mt-0.5 shrink-0">
                  {isOverdue ? (
                    <AlertCircle className="w-4 h-4 text-rose-500 animate-bounce" />
                  ) : isImminent ? (
                    <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                  ) : (
                    <Clock className="w-4 h-4 text-sky-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {task.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {formatTimeDisplay(task.dueTime)}
                    </span>
                    <span>•</span>
                    <span
                      className={`font-semibold ${
                        isOverdue
                          ? 'text-rose-600 dark:text-rose-400'
                          : isImminent
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-sky-600 dark:text-sky-400'
                      }`}
                    >
                      {text}
                    </span>
                  </div>
                </div>
              </div>

              <button
                id={`btn-complete-reminder-${task.id}`}
                onClick={() => onToggleComplete(task)}
                className="shrink-0 p-1.5 rounded-lg text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                title="Mark as completed"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
