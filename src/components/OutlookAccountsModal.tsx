import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  ExternalLink, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Upload, 
  Info, 
  HelpCircle,
  Sparkles,
  Link,
  Laptop
} from 'lucide-react';
import { OutlookAccountConfig, OutlookMeeting } from '../types';
import { 
  syncOutlookAccount, 
  parseICS, 
  generateSampleDemoMeetings, 
  saveStoredOutlookMeetings, 
  getStoredOutlookMeetings,
  isDummyDemoMeeting
} from '../services/outlookSyncService';

interface OutlookAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: OutlookAccountConfig[];
  onUpdateAccounts: (accounts: OutlookAccountConfig[]) => void;
  onRefreshMeetings: () => Promise<void>;
  onImportMeetings: (meetings: OutlookMeeting[], message?: string) => void;
}

export const OutlookAccountsModal: React.FC<OutlookAccountsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onUpdateAccounts,
  onRefreshMeetings,
  onImportMeetings,
}) => {
  const [editingAccounts, setEditingAccounts] = useState<OutlookAccountConfig[]>(accounts);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ [id: string]: { success: boolean; msg: string } }>({});
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setEditingAccounts(accounts);
      setTestResult({});
    }
  }, [isOpen, accounts]);

  if (!isOpen) return null;

  const handleAccountChange = (id: string, updates: Partial<OutlookAccountConfig>) => {
    setEditingAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc))
    );
  };

  const handleTestAccount = async (account: OutlookAccountConfig) => {
    if (!account.feedUrl.trim()) {
      setTestResult((prev) => ({
        ...prev,
        [account.id]: { success: false, msg: 'Please enter a valid Outlook calendar ICS URL.' },
      }));
      return;
    }

    setTestingId(account.id);
    setTestResult((prev) => ({ ...prev, [account.id]: { success: true, msg: 'Connecting to Outlook...' } }));

    const res = await syncOutlookAccount(account);
    setTestingId(null);

    if (res.success) {
      setTestResult((prev) => ({
        ...prev,
        [account.id]: {
          success: true,
          msg: `Successfully connected! Found ${res.meetings.length} events.`,
        },
      }));
      // Merge test results into storage, excluding dummy demo meetings
      const currentStored = getStoredOutlookMeetings().filter((m) => !isDummyDemoMeeting(m));
      const otherAcc = currentStored.filter((m) => m.accountId !== account.id);
      
      const uniqueMap = new Map<string, OutlookMeeting>();
      for (const m of [...otherAcc, ...res.meetings]) {
        const dedupKey = `${m.accountId}__${m.title.trim().toLowerCase()}__${m.start}`;
        if (!uniqueMap.has(dedupKey)) {
          uniqueMap.set(dedupKey, m);
        }
      }
      const combined = Array.from(uniqueMap.values()).sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );

      saveStoredOutlookMeetings(combined);
      onImportMeetings(combined, `Connected to ${account.name}! Found ${res.meetings.length} events.`);
    } else {
      setTestResult((prev) => ({
        ...prev,
        [account.id]: {
          success: false,
          msg: res.error || 'Could not fetch calendar. Please check the URL.',
        },
      }));
    }
  };

  const handleSaveAndSync = async () => {
    setIsSaving(true);
    onUpdateAccounts(editingAccounts);
    await onRefreshMeetings();
    setIsSaving(false);
    onClose();
  };

  const handleFileUpload = (accountId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const icsText = event.target?.result as string;
      if (icsText) {
        const targetAcc = editingAccounts.find((a) => a.id === accountId) || editingAccounts[0];
        if (targetAcc) {
          const parsed = parseICS(icsText, targetAcc.id, targetAcc.name, targetAcc.color);
          if (parsed.length === 0) {
            setTestResult((prev) => ({
              ...prev,
              [accountId]: {
                success: false,
                msg: `Could not find any calendar events in "${file.name}". Please ensure it is a valid .ics file.`,
              },
            }));
            return;
          }

          // Merge with meetings from other accounts, filtering out dummy demo meetings
          const currentStored = getStoredOutlookMeetings().filter((m) => !isDummyDemoMeeting(m));
          const otherAccountsMeetings = currentStored.filter((m) => m.accountId !== targetAcc.id);
          
          const uniqueMap = new Map<string, OutlookMeeting>();
          for (const m of [...otherAccountsMeetings, ...parsed]) {
            const dedupKey = `${m.accountId}__${m.title.trim().toLowerCase()}__${m.start}`;
            if (!uniqueMap.has(dedupKey)) {
              uniqueMap.set(dedupKey, m);
            }
          }
          const combined = Array.from(uniqueMap.values()).sort(
            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
          );

          saveStoredOutlookMeetings(combined);
          onImportMeetings(combined, `Imported ${parsed.length} meetings from ${file.name}`);
          setTestResult((prev) => ({
            ...prev,
            [accountId]: {
              success: true,
              msg: `Imported ${parsed.length} meetings successfully!`,
            },
          }));
        }
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSampleDemo = () => {
    const sampleMeetings = generateSampleDemoMeetings();
    saveStoredOutlookMeetings(sampleMeetings);
    onImportMeetings(sampleMeetings, 'Loaded demo Work & Personal schedule');
    setTestResult({
      'work-outlook': { success: true, msg: 'Demo Work meetings loaded!' },
      'personal-outlook': { success: true, msg: 'Demo Personal meetings loaded!' },
    });
  };

  const colorOptions: OutlookAccountConfig['color'][] = ['sky', 'indigo', 'purple', 'emerald', 'amber', 'rose'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div 
        id="outlook-accounts-modal"
        className="w-full max-w-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Calendar className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span>Outlook Meeting Accounts (2 Accounts)</span>
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Sync Work &amp; Personal Outlook calendars without signing in
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
          {/* Quick Info & Help Toggle */}
          <div className="p-3.5 rounded-xl bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0" />
              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                Uses private Outlook <strong>ICS Calendar Feeds</strong>. No passwords or Microsoft login required.
              </p>
            </div>
            <button
              onClick={() => setShowHelpGuide(!showHelpGuide)}
              className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline shrink-0 ml-2"
            >
              {showHelpGuide ? 'Hide Guide' : 'How to get ICS URL?'}
            </button>
          </div>

          {/* Step-by-Step Guide */}
          {showHelpGuide && (
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300 animate-in fade-in">
              <h4 className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-sky-500" />
                <span>How to get your Outlook Calendar Feed URL (Takes 30 seconds):</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px] leading-relaxed">
                <li>Open <strong>Outlook on the Web</strong> (<a href="https://outlook.office.com" target="_blank" rel="noreferrer" className="text-sky-500 underline">outlook.office.com</a> or <a href="https://outlook.live.com" target="_blank" rel="noreferrer" className="text-sky-500 underline">outlook.live.com</a>).</li>
                <li>Click the <strong>Settings (⚙️)</strong> gear icon in top right &rarr; <strong>Calendar</strong> &rarr; <strong>Shared Calendars</strong>.</li>
                <li>Under <strong>Publish a calendar</strong>, select your calendar and permissions (e.g. <em>Can view all details</em>), then click <strong>Publish</strong>.</li>
                <li>Click the generated <strong>ICS</strong> link &rarr; choose <strong>Copy Link</strong>.</li>
                <li>Paste that link below for Account 1 (Work) or Account 2 (Personal)!</li>
              </ol>
            </div>
          )}

          {/* Account 1 and Account 2 Cards */}
          <div className="space-y-4">
            {editingAccounts.map((account, index) => {
              const testInfo = testResult[account.id];
              return (
                <div
                  key={account.id}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/40 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full bg-${account.color}-500 ring-2 ring-${account.color}-500/20`} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Account {index + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={account.enabled}
                          onChange={(e) => handleAccountChange(account.id, { enabled: e.target.checked })}
                          className="rounded text-sky-500 focus:ring-sky-500"
                        />
                        <span>Active</span>
                      </label>
                    </div>
                  </div>

                  {/* Account Name & Color */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
                        Label / Name
                      </label>
                      <input
                        type="text"
                        value={account.name}
                        onChange={(e) => handleAccountChange(account.id, { name: e.target.value })}
                        placeholder="e.g. Work Outlook or Personal Outlook"
                        className="w-full px-3 py-1.5 rounded-lg text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
                        Theme Color
                      </label>
                      <div className="flex items-center gap-2 py-1">
                        {colorOptions.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleAccountChange(account.id, { color: c })}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
                              account.color === c ? 'border-neutral-900 dark:border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                            } ${
                              c === 'sky'
                                ? 'bg-sky-500'
                                : c === 'indigo'
                                ? 'bg-indigo-500'
                                : c === 'purple'
                                ? 'bg-purple-500'
                                : c === 'emerald'
                                ? 'bg-emerald-500'
                                : c === 'amber'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Feed URL */}
                  <div>
                    <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1">
                        <Link className="w-3 h-3" />
                        <span>Outlook ICS / WebCal Feed URL</span>
                      </span>
                      <label className="text-sky-500 hover:text-sky-600 cursor-pointer flex items-center gap-1 font-normal">
                        <Upload className="w-3 h-3" />
                        <span>or upload .ics file</span>
                        <input
                          type="file"
                          accept=".ics,text/calendar"
                          onChange={(e) => handleFileUpload(account.id, e)}
                          className="hidden"
                        />
                      </label>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={account.feedUrl}
                        onChange={(e) => handleAccountChange(account.id, { feedUrl: e.target.value })}
                        placeholder="https://outlook.office365.com/owa/calendar/.../calendar.ics"
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-mono placeholder:font-sans focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleTestAccount(account)}
                        disabled={testingId === account.id || !account.feedUrl.trim()}
                        className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 shrink-0"
                      >
                        {testingId === account.id ? 'Testing...' : 'Test Feed'}
                      </button>
                    </div>
                  </div>

                  {/* Test Feedback */}
                  {testInfo && (
                    <div
                      className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                        testInfo.success
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {testInfo.success ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                      <span>{testInfo.msg}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Demo Pre-fill Option */}
          <div className="p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="text-xs text-neutral-700 dark:text-neutral-300">
                Want to test immediately without URLs?
              </div>
            </div>
            <button
              type="button"
              onClick={handleLoadSampleDemo}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs"
            >
              Load Demo Meetings
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {editingAccounts.filter((a) => a.enabled).length} of 2 accounts active
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndSync}
              disabled={isSaving}
              className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save &amp; Sync Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
