import React, { useState, useEffect } from 'react';
import { X, Clock, Repeat, Calendar, Sparkles, AlertCircle, Check, CalendarDays, Ban } from 'lucide-react';
import { Task, TaskType, TaskPriority, Weekday, ALL_WEEKDAYS } from '../types';
import { WEEKDAY_FULL_NAMES, formatActiveDaysDisplay, getISOWeekString } from '../utils/dateUtils';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'order' | 'streak' | 'bestStreak' | 'completionHistory'> & { id?: string }) => void;
  initialTask?: Task | null;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<TaskType>('recurring');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueTime, setDueTime] = useState('');
  const [activeDays, setActiveDays] = useState<Weekday[]>(ALL_WEEKDAYS);
  const [skipThisWeek, setSkipThisWeek] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setNotes(initialTask.notes || '');
      // Handle legacy 'daily' type seamlessly
      setType(initialTask.type === 'daily' ? 'recurring' : initialTask.type);
      setPriority(initialTask.priority);
      setDueTime(initialTask.dueTime || '');
      setActiveDays(
        initialTask.activeDays && initialTask.activeDays.length > 0
          ? initialTask.activeDays
          : ALL_WEEKDAYS
      );
      setSkipThisWeek(!!initialTask.skipThisWeek);
    } else {
      setTitle('');
      setNotes('');
      setType('recurring');
      setPriority('medium');
      setDueTime('');
      setActiveDays(ALL_WEEKDAYS); // All 7 days selected by default
      setSkipThisWeek(false);
    }
    setError('');
  }, [initialTask, isOpen]);

  if (!isOpen) return null;

  const handleToggleDay = (day: Weekday) => {
    setActiveDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day];
      }
    });
    if (error) setError('');
  };

  const handleSetPreset = (preset: 'all' | 'weekdays' | 'weekends') => {
    if (preset === 'all') {
      setActiveDays(ALL_WEEKDAYS);
    } else if (preset === 'weekdays') {
      setActiveDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    } else if (preset === 'weekends') {
      setActiveDays(['Sat', 'Sun']);
    }
    if (error) setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a task title');
      return;
    }

    if (type === 'recurring' && activeDays.length === 0) {
      setError('Please select at least one active day of the week for recurring tasks');
      return;
    }

    onSave({
      ...(initialTask?.id ? { id: initialTask.id } : {}),
      title: title.trim(),
      notes: notes.trim() || undefined,
      type,
      priority,
      dueTime: dueTime || undefined,
      completed: initialTask ? initialTask.completed : false,
      archived: initialTask ? initialTask.archived : false,
      activeDays: type === 'recurring' ? activeDays : undefined,
      skipThisWeek: type === 'weekly' ? skipThisWeek : false,
      skippedWeek: type === 'weekly' && skipThisWeek ? (initialTask?.skippedWeek || getISOWeekString()) : undefined,
    });
    onClose();
  };

  const quickTimes = [
    { label: '08:30 AM', value: '08:30' },
    { label: '12:00 PM', value: '12:00' },
    { label: '03:00 PM', value: '15:00' },
    { label: '06:00 PM', value: '18:00' },
    { label: '09:00 PM', value: '21:00' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="task-form-sheet"
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header with macOS styling */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {initialTask ? 'Edit Task' : 'New Task'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-task-title"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g., Morning workout & hydration"
              className="w-full px-3.5 py-2 rounded-xl text-sm bg-neutral-100/70 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all"
            />
          </div>

          {/* Task Type Selector */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Task Type & Recurrence
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-type-recurring"
                onClick={() => setType('recurring')}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  type === 'recurring' || (type as string) === 'daily'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <Repeat className="w-4 h-4 text-indigo-500" />
                <span>Recurring</span>
                <span className="text-[10px] text-neutral-400">Custom Mon–Sun</span>
              </button>

              <button
                type="button"
                id="btn-type-weekly"
                onClick={() => setType('weekly')}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  type === 'weekly'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <Calendar className="w-4 h-4 text-purple-500" />
                <span>Weekly Focus</span>
                <span className="text-[10px] text-neutral-400">Resets Monday</span>
              </button>

              <button
                type="button"
                id="btn-type-onetime"
                onClick={() => setType('one-time')}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  type === 'one-time'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <Sparkles className="w-4 h-4 text-sky-500" />
                <span>One-Time</span>
                <span className="text-[10px] text-neutral-400">Archives on done</span>
              </button>
            </div>
          </div>

          {/* DAY-OF-WEEK SELECTOR: Show ONLY for Recurring Task Type */}
          {(type === 'recurring' || (type as string) === 'daily') && (
            <div
              id="recurring-day-selector-section"
              className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 space-y-2.5 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Active Days of Week</span>
                </label>

                {/* Preset Quick Buttons */}
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleSetPreset('all')}
                    className={`px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                      activeDays.length === 7
                        ? 'bg-indigo-500 text-white border-indigo-600 font-medium'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    Every Day
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPreset('weekdays')}
                    className={`px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                      activeDays.length === 5 &&
                      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every((d) => activeDays.includes(d as Weekday))
                        ? 'bg-indigo-500 text-white border-indigo-600 font-medium'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    Weekdays
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPreset('weekends')}
                    className={`px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                      activeDays.length === 2 &&
                      ['Sat', 'Sun'].every((d) => activeDays.includes(d as Weekday))
                        ? 'bg-indigo-500 text-white border-indigo-600 font-medium'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    Weekends
                  </button>
                </div>
              </div>

              {/* Multi-select Days Buttons Mon-Sun */}
              <div className="grid grid-cols-7 gap-1.5">
                {ALL_WEEKDAYS.map((day) => {
                  const isSelected = activeDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      id={`btn-day-select-${day.toLowerCase()}`}
                      onClick={() => handleToggleDay(day)}
                      title={`${WEEKDAY_FULL_NAMES[day]}: Click to ${isSelected ? 'deselect' : 'select'}`}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-500 border-indigo-600 text-white shadow-xs scale-100 ring-1 ring-indigo-400/50'
                          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span>{day}</span>
                      <div className="mt-1">
                        {isSelected ? (
                          <Check className="w-3 h-3 stroke-[3]" />
                        ) : (
                          <div className="w-2 h-2 rounded-full border border-neutral-300 dark:border-neutral-600" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 pt-0.5">
                <span>
                  {activeDays.length === 7
                    ? 'Repeats every day (Mon–Sun)'
                    : activeDays.length === 0
                    ? '⚠️ No days selected'
                    : `Repeats on: ${formatActiveDaysDisplay(activeDays)}`}
                </span>
                {activeDays.length < 7 && activeDays.length > 0 && (
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    {7 - activeDays.length} day{7 - activeDays.length > 1 ? 's' : ''} off
                  </span>
                )}
              </div>
            </div>
          )}

          {/* WEEKLY TASK: Skip This Week Toggle */}
          {type === 'weekly' && (
            <div
              id="weekly-skip-section"
              className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 space-y-2 animate-in fade-in duration-150"
            >
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="checkbox-skip-this-week"
                  checked={skipThisWeek}
                  onChange={(e) => setSkipThisWeek(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-300 text-purple-600 focus:ring-purple-500 cursor-pointer w-4 h-4"
                />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <span>Skip this week (one-off exception)</span>
                    {skipThisWeek && (
                      <span className="px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold border border-purple-500/20">
                        Skipped
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Hides this weekly task from this week's active list. Automatically resets and re-appears next Monday.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Priority Selector */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Priority Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-priority-high"
                onClick={() => setPriority('high')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  priority === 'high'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>High</span>
              </button>

              <button
                type="button"
                id="btn-priority-medium"
                onClick={() => setPriority('medium')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  priority === 'medium'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Medium</span>
              </button>

              <button
                type="button"
                id="btn-priority-low"
                onClick={() => setPriority('low')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  priority === 'low'
                    ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                <span>Low</span>
              </button>
            </div>
          </div>

          {/* Due Time Picker & Presets */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span>Due Time & Reminder</span>
              </label>
              {dueTime && (
                <button
                  type="button"
                  onClick={() => setDueTime('')}
                  className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                >
                  Clear time
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 mb-2">
              <input
                id="input-task-duetime"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl text-sm bg-neutral-100/70 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all"
              />
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {quickTimes.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setDueTime(preset.value)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                    dueTime === preset.value
                      ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Notes & Context (Optional)
            </label>
            <textarea
              id="input-task-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add key links, steps, or instructions..."
              className="w-full px-3.5 py-2 rounded-xl text-sm bg-neutral-100/70 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200/80 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-save-task-submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 active:scale-95 text-white shadow-xs transition-all cursor-pointer"
            >
              {initialTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
