import React from 'react';
import { X, Bell, Laptop, Download, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface PwaLimitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestNotificationPermission: () => void;
  permissionStatus: NotificationPermission | 'unsupported';
  isStandalone: boolean;
}

export const PwaLimitationsModal: React.FC<PwaLimitationsModalProps> = ({
  isOpen,
  onClose,
  onRequestNotificationPermission,
  permissionStatus,
  isStandalone,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="pwa-limitations-modal"
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                macOS PWA & Reminders Guide
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                How notifications and background timers function on macOS
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
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-neutral-600 dark:text-neutral-300">
          {/* Notification Permission Status Card */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-sky-500" />
                Browser Notification Permission
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                  permissionStatus === 'granted'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                {permissionStatus}
              </span>
            </div>

            {permissionStatus !== 'granted' && (
              <button
                onClick={onRequestNotificationPermission}
                className="w-full mt-2 py-1.5 px-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Grant Notification Permission
              </button>
            )}
          </div>

          {/* How It Works on macOS Section */}
          <div className="space-y-3">
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              How DayFlow Delivers Reminders
            </h4>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-neutral-900 dark:text-neutral-100">When DayFlow is open or minimized in Dock:</strong>
                <p className="mt-0.5 text-neutral-500 dark:text-neutral-400">
                  Precision timers evaluate every minute to fire native system notifications and subtle glass chimes immediately at the scheduled due time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-neutral-900 dark:text-neutral-100">When the app is fully quit (Cmd+Q):</strong>
                <p className="mt-0.5 text-neutral-500 dark:text-neutral-400">
                  Web standards (PWA Web Workers) do not run client-side background timer loops when fully terminated without a remote push relay server. Keep DayFlow minimized in your Dock or in a pinned browser tab for uninterrupted precision reminders.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-neutral-900 dark:text-neutral-100">Upcoming Reminders HUD:</strong>
                <p className="mt-0.5 text-neutral-500 dark:text-neutral-400">
                  The in-app reminder panel highlights all tasks due within the next 60 minutes with live countdowns so you never miss a beat when working in DayFlow.
                </p>
              </div>
            </div>
          </div>

          {/* Installing to macOS Dock */}
          <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50">
            <h4 className="font-semibold text-sky-900 dark:text-sky-200 flex items-center gap-1.5 mb-1.5">
              <Download className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Installing to macOS Dock
            </h4>
            <p className="text-sky-800 dark:text-sky-300 leading-relaxed text-[11px]">
              {isStandalone
                ? '✅ DayFlow is already running in standalone window mode from your macOS Dock!'
                : 'In Google Chrome or Microsoft Edge, click the Install DayFlow icon in the URL address bar or select Chrome Menu > Save and Share > Install DayFlow. It creates a dedicated Mac app icon in Launchpad and your Dock with offline support.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
