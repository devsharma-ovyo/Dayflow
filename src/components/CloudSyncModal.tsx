import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudCheck, 
  CloudOff, 
  RefreshCw, 
  Copy, 
  Check, 
  Smartphone, 
  Laptop, 
  ArrowRight, 
  QrCode, 
  X, 
  ShieldCheck, 
  Unlink, 
  Sparkles 
} from 'lucide-react';
import { 
  generateSyncCode, 
  formatSyncCode, 
  getStoredSyncCode, 
  setStoredSyncCode, 
  getStoredSyncTime, 
  pushToCloud, 
  pullFromCloud,
  SyncPayload 
} from '../services/syncService';
import { Task, AppSettings } from '../types';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  settings: AppSettings;
  onApplyRemoteState: (newTasks: Task[], newSettings?: Partial<AppSettings>) => void;
  currentSyncCode: string | null;
  onSyncCodeChange: (code: string | null) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  tasks,
  settings,
  onApplyRemoteState,
  currentSyncCode,
  onSyncCodeChange
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'pair' | 'new'>('status');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<number | null>(getStoredSyncTime());

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSyncSuccessMsg(null);
      setLastSyncedTime(getStoredSyncTime());
      if (!currentSyncCode) {
        setActiveTab('new');
      } else {
        setActiveTab('status');
      }
    }
  }, [isOpen, currentSyncCode]);

  if (!isOpen) return null;

  const handleGenerateNewSync = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const newCode = generateSyncCode();
      await pushToCloud(newCode, tasks, settings);
      setStoredSyncCode(newCode);
      onSyncCodeChange(newCode);
      setLastSyncedTime(Date.now());
      setSyncSuccessMsg('Sync room created! Use this 6-character code on your iPhone or other Mac.');
      setActiveTab('status');
    } catch {
      setErrorMsg('Failed to initialize cloud sync room. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = formatSyncCode(inputCode.trim());
    if (!formatted || formatted.length < 4) {
      setErrorMsg('Please enter a valid 6-character sync code.');
      return;
    }

    setIsSyncing(true);
    setErrorMsg(null);
    try {
      // Pull remote state
      const remote = await pullFromCloud(formatted);
      if (remote && remote.tasks) {
        // Merge or replace
        onApplyRemoteState(remote.tasks, remote.settings);
        setStoredSyncCode(formatted);
        onSyncCodeChange(formatted);
        setLastSyncedTime(Date.now());
        setSyncSuccessMsg('Connected successfully! Tasks synced with cloud.');
        setActiveTab('status');
      } else {
        // Code is brand new, let's push our current tasks to it
        await pushToCloud(formatted, tasks, settings);
        setStoredSyncCode(formatted);
        onSyncCodeChange(formatted);
        setLastSyncedTime(Date.now());
        setSyncSuccessMsg('Connected! Current tasks saved to your new sync code.');
        setActiveTab('status');
      }
    } catch {
      setErrorMsg('Could not connect with that sync code. Please verify and try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSyncNow = async () => {
    if (!currentSyncCode) return;
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      // First push our latest
      await pushToCloud(currentSyncCode, tasks, settings);
      setLastSyncedTime(Date.now());
      setSyncSuccessMsg('Synced! All tasks are up to date.');
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch {
      setErrorMsg('Sync failed. Check your internet connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('Disconnect cloud sync from this device? Your local tasks will remain safe on this device.')) {
      setStoredSyncCode(null);
      onSyncCodeChange(null);
      setActiveTab('new');
      setSyncSuccessMsg('Disconnected. Device is now in local mode.');
    }
  };

  const copySyncCode = () => {
    if (!currentSyncCode) return;
    navigator.clipboard.writeText(currentSyncCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatLastSync = (ts: number | null) => {
    if (!ts) return 'Never';
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div 
        id="cloud-sync-modal"
        className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Cloud className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Mac & iPhone Cloud Sync
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Real-time sync across your devices • Zero passwords
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

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Status Alert Messages */}
          {syncSuccessMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Active Connected State */}
          {currentSyncCode ? (
            <div className="space-y-4">
              {/* Sync Code Display Card */}
              <div className="p-4 rounded-xl bg-linear-to-br from-sky-500/5 via-indigo-500/5 to-purple-500/5 border border-sky-500/20 dark:border-sky-500/10 flex flex-col items-center text-center space-y-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Your Device Pairing Code
                </span>
                
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xl font-bold tracking-widest text-neutral-900 dark:text-white bg-white dark:bg-neutral-800 px-4 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-xs">
                    {currentSyncCode}
                  </span>
                  <button
                    onClick={copySyncCode}
                    className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-sky-600 dark:hover:text-sky-400 shadow-xs transition-colors"
                    title="Copy Sync Code"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs">
                  Enter this 6-character code on your <strong>iPhone</strong> (or second Mac) to instantly link task lists.
                </p>
              </div>

              {/* Status & Sync Action Details */}
              <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Cloud Sync Active
                  </span>
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                    {formatLastSync(lastSyncedTime)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/40 dark:border-neutral-700/40">
                  <span className="text-neutral-500 dark:text-neutral-400">Connected Tasks</span>
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                    {tasks.filter(t => !t.archived).length} active items
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleManualSyncNow}
                  disabled={isSyncing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium text-xs shadow-xs active:scale-98 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>

                <button
                  onClick={handleDisconnect}
                  className="py-2.5 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-rose-500/10 hover:border-rose-500/30 text-neutral-600 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium transition-colors"
                  title="Unlink from this Sync Code"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>

              {/* iPhone Pairing Steps Guide */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 space-y-1.5">
                <div className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-sky-500" />
                  <span>How to connect your iPhone:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-neutral-500 dark:text-neutral-400">
                  <li>Open <strong>DayFlow</strong> on your iPhone Safari.</li>
                  <li>Tap the <strong>Cloud Sync</strong> icon in the header.</li>
                  <li>Enter the code <strong className="text-neutral-800 dark:text-neutral-200">{currentSyncCode}</strong> and tap Connect.</li>
                </ol>
              </div>
            </div>
          ) : (
            /* Setup / Connect Options */
            <div className="space-y-4">
              {/* Option A: Create New Sync Room */}
              <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 dark:bg-sky-500/10 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-500 text-white flex items-center justify-center text-xs font-bold">1</div>
                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    First time setting up sync?
                  </h3>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Generate a private 6-digit sync code for your tasks. You can share this code with your iPhone to sync instantly.
                </p>
                <button
                  onClick={handleGenerateNewSync}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium shadow-xs transition-all active:scale-98 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSyncing ? 'Creating Sync Code...' : 'Generate New Sync Code'}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                <span>OR</span>
                <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
              </div>

              {/* Option B: Enter Existing Code */}
              <form onSubmit={handleConnectWithCode} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center text-xs font-bold">2</div>
                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Already have a code from another device?
                  </h3>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. DFAB1234"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="flex-1 px-3 py-2 text-xs font-mono font-bold tracking-wider rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white uppercase focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={isSyncing || !inputCode.trim()}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 text-xs font-medium rounded-lg transition-all active:scale-98 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>Connect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Privacy & Encryption Note */}
          <div className="flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>End-to-end sync via private hashed channel. Zero tracking or telemetry.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
