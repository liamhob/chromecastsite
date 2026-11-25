import React, {useState} from 'react';
import {BrainCircuit, Check, Copy, Database, Loader2, Send, Smartphone} from 'lucide-react';

type SpecTab = 'ios-cast' | 'anime-schema' | 'thinking';

const IOS_CAST_LAYERS = [
  {
    title: '01. iOS Sender Integration (Google Cast SDK v4.8+)',
    summary:
      'Initialize GCKCastContext on app launch with a custom CAF v3 Receiver App ID, disable physical volume interception only when idle, and bind GCKSessionManager + GCKRemoteMediaClient to an Observable SwiftUI MediaCastCoordinator.',
    bullets: [
      'Enable NSLocalNetworkUsageDescription & NSBonjourServices (_googlecast._tcp, _<APP_ID>._googlecast._tcp) in Info.plist for iOS 14+ LAN discovery.',
      'Intercept WKWebView video/m3u8 URLs via WKURLSchemeHandler / WKScriptMessageHandler to hand off direct HLS manifests to GCKMediaInformationBuilder instead of screen-recording.',
      'Persist GCKMediaQueueData with preloadTime = 15.0s so episode transitions remain gapless when the iPhone locks or enters background.',
    ],
  },
  {
    title: '02. Low-Latency HLS (LL-HLS) Stream Optimization',
    summary:
      'Target 1.8s–2.5s glass-to-glass latency by migrating standard 6-second TS segments to 200ms–333ms CMAF fMP4 partial segments delivered over HTTP/2 or HTTP/3 (QUIC).',
    bullets: [
      'Publish #EXT-X-PART segments with INDEPENDENT=YES keyframes aligned every 1.0s–2.0s and advertise #EXT-X-PRELOAD-HINT for upcoming parts.',
      'Configure #EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=0.6,CAN-SKIP-UNTIL=12.0 so Chromecast Shaka/CAF player holds open blocking delta requests.',
      'Enable CORS Access-Control-Allow-Origin and byte-range support on CDN edge so CAF v3 receiver fetches media directly without proxying through iOS.',
    ],
  },
  {
    title: '03. 4K UHD HDR10 & Dolby Vision on Chromecast Hardware',
    summary:
      'Negotiate hardware decode capabilities on Chromecast Ultra & Chromecast with Google TV (4K) via CastReceiverContext.canDisplayType() before selecting the master variant.',
    bullets: [
      'Primary 4K tier: HEVC Main10 (hvc1.2.4.L150.B0) 3840x2160 @ 23.976/60fps, 18–25 Mbps VBR, PQ (SMPTE ST 2084) / BT.2020 color space, plus AV1 Main Profile fallback for newer Google TV hardware.',
      'Audio ladder: Dolby Digital Plus Atmos (ec-3, 384–768 kbps) with stereo AAC-LC (192 kbps) fallback for non-eARC displays.',
      'Adaptive Bitrate (ABR) ladder: 2160p (22 Mbps) → 1440p (12 Mbps) → 1080p 10-bit (6.5 Mbps) → 720p (3.2 Mbps) with 2-second aligned IDR boundaries for instant switching.',
    ],
  },
];

const SWIFT_AND_HLS_SNIPPET = `// Swift — iOS GCKRemoteMediaClient 4K LL-HLS Handoff
let metadata = GCKMediaMetadata(metadataType: .tvShow)
metadata.setString("Nocturne Express · Ep 4", forKey: kGCKMetadataKeyTitle)

let builder = GCKMediaInformationBuilder(contentURL: hlsMasterURL)
builder.contentType = "application/x-mpegURL"
builder.streamType = .buffered
builder.hlsSegmentFormat = .FMP4
builder.hlsVideoSegmentFormat = .FMP4
builder.mediaTracks = [englishVttTrack, japaneseVttTrack]
builder.metadata = metadata

let options = GCKMediaLoadOptions()
options.autoplay = true
options.playPosition = resumeTimeSec
options.activeTrackIDs = [NSNumber(value: englishVttTrack.identifier)]
session.remoteMediaClient?.loadMedia(builder.build(), with: options)

# Master LL-HLS Manifest (4K HDR10 + CMAF Partial Segments)
#EXTM3U
#EXT-X-VERSION:9
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=0.600
#EXT-X-STREAM-INF:BANDWIDTH=22500000,RESOLUTION=3840x2160,CODECS="hvc1.2.4.L150.B0,ec-3",VIDEO-RANGE=PQ,FRAME-RATE=23.976
2160p_hdr10/index.m3u8`;

