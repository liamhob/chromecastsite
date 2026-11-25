import React, {useState} from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CloudDownload,
  HardDrive,
  Play,
  Plus,
  Trash2,
  WifiOff,
} from 'lucide-react';
import type {PlaylistItem, StreamQuality} from '../types/media';
import {formatTimecode, validateStreamUrl} from '../utils/mediaState';
import {MediaArtwork} from './MediaArtwork';

interface PlaylistQueueViewProps {
  playlist: PlaylistItem[];
  activeItemId: string;
  offlineSimMode: boolean;
  lastSyncedAt: string;
  onPlayItem: (id: string) => void;
  onMoveItem: (id: string, direction: 'up' | 'down') => void;
  onRemoveItem: (id: string) => void;
  onToggleOfflineItem: (id: string) => void;
  onSyncAllOffline: () => void;
  onToggleOfflineSim: () => void;
  onAddCustomStream: (item: {title: string; streamUrl: string; quality: StreamQuality}) => void;
}

export const PlaylistQueueView: React.FC<PlaylistQueueViewProps> = ({
  playlist,
  activeItemId,
  offlineSimMode,
  lastSyncedAt,
  onPlayItem,
  onMoveItem,
  onRemoveItem,
  onToggleOfflineItem,
  onSyncAllOffline,
  onToggleOfflineSim,
  onAddCustomStream,
}) => {
  const [title, setTitle] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [quality, setQuality] = useState<StreamQuality>('2160p');
  const [formError, setFormError] = useState<string | null>(null);

  const cachedItems = playlist.filter((item) => item.offlineCached);
  const totalCachedMb = cachedItems.reduce((sum, item) => sum + item.sizeMb, 0);
  const visibleItems = offlineSimMode ? cachedItems : playlist;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Enter a media title before queueing.');
      return;
    }
    const urlCheck = validateStreamUrl(streamUrl);
    if (!urlCheck.valid) {
      setFormError(urlCheck.error ?? 'Invalid stream URL.');
      return;
    }
    setFormError(null);
    onAddCustomStream({
      title: trimmedTitle,
      streamUrl: urlCheck.normalized,
      quality,
    });
    setTitle('');
    setStreamUrl('');
  };

  return (
    <div className="space-y-8">
      {/* Header & Offline Storage Summary */}
      <div className="flex flex-col gap-4 border-b border-[#232736] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F4F6] sm:text-3xl">
            Playlist Queue &amp; Offline Sync
          </h1>
          <p className="mt-1 text-sm text-[#9499AD]">
            Reorder queued media for continuous Chromecast playback and cache episodes for travel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleOfflineSim}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              offlineSimMode
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                : 'border-[#2A2F42] bg-[#161924] text-[#D6D9E4] hover:bg-[#1D2130]'
            }`}
          >
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            {offlineSimMode ? 'Viewing Offline Cache Only' : 'Test Offline Mode'}
          </button>

          <button
            type="button"
            onClick={onSyncAllOffline}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#E5484D] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#D13B40] whitespace-nowrap shrink-0"
          >
            <CloudDownload className="h-3.5 w-3.5" aria-hidden="true" />
            Sync All Queued Offline
          </button>
        </div>
      </div>

      {/* Offline Metrics Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#232736] bg-[#12141C] p-4">
          <p className="text-xs text-[#9499AD]">Queued Media</p>
          <p className="mt-1 font-mono-tabular text-2xl font-semibold text-[#F4F4F6]" data-testid="queue-total-count">
            {playlist.length}
          </p>
          <p className="mt-1 text-xs text-[#9499AD]">Gapless CAF v3 queue ready</p>
        </div>

        <div className="rounded-xl border border-[#232736] bg-[#12141C] p-4">
          <p className="text-xs text-[#9499AD]">Synced Offline</p>
          <p className="mt-1 font-mono-tabular text-2xl font-semibold text-[#F4F4F6]" data-testid="offline-cached-count">
            {cachedItems.length} / {playlist.length}
          </p>
          <p className="mt-1 font-mono-tabular text-xs text-[#9499AD]">
            {(totalCachedMb / 1024).toFixed(2)} GB stored in IndexedDB
          </p>
        </div>

        <div className="rounded-xl border border-[#232736] bg-[#12141C] p-4">
          <p className="text-xs text-[#9499AD]">Last Local Sync</p>
          <p className="mt-1 font-mono-tabular text-base font-semibold text-[#F4F4F6]">
            {lastSyncedAt}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[#9499AD]">
            <HardDrive className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
            Cross-device manifest active
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Queue List */}
        <section className="rounded-2xl border border-[#232736] bg-[#12141C] p-5 lg:col-span-8">
          <div className="flex items-center justify-between border-b border-[#232736] pb-3.5">
            <h2 className="text-base font-semibold text-[#F4F4F6]">
              {offlineSimMode ? 'Offline Synced Episodes' : 'Active Cast Playlist'}
            </h2>
            <span className="font-mono-tabular text-xs text-[#9499AD]">
              {visibleItems.length} {visibleItems.length === 1 ? 'track' : 'tracks'}
            </span>
          </div>

          {visibleItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-[#D6D9E4]">
                {offlineSimMode
                  ? 'No episodes are cached offline yet.'
                  : 'Your playlist queue is currently empty.'}
              </p>
              <p className="mt-1 text-xs text-[#9499AD]">
                {offlineSimMode
                  ? 'Disable Offline Mode or click Sync All Queued Offline to store streams locally.'
                  : 'Queue an episode from the Anime tracker or add a direct HLS URL on the right.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#232736]" data-testid="playlist-list">
              {visibleItems.map((item, idx) => {
                const isActive = item.id === activeItemId;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span className="w-6 shrink-0 font-mono-tabular text-xs text-[#9499AD]">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-[#232736]">
                        <MediaArtwork
                          src={item.posterUrl}
                          alt={item.title}
                          title={item.title}
                          className="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${isActive ? 'text-[#E5484D]' : 'text-[#F4F4F6]'}`}>
                          {item.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[#9499AD]">
                          {item.subtitle} · {formatTimecode(item.durationSec)} · {item.quality} · {item.sizeMb} MB
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                      <button
                        type="button"
                        onClick={() => onPlayItem(item.id)}
                        aria-label={`Play ${item.title}`}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#1A1D28] px-3 py-2 text-xs font-medium text-[#F4F4F6] transition-colors hover:bg-[#252A3B] whitespace-nowrap shrink-0"
                      >
                        <Play className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
                        {isActive ? 'Playing' : 'Play'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleOfflineItem(item.id)}
                        aria-label={
                          item.offlineCached
                            ? `Remove ${item.title} from offline cache`
                            : `Save ${item.title} offline`
                        }
                        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          item.offlineCached
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-[#232736] bg-[#0A0B0F] text-[#9499AD] hover:text-[#F4F4F6]'
                        }`}
                      >
                        {item.offlineCached ? (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <CloudDownload className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {item.offlineCached ? 'Synced' : 'Save Offline'}
                      </button>

                      <button
                        type="button"
                        disabled={idx === 0 || offlineSimMode}
                        onClick={() => onMoveItem(item.id, 'up')}
                        aria-label={`Move ${item.title} up`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-[#9499AD] transition-colors hover:bg-[#1A1D28] hover:text-[#F4F4F6] disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === visibleItems.length - 1 || offlineSimMode}
                        onClick={() => onMoveItem(item.id, 'down')}
                        aria-label={`Move ${item.title} down`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-[#9499AD] transition-colors hover:bg-[#1A1D28] hover:text-[#F4F4F6] disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        aria-label={`Remove ${item.title} from queue`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-[#9499AD] transition-colors hover:bg-[#2A191D] hover:text-[#F87171]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Add Custom HLS / Browser Stream URL Form */}
        <aside className="rounded-2xl border border-[#232736] bg-[#12141C] p-5 lg:col-span-4">
          <h2 className="text-base font-semibold text-[#F4F4F6]">Queue Custom Stream</h2>
          <p className="mt-1 text-xs text-[#9499AD]">
            Paste any LL-HLS (.m3u8) or MP4 stream URL from your mobile browser to enqueue on Chromecast.
          </p>

          <form onSubmit={handleAddSubmit} className="mt-4 space-y-4" noValidate>
            <div>
              <label htmlFor="queue-title" className="block text-xs font-medium text-[#D6D9E4]">
                Title
              </label>
              <input
                id="queue-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="e.g. OVA Special — 4K Remaster"
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-2 text-sm text-[#F4F4F6] placeholder-[#6B7085] focus:border-[#E5484D] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="queue-url" className="block text-xs font-medium text-[#D6D9E4]">
                HLS / Media Stream URL
              </label>
              <input
                id="queue-url"
                type="url"
                value={streamUrl}
                onChange={(e) => {
                  setStreamUrl(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="https://stream.example.com/4k/master.m3u8"
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-2 text-sm text-[#F4F4F6] placeholder-[#6B7085] focus:border-[#E5484D] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="queue-quality" className="block text-xs font-medium text-[#D6D9E4]">
                Target Cast Resolution
              </label>
              <select
                id="queue-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value as StreamQuality)}
                className="mt-1.5 w-full min-h-[42px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-2 text-sm text-[#F4F4F6] focus:border-[#E5484D] focus:outline-none"
              >
                <option value="2160p">4K UHD (2160p HDR10)</option>
                <option value="1440p">QHD (1440p)</option>
                <option value="1080p">Full HD (1080p)</option>
                <option value="720p">HD (720p)</option>
              </select>
            </div>

            {formError && (
              <p role="alert" className="text-xs text-[#F87171]">
                {formError}
              </p>
            )}

            <button
              type="submit"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#E5484D] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#D13B40] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add to Cast Queue
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
};
