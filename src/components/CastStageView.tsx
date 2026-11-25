import React from 'react';
import {
  Cast,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Subtitles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  AnimeSeries,
  CastDevice,
  LatencyProfile,
  PlaybackState,
  PlaylistItem,
  StreamQuality,
  SubtitleLanguage,
  SubtitleTrack,
} from '../types/media';
import {formatTimecode} from '../utils/mediaState';
import {findActiveCues} from '../utils/subtitleEngine';
import {MediaArtwork} from './MediaArtwork';

interface CastStageViewProps {
  playback: PlaybackState;
  activeItem: PlaylistItem | null;
  activeSeries: AnimeSeries | null;
  playlist: PlaylistItem[];
  connectedDevice: CastDevice | null;
  subtitleTracks: Record<string, SubtitleTrack>;
  onTogglePlay: () => void;
  onSeek: (sec: number) => void;
  onStepSeek: (deltaSec: number) => void;
  onSelectTrack: (itemId: string) => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onQualityChange: (quality: StreamQuality) => void;
  onLatencyChange: (profile: LatencyProfile) => void;
  onRateChange: (rate: number) => void;
  onPrimarySubChange: (lang: SubtitleLanguage | 'off') => void;
  onNudgeSubOffset: (lang: SubtitleLanguage, deltaMs: number) => void;
  onOpenCastModal: () => void;
  onOpenSubtitlesTab: () => void;
}

const QUALITY_DETAILS: Record<StreamQuality, string> = {
  '2160p': '4K UHD · HEVC Main10 HDR10 · 22 Mbps',
  '1440p': 'QHD 1440p · HEVC 10-bit · 12 Mbps',
  '1080p': 'Full HD 1080p · H.264 High · 6.5 Mbps',
  '720p': 'HD 720p · Mobile Saver · 3.2 Mbps',
};

const LATENCY_LABELS: Record<LatencyProfile, {label: string; target: string}> = {
  'ultra-low': {label: 'LL-HLS Ultra-Low', target: '1.8s glass-to-glass'},
  balanced: {label: 'LL-HLS Balanced', target: '3.2s adaptive buffer'},
  'buffer-safe': {label: 'Cinema Safe', target: '6.0s zero-stutter'},
};

