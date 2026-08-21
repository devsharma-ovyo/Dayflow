import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderSync, 
  Check, 
  Smartphone, 
  Laptop, 
  X, 
  ShieldCheck, 
  FolderOpen, 
  Save, 
  Zap, 
  Copy, 
  CheckCircle2, 
  Apple, 
  Clock, 
  RotateCw 
} from 'lucide-react';
import { 
  saveToICloudDrive, 
  openFromICloudDrive, 
  ICloudBackup,
  getStoredICloudSyncTime,
  getIsHourlySyncEnabled,
  setIsHourlySyncEnabled,
  ICLOUD_FILENAME
} from '../services/icloudSyncService';
import { Task, AppSettings } from '../types';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  settings: AppSettings;
  onApplyRemoteState: (newTasks: Task[], newSettings?: Partial<AppSettings>) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  tasks,
  settings,
  onApplyRemoteState
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<number | null>(getStoredICloudSyncTime());
  const [hourlySyncActive, setHourlySyncActive] = useState<boolean>(getIsHourlySyncEnabled());
  const [copiedShortcut, setCopiedShortcut] = useState(false);
  const [showShortcutGuide, setShowShortcutGuide] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSyncSuccessMsg(null);
      setLastSyncedTime(getStoredICloudSyncTime());
      setHourlySyncActive(getIsHourlySyncEnabled());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveToICloud = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const res = await saveToICloudDrive(tasks, settings);
      if (res.success) {
        setLastSyncedTime(Date.now());
        setSyncSuccessMsg(`Saved "${res.filename}" with ${tasks.length} tasks to your iCloud Drive!`);
        setTimeout(() => setSyncSuccessMsg(null), 5000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save to iCloud Drive.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenFromICloud = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    setErrorMsg(null);
    openFromICloudDrive(file)
      .then((backup: ICloudBackup) => {
        if (Array.isArray(backup.tasks) && backup.tasks.length > 0) {
          onApplyRemoteState(backup.tasks, backup.settings);
          setLastSyncedTime(Date.now());
          setSyncSuccessMsg(`Loaded ${backup.tasks.length} tasks from "${file.name}"!`);
          setTimeout(() => setSyncSuccessMsg(null), 5000);
        } else {
          setErrorMsg('The selected file contains 0 tasks.');
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Could not parse the selected file.');
      })
      .finally(() => {
        setIsSyncing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
  };

  const toggleHourlySync = () => {
    const nextVal = !hourlySyncActive;
    setHourlySyncActive(nextVal);
    setIsHourlySyncEnabled(nextVal);
    setSyncSuccessMsg(nextVal ? 'Hourly auto-sync enabled!' : 'Hourly auto-sync disabled.');
    setTimeout(() => setSyncSuccessMsg(null), 3000);
  };

  const formatLastSync = (ts: number | null) => {
    if (!ts) return 'Never';
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const copyShortcutInstructions = () => {
    const shortcutTemplate = `Apple Shortcuts Auto-Sync Recipe for DayFlow:
1. Open Shortcuts App on Mac or iPhone.
2. Tap "+" to create a New Shortcut named "DayFlow".
3. Add Action: "Get File from Folder" -> Path: "DayFlow_Tasks.json" inside iCloud Drive.
4. Add Action: "URL Encode" or "Base64 Encode" on File.
5. Add Action: "Open URL" -> ${window.location.origin}/#icloud=[Encoded File Content]
6. Add to Home Screen (iPhone) or Dock/Menu Bar (Mac).`;
    
    navigator.clipboard.writeText(shortcutTemplate);
    setCopiedShortcut(true);
    setTimeout(() => setCopiedShortcut(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div 
        id="icloud-sync-modal"
        className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <FolderSync className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  iCloud Drive Backup & Sync
                </h2>
                <Apple className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                MacBook ⇄ iPhone automatic Apple ecosystem sync
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Notifications */}
          {syncSuccessMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
              <X className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Status Banner */}
          <div className="p-3.5 rounded-xl bg-linear-to-br from-sky-500/10 via-indigo-500/5 to-purple-500/10 border border-sky-500/20 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{tasks.length} tasks synced & ready</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                File: <code className="font-mono text-sky-600 dark:text-sky-400 font-medium">{ICLOUD_FILENAME}</code>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-neutral-400 block uppercase tracking-wider font-semibold">Last Synced</span>
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                {formatLastSync(lastSyncedTime)}
              </span>
            </div>
          </div>

          {/* Hourly Auto-Sync Toggle Banner */}
          <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <span>Auto-Sync Every 1 Hour</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium rounded-md">
                    Active
                  </span>
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Synchronizes updates every hour & whenever you wake your device.
                </p>
              </div>
            </div>

            <button
              onClick={toggleHourlySync}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
                hourlySyncActive ? 'bg-sky-500' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  hourlySyncActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Hidden File Input for Opening from iCloud Drive */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleOpenFromICloud}
            accept=".json,application/json"
            className="hidden"
          />

          {/* Primary 2-Way Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Save to iCloud */}
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-sky-500" />
                  <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    1. Save to iCloud
                  </h4>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                  Exports current {tasks.length} tasks to your <strong>iCloud Drive</strong> folder.
                </p>
              </div>

              <button
                onClick={handleSaveToICloud}
                disabled={isSyncing}
                className="w-full py-2.5 px-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save to iCloud Drive</span>
              </button>
            </div>

            {/* Open / Restore from iCloud */}
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-500" />
                  <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    2. Open on iPhone / Mac
                  </h4>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                  Select <code className="text-neutral-700 dark:text-neutral-300">DayFlow_Tasks.json</code> from <strong>Files &gt; iCloud Drive</strong>.
                </p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSyncing}
                className="w-full py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg text-xs font-medium flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 disabled:opacity-50"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open from Files App</span>
              </button>
            </div>
          </div>

          {/* Apple Shortcuts Auto-Sync on Launch Section */}
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Auto-Sync on Launch (Apple Shortcuts)
                </h4>
              </div>
              <button
                onClick={() => setShowShortcutGuide(!showShortcutGuide)}
                className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
              >
                {showShortcutGuide ? 'Hide Setup' : 'View Setup'}
              </button>
            </div>

            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              When opened via an Apple Shortcut icon on iPhone or MacBook, DayFlow automatically reads your iCloud backup and updates all tasks on first launch without clicking anything!
            </p>

            {showShortcutGuide && (
              <div className="pt-2 space-y-2 text-[11px] text-neutral-600 dark:text-neutral-400 border-t border-amber-500/20">
                <div className="space-y-1 bg-white/70 dark:bg-neutral-900/70 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 font-mono text-[10px]">
                  <p className="font-sans font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                    📱 30-Second Shortcut Setup:
                  </p>
                  <p>1. Open <strong>Shortcuts</strong> app on iPhone or Mac.</p>
                  <p>2. Tap <strong>+</strong> &rarr; Add Action <strong>"Get File from iCloud Drive"</strong> (select <code>DayFlow_Tasks.json</code>).</p>
                  <p>3. Add Action <strong>"Open URLs"</strong> &rarr; <span className="text-sky-600 dark:text-sky-400 font-semibold">{window.location.origin}/#icloud=[File]</span></p>
                  <p>4. Add Shortcut to Home Screen (iPhone) or Dock (Mac).</p>
                </div>

                <button
                  onClick={copyShortcutInstructions}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98"
                >
                  {copiedShortcut ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedShortcut ? 'Copied Setup Recipe!' : 'Copy Shortcut Recipe'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>100% private to your Apple ID &amp; iCloud Drive. No external servers.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
