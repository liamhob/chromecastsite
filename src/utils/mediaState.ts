import type {AnimeSeries, PlaylistItem, WatchStatus} from '../types/media';

export function formatTimecode(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function validateStreamUrl(rawUrl: string): {valid: boolean; normalized: string; error?: string} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {valid: false, normalized: '', error: 'Stream URL is required.'};
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        valid: false,
        normalized: '',
        error: 'Only http:// and https:// stream URLs are supported for Chromecast.',
      };
    }
    return {valid: true, normalized: parsed.toString()};
  } catch {
    return {
      valid: false,
      normalized: '',
      error: 'Enter a valid HLS (.m3u8), MP4, or Web stream URL (e.g., https://cdn.example.com/master.m3u8).',
    };
  }
}

export function reorderPlaylist(
  items: PlaylistItem[],
  itemId: string,
  direction: 'up' | 'down'
): PlaylistItem[] {
  const idx = items.findIndex((item) => item.id === itemId);
  if (idx === -1) {
    return items;
  }
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(idx, 1);
  next.splice(targetIdx, 0, moved);
  return next;
}

export function enqueueMediaItem(items: PlaylistItem[], newItem: PlaylistItem): PlaylistItem[] {
  const exists = items.some((i) => i.id === newItem.id);
  if (exists) {
    return items;
  }
  return [...items, newItem];
}

export function removePlaylistItem(
  items: PlaylistItem[],
  removeId: string,
  activeItemId: string
): {items: PlaylistItem[]; nextActiveId: string} {
  const idx = items.findIndex((i) => i.id === removeId);
  if (idx === -1) {
    return {items, nextActiveId: activeItemId};
  }
  const filtered = items.filter((i) => i.id !== removeId);
  if (removeId !== activeItemId) {
    return {items: filtered, nextActiveId: activeItemId};
  }
  const fallback = filtered[idx] ?? filtered[idx - 1] ?? filtered[0];
  return {
    items: filtered,
    nextActiveId: fallback ? fallback.id : '',
  };
}

export function computeSeriesProgress(series: AnimeSeries): {
  watchedCount: number;
  totalCount: number;
  percent: number;
  offlineCount: number;
  offlineMb: number;
} {
  const totalCount = series.episodes.length;
  const watchedCount = series.episodes.filter((ep) => ep.watched).length;
  const offlineEpisodes = series.episodes.filter((ep) => ep.offlineCached);
  const offlineCount = offlineEpisodes.length;
  const offlineMb = offlineEpisodes.reduce((sum, ep) => sum + ep.sizeMb, 0);
  const percent = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;

  return {watchedCount, totalCount, percent, offlineCount, offlineMb};
}

export function toggleEpisodeWatched(
  catalog: AnimeSeries[],
  seriesId: string,
  episodeId: string
): AnimeSeries[] {
  return catalog.map((series) => {
    if (series.id !== seriesId) {
      return series;
    }
    const episodes = series.episodes.map((ep) => {
      if (ep.id !== episodeId) {
        return ep;
      }
      const nextWatched = !ep.watched;
      return {
        ...ep,
        watched: nextWatched,
        resumeSec: nextWatched ? ep.durationSec : 0,
      };
    });

    const watchedCount = episodes.filter((ep) => ep.watched).length;
    let nextStatus: WatchStatus = series.status;
    if (watchedCount === episodes.length && episodes.length > 0) {
      nextStatus = 'completed';
    } else if (watchedCount > 0 && (series.status === 'plan-to-watch' || series.status === 'completed')) {
      nextStatus = 'watching';
    }

    return {
      ...series,
      status: nextStatus,
      episodes,
    };
  });
}

export function toggleEpisodeOfflineCache(
  catalog: AnimeSeries[],
  seriesId: string,
  episodeId: string
): AnimeSeries[] {
  return catalog.map((series) => {
    if (series.id !== seriesId) {
      return series;
    }
    return {
      ...series,
      episodes: series.episodes.map((ep) =>
        ep.id === episodeId ? {...ep, offlineCached: !ep.offlineCached} : ep
      ),
    };
  });
}