export const CastStageView: React.FC<CastStageViewProps> = ({
  playback,
  activeItem,
  activeSeries,
  playlist,
  connectedDevice,
  subtitleTracks,
  onTogglePlay,
  onSeek,
  onStepSeek,
  onSelectTrack,
  onPrevTrack,
  onNextTrack,
  onVolumeChange,
  onToggleMute,
  onQualityChange,
  onLatencyChange,
  onRateChange,
  onPrimarySubChange,
  onNudgeSubOffset,
  onOpenCastModal,
  onOpenSubtitlesTab,
}) => {
  const duration = activeItem?.durationSec ?? 1440;
  const activeEpisode = activeSeries?.episodes.find((ep) => ep.id === activeItem?.episodeId) ?? null;
  const chapters = activeEpisode?.chapters ?? [];

  const currentChapter = chapters.find(
    (ch) => playback.currentTimeSec >= ch.startSec && playback.currentTimeSec < ch.endSec
  );

  const primaryTrack =
    playback.primarySubLang !== 'off' ? subtitleTracks[playback.primarySubLang] : null;
  const secondaryTrack =
    playback.secondarySubLang !== 'off' && playback.secondarySubLang !== playback.primarySubLang
      ? subtitleTracks[playback.secondarySubLang]
      : null;

  const playbackMs = playback.currentTimeSec * 1000;
  const primaryCues = primaryTrack
    ? findActiveCues(primaryTrack.cues, playbackMs, primaryTrack.offsetMs, primaryTrack.rateScale)
    : [];
  const secondaryCues = secondaryTrack
    ? findActiveCues(secondaryTrack.cues, playbackMs, secondaryTrack.offsetMs, secondaryTrack.rateScale)
    : [];

  const effectiveVolume = playback.muted ? 0 : playback.volume;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
      {/* Primary Stage Column */}
      <section className="space-y-5 lg:col-span-8" aria-label="4K Casting Stage">
        {/* 16:9 Cinema Stage */}
        <div
          className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[#232736] bg-[#0D0F16]"
          data-testid="cinema-stage"
        >
          <MediaArtwork
            src={activeItem?.posterUrl ?? ''}
            alt={activeItem ? `${activeItem.subtitle} — ${activeItem.title}` : 'Active stream frame'}
            title={activeItem?.title ?? 'No media selected'}
            className={`h-full w-full transition-transform duration-700 ${
              playback.isPlaying ? 'scale-[1.03]' : 'scale-100'
            }`}
          />

          {/* Top Scrim with Quiet Single-Line Stream Metadata */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/30 to-transparent px-3 pt-2.5 pb-6 sm:px-5 sm:pt-4 sm:pb-10">
            <div className="flex items-center justify-between gap-2 text-[11px] text-[#D6D9E4] sm:text-xs">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <span className="truncate font-semibold text-white">
                  {connectedDevice ? `Casting · ${connectedDevice.name}` : 'Local Preview'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0 font-mono-tabular text-[#D6D9E4]">{playback.quality}</span>
                <span className="hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="hidden truncate sm:inline">
                  {LATENCY_LABELS[playback.latencyProfile].label}
                </span>
              </div>
              {activeItem?.offlineCached && (
                <span className="hidden shrink-0 text-[#D6D9E4] sm:inline">Offline Synced</span>
              )}
            </div>
          </div>

          {/* Bottom Scrim + Synchronized Subtitles + Skip Intro */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pt-8 pb-2.5 sm:px-5 sm:pt-14 sm:pb-5">
            <div className="flex flex-col items-center justify-end gap-1 text-center sm:gap-2">
              {secondaryCues.length > 0 && (
                <p
                  data-testid="stage-subtitle-secondary"
                  className="max-w-2xl rounded bg-black/70 px-2.5 py-0.5 text-[11px] font-medium leading-snug text-[#D6D9E4] backdrop-blur-xs sm:px-3 sm:py-1 sm:text-sm"
                >
                  {secondaryCues.map((c) => c.text).join(' ')}
                </p>
              )}
              {primaryCues.length > 0 && (
                <p
                  data-testid="stage-subtitle-primary"
                  className="max-w-2xl rounded bg-black/80 px-2.5 py-1 text-xs font-semibold leading-snug text-white backdrop-blur-xs sm:px-3.5 sm:py-1.5 sm:text-base md:text-lg"
                >
                  {primaryCues.map((c) => c.text).join(' ')}
                </p>
              )}
            </div>

            {currentChapter?.skippable && (
              <div className="mt-2 flex justify-end sm:mt-3">
                <button
                  type="button"
                  onClick={() => onSeek(currentChapter.endSec)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#0A0B0F] transition-colors hover:bg-white whitespace-nowrap shrink-0 sm:min-h-[40px] sm:px-3.5 sm:py-2"
                >
                  <FastForward className="h-3.5 w-3.5" aria-hidden="true" />
                  Skip {currentChapter.label}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Integrated Scrubbing, Transport, Volume & Stream Profile Deck */}
        <div className="rounded-2xl border border-[#232736] bg-[#12141C] p-5">
          {/* Active Title Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#9499AD]">
                {activeItem?.subtitle ?? 'Queue Empty'}
                {currentChapter ? ` · ${currentChapter.label}` : ''}
                {activeItem?.offlineCached ? ' · Offline Synced' : ''}
              </p>
              <h1 className="mt-0.5 line-clamp-2 text-lg font-semibold text-[#F4F4F6] sm:text-2xl">
                {activeItem?.title ?? 'Select an episode or load an HLS stream'}
              </h1>
            </div>
            <button
              type="button"
              onClick={onOpenCastModal}
              className="hidden min-h-[40px] items-center gap-2 rounded-lg border border-[#2A2F42] bg-[#161924] px-3.5 py-2 text-xs font-medium text-[#F4F4F6] transition-colors hover:bg-[#1D2130] whitespace-nowrap shrink-0 sm:inline-flex"
            >
              <Cast className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
              Mirror Stream URL
            </button>
          </div>

          {/* Playback Scrubber */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-[#9499AD]">
              <span className="font-mono-tabular" data-testid="playback-current-time">
                {formatTimecode(playback.currentTimeSec)}
              </span>
              <span className="font-mono-tabular">{formatTimecode(duration)}</span>
            </div>
            <label htmlFor="stage-scrubber" className="sr-only">
              Playback timeline scrubber
            </label>
            <input
              id="stage-scrubber"
              type="range"
              min={0}
              max={duration}
              step={1}
              value={Math.min(playback.currentTimeSec, duration)}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="kuro-slider mt-2 w-full"
            />
            {chapters.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {chapters.map((ch) => {
                  const isCurrent = currentChapter?.id === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => onSeek(ch.startSec)}
                      className={`min-h-[32px] rounded-md px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                        isCurrent
                          ? 'bg-[#232736] font-medium text-[#F4F4F6]'
                          : 'text-[#9499AD] hover:bg-[#1A1D28] hover:text-[#F4F4F6]'
                      }`}
                    >
                      {ch.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Transport + Volume Row */}
          <div className="mt-5 flex flex-col gap-4 border-t border-[#232736] pt-5 sm:flex-row sm:items-center sm:justify-between">
            {/* Primary Transport Controls */}
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <button
                type="button"
                onClick={onPrevTrack}
                aria-label="Previous item in playlist"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[#D6D9E4] transition-colors hover:bg-[#1A1D28] hover:text-white"
              >
                <SkipBack className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onStepSeek(-10)}
                aria-label="Rewind 10 seconds"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[#D6D9E4] transition-colors hover:bg-[#1A1D28] hover:text-white"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={playback.isPlaying ? 'Pause playback' : 'Start playback'}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E5484D] text-white transition-colors hover:bg-[#D13B40]"
              >
                {playback.isPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 translate-x-0.5 fill-current" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onStepSeek(10)}
                aria-label="Forward 10 seconds"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[#D6D9E4] transition-colors hover:bg-[#1A1D28] hover:text-white"
              >
                <RotateCw className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onNextTrack}
                aria-label="Next item in playlist"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[#D6D9E4] transition-colors hover:bg-[#1A1D28] hover:text-white"
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </div>

            {/* Volume + Speed Controls */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={playback.muted ? 'Unmute audio' : 'Mute audio'}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-[#D6D9E4] transition-colors hover:bg-[#1A1D28] hover:text-white"
                >
                  {playback.muted || playback.volume === 0 ? (
                    <VolumeX className="h-5 w-5 text-[#E5484D]" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
                <label htmlFor="stage-volume" className="sr-only">
                  Cast output volume
                </label>
                <input
                  id="stage-volume"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={effectiveVolume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="kuro-slider w-24 sm:w-28"
                />
                <span className="w-9 text-right font-mono-tabular text-xs text-[#9499AD]">
                  {effectiveVolume}%
                </span>
              </div>

              <label htmlFor="stage-rate" className="sr-only">
                Playback speed
              </label>
              <select
                id="stage-rate"
                value={playback.playbackRate}
                onChange={(e) => onRateChange(Number(e.target.value))}
                className="min-h-[40px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-2.5 py-1.5 font-mono-tabular text-xs text-[#F4F4F6] focus:border-[#E5484D] focus:outline-none"
              >
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
              </select>
            </div>
          </div>

          {/* Stream Quality, LL-HLS Profile & Quick Subtitle Sync Row */}
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-[#232736] pt-5 md:grid-cols-3">
            <div>
              <label htmlFor="stage-quality" className="block text-xs font-medium text-[#9499AD]">
                Streaming Resolution
              </label>
              <select
                id="stage-quality"
                value={playback.quality}
                onChange={(e) => onQualityChange(e.target.value as StreamQuality)}
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-2 text-xs font-medium text-[#F4F4F6] focus:border-[#E5484D] focus:outline-none"
              >
                <option value="2160p">4K UHD (2160p HDR10)</option>
                <option value="1440p">QHD (1440p)</option>
                <option value="1080p">Full HD (1080p)</option>
                <option value="720p">HD (720p)</option>
              </select>
              <p className="mt-1.5 font-mono-tabular text-[11px] text-[#9499AD]">
                {QUALITY_DETAILS[playback.quality]}
              </p>
            </div>

            <div>
              <label htmlFor="stage-latency" className="block text-xs font-medium text-[#9499AD]">
                HLS Latency Mode
              </label>
              <select
                id="stage-latency"
                value={playback.latencyProfile}
                onChange={(e) => onLatencyChange(e.target.value as LatencyProfile)}
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-2 text-xs font-medium text-[#F4F4F6] focus:border-[#E5484D] focus:outline-none"
              >
                <option value="ultra-low">LL-HLS Ultra-Low (1.8s)</option>
                <option value="balanced">LL-HLS Balanced (3.2s)</option>
                <option value="buffer-safe">Cinema Safe (6.0s)</option>
              </select>
              <p className="mt-1.5 font-mono-tabular text-[11px] text-[#9499AD]">
                {LATENCY_LABELS[playback.latencyProfile].target}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="stage-sub-lang" className="text-xs font-medium text-[#9499AD]">
                  Subtitle Track
                </label>
                <button
                  type="button"
                  onClick={onOpenSubtitlesTab}
                  className="text-[11px] font-medium text-[#E5484D] hover:underline"
                >
                  Open Sync Studio
                </button>
              </div>
              <select
                id="stage-sub-lang"
                value={playback.primarySubLang}
                onChange={(e) => onPrimarySubChange(e.target.value as SubtitleLanguage | 'off')}
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-2 text-xs font-medium text-[#F4F4F6] focus:border-[#E5484D] focus:outline-none"
              >
                <option value="off">Subtitles Off</option>
                <option value="en">English (CC)</option>
                <option value="ja">Japanese (日本語)</option>
                <option value="es">Spanish (Español)</option>
                <option value="fr">French (Français)</option>
              </select>
              {primaryTrack && (
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono-tabular text-[#9499AD]">
                    Offset: {primaryTrack.offsetMs >= 0 ? `+${primaryTrack.offsetMs}` : primaryTrack.offsetMs}ms
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onNudgeSubOffset(primaryTrack.language, -100)}
                      className="rounded px-1.5 py-0.5 text-[#D6D9E4] hover:bg-[#1A1D28]"
                    >
                      -100ms
                    </button>
                    <button
                      type="button"
                      onClick={() => onNudgeSubOffset(primaryTrack.language, 100)}
                      className="rounded px-1.5 py-0.5 text-[#D6D9E4] hover:bg-[#1A1D28]"
                    >
                      +100ms
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Right Rail: Up Next Queue */}
      <aside className="rounded-2xl border border-[#232736] bg-[#12141C] p-5 lg:col-span-4" aria-label="Up Next Queue">
        <div className="flex items-center justify-between border-b border-[#232736] pb-3.5">
          <div>
            <h2 className="text-base font-semibold text-[#F4F4F6]">Up Next in Queue</h2>
            <p className="mt-0.5 text-xs text-[#9499AD]">
              {playlist.length} {playlist.length === 1 ? 'item' : 'items'} ready for continuous cast
            </p>
          </div>
          <Subtitles className="h-4 w-4 text-[#9499AD]" aria-hidden="true" />
        </div>

        <div className="mt-3 divide-y divide-[#232736]">
          {playlist.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#9499AD]">
              Your cast queue is empty. Add episodes from Anime or Queue tabs.
            </p>
          ) : (
            playlist.map((item, idx) => {
              const isActive = item.id === playback.activeItemId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTrack(item.id)}
                  className={`flex w-full items-center gap-3 py-3 text-left transition-colors ${
                    isActive ? 'text-white' : 'text-[#D6D9E4] hover:text-white'
                  }`}
                >
                  <span className="w-5 shrink-0 font-mono-tabular text-xs text-[#9499AD]">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-[#232736]">
                    <MediaArtwork
                      src={item.posterUrl}
                      alt={item.title}
                      title={item.title}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${isActive ? 'text-[#E5484D]' : 'text-[#F4F4F6]'}`}>
                      {item.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#9499AD]">
                      {item.subtitle} · {formatTimecode(item.durationSec)} · {item.quality}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
};
