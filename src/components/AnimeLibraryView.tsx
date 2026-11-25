import React, {useState} from 'react';
import {
  Check,
  CloudDownload,
  ListPlus,
  Loader2,
  Play,
  Plus,
  Search,
} from 'lucide-react';
import type {AnimeSeries, Episode, JikanSearchResult, WatchStatus} from '../types/media';
import {computeSeriesProgress, formatTimecode} from '../utils/mediaState';
import {MediaArtwork} from './MediaArtwork';

interface AnimeLibraryViewProps {
  catalog: AnimeSeries[];
  onToggleEpisodeWatched: (seriesId: string, episodeId: string) => void;
  onToggleEpisodeOffline: (seriesId: string, episodeId: string) => void;
  onChangeSeriesStatus: (seriesId: string, status: WatchStatus) => void;
  onQueueEpisode: (series: AnimeSeries, episode: Episode, playImmediately: boolean) => void;
  onImportFromJikan: (item: JikanSearchResult) => void;
}

const STATUS_TABS: Array<{value: WatchStatus | 'all'; label: string}> = [
  {value: 'all', label: 'All'},
  {value: 'watching', label: 'Watching'},
  {value: 'plan-to-watch', label: 'Plan to Watch'},
  {value: 'completed', label: 'Completed'},
  {value: 'on-hold', label: 'On Hold'},
];

const STATUS_LABELS: Record<WatchStatus, string> = {
  watching: 'Watching',
  'plan-to-watch': 'Plan to Watch',
  completed: 'Completed',
  'on-hold': 'On Hold',
};

