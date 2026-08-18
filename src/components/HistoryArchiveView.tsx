import React, { useState } from 'react';
import { 
  X, 
  Archive, 
  RotateCcw, 
  Trash2, 
  Download, 
  Upload, 
  CheckCircle, 
  Clock, 
  Calendar,
  Sparkles
} from 'lucide-react';
import { Task } from '../types';
import { formatTimeDisplay } from '../utils/dateUtils';

interface HistoryArchiveViewProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onRestoreTask: (taskId: string) => void;
  onPermanentlyDeleteTask: (taskId: string) => void;
  onImportBackup: (importedTasks: Task[]) => void;
}

export const HistoryArchiveView: React.FC<HistoryArchiveViewProps> = ({
  isOpen,
  onClose,
  tasks,
  onRestoreTask,
  onPermanentlyDeleteTask,
  onImportBackup,
}) => {
  const [filter, setFilter] = useState<'all' | 'recurring' | 'weekly' | 'one-time'>('all');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Find archived tasks or completed one-time tasks
  const archivedOrCompletedOneTime = tasks.filter((t) => t.archived || (t.type === 'one-time' && t.completed));

  const filteredItems = archivedOrCompletedOneTime.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'recurring') return t.type === 'recurring' || (t.type as string) === 'daily';
    return t.type === filter;
  });

  const handleExportBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tasks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `dayflow-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportBackup(parsed);
          alert(`Successfully restored ${parsed.length} tasks from backup.`);
        }
      } catch (err) {
        alert('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="history-archive-drawer"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Completed & Archive History
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {archivedOrCompletedOneTime.length} completed or archived items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBackup}
              title="Export all tasks backup (JSON)"
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1 text-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import tasks backup (JSON)"
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1 text-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-neutral-200/50 dark:border-neutral-800 bg-neutral-100/40 dark:bg-neutral-900/40 text-xs">
          {(['all', 'recurring', 'weekly', 'one-time'] as const).map((typeKey) => (
            <button
              key={typeKey}
              onClick={() => setFilter(typeKey)}
              className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                filter === typeKey
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              {typeKey === 'all' ? 'All Archive' : typeKey}
            </button>
          ))}
        </div>

        {/* Content List */}
        <div className="p-5 overflow-y-auto space-y-2.5 flex-1">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-xs text-neutral-400">
              No completed items in archive yet. Completed one-time tasks automatically move here.
            </div>
          ) : (
            filteredItems.map((task) => {
              const completedDateDisplay = task.completedAt
                ? new Date(task.completedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Completed';

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/70 dark:border-neutral-700/70"
                >
                  <div className="flex items-start gap-2.5 min-w-0 pr-3">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-medium text-neutral-900 dark:text-neutral-100 line-through truncate">
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
                        <span className="capitalize">{task.type}</span>
                        <span>•</span>
                        <span>Completed on {completedDateDisplay}</span>
                        {task.dueTime && <span>• Due was {formatTimeDisplay(task.dueTime)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onRestoreTask(task.id)}
                      className="p-1.5 rounded-lg text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Restore to active task list"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Restore</span>
                    </button>

                    <button
                      onClick={() => onPermanentlyDeleteTask(task.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs transition-colors cursor-pointer"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <span className="text-[11px] text-neutral-400">
            Data is securely persisted locally on this device.
          </span>
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
