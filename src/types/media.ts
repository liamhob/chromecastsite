export type StreamQuality = '2160p' | '1440p' | '1080p' | '720p';

export type LatencyProfile = 'ultra-low' | 'balanced' | 'buffer-safe';

export type WatchStatus = 'watching' | 'plan-to-watch' | 'completed' | 'on-hold';

export type SubtitleLanguage = 'en' | 'ja' | 'es' | 'fr';

export type AppView = 'stage' | 'queue' | 'anime' | 'subtitles' | 'specs';

export interface CastDevice {
  id: string;
  name: string;
  model: string;
  maxResolution: StreamQuality;
  hdrSupport: string;
  audioCodec: string;
  ipHint: string;
}

export interface ChapterMarker {
  id: string;
  label: string;
  startSec: number;
  endSec: number;
  skippable?: boolean;
}

export interface SubtitleCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface SubtitleTrack {
  language: SubtitleLanguage;
  label: string;
  nativeLabel: string;
  offsetMs: number;
  rateScale: number;
  cues: SubtitleCue[];
}

export interface Episode {
  id: string;
  seriesId: string;
  number: number;
  title: string;
  durationSec: number;
  watched: boolean;
  resumeSec: number;
  streamUrl: string;
  sizeMb: number;
  offlineCached: boolean;
  airedDate: string;
  chapters: ChapterMarker[];
}

export interface AnimeSeries {
  id: string;
  malId?: number;
  title: string;
  japaneseTitle: string;
  studio: string;
  year: number;
  score: number;
  genres: string[];
  status: WatchStatus;
  synopsis: string;
  posterUrl: string;
  episodes: Episode[];
}

export interface PlaylistItem {
  id: string;
  title: string;
  subtitle: string;
  seriesId?: string;
  episodeId?: string;
  streamUrl: string;
  posterUrl: string;
  durationSec: number;
  quality: StreamQuality;
  offlineCached: boolean;
  sizeMb: number;
}

export interface PlaybackState {
  activeItemId: string;
  isPlaying: boolean;
  currentTimeSec: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  quality: StreamQuality;
  latencyProfile: LatencyProfile;
  primarySubLang: SubtitleLanguage | 'off';
  secondarySubLang: SubtitleLanguage | 'off';
  connectedDeviceId: string | null;
}

export interface JikanSearchResult {
  malId: number;
  title: string;
  japaneseTitle: string;
  totalEpisodes: number;
  score: number;
  year: number;
  studio: string;
  genres: string[];
  synopsis: string;
  posterUrl: string;
}