const ANIME_SCHEMA_TABLES = [
  {
    table: 'anime_series',
    keys: 'PK id (UUID) · UNIQUE mal_id (INT)',
    fields:
      'title, japanese_title, studio, release_year, score, genres[], synopsis, poster_url, etag, synced_at',
  },
  {
    table: 'episodes',
    keys: 'PK id (UUID) · FK series_id → anime_series(id)',
    fields:
      'episode_number, title, duration_sec, hls_master_url, aired_date, chapters_json (OP/ED bounds), size_mb',
  },
  {
    table: 'watch_progress',
    keys: 'PK (user_id, episode_id)',
    fields:
      'watched (BOOL), resume_sec (FLOAT), completed_at, device_id, updated_at (LWW conflict resolution)',
  },
  {
    table: 'watchlist_entries',
    keys: 'PK (user_id, series_id)',
    fields:
      'status (watching | plan_to_watch | completed | on_hold), user_rating, priority_order, notes',
  },
  {
    table: 'subtitle_tracks & subtitle_cues',
    keys: 'PK track_id · FK episode_id · INDEX (track_id, start_ms)',
    fields:
      'language_code (ISO-639-1), offset_ms (INT), rate_scale (DOUBLE DEFAULT 1.0), cue_index, start_ms, end_ms, text',
  },
  {
    table: 'offline_packages (IndexedDB / CoreData)',
    keys: 'PK package_id · FK episode_id',
    fields:
      'hls_asset_bookmark, vtt_blobs_map, bytes_downloaded, total_bytes, sync_state (queued | synced | dirty)',
  },
];

const SCHEMA_LOGIC_SNIPPET = `-- Subtitle Sync Engine Core Transform
effective_start_ms = max(0, round(raw_start_ms * rate_scale + offset_ms))
effective_end_ms   = max(effective_start_ms + 250, round(raw_end_ms * rate_scale + offset_ms))

-- Two-Point Framerate Drift Solver (e.g., 25fps PAL ↔ 23.976fps NTSC)
rate_scale = (target_B_ms - target_A_ms) / (source_B_ms - source_A_ms)
offset_ms  = round(target_A_ms - source_A_ms * rate_scale)

-- Public Anime DB Metadata Hydration (Jikan v4 / AniList)
1. Query /api/anime/search?q=<title> (server-side proxy w/ 3 req/s token bucket)
2. Cache normalized payload by mal_id with ETag + 24h TTL in IndexedDB
3. Merge remote episode metadata non-destructively (preserve local watched/resume_sec)`;

const SAMPLE_COMPLEX_PROMPTS = [
  'Analyze the ideal LL-HLS part duration, GOP keyframe alignment, and Chromecast CAF v3 buffer settings to keep 4K HDR10 anime under 2.0s latency on Wi-Fi 5.',
  'Derive the exact subtitle resynchronization strategy when matching a 23.976fps Blu-ray English WebVTT track against a 25fps PAL broadcast stream with a 3.4s cold-open difference.',
  'Design an offline-first conflict resolution protocol (CRDT vs LWW) for syncing anime episode watch progress and subtitle offsets between iOS, iPad, and Desktop PWA.',
];

