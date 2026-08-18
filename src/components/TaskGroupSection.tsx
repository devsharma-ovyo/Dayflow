import React, { useState } from 'react';
import { Task, TaskPriority } from '../types';
import { TaskCard } from './TaskCard';

interface TaskGroupSectionProps {
  priority: TaskPriority;
  tasks: Task[];
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onChangePriority: (taskId: string, newPriority: TaskPriority) => void;
  onReorderWithinPriority: (priority: TaskPriority, reorderedTasks: Task[]) => void;
  onToggleSkipWeek?: (task: Task) => void;
  compactView?: boolean;
}

export const TaskGroupSection: React.FC<TaskGroupSectionProps> = ({
  priority,
  tasks,
  onToggleComplete,
  onEdit,
  onDelete,
  onChangePriority,
  onReorderWithinPriority,
  onToggleSkipWeek,
  compactView = false,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const meta = {
    high: {
      title: 'High Priority',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      dotColor: 'bg-rose-500',
      emptyText: 'No high-priority tasks',
    },
    medium: {
      title: 'Medium Priority',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      dotColor: 'bg-amber-500',
      emptyText: 'No medium-priority tasks',
    },
    low: {
      title: 'Low Priority',
      badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      dotColor: 'bg-sky-500',
      emptyText: 'No low-priority tasks',
    },
  }[priority];

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTaskId(task.id);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTaskId !== targetTask.id) {
      setDragOverTaskId(targetTask.id);
    }
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const handleDrop = (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!sourceId || sourceId === targetTask.id) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }

    const sourceIndex = tasks.findIndex((t) => t.id === sourceId);
    const targetIndex = tasks.findIndex((t) => t.id === targetTask.id);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const updated = [...tasks];
      const [removed] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, removed);
      // Update internal order property
      const reindexed = updated.map((t, idx) => ({ ...t, order: idx }));
      onReorderWithinPriority(priority, reindexed);
    }

    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  if (tasks.length === 0) {
    return null;
  }

  return (
    <section id={`priority-group-${priority}`} className="mb-6">
      {/* Section Header with Priority Pill & Task Count */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
            {meta.title}
          </h3>
          <span className="px-1.5 py-0.2 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
            {tasks.length}
          </span>
        </div>

        <span className="text-[11px] text-neutral-400 dark:text-neutral-500 hidden sm:inline">
          Drag to reorder
        </span>
      </div>

      {/* Task Cards Stack */}
      <div className="space-y-2.5">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="relative transition-all duration-300 ease-out"
          >
            {dragOverTaskId === task.id && draggedTaskId !== task.id && (
              <div className="h-1 bg-sky-500 rounded-full my-1 animate-pulse shadow-xs" />
            )}
            <TaskCard
              task={task}
              onToggleComplete={onToggleComplete}
              onEdit={onEdit}
              onDelete={onDelete}
              onChangePriority={onChangePriority}
              onToggleSkipWeek={onToggleSkipWeek}
              isDragging={draggedTaskId === task.id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              compactView={compactView}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

