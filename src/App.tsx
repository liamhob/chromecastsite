import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Cast,
  FileCode2,
  ListVideo,
  PlaySquare,
  Subtitles,
  Tv,
} from 'lucide-react';
import {
  ARTWORK,
  SEED_ANIME_CATALOG,
  SEED_CAST_DEVICES,
  SEED_PLAYLIST,
  SEED_SUBTITLE_TRACKS,
} from './data/seedCatalog';
import type {
  AnimeSeries,
  AppView,
  Episode,
  JikanSearchResult,
  LatencyProfile,
  PlaybackState,
  PlaylistItem,
  StreamQuality,
  SubtitleLanguage,
  SubtitleTrack,
  WatchStatus,
} from './types/media';
import {
  enqueueMediaItem,
  removePlaylistItem,
  reorderPlaylist,
  toggleEpisodeOfflineCache,
  toggleEpisodeWatched,
} from './utils/mediaState';
import {
  loadPersistedState,
  savePersistedState,
  syncOfflineManifestRecord,
} from './utils/offlineStorage';
import {parseSubtitleText} from './utils/subtitleEngine';
import {AnimeLibraryView} from './components/AnimeLibraryView';
import {ArchitectureSpecsView} from './components/ArchitectureSpecsView';
import {CastModal} from './components/CastModal';
import {CastStageView} from './components/CastStageView';
import {PlaylistQueueView} from './components/PlaylistQueueView';
import {OfflineIndicator, PWAInstallButton} from './components/PWAInstallButton';
import {SubtitleSyncView} from './components/SubtitleSyncView';

const DEFAULT_PLAYBACK: PlaybackState = {
  activeItemId: SEED_PLAYLIST[0].id,
  isPlaying: false,
  currentTimeSec: 162,
  volume: 78,
  muted: false,
  playbackRate: 1,
  quality: '2160p',
  latencyProfile: 'ultra-low',
  primarySubLang: 'en',
  secondarySubLang: 'off',
  connectedDeviceId: null,
};

const NAV_ITEMS: Array<{id: AppView; label: string; icon: React.ComponentType<{className?: string}>}> = [
  {id: 'stage', label: 'Stage', icon: Tv},
  {id: 'queue', label: 'Queue', icon: ListVideo},
  {id: 'anime', label: 'Anime', icon: PlaySquare},
  {id: 'subtitles', label: 'Subtitles', icon: Subtitles},
  {id: 'specs', label: 'Specs', icon: FileCode2},
];