export const ArchitectureSpecsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SpecTab>('ios-cast');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // High-thinking query state
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Fallback ignored gracefully
    }
  };

  const handleAskThinking = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError('Enter a technical or anime architecture question first.');
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const res = await fetch('./api/gemini/think', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          query: trimmed,
          context:
            'KuroCast platform: iOS Google Cast SDK v4.8 + CAF v3 Receiver, 4K HDR10 LL-HLS streaming, Anime Episode & Watchlist DB, Multi-language Subtitle Sync Engine, Offline PWA.',
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setError(
          'Deep Reasoning requires the Node/Express backend (npm start) with a GEMINI_API_KEY configured. On static GitHub Pages hosting, all streaming, playlist, anime tracking, subtitle sync, and architecture blueprint features run directly in the browser.'
        );
        return;
      }
      const data = (await res.json()) as {answer?: string; error?: string};
      if (!res.ok) {
        setError(data.error || 'High-thinking request failed.');
      } else {
        setAnswer(data.answer ?? '');
      }
    } catch {
      setError('Unable to reach server endpoint /api/gemini/think.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header + Segmented Blueprint Switcher */}
      <div className="flex flex-col gap-4 border-b border-[#232736] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-xl">
          <h1 className="text-2xl font-semibold text-[#F4F4F6] sm:text-3xl">
            System Architecture &amp; Deep Reasoning
          </h1>
          <p className="mt-1 text-sm text-[#9499AD]">
            Technical plan for iOS Google Cast SDK, 4K LL-HLS optimization, anime database schema, and high-thinking analysis.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Architecture specification sections"
          className="flex flex-wrap items-center gap-1 rounded-xl border border-[#232736] bg-[#12141C] p-1 sm:flex-nowrap shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ios-cast'}
            onClick={() => setActiveTab('ios-cast')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'ios-cast'
                ? 'bg-[#232736] text-[#F4F4F6]'
                : 'text-[#9499AD] hover:text-[#F4F4F6]'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
            iOS Cast &amp; 4K LL-HLS
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'anime-schema'}
            onClick={() => setActiveTab('anime-schema')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'anime-schema'
                ? 'bg-[#232736] text-[#F4F4F6]'
                : 'text-[#9499AD] hover:text-[#F4F4F6]'
            }`}
          >
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            Anime Schema &amp; Sync
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'thinking'}
            onClick={() => setActiveTab('thinking')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'thinking'
                ? 'bg-[#232736] text-[#F4F4F6]'
                : 'text-[#9499AD] hover:text-[#F4F4F6]'
            }`}
          >
            <BrainCircuit className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
            Deep Reasoning
          </button>
        </div>
      </div>

      {/* Tab 1: iOS Google Cast SDK & 4K LL-HLS */}
      {activeTab === 'ios-cast' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {IOS_CAST_LAYERS.map((layer) => (
              <article
                key={layer.title}
                className="min-w-0 rounded-2xl border border-[#232736] bg-[#12141C] p-5"
              >
                <h2 className="text-base font-semibold text-[#F4F4F6]">{layer.title}</h2>
                <p className="mt-2 break-words text-sm leading-relaxed text-[#B6BACB]">
                  {layer.summary}
                </p>
                <ul className="mt-4 space-y-2.5 border-t border-[#232736] pt-4 text-xs leading-relaxed text-[#9499AD]">
                  {layer.bullets.map((b) => (
                    <li key={b} className="break-words">
                      {b}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <section className="rounded-2xl border border-[#232736] bg-[#12141C] p-5">
            <div className="flex items-center justify-between gap-4 border-b border-[#232736] pb-3.5">
              <div>
                <h2 className="text-base font-semibold text-[#F4F4F6]">
                  Reference Implementation — Swift Cast Handoff &amp; 4K LL-HLS Manifest
                </h2>
                <p className="mt-0.5 text-xs text-[#9499AD]">
                  Direct CDN-to-Chromecast fMP4 delivery with hardware HDR10 negotiation
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy('ios-snippet', SWIFT_AND_HLS_SNIPPET)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#2A2F42] bg-[#161924] px-3 py-1.5 text-xs font-medium text-[#F4F4F6] hover:bg-[#1E2232] whitespace-nowrap shrink-0"
              >
                {copiedId === 'ios-snippet' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copiedId === 'ios-snippet' ? 'Copied' : 'Copy Code'}
              </button>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-[#0A0B0F] p-4 font-mono text-xs leading-relaxed text-[#D6D9E4]">
              <code>{SWIFT_AND_HLS_SNIPPET}</code>
            </pre>
          </section>
        </div>
      )}

      {/* Tab 2: Anime Management Schema & Subtitle Sync Engine */}
      {activeTab === 'anime-schema' && (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-[#232736] bg-[#12141C]">
            <div className="border-b border-[#232736] px-5 py-4">
              <h2 className="text-base font-semibold text-[#F4F4F6]">
                Normalized Anime &amp; Offline Sync Data Schema
              </h2>
              <p className="mt-0.5 text-xs text-[#9499AD]">
                Shared across SQLite / CoreData (iOS) and IndexedDB (Cross-Platform PWA)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#232736] bg-[#0D0F16] text-xs text-[#9499AD]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Entity</th>
                    <th className="px-5 py-3 font-medium">Keys &amp; Indexes</th>
                    <th className="px-5 py-3 font-medium">Columns &amp; Sync Semantics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232736]">
                  {ANIME_SCHEMA_TABLES.map((row) => (
                    <tr key={row.table} className="hover:bg-[#161924]/70">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#E5484D] whitespace-nowrap">
                        {row.table}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[#D6D9E4] whitespace-nowrap">
                        {row.keys}
                      </td>
                      <td className="px-5 py-3.5 text-xs leading-relaxed text-[#B6BACB]">
                        {row.fields}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-[#232736] bg-[#12141C] p-5">
            <div className="flex items-center justify-between gap-4 border-b border-[#232736] pb-3.5">
              <div>
                <h2 className="text-base font-semibold text-[#F4F4F6]">
                  Subtitle Synchronization Math &amp; Public API Hydration Flow
                </h2>
                <p className="mt-0.5 text-xs text-[#9499AD]">
                  Implemented live in KuroCast’s unit-tested subtitleEngine.ts and /api/anime/search proxy
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy('schema-snippet', SCHEMA_LOGIC_SNIPPET)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#2A2F42] bg-[#161924] px-3 py-1.5 text-xs font-medium text-[#F4F4F6] hover:bg-[#1E2232] whitespace-nowrap shrink-0"
              >
                {copiedId === 'schema-snippet' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copiedId === 'schema-snippet' ? 'Copied' : 'Copy Spec'}
              </button>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-[#0A0B0F] p-4 font-mono text-xs leading-relaxed text-[#D6D9E4]">
              <code>{SCHEMA_LOGIC_SNIPPET}</code>
            </pre>
          </section>
        </div>
      )}

      {/* Tab 3: High-Thinking Mode Advisor (gemini-4-carbon + ThinkingLevel.HIGH) */}
      {activeTab === 'thinking' && (
        <section className="rounded-2xl border border-[#232736] bg-[#12141C] p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[#F4F4F6]">
              Deep Reasoning Architecture &amp; Media Advisor
            </h2>
            <p className="mt-1 text-sm text-[#9499AD]">
              Ask complex questions about LL-HLS latency tuning, Chromecast 4K codec negotiation, subtitle framerate drift, or intricate anime franchise watch orders. Powered server-side by high-thinking mode.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#9499AD]">Quick Complex Queries</p>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
              {SAMPLE_COMPLEX_PROMPTS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setQuery(sample);
                    setError(null);
                  }}
                  className="rounded-xl border border-[#232736] bg-[#0D0F16] p-3.5 text-left text-xs leading-relaxed text-[#D6D9E4] transition-colors hover:border-[#3A4158] hover:text-white"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleAskThinking} className="space-y-3" noValidate>
            <label htmlFor="thinking-query-input" className="block text-xs font-medium text-[#D6D9E4]">
              Complex Engineering or Anime Query
            </label>
            <textarea
              id="thinking-query-input"
              rows={4}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ask a multi-step streaming, subtitle synchronization, schema, or anime franchise question..."
              className="w-full rounded-xl border border-[#232736] bg-[#0A0B0F] p-3.5 text-sm text-[#F4F4F6] placeholder-[#6B7085] focus:border-[#E5484D] focus:outline-none"
            />
            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#E5484D] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#D13B40] disabled:opacity-60 whitespace-nowrap"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                {loading ? 'Reasoning deeply...' : 'Run Deep Analysis'}
              </button>
            </div>
          </form>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[#5A2429] bg-[#211114] p-4 text-sm text-[#FCA5A5]"
            >
              {error}
            </div>
          )}

          {answer && (
            <div className="rounded-xl border border-[#232736] bg-[#0A0B0F] p-5">
              <p className="text-xs font-medium text-[#9499AD]">Deep Analysis Result</p>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#E6E8F0]">
                {answer}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
