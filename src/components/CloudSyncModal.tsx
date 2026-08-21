import React, { useState, useEffect, useRef } from 'react';
import { 
  Cloud, 
  FolderSync, 
  Copy, 
  Check, 
  Smartphone, 
  Laptop, 
  ArrowRight, 
  X, 
  ShieldCheck, 
  Unlink, 
  Sparkles,
  Download,
  Upload,
  FileCode,
  Share2,
  CheckCircle2,
  FolderOpen,
  Save,
  HelpCircle
} from 'lucide-react';
import { 
  generateSyncCode, 
  formatSyncCode, 
  getStoredSyncCode, 
  setStoredSyncCode, 
  getStoredSyncTime, 
  pushToCloud, 
  pullFromCloud 
} from '../services/syncService';
import { saveToICloudDrive, openFromICloudDrive, ICloudBackup } from '../services/icloudSyncService';
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
  const [activeTab, setActiveTab] = useState<'icloud' | 'cloud' | 'json' | 'link'>('icloud');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<number | null>(getStoredSyncTime());
  const [pasteJsonText, setPasteJsonText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSyncSuccessMsg(null);
      setLastSyncedTime(getStoredSyncTime());
    }
  }, [isOpen, currentSyncCode]);

  if (!isOpen) return null;

  // 1. iCloud Drive Handlers
  const handleSaveToICloud = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const res = await saveToICloudDrive(tasks, settings);
      if (res.success) {
        setSyncSuccessMsg(`Saved "${res.filename}" with ${tasks.length} tasks! Save it inside your iCloud Drive folder.`);
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

  // 2. Cloud Room Handlers
  const handleGenerateNewSync = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const newCode = generateSyncCode();
      await pushToCloud(newCode, tasks, settings);
      setStoredSyncCode(newCode);
      onSyncCodeChange(newCode);
      setLastSyncedTime(Date.now());
      setSyncSuccessMsg(`Sync room ${newCode} created with ${tasks.length} tasks!`);
    } catch {
      setErrorMsg('Failed to initialize sync room. Please check your network.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectWithCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const formatted = formatSyncCode(inputCode.trim());
    if (!formatted || formatted.length < 4) {
      setErrorMsg('Please enter a valid 6-character sync code (e.g. DF9842).');
      return;
    }

    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const remote = await pullFromCloud(formatted);
      if (remote && Array.isArray(remote.tasks) && remote.tasks.length > 0) {
        onApplyRemoteState(remote.tasks, remote.settings);
        setStoredSyncCode(formatted);
        onSyncCodeChange(formatted);
        setLastSyncedTime(remote.updatedAt || Date.now());
        setSyncSuccessMsg(`Connected! Successfully imported ${remote.tasks.length} tasks.`);
      } else {
        await pushToCloud(formatted, tasks, settings);
        setStoredSyncCode(formatted);
        onSyncCodeChange(formatted);
        setLastSyncedTime(Date.now());
        setSyncSuccessMsg(`Connected! Uploaded ${tasks.length} tasks to room ${formatted}.`);
      }
    } catch {
      setErrorMsg('Could not connect with that code. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushUpload = async () => {
    if (!currentSyncCode) return;
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      await pushToCloud(currentSyncCode, tasks, settings);
      setLastSyncedTime(Date.now());
      setSyncSuccessMsg(`Uploaded ${tasks.length} tasks to cloud successfully!`);
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch {
      setErrorMsg('Upload failed. Please check internet connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullDownload = async () => {
    if (!currentSyncCode) return;
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const remote = await pullFromCloud(currentSyncCode);
      if (remote && Array.isArray(remote.tasks) && remote.tasks.length > 0) {
        onApplyRemoteState(remote.tasks, remote.settings);
        setLastSyncedTime(remote.updatedAt || Date.now());
        setSyncSuccessMsg(`Downloaded & applied ${remote.tasks.length} tasks from cloud!`);
        setTimeout(() => setSyncSuccessMsg(null), 4000);
      } else {
        setErrorMsg('No remote tasks found in this room yet. Try clicking "Upload to Cloud" on your MacBook first.');
      }
    } catch {
      setErrorMsg('Download failed. Please check internet connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('Disconnect sync room? Your tasks will stay saved locally on this device.')) {
      setStoredSyncCode(null);
      onSyncCodeChange(null);
      setSyncSuccessMsg('Disconnected from sync room.');
    }
  };

  // 3. JSON Handlers
  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(tasks, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleImportPastedJson = () => {
    try {
      if (!pasteJsonText.trim()) {
        setErrorMsg('Please paste valid JSON text.');
        return;
      }
      const parsed = JSON.parse(pasteJsonText.trim());
      if (Array.isArray(parsed)) {
        onApplyRemoteState(parsed, settings);
        setSyncSuccessMsg(`Successfully imported ${parsed.length} tasks!`);
        setPasteJsonText('');
        setTimeout(() => setSyncSuccessMsg(null), 4000);
      } else {
        setErrorMsg('Invalid format: JSON must be an array of tasks.');
      }
    } catch {
      setErrorMsg('Failed to parse JSON. Please verify the copied text.');
    }
  };

  // 4. Shareable Link Generator
  const generateDirectShareLink = () => {
    try {
      const payload = encodeURIComponent(JSON.stringify(tasks));
      return `${window.location.origin}${window.location.pathname}#importTasks=${payload}`;
    } catch {
      return window.location.href;
    }
  };

  const handleCopyDirectLink = () => {
    const link = generateDirectShareLink();
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
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
              <FolderSync className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                MacBook ⇄ iPhone Sync
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                iCloud Drive & Apple Ecosystem Sync
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-4 pt-2 gap-1 bg-neutral-50/30 dark:bg-neutral-900/30 overflow-x-auto">
          <button
            onClick={() => setActiveTab('icloud')}
            className={`pb-2.5 px-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'icloud'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>iCloud Drive</span>
          </button>

          <button
            onClick={() => setActiveTab('link')}
            className={`pb-2.5 px-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'link'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>AirDrop / Link</span>
          </button>

          <button
            onClick={() => setActiveTab('cloud')}
            className={`pb-2.5 px-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'cloud'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Pairing Code</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`pb-2.5 px-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'json'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Notifications */}
          {syncSuccessMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB: ICLOUD DRIVE SYNC (Option A) */}
          {activeTab === 'icloud' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-semibold text-xs">
                  <FolderSync className="w-4 h-4" />
                  <span>Native Apple iCloud Drive Sync</span>
                </div>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Save your tasks to your <strong>iCloud Drive</strong> on Mac, and open them instantly from the <strong>Files App</strong> on your iPhone. 100% private to your Apple ID.
                </p>
              </div>

              {/* Hidden File Input for Reading from iCloud Drive */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleOpenFromICloud}
                accept=".json,application/json"
                className="hidden"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Save to iCloud */}
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                      <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        1. On MacBook
                      </h4>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                      Save current {tasks.length} tasks directly to your iCloud Drive folder.
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

                {/* Open from iCloud */}
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                      <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        2. On iPhone
                      </h4>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                      Select <code>DayFlow_Tasks.json</code> from your iPhone <strong>Files &gt; iCloud Drive</strong>.
                    </p>
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSyncing}
                    className="w-full py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg text-xs font-medium flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 disabled:opacity-50"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open from Files / iCloud</span>
                  </button>
                </div>
              </div>

              {/* How it works simple guide */}
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 text-[11px] text-neutral-600 dark:text-neutral-400 space-y-1">
                <div className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-sky-500" />
                  <span>How Apple iCloud Sync Works:</span>
                </div>
                <p>
                  Apple automatically synchronizes all files inside your <strong>iCloud Drive</strong> across all your Macs, iPhones, and iPads in the background. Whenever you update tasks on Mac, save the file to iCloud, and it will be waiting on your iPhone!
                </p>
              </div>
            </div>
          )}

          {/* TAB: AIRDROP / DIRECT LINK */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 dark:bg-sky-500/10 space-y-3 text-center">
                <Share2 className="w-6 h-6 text-sky-500 mx-auto" />
                <div>
                  <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    AirDrop / One-Tap Shared Link
                  </h3>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-xs mx-auto">
                    Creates a link containing your {tasks.length} tasks. AirDrop or message this link to your iPhone, tap it, and DayFlow will automatically import all tasks!
                  </p>
                </div>

                <button
                  onClick={handleCopyDirectLink}
                  className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Direct AirDrop Link'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: CLOUD CODE PAIRING */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              {currentSyncCode ? (
                <div className="space-y-4">
                  {/* Pairing Code Banner */}
                  <div className="p-4 rounded-xl bg-linear-to-br from-sky-500/10 via-indigo-500/5 to-purple-500/10 border border-sky-500/20 flex flex-col items-center text-center space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                      Active Sync Room Code
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

                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{tasks.length} local tasks • Last active {formatLastSync(lastSyncedTime)}</span>
                    </div>
                  </div>

                  {/* Explicit Two-Way Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={handlePushUpload}
                      disabled={isSyncing}
                      className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 transition-all active:scale-98 disabled:opacity-50 text-center gap-1"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="text-xs font-semibold">Upload to Cloud</span>
                      <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                        Push MacBook tasks
                      </span>
                    </button>

                    <button
                      onClick={handlePullDownload}
                      disabled={isSyncing}
                      className="flex flex-col items-center justify-center p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-500/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-300 transition-all active:scale-98 disabled:opacity-50 text-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-xs font-semibold">Download to Device</span>
                      <span className="text-[10px] text-sky-600/80 dark:text-sky-400/80">
                        Pull tasks to iPhone
                      </span>
                    </button>
                  </div>

                  {/* Disconnect Option */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={handleDisconnect}
                      className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 transition-colors"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Disconnect from this code</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Step 1: Generate Code on Mac */}
                  <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 dark:bg-sky-500/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-sky-500" />
                      <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        On your MacBook (Sender):
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Create a new sync code containing your current {tasks.length} tasks.
                    </p>
                    <button
                      onClick={handleGenerateNewSync}
                      disabled={isSyncing}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium shadow-xs transition-all active:scale-98 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isSyncing ? 'Creating Code...' : 'Generate New Sync Code'}</span>
                    </button>
                  </div>

                  {/* Step 2: Enter Code on iPhone */}
                  <form onSubmit={handleConnectWithCode} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-neutral-500" />
                      <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        On your iPhone (Receiver):
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Enter the 6-character code from your MacBook to load your tasks:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. DF9842"
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
                        <span>Connect & Pull</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB: COPY / PASTE JSON */}
          {activeTab === 'json' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
                💡 <strong>Instant 2-Second Transfer</strong>: If you just want to get your MacBook tasks onto iPhone immediately, copy the JSON below and paste it on your iPhone!
              </div>

              {/* Step 1: Copy on Mac */}
              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    1. On MacBook: Copy Task Data
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {tasks.length} tasks ready
                  </span>
                </div>
                <button
                  onClick={handleCopyJson}
                  className="w-full py-2 px-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xs"
                >
                  {copiedJson ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedJson ? 'Copied Tasks JSON!' : 'Copy All Tasks (JSON)'}</span>
                </button>
              </div>

              {/* Step 2: Paste on iPhone */}
              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 space-y-2">
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  2. On iPhone: Paste Task Data
                </span>
                <textarea
                  value={pasteJsonText}
                  onChange={(e) => setPasteJsonText(e.target.value)}
                  placeholder="Paste your copied tasks JSON here..."
                  rows={3}
                  className="w-full p-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
                <button
                  onClick={handleImportPastedJson}
                  disabled={!pasteJsonText.trim()}
                  className="w-full py-2 px-3 bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Import & Apply Tasks</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>All task data is private to your Apple devices. Zero third-party telemetry.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