function formatSyncTime(date: Date): string {
  return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

export default function App() {
  const persisted = useMemo(() => loadPersistedState(), []);

  const [activeView, setActiveView] = useState<AppView>('stage');
  const [catalog, setCatalog] = useState<AnimeSeries[]>(
    () => persisted?.catalog ?? SEED_ANIME_CATALOG
  );
  const [playlist, setPlaylist] = useState<PlaylistItem[]>(
    () => persisted?.playlist ?? SEED_PLAYLIST
  );
  const [subtitleTracks, setSubtitleTracks] = useState<Record<string, SubtitleTrack>>(
    () => persisted?.subtitleTracks ?? SEED_SUBTITLE_TRACKS
  );
  const [playback, setPlayback] = useState<PlaybackState>(
    () => persisted?.playback ?? DEFAULT_PLAYBACK
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(
    () => persisted?.lastSyncedAt ?? formatSyncTime(new Date())
  );
  const [castModalOpen, setCastModalOpen] = useState(false);
  const [offlineSimMode, setOfflineSimMode] = useState(false);

  const activeItem = useMemo(
    () => playlist.find((item) => item.id === playback.activeItemId) ?? playlist[0] ?? null,
    [playlist, playback.activeItemId]
  );

  const activeSeries = useMemo(
    () => catalog.find((series) => series.id === activeItem?.seriesId) ?? null,
    [catalog, activeItem]
  );

  const connectedDevice = useMemo(
    () => SEED_CAST_DEVICES.find((d) => d.id === playback.connectedDeviceId) ?? null,
    [playback.connectedDeviceId]
  );

  // Persist application state automatically to localStorage
  useEffect(() => {
    const syncStamp = formatSyncTime(new Date());
    setLastSyncedAt(syncStamp);
    savePersistedState({
      catalog,
      playlist,
      subtitleTracks,
      playback,
      lastSyncedAt: syncStamp,
    });
  }, [catalog, playlist, subtitleTracks, playback]);

  // Playback timer progression while playing
  useEffect(() => {
    if (!playback.isPlaying || !activeItem) {
      return;
    }
    const interval = window.setInterval(() => {
      setPlayback((prev) => {
        const nextSec = prev.currentTimeSec + prev.playbackRate;
        if (nextSec >= activeItem.durationSec) {
          const currentIdx = playlist.findIndex((p) => p.id === prev.activeItemId);
          const nextItem = playlist[currentIdx + 1];
          if (nextItem) {
            return {
              ...prev,
              activeItemId: nextItem.id,
              currentTimeSec: 0,
            };
          }
          return {
            ...prev,
            isPlaying: false,
            currentTimeSec: activeItem.durationSec,
          };
        }
        return {...prev, currentTimeSec: nextSec};
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [playback.isPlaying, playback.playbackRate, activeItem, playlist]);

  // Global keyboard shortcuts when not typing in an input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.code === 'Space' && activeView === 'stage') {
        e.preventDefault();
        setPlayback((prev) => ({...prev, isPlaying: !prev.isPlaying}));
      } else if (e.key.toLowerCase() === 'm' && activeView === 'stage') {
        setPlayback((prev) => ({...prev, muted: !prev.muted}));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView]);

  const handleSelectTrack = useCallback(
    (itemId: string) => {
      const target = playlist.find((p) => p.id === itemId);
      if (!target) {
        return;
      }
      const linkedSeries = catalog.find((s) => s.id === target.seriesId);
      const linkedEpisode = linkedSeries?.episodes.find((ep) => ep.id === target.episodeId);
      const resumeSec =
        linkedEpisode && !linkedEpisode.watched ? linkedEpisode.resumeSec : 0;

      setPlayback((prev) => ({
        ...prev,
        activeItemId: target.id,
        currentTimeSec: resumeSec,
        quality: target.quality,
        isPlaying: true,
      }));
      setActiveView('stage');
    },
    [playlist, catalog]
  );

  const handleStepTrack = useCallback(
    (offset: -1 | 1) => {
      if (playlist.length === 0) return;
      const idx = playlist.findIndex((p) => p.id === playback.activeItemId);
      const nextIdx = (idx + offset + playlist.length) % playlist.length;
      handleSelectTrack(playlist[nextIdx].id);
    },
    [playlist, playback.activeItemId, handleSelectTrack]
  );

  const handleSeek = useCallback(
    (sec: number) => {
      const maxSec = activeItem?.durationSec ?? 1440;
      const clamped = Math.max(0, Math.min(maxSec, sec));
      setPlayback((prev) => ({...prev, currentTimeSec: clamped}));
    },
    [activeItem]
  );

  const handleStepSeek = useCallback(
    (deltaSec: number) => {
      handleSeek(playback.currentTimeSec + deltaSec);
    },
    [playback.currentTimeSec, handleSeek]
  );

  const handleMirrorUrl = useCallback((url: string, label: string) => {
    const newItem: PlaylistItem = {
      id: `mirror-${Date.now()}`,
      title: label,
      subtitle: 'Browser HLS Mirror',
      streamUrl: url,
      posterUrl: ARTWORK.nocturneExpress,
      durationSec: 1440,
      quality: '2160p',
      offlineCached: false,
      sizeMb: 720,
    };
    setPlaylist((prev) => [newItem, ...prev]);
    setPlayback((prev) => ({
      ...prev,
      activeItemId: newItem.id,
      currentTimeSec: 0,
      isPlaying: true,
    }));
    setActiveView('stage');
  }, []);

  const handleAddCustomStream = useCallback(
    (payload: {title: string; streamUrl: string; quality: StreamQuality}) => {
      const newItem: PlaylistItem = {
        id: `custom-${Date.now()}`,
        title: payload.title,
        subtitle: 'Custom HLS Stream',
        streamUrl: payload.streamUrl,
        posterUrl: ARTWORK.orbitalArchive,
        durationSec: 1440,
        quality: payload.quality,
        offlineCached: false,
        sizeMb: payload.quality === '2160p' ? 760 : 420,
      };
      setPlaylist((prev) => enqueueMediaItem(prev, newItem));
    },
    []
  );

  const handleToggleOfflinePlaylistItem = useCallback((id: string) => {
    setPlaylist((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextCached = !item.offlineCached;
        void syncOfflineManifestRecord(item.id, {
          title: item.title,
          streamUrl: item.streamUrl,
          sizeMb: item.sizeMb,
          cached: nextCached,
        });
        return {...item, offlineCached: nextCached};
      })
    );
  }, []);

  const handleSyncAllOffline = useCallback(() => {
    setPlaylist((prev) =>
      prev.map((item) => {
        if (!item.offlineCached) {
          void syncOfflineManifestRecord(item.id, {
            title: item.title,
            streamUrl: item.streamUrl,
            sizeMb: item.sizeMb,
            cached: true,
          });
        }
        return {...item, offlineCached: true};
      })
    );
  }, []);

  const handleQueueEpisode = useCallback(
    (series: AnimeSeries, episode: Episode, playImmediately: boolean) => {
      const queueId = `q-${episode.id}`;
      const newItem: PlaylistItem = {
        id: queueId,
        title: `Ep ${episode.number} · ${episode.title}`,
        subtitle: series.title,
        seriesId: series.id,
        episodeId: episode.id,
        streamUrl: episode.streamUrl,
        posterUrl: series.posterUrl,
        durationSec: episode.durationSec,
        quality: '2160p',
        offlineCached: episode.offlineCached,
        sizeMb: episode.sizeMb,
      };
      setPlaylist((prev) => enqueueMediaItem(prev, newItem));
      if (playImmediately) {
        setPlayback((prev) => ({
          ...prev,
          activeItemId: queueId,
          currentTimeSec: episode.watched ? 0 : episode.resumeSec,
          isPlaying: true,
        }));
        setActiveView('stage');
      }
    },
    []
  );

  const handleImportFromJikan = useCallback((result: JikanSearchResult) => {
    const seriesId = `mal-${result.malId}`;
    const epCount = Math.min(Math.max(result.totalEpisodes, 1), 12);
    const episodes: Episode[] = Array.from({length: epCount}, (_, i) => ({
      id: `${seriesId}-ep${i + 1}`,
      seriesId,
      number: i + 1,
      title: `Episode ${i + 1}`,
      durationSec: 1440,
      watched: false,
      resumeSec: 0,
      streamUrl: `https://stream.kurocast.app/hls/${seriesId}/ep${String(i + 1).padStart(2, '0')}/master.m3u8`,
      sizeMb: 690,
      offlineCached: false,
      airedDate: `${result.year}-01-${String(Math.min(28, i + 1)).padStart(2, '0')}`,
      chapters: [
        {id: 'op', label: 'Opening Theme', startSec: 65, endSec: 155, skippable: true},
        {id: 'ed', label: 'Ending Credits', startSec: 1320, endSec: 1410, skippable: true},
      ],
    }));

    const newSeries: AnimeSeries = {
      id: seriesId,
      malId: result.malId,
      title: result.title,
      japaneseTitle: result.japaneseTitle || result.title,
      studio: result.studio,
      year: result.year,
      score: result.score,
      genres: result.genres.length > 0 ? result.genres : ['Anime'],
      status: 'plan-to-watch',
      synopsis: result.synopsis,
      posterUrl: result.posterUrl || ARTWORK.orbitalArchive,
      episodes,
    };

    setCatalog((prev) => (prev.some((s) => s.id === seriesId) ? prev : [newSeries, ...prev]));
  }, []);

  const handleNudgeSubOffset = useCallback((lang: SubtitleLanguage, deltaMs: number) => {
    setSubtitleTracks((prev) => {
      const current = prev[lang];
      if (!current) return prev;
      return {
        ...prev,
        [lang]: {...current, offsetMs: current.offsetMs + deltaMs},
      };
    });
  }, []);

  const handleSetSubOffset = useCallback((lang: SubtitleLanguage, offsetMs: number) => {
    setSubtitleTracks((prev) => {
      const current = prev[lang];
      if (!current) return prev;
      return {...prev, [lang]: {...current, offsetMs}};
    });
  }, []);

  const handleSetSubRate = useCallback((lang: SubtitleLanguage, rateScale: number) => {
    setSubtitleTracks((prev) => {
      const current = prev[lang];
      if (!current) return prev;
      return {...prev, [lang]: {...current, rateScale}};
    });
  }, []);

  const handleUpdateCueText = useCallback(
    (lang: SubtitleLanguage, cueId: string, text: string) => {
      setSubtitleTracks((prev) => {
        const current = prev[lang];
        if (!current) return prev;
        return {
          ...prev,
          [lang]: {
            ...current,
            cues: current.cues.map((c) => (c.id === cueId ? {...c, text} : c)),
          },
        };
      });
    },
    []
  );

  const handleReplaceTrackCues = useCallback((lang: SubtitleLanguage, rawText: string) => {
    const parsed = parseSubtitleText(rawText);
    if (parsed.length === 0) {
      return {count: 0, error: 'Could not parse any subtitle cues.'};
    }
    setSubtitleTracks((prev) => {
      const current = prev[lang];
      if (!current) return prev;
      return {...prev, [lang]: {...current, cues: parsed, offsetMs: 0, rateScale: 1}};
    });
    return {count: parsed.length};
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0B0F] text-[#F4F4F6] pb-20 md:pb-10">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-[#232736] bg-[#0A0B0F]/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('stage')}
            className="font-display text-lg font-bold tracking-tight text-[#F4F4F6] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E5484D]"
          >
            KuroCast
          </button>

          {/* Zone 2: 5 clean single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-6 md:flex"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-[#F4F4F6] after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-[#E5484D]'
                      : 'text-[#9499AD] hover:text-[#F4F4F6]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setCastModalOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#E5484D] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#D13B40] whitespace-nowrap shrink-0"
            >
              <Cast className="h-3.5 w-3.5" aria-hidden="true" />
              {connectedDevice ? connectedDevice.name : 'Cast to TV'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        {activeView === 'stage' && (
          <CastStageView
            playback={playback}
            activeItem={activeItem}
            activeSeries={activeSeries}
            playlist={playlist}
            connectedDevice={connectedDevice}
            subtitleTracks={subtitleTracks}
            onTogglePlay={() =>
              setPlayback((prev) => ({...prev, isPlaying: !prev.isPlaying}))
            }
            onSeek={handleSeek}
            onStepSeek={handleStepSeek}
            onSelectTrack={handleSelectTrack}
            onPrevTrack={() => handleStepTrack(-1)}
            onNextTrack={() => handleStepTrack(1)}
            onVolumeChange={(volume) =>
              setPlayback((prev) => ({...prev, volume, muted: volume === 0}))
            }
            onToggleMute={() =>
              setPlayback((prev) => ({...prev, muted: !prev.muted}))
            }
            onQualityChange={(quality: StreamQuality) =>
              setPlayback((prev) => ({...prev, quality}))
            }
            onLatencyChange={(latencyProfile: LatencyProfile) =>
              setPlayback((prev) => ({...prev, latencyProfile}))
            }
            onRateChange={(playbackRate: number) =>
              setPlayback((prev) => ({...prev, playbackRate}))
            }
            onPrimarySubChange={(primarySubLang) =>
              setPlayback((prev) => ({...prev, primarySubLang}))
            }
            onNudgeSubOffset={handleNudgeSubOffset}
            onOpenCastModal={() => setCastModalOpen(true)}
            onOpenSubtitlesTab={() => setActiveView('subtitles')}
          />
        )}

        {activeView === 'queue' && (
          <PlaylistQueueView
            playlist={playlist}
            activeItemId={playback.activeItemId}
            offlineSimMode={offlineSimMode}
            lastSyncedAt={lastSyncedAt}
            onPlayItem={handleSelectTrack}
            onMoveItem={(id, dir) =>
              setPlaylist((prev) => reorderPlaylist(prev, id, dir))
            }
            onRemoveItem={(id) => {
              const result = removePlaylistItem(playlist, id, playback.activeItemId);
              setPlaylist(result.items);
              if (result.nextActiveId !== playback.activeItemId) {
                setPlayback((prev) => ({
                  ...prev,
                  activeItemId: result.nextActiveId,
                  currentTimeSec: 0,
                  isPlaying: false,
                }));
              }
            }}
            onToggleOfflineItem={handleToggleOfflinePlaylistItem}
            onSyncAllOffline={handleSyncAllOffline}
            onToggleOfflineSim={() => setOfflineSimMode((v) => !v)}
            onAddCustomStream={handleAddCustomStream}
          />
        )}

        {activeView === 'anime' && (
          <AnimeLibraryView
            catalog={catalog}
            onToggleEpisodeWatched={(seriesId, episodeId) =>
              setCatalog((prev) => toggleEpisodeWatched(prev, seriesId, episodeId))
            }
            onToggleEpisodeOffline={(seriesId, episodeId) => {
              setCatalog((prev) => toggleEpisodeOfflineCache(prev, seriesId, episodeId));
              setPlaylist((prev) =>
                prev.map((item) =>
                  item.episodeId === episodeId
                    ? {...item, offlineCached: !item.offlineCached}
                    : item
                )
              );
            }}
            onChangeSeriesStatus={(seriesId, status: WatchStatus) =>
              setCatalog((prev) =>
                prev.map((s) => (s.id === seriesId ? {...s, status} : s))
              )
            }
            onQueueEpisode={handleQueueEpisode}
            onImportFromJikan={handleImportFromJikan}
          />
        )}

        {activeView === 'subtitles' && (
          <SubtitleSyncView
            tracks={subtitleTracks}
            primaryLang={playback.primarySubLang}
            secondaryLang={playback.secondarySubLang}
            currentTimeSec={playback.currentTimeSec}
            onPrimaryChange={(primarySubLang) =>
              setPlayback((prev) => ({...prev, primarySubLang}))
            }
            onSecondaryChange={(secondarySubLang) =>
              setPlayback((prev) => ({...prev, secondarySubLang}))
            }
            onUpdateTrackOffset={handleSetSubOffset}
            onUpdateTrackRate={handleSetSubRate}
            onUpdateCueText={handleUpdateCueText}
            onReplaceTrackCues={handleReplaceTrackCues}
            onJumpToSec={(sec) => {
              handleSeek(sec);
              setActiveView('stage');
            }}
          />
        )}

        {activeView === 'specs' && <ArchitectureSpecsView />}

        {/* Quiet Footer with Cross-Platform PWA Install */}
        <footer className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-[#232736] pt-6 text-xs text-[#9499AD] sm:flex-row sm:items-center">
          <p>
            KuroCast · Cross-Platform 4K Chromecast &amp; Anime Media Suite · Offline PWA Sync Enabled
          </p>
          <PWAInstallButton />
        </footer>
      </main>

      {/* Mobile Ergonomic Bottom Tab Bar (56px height + 56px header = 112px <= 13.3% of 844px mobile viewport) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#232736] bg-[#0A0B0F]/95 backdrop-blur-md md:hidden"
      >
        <div className="grid h-14 grid-cols-5 items-center">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-[#E5484D]' : 'text-[#9499AD]'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <CastModal
        isOpen={castModalOpen}
        devices={SEED_CAST_DEVICES}
        connectedDeviceId={playback.connectedDeviceId}
        onClose={() => setCastModalOpen(false)}
        onSelectDevice={(deviceId) =>
          setPlayback((prev) => ({...prev, connectedDeviceId: deviceId}))
        }
        onMirrorUrl={handleMirrorUrl}
      />

      <OfflineIndicator offlineSimMode={offlineSimMode} />
    </div>
  );
}
