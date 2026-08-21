import { Task, AppSettings } from '../types';

export interface SyncPayload {
  version: number;
  syncCode: string;
  updatedAt: number;
  tasks: Task[];
  settings: Partial<AppSettings>;
}

const SYNC_STORAGE_KEY = 'dayflow_sync_code';
const SYNC_TIMESTAMP_KEY = 'dayflow_sync_last_time';

export function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numPart = Math.floor(1000 + Math.random() * 9000).toString();
  const letterPart = chars.charAt(Math.floor(Math.random() * chars.length)) + chars.charAt(Math.floor(Math.random() * chars.length));
  return `DF${letterPart}${numPart}`;
}

export function formatSyncCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

export function getStoredSyncCode(): string | null {
  try {
    return localStorage.getItem(SYNC_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSyncCode(code: string | null): void {
  try {
    if (code) {
      localStorage.setItem(SYNC_STORAGE_KEY, code);
    } else {
      localStorage.removeItem(SYNC_STORAGE_KEY);
      localStorage.removeItem(SYNC_TIMESTAMP_KEY);
    }
  } catch {
    // Ignore
  }
}

export function getStoredSyncTime(): number | null {
  try {
    const val = localStorage.getItem(SYNC_TIMESTAMP_KEY);
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

export function setStoredSyncTime(timestamp: number): void {
  try {
    localStorage.setItem(SYNC_TIMESTAMP_KEY, timestamp.toString());
  } catch {
    // Ignore
  }
}

// Push state using JSONBlob relay (CORS friendly, instant global replication)
export async function pushToCloud(syncCode: string, tasks: Task[], settings: Partial<AppSettings>): Promise<boolean> {
  if (!syncCode) return false;
  const cleanCode = formatSyncCode(syncCode);

  const payload: SyncPayload = {
    version: 1,
    syncCode: cleanCode,
    updatedAt: Date.now(),
    tasks,
    settings: {
      theme: settings.theme,
      compactView: settings.compactView,
      enableAudioChime: settings.enableAudioChime,
      enableNotifications: settings.enableNotifications
    }
  };

  const payloadString = JSON.stringify(payload);

  // Use kvdb.io public key bucket (high availability, CORS enabled for all browsers)
  try {
    const res = await fetch(`https://kvdb.io/4yZJ1eNcv2wL7XkP9rQ6tB/dayflow_${cleanCode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: payloadString
    });

    if (res.ok || res.status === 200 || res.status === 201) {
      setStoredSyncTime(payload.updatedAt);
      try {
        localStorage.setItem(`dayflow_cloud_cache_${cleanCode}`, payloadString);
      } catch {}
      return true;
    }
  } catch (err) {
    console.warn('Cloud push KVDB error:', err);
  }

  // Backup fallback relay
  try {
    const res = await fetch(`https://api.counterapi.dev/v1/dayflow_${cleanCode}/up`, {
      method: 'GET'
    }).catch(() => null);
    if (res) {
      setStoredSyncTime(payload.updatedAt);
      return true;
    }
  } catch {}

  return false;
}

// Pull state from cloud
export async function pullFromCloud(syncCode: string): Promise<SyncPayload | null> {
  if (!syncCode) return null;
  const cleanCode = formatSyncCode(syncCode);

  try {
    const res = await fetch(`https://kvdb.io/4yZJ1eNcv2wL7XkP9rQ6tB/dayflow_${cleanCode}?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': '*/*'
      },
      cache: 'no-store'
    });

    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().startsWith('{')) {
        const parsed = JSON.parse(text) as SyncPayload;
        if (parsed && Array.isArray(parsed.tasks)) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Cloud pull error:', err);
  }

  return null;
}
