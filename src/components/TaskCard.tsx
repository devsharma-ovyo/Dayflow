import React, { useState } from 'react';
import { 
  Check, 
  Clock, 
  Flame, 
  GripVertical, 
  MoreHorizontal, 
  Trash2, 
  Edit3, 
  Calendar, 
  Repeat, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Ban,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Task, TaskPriority } from '../types';
import { formatTimeDisplay, getRelativeTimeDue, formatActiveDaysDisplay } from '../utils/dateUtils';

interface TaskCardProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onChangePriority: (taskId: string, newPriority: TaskPriority) => void;
  onToggleSkipWeek?: (task: Task) => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragOver?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetTask: Task) => void;
  compactView?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  onChangePriority,
  onToggleSkipWeek,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  compactView = false,
}) => {
  const [showNotes, setShowNotes] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isRecurring = task.type === 'recurring' || (task.type as string) === 'daily';

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.completed) {
      // Fire celebratory micro-confetti on high priority or streak completion
      if (task.priority === 'high' || (isRecurring && (task.streak || 0) >= 2)) {
        try {
          confetti({
            particleCount: 25,
            spread: 50,
            origin: { y: 0.8 },
            colors: ['#38bdf8', '#818cf8', '#f59e0b', '#10b981'],
          });
        } catch {
          // ignore if canvas not supported
        }
      }
    }
    onToggleComplete(task);
  };

  const priorityColor = {
    high: {
      badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      dot: 'bg-rose-500',
      label: 'High',
    },
    medium: {
      badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      dot: 'bg-amber-500',
      label: 'Medium',
    },
    low: {
      badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      dot: 'bg-sky-500',
      label: 'Low',
    },
  }[task.priority];

  const typeDetails = isRecurring
    ? { 
        label: formatActiveDaysDisplay(task.activeDays), 
        icon: Repeat, 
        color: 'text-indigo-500 dark:text-indigo-400' 
      }
    : task.type === 'weekly'
    ? { 
        label: task.skipThisWeek ? 'Weekly (Skipped)' : 'Weekly Focus', 
        icon: Calendar, 
        color: 'text-purple-500 dark:text-purple-400' 
      }
    : { 
        label: 'One-Time', 
        icon: Sparkles, 
        color: 'text-sky-500 dark:text-sky-400' 
      };

  const TypeIcon = typeDetails.icon;

  const dueInfo = task.dueTime ? getRelativeTimeDue(task.dueTime) : null;

  return (
    <div
      id={`task-item-${task.id}`}
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, task)}
      onDragOver={(e) => onDragOver && onDragOver(e, task)}
      onDragEnd={(e) => onDragEnd && onDragEnd(e)}
      onDrop={(e) => onDrop && onDrop(e, task)}
      className={`group relative rounded-xl border transition-all duration-200 ${
        isDragging
          ? 'opacity-40 border-dashed border-sky-400 scale-[0.98]'
          : task.completed
          ? 'bg-neutral-50/70 dark:bg-neutral-900/40 border-neutral-200/50 dark:border-neutral-800/50 opacity-75'
          : task.skipThisWeek
          ? 'bg-purple-50/30 dark:bg-purple-950/20 border-purple-200/50 dark:border-purple-800/50'
          : 'bg-white/90 dark:bg-neutral-900/90 border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs hover:shadow-md'
      } ${compactView ? 'p-2.5' : 'p-3.5'}`}
    >
      <div className="flex items-start gap-3">
        {/* Drag Reorder Handle */}
        <div
          title="Drag to reorder within priority group"
          className="mt-1 -ml-1 text-neutral-300 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-grab active:cursor-grabbing transition-colors hidden sm:block select-none"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* macOS Style Custom Round Checkbox */}
        <button
          id={`checkbox-task-${task.id}`}
          onClick={handleCheckboxClick}
          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90 shrink-0 ${
            task.completed
              ? 'bg-emerald-500 border-emerald-600 text-white'
              : 'border-neutral-300 dark:border-neutral-600 hover:border-sky-500 dark:hover:border-sky-400 bg-white dark:bg-neutral-800'
          }`}
          title={task.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {/* Priority Indicator Pill */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${priorityColor.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${priorityColor.dot}`} />
              <span>{priorityColor.label}</span>
            </span>

            {/* Task Type & Schedule Pill */}
            <span 
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                isRecurring
                  ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20'
                  : task.type === 'weekly'
                  ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200/60 dark:border-neutral-700/60'
              }`}
              title={isRecurring ? `Recurring schedule: ${typeDetails.label}` : typeDetails.label}
            >
              <TypeIcon className={`w-3 h-3 ${typeDetails.color}`} />
              <span>{typeDetails.label}</span>
            </span>

            {/* Weekly Skipped Pill */}
            {task.type === 'weekly' && task.skipThisWeek && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                <Ban className="w-3 h-3" />
                <span>Skipped This Week</span>
              </span>
            )}

            {/* Recurring Active Streak Indicator */}
            {isRecurring && (task.streak || 0) > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                title={`Active Streak: ${task.streak} scheduled days (Best: ${task.bestStreak || task.streak} days)`}
              >
                <Flame className="w-3 h-3 fill-amber-500 text-amber-500 animate-pulse" />
                <span>{task.streak}d streak</span>
              </span>
            )}

            {/* Due Time Badge */}
            {task.dueTime && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                  task.completed
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-neutral-200 dark:border-neutral-700'
                    : dueInfo?.isOverdue
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-semibold'
                    : dueInfo?.isImminent
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                }`}
                title={`Due today at ${formatTimeDisplay(task.dueTime)}`}
              >
                <Clock className="w-3 h-3" />
                <span>{formatTimeDisplay(task.dueTime)}</span>
                {!task.completed && dueInfo && (
                  <span className="opacity-80 text-[10px]">({dueInfo.text})</span>
                )}
              </span>
            )}
          </div>

          {/* Title */}
          <h4
            onClick={() => onEdit(task)}
            className={`text-sm font-medium leading-snug cursor-pointer transition-colors ${
              task.completed
                ? 'line-through text-neutral-400 dark:text-neutral-500'
                : 'text-neutral-900 dark:text-neutral-100 hover:text-sky-600 dark:hover:text-sky-400'
            }`}
          >
            {task.title}
          </h4>

          {/* Notes Preview / Accordion */}
          {task.notes && (
            <div className="mt-1.5">
              {!showNotes ? (
                <button
                  onClick={() => setShowNotes(true)}
                  className="text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="truncate max-w-xs sm:max-w-md">{task.notes}</span>
                  <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
                </button>
              ) : (
                <div className="text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800/60 p-2 rounded-lg border border-neutral-200/50 dark:border-neutral-700/50 mt-1">
                  <p className="whitespace-pre-wrap">{task.notes}</p>
                  <button
                    onClick={() => setShowNotes(false)}
                    className="text-[11px] text-sky-600 dark:text-sky-400 mt-1 flex items-center gap-0.5 hover:underline cursor-pointer"
                  >
                    <span>Collapse</span>
                    <ChevronUp className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Actions Menu */}
        <div className="relative shrink-0">
          <button
            id={`btn-menu-task-${task.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Task options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-7 z-30 w-48 rounded-xl bg-white/95 dark:bg-neutral-800/95 backdrop-blur-xl border border-neutral-200 dark:border-neutral-700 shadow-xl py-1 text-xs text-neutral-700 dark:text-neutral-200 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(task);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700/70 flex items-center gap-2 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Edit Details</span>
                </button>

                {/* Weekly Task Skip/Unskip Action */}
                {task.type === 'weekly' && onToggleSkipWeek && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleSkipWeek(task);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700/70 flex items-center gap-2 cursor-pointer text-purple-600 dark:text-purple-400"
                  >
                    {task.skipThisWeek ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Unskip This Week</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-3.5 h-3.5" />
                        <span>Skip This Week</span>
                      </>
                    )}
                  </button>
                )}

                {/* Priority quick switch */}
                <div className="px-3 py-1 border-t border-neutral-100 dark:border-neutral-700 text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                  Set Priority
                </div>
                {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setMenuOpen(false);
                      onChangePriority(task.id, p);
                    }}
                    className={`w-full text-left px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-700/70 flex items-center justify-between cursor-pointer capitalize ${
                      task.priority === p ? 'font-semibold text-sky-600 dark:text-sky-400' : ''
                    }`}
                  >
                    <span>{p} Priority</span>
                    {task.priority === p && <Check className="w-3 h-3 text-sky-500" />}
                  </button>
                ))}

                <div className="border-t border-neutral-100 dark:border-neutral-700 my-1" />

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(task.id);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Task</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
