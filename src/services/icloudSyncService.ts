// iCloud Drive File & Apple Shortcuts Auto-Sync Service for DayFlow (MacBook ⇄ iPhone)
import { Task, AppSettings } from '../types';

export interface ICloudBackup {
  app: 'DayFlow';
  version: number;
  exportedAt: string;
  timestamp: number;
  tasksCount: number;
  tasks: Task[];
  settings: Partial<AppSettings>;
}

export const ICLOUD_FILENAME = 'DayFlow_Tasks.json';
export const ICLOUD_LAST_SYNC_KEY = 'dayflow_icloud_last_sync_time';
export const ICLOUD_AUTO_SYNC_ENABLED_KEY = 'dayflow_icloud_autosync_hourly';
export const ICLOUD_CACHED_BACKUP_KEY = 'dayflow_icloud_cached_backup';

export function getStoredICloudSyncTime(): number | null {
  try {
    const val = localStorage.getItem(ICLOUD_LAST_SYNC_KEY);
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

export function setStoredICloudSyncTime(ts: number): void {
  try {
    localStorage.setItem(ICLOUD_LAST_SYNC_KEY, ts.toString());
  } catch {
    // Ignore
  }
}

export function getIsHourlySyncEnabled(): boolean {
  try {
    const val = localStorage.getItem(ICLOUD_AUTO_SYNC_ENABLED_KEY);
    return val !== null ? val === 'true' : true; // Default to true
  } catch {
    return true;
  }
}

export function setIsHourlySyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ICLOUD_AUTO_SYNC_ENABLED_KEY, enabled.toString());
  } catch {
    // Ignore
  }
}

/**
 * Saves tasks directly to iCloud Drive (via File System Access API or browser download into iCloud Drive folder)
 */
export async function saveToICloudDrive(tasks: Task[], settings: Partial<AppSettings>, silent = false): Promise<{ success: boolean; filename: string }> {
  const payload: ICloudBackup = {
    app: 'DayFlow',
    version: 1,
    exportedAt: new Date().toISOString(),
    timestamp: Date.now(),
    tasksCount: tasks.length,
    tasks,
    settings: {
      theme: settings.theme,
      compactView: settings.compactView,
      enableAudioChime: settings.enableAudioChime,
      enableNotifications: settings.enableNotifications
    }
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  // Store in cache for recovery
  try {
    localStorage.setItem(ICLOUD_CACHED_BACKUP_KEY, jsonString);
  } catch {
    // Ignore quota issues
  }

  setStoredICloudSyncTime(Date.now());

  // 1. File System Access API (Supported on macOS Chrome, Edge, Safari TP - direct Save to iCloud Drive)
  if ('showSaveFilePicker' in window && !silent) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: ICLOUD_FILENAME,
        types: [
          {
            description: 'DayFlow iCloud Tasks Backup',
            accept: { 'application/json': ['.json'] }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { success: true, filename: handle.name || ICLOUD_FILENAME };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, filename: ICLOUD_FILENAME };
      }
    }
  }

  // 2. Universal iOS / macOS Safari Fallback (Prompts Save to Files > iCloud Drive)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ICLOUD_FILENAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return { success: true, filename: ICLOUD_FILENAME };
}

/**
 * Reads tasks from an iCloud Drive file selected by the user via native file picker.
 */
export function openFromICloudDrive(file: File): Promise<ICloudBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        setStoredICloudSyncTime(Date.now());

        if (Array.isArray(parsed)) {
          resolve({
            app: 'DayFlow',
            version: 1,
            exportedAt: new Date().toISOString(),
            timestamp: Date.now(),
            tasksCount: parsed.length,
            tasks: parsed,
            settings: {}
          });
        } else if (parsed && Array.isArray(parsed.tasks)) {
          resolve(parsed);
        } else {
          reject(new Error('Invalid task format in selected file.'));
        }
      } catch (err) {
        reject(new Error('Could not read JSON file. Please ensure it is a valid DayFlow file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file from storage.'));
    reader.readAsText(file);
  });
}

/**
 * Parses payload passed on launch via Apple Shortcuts (URL Hash or query parameter)
 * Supports: #icloud=<encoded_json>, #icloud=base64:<data>, #importTasks=<json>
 */
export function parseLaunchShortcutData(rawHashOrUrl: string): { tasks: Task[]; settings?: Partial<AppSettings> } | null {
  try {
    let payloadStr = '';

    if (rawHashOrUrl.includes('icloud=')) {
      payloadStr = rawHashOrUrl.split('icloud=')[1]?.split('&')[0];
    } else if (rawHashOrUrl.includes('importTasks=')) {
      payloadStr = rawHashOrUrl.split('importTasks=')[1]?.split('&')[0];
    } else if (rawHashOrUrl.includes('data=')) {
      payloadStr = rawHashOrUrl.split('data=')[1]?.split('&')[0];
    }

    if (!payloadStr) return null;

    let jsonText = '';
    if (payloadStr.startsWith('base64:')) {
      jsonText = atob(payloadStr.replace('base64:', ''));
    } else {
      jsonText = decodeURIComponent(payloadStr);
    }

    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) {
      return { tasks: parsed };
    } else if (parsed && Array.isArray(parsed.tasks)) {
      return { tasks: parsed.tasks, settings: parsed.settings };
    }
  } catch (err) {
    console.warn('Failed to parse Apple Shortcut launch data:', err);
  }
  return null;
}
