// iCloud Drive File & Direct Peer Sync Engine for DayFlow (MacBook ⇄ iPhone)
// Provides:
// 1. Native File System Access API (Save directly to / open from iCloud Drive folder)
// 2. Fallback direct JSON export/import for mobile Safari & Files app
// 3. WebRTC Local P2P Sync (Direct peer-to-peer real-time connection across Wi-Fi)

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

const ICLOUD_FILENAME = 'DayFlow_Tasks.json';

/**
 * Saves tasks directly to iCloud Drive (or Downloads on devices supporting File System Access API)
 * or triggers a standard iOS/macOS download to iCloud Drive.
 */
export async function saveToICloudDrive(tasks: Task[], settings: Partial<AppSettings>): Promise<{ success: boolean; filename: string }> {
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

  // 1. Modern File System Access API (Save dialog directly inside iCloud Drive in Finder)
  if ('showSaveFilePicker' in window) {
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

  // 2. Universal iOS / macOS Safari Fallback (Prompts download into iCloud Drive / Files)
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

        // Handle both full DayFlow backup object and raw Task[] array
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