export const AnimeLibraryView: React.FC<AnimeLibraryViewProps> = ({
  catalog,
  onToggleEpisodeWatched,
  onToggleEpisodeOffline,
  onChangeSeriesStatus,
  onQueueEpisode,
  onImportFromJikan,
}) => {
  const [statusFilter, setStatusFilter] = useState<WatchStatus | 'all'>('all');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(catalog[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<JikanSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  const filteredCatalog =
    statusFilter === 'all'
      ? catalog
      : catalog.filter((series) => series.status === statusFilter);

  const selectedSeries =
    filteredCatalog.find((s) => s.id === selectedSeriesId) ??
    catalog.find((s) => s.id === selectedSeriesId) ??
    filteredCatalog[0] ??
    null;

  const selectedProgress = selectedSeries ? computeSeriesProgress(selectedSeries) : null;

  const handlePublicSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchError('Enter at least 2 characters to search MyAnimeList metadata.');
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      let results: JikanSearchResult[] = [];
      let usedDirectFallback = false;

      try {
        const res = await fetch(`./api/anime/search?q=${encodeURIComponent(trimmed)}`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = (await res.json()) as {results?: JikanSearchResult[]; error?: string};
          results = data.results ?? [];
        } else {
          usedDirectFallback = true;
        }
      } catch {
        usedDirectFallback = true;
      }

      if (usedDirectFallback) {
        const directRes = await fetch(
          `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(trimmed)}&limit=8&sfw=true`,
          {headers: {Accept: 'application/json'}}
        );
        if (!directRes.ok) {
          setSearchError(`Public anime database returned HTTP ${directRes.status}. Try again shortly.`);
          setSearchResults([]);
          return;
        }
        const payload = (await directRes.json()) as {
          data?: Array<{
            mal_id: number;
            title: string;
            title_japanese?: string;
            episodes?: number | null;
            score?: number | null;
            year?: number | null;
            synopsis?: string | null;
            studios?: Array<{name: string}>;
            genres?: Array<{name: string}>;
            images?: {jpg?: {large_image_url?: string; image_url?: string}};
          }>;
        };
        results = (payload.data ?? []).map((item) => ({
          malId: item.mal_id,
          title: item.title,
          japaneseTitle: item.title_japanese ?? '',
          totalEpisodes: item.episodes && item.episodes > 0 ? item.episodes : 12,
          score: item.score ?? 8.0,
          year: item.year ?? 2024,
          studio: item.studios?.[0]?.name ?? 'Independent Studio',
          genres: (item.genres ?? []).slice(0, 3).map((g) => g.name),
          synopsis:
            item.synopsis?.replace(/\s*\[Written by MAL Rewrite\]\s*/i, '').trim() ||
            'No synopsis available from database metadata.',
          posterUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
        }));
      }

      setSearchResults(results);
      if (results.length === 0) {
        setSearchError(`No anime titles matched "${trimmed}".`);
      }
    } catch {
      setSearchError('Offline or unable to reach the public anime metadata service.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Watchlist Status Filter */}
      <div className="flex flex-col gap-4 border-b border-[#232736] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F4F6] sm:text-3xl">
            Anime Watchlist &amp; Episode Tracker
          </h1>
          <p className="mt-1 text-sm text-[#9499AD]">
            Track per-episode progress, queue directly to Chromecast, or pull live metadata from Jikan / MyAnimeList.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Filter watchlist by status"
          className="flex flex-wrap items-center gap-1 rounded-xl border border-[#232736] bg-[#12141C] p-1"
        >
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(tab.value)}
                className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#232736] text-[#F4F4F6]'
                    : 'text-[#9499AD] hover:text-[#F4F4F6]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Public Anime DB Search (Jikan v4) */}
      <section className="rounded-2xl border border-[#232736] bg-[#12141C] p-5" aria-label="Public Anime Database Search">
        <form onSubmit={handlePublicSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#9499AD]"
              aria-hidden="true"
            />
            <label htmlFor="jikan-search-input" className="sr-only">
              Search public anime database
            </label>
            <input
              id="jikan-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (searchError) setSearchError(null);
              }}
              placeholder="Search public anime database (e.g. Frieren, Cowboy Bebop, Mushishi)..."
              className="w-full min-h-[44px] rounded-lg border border-[#232736] bg-[#0A0B0F] py-2 pr-4 pl-10 text-sm text-[#F4F4F6] placeholder-[#6B7085] focus:border-[#E5484D] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#E5484D] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#D13B40] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            Lookup Metadata
          </button>
        </form>

        {searchError && (
          <p role="alert" className="mt-3 text-xs text-[#F87171]">
            {searchError}
          </p>
        )}

        {searchResults.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#232736] pt-4 md:grid-cols-2">
            {searchResults.map((item) => {
              const alreadyInLibrary =
                importedIds.has(item.malId) || catalog.some((s) => s.malId === item.malId);
              return (
                <div
                  key={item.malId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#232736] bg-[#0D0F16] p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md border border-[#232736]">
                      <MediaArtwork
                        src={item.posterUrl}
                        alt={item.title}
                        title={item.title}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#F4F4F6]">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-[#9499AD]">
                        {item.studio} · {item.year} · {item.totalEpisodes} eps · Score {item.score.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={alreadyInLibrary}
                    onClick={() => {
                      onImportFromJikan(item);
                      setImportedIds((prev) => new Set(prev).add(item.malId));
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#2A2F42] bg-[#161924] px-3 py-1.5 text-xs font-medium text-[#F4F4F6] transition-colors hover:bg-[#1E2232] disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {alreadyInLibrary ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        Added
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
                        Add
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Main Split: Series Grid + Detailed Episode Tracker */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Series List */}
        <section className="space-y-4 lg:col-span-5" aria-label="Watchlist Series">
          {filteredCatalog.length === 0 ? (
            <div className="rounded-2xl border border-[#232736] bg-[#12141C] p-8 text-center">
              <p className="text-sm font-medium text-[#D6D9E4]">No series in this watchlist bucket.</p>
              <p className="mt-1 text-xs text-[#9499AD]">
                Switch filters above or import a new title from the public anime database.
              </p>
            </div>
          ) : (
            filteredCatalog.map((series) => {
              const progress = computeSeriesProgress(series);
              const isSelected = selectedSeries?.id === series.id;
              return (
                <button
                  key={series.id}
                  type="button"
                  onClick={() => setSelectedSeriesId(series.id)}
                  className={`block w-full overflow-hidden rounded-2xl border text-left transition-colors ${
                    isSelected
                      ? 'border-[#E5484D] bg-[#161924]'
                      : 'border-[#232736] bg-[#12141C] hover:border-[#343B52]'
                  }`}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-[#0D0F16]">
                    <MediaArtwork
                      src={series.posterUrl}
                      alt={series.title}
                      title={series.title}
                      className="h-full w-full"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-4 pt-12 pb-3.5">
                      <p className="text-xs text-[#D6D9E4]">
                        {series.studio} · {series.year} · Score {series.score.toFixed(2)}
                      </p>
                      <h2 className="mt-0.5 text-lg font-semibold text-white">{series.title}</h2>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between text-xs text-[#9499AD]">
                      <span>{STATUS_LABELS[series.status]}</span>
                      <span className="font-mono-tabular text-[#F4F4F6]">
                        {progress.watchedCount} / {progress.totalCount} eps ({progress.percent}%)
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#232736]">
                      <div
                        className="h-full rounded-full bg-[#E5484D] transition-all duration-300"
                        style={{width: `${progress.percent}%`}}
                      />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </section>

        {/* Detailed Episode Tracker Panel */}
        <section className="rounded-2xl border border-[#232736] bg-[#12141C] p-6 lg:col-span-7" aria-label="Episode Progress Tracker">
          {!selectedSeries || !selectedProgress ? (
            <p className="py-12 text-center text-sm text-[#9499AD]">
              Select a series to manage its episodes and offline cache.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-4 border-b border-[#232736] pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs text-[#9499AD]">
                    {selectedSeries.japaneseTitle} · {selectedSeries.genres.join(' · ')}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-[#F4F4F6]">
                    {selectedSeries.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#B6BACB]">
                    {selectedSeries.synopsis}
                  </p>
                </div>

                <div className="shrink-0">
                  <label htmlFor="series-status-select" className="block text-xs text-[#9499AD]">
                    Watchlist Status
                  </label>
                  <select
                    id="series-status-select"
                    value={selectedSeries.status}
                    onChange={(e) =>
                      onChangeSeriesStatus(selectedSeries.id, e.target.value as WatchStatus)
                    }
                    className="mt-1.5 min-h-[40px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-2 text-xs font-medium text-[#F4F4F6] focus:border-[#E5484D] focus:outline-none"
                  >
                    <option value="watching">Watching</option>
                    <option value="plan-to-watch">Plan to Watch</option>
                    <option value="completed">Completed</option>
                    <option value="on-hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#9499AD]">
                <span className="font-mono-tabular" data-testid="selected-series-progress">
                  Progress: {selectedProgress.watchedCount} of {selectedProgress.totalCount} episodes watched ({selectedProgress.percent}%)
                </span>
                <span className="font-mono-tabular">
                  Offline Cache: {selectedProgress.offlineCount} eps ({selectedProgress.offlineMb} MB)
                </span>
              </div>

              <div className="mt-4 divide-y divide-[#232736]">
                {selectedSeries.episodes.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <button
                        type="button"
                        onClick={() => onToggleEpisodeWatched(selectedSeries.id, ep.id)}
                        aria-label={
                          ep.watched
                            ? `Mark Episode ${ep.number} ${ep.title} as unwatched`
                            : `Mark Episode ${ep.number} ${ep.title} as watched`
                        }
                        aria-pressed={ep.watched}
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                          ep.watched
                            ? 'border-[#E5484D] bg-[#E5484D] text-white'
                            : 'border-[#2E3448] bg-[#0A0B0F] text-transparent hover:border-[#9499AD]'
                        }`}
                      >
                        <Check className="h-4 w-4" />
                      </button>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#F4F4F6]">
                          <span className="mr-2 font-mono-tabular text-xs text-[#9499AD]">
                            E{String(ep.number).padStart(2, '0')}
                          </span>
                          {ep.title}
                        </p>
                        <p className="mt-0.5 font-mono-tabular text-xs text-[#9499AD]">
                          {formatTimecode(ep.durationSec)} · {ep.sizeMb} MB · Aired {ep.airedDate}
                          {!ep.watched && ep.resumeSec > 0
                            ? ` · Resume ${formatTimecode(ep.resumeSec)}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                      <button
                        type="button"
                        onClick={() => onQueueEpisode(selectedSeries, ep, true)}
                        aria-label={`Cast Episode ${ep.number} ${ep.title} now`}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#1A1D28] px-3 py-1.5 text-xs font-medium text-[#F4F4F6] transition-colors hover:bg-[#262B3D] whitespace-nowrap shrink-0"
                      >
                        <Play className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
                        Cast
                      </button>
                      <button
                        type="button"
                        onClick={() => onQueueEpisode(selectedSeries, ep, false)}
                        aria-label={`Queue Episode ${ep.number} ${ep.title}`}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-1.5 text-xs font-medium text-[#D6D9E4] transition-colors hover:bg-[#1A1D28] whitespace-nowrap shrink-0"
                      >
                        <ListPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        Queue
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleEpisodeOffline(selectedSeries.id, ep.id)}
                        aria-label={
                          ep.offlineCached
                            ? `Remove Episode ${ep.number} from offline storage`
                            : `Save Episode ${ep.number} offline`
                        }
                        className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          ep.offlineCached
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-[#232736] bg-[#0A0B0F] text-[#9499AD] hover:text-[#F4F4F6]'
                        }`}
                      >
                        <CloudDownload className="h-3.5 w-3.5" aria-hidden="true" />
                        {ep.offlineCached ? 'Cached' : 'Offline'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
