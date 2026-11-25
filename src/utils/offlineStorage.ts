import type {AnimeSeries, PlaybackState, PlaylistItem, SubtitleTrack} from '../types/media';

const STORAGE_KEY = 'kurocast_state_v1';
const DB_NAME = 'kurocast_offline_db';
const STORE_NAME = 'offline_blobs';

export interface PersistedAppState {
  catalog: AnimeSeries[];
  playlist: PlaylistItem[];
  subtitleTracks: Record<string, SubtitleTrack>;
  playback: PlaybackState;
  lastSyncedAt: string;
}

export function loadPersistedState(): Partial<PersistedAppState> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as Partial<PersistedAppState>;
  } catch {
    return null;
  }
}

export function savePersistedState(state: PersistedAppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {keyPath: 'id'});
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function syncOfflineManifestRecord(
  id: string,
  metadata: {title: string; streamUrl: string; sizeMb: number; cached: boolean}
): Promise<void> {
  const db = await openOfflineDb();
  if (!db) {
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (metadata.cached) {
      store.put({id, ...metadata, syncedAt: new Date().toISOString()});
    } else {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function countOfflineDbRecords(): Promise<number> {
  const db = await openOfflineDb();
  if (!db) {
    return 0;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
}
