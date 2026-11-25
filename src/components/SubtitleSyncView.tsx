import React, {useMemo, useState} from 'react';
import {Download, RotateCcw, Upload} from 'lucide-react';
import type {SubtitleLanguage, SubtitleTrack} from '../types/media';
import {
  applyTrackTiming,
  calculateTwoPointCalibration,
  formatMsToWebVtt,
  parseSubtitleText,
  serializeWebVTT,
} from '../utils/subtitleEngine';

interface SubtitleSyncViewProps {
  tracks: Record<string, SubtitleTrack>;
  primaryLang: SubtitleLanguage | 'off';
  secondaryLang: SubtitleLanguage | 'off';
  currentTimeSec: number;
  onPrimaryChange: (lang: SubtitleLanguage | 'off') => void;
  onSecondaryChange: (lang: SubtitleLanguage | 'off') => void;
  onUpdateTrackOffset: (lang: SubtitleLanguage, offsetMs: number) => void;
  onUpdateTrackRate: (lang: SubtitleLanguage, rateScale: number) => void;
  onUpdateCueText: (lang: SubtitleLanguage, cueId: string, text: string) => void;
  onReplaceTrackCues: (lang: SubtitleLanguage, rawText: string) => {count: number; error?: string};
  onJumpToSec: (sec: number) => void;
}

const LANGUAGES: SubtitleLanguage[] = ['en', 'ja', 'es', 'fr'];

export const SubtitleSyncView: React.FC<SubtitleSyncViewProps> = ({
  tracks,
  primaryLang,
  secondaryLang,
  currentTimeSec,
  onPrimaryChange,
  onSecondaryChange,
  onUpdateTrackOffset,
  onUpdateTrackRate,
  onUpdateCueText,
  onReplaceTrackCues,
  onJumpToSec,
}) => {
  const [editingLang, setEditingLang] = useState<SubtitleLanguage>(
    primaryLang === 'off' ? 'en' : primaryLang
  );
  const [importOpen, setImportOpen] = useState(false);
  const [rawImport, setRawImport] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  // Two-point linear drift calibration inputs (seconds)
  const [anchorASource, setAnchorASource] = useState('13.0');
  const [anchorATarget, setAnchorATarget] = useState('13.5');
  const [anchorBSource, setAnchorBSource] = useState('905.0');
  const [anchorBTarget, setAnchorBTarget] = useState('906.8');
  const [driftFeedback, setDriftFeedback] = useState<string | null>(null);

  const activeTrack = tracks[editingLang] ?? tracks.en;
  const effectiveCues = useMemo(
    () => applyTrackTiming(activeTrack.cues, activeTrack.offsetMs, activeTrack.rateScale),
    [activeTrack]
  );

  const playbackMs = currentTimeSec * 1000;

  const handleApplyTwoPoint = (e: React.FormEvent) => {
    e.preventDefault();
    const sA = Number(anchorASource) * 1000;
    const tA = Number(anchorATarget) * 1000;
    const sB = Number(anchorBSource) * 1000;
    const tB = Number(anchorBTarget) * 1000;

    if (![sA, tA, sB, tB].every(Number.isFinite)) {
      setDriftFeedback('Enter valid numeric second values for both sync anchors.');
      return;
    }
    const calibrated = calculateTwoPointCalibration(sA, tA, sB, tB);
    if (!calibrated) {
      setDriftFeedback('Anchor B must occur strictly after Anchor A.');
      return;
    }
    onUpdateTrackRate(editingLang, calibrated.rateScale);
    onUpdateTrackOffset(editingLang, calibrated.offsetMs);
    setDriftFeedback(
      `Applied rate ${calibrated.rateScale.toFixed(4)}x and offset ${calibrated.offsetMs >= 0 ? '+' : ''}${calibrated.offsetMs}ms.`
    );
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseSubtitleText(rawImport);
    if (parsed.length === 0) {
      setImportFeedback('No valid SRT or WebVTT cues detected. Check timestamp syntax (00:00:01.000 --> 00:00:03.500).');
      return;
    }
    const result = onReplaceTrackCues(editingLang, rawImport);
    if (result.error) {
      setImportFeedback(result.error);
      return;
    }
    setImportFeedback(`Imported ${result.count} cues into ${activeTrack.label} track.`);
    setRawImport('');
    setImportOpen(false);
  };

  const handleDownloadVtt = () => {
    const vttContent = serializeWebVTT(
      activeTrack.cues,
      activeTrack.offsetMs,
      activeTrack.rateScale
    );
    const blob = new Blob([vttContent], {type: 'text/vtt;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kurocast-${activeTrack.language}-synced.vtt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#232736] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F4F6] sm:text-3xl">
            Multi-Language Subtitle Synchronization
          </h1>
          <p className="mt-1 text-sm text-[#9499AD]">
            Calibrate manual millisecond offsets, correct PAL/NTSC framerate drift, enable dual subtitles, and export Cast-ready WebVTT.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setImportOpen((v) => !v)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#2A2F42] bg-[#161924] px-3.5 py-2 text-xs font-medium text-[#F4F4F6] transition-colors hover:bg-[#1E2232] whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5 text-[#E5484D]" aria-hidden="true" />
            Import SRT / VTT
          </button>
          <button
            type="button"
            onClick={handleDownloadVtt}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#E5484D] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#D13B40] whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export Calibrated .vtt
          </button>
        </div>
      </div>

      {/* Optional SRT/VTT Import Drawer */}
      {importOpen && (
        <form
          onSubmit={handleImportSubmit}
          className="rounded-2xl border border-[#232736] bg-[#12141C] p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <label htmlFor="subtitle-raw-import" className="text-sm font-semibold text-[#F4F4F6]">
              Paste SRT or WebVTT into {activeTrack.label} Track
            </label>
            <button
              type="button"
              onClick={() => setImportOpen(false)}
              className="text-xs text-[#9499AD] hover:text-[#F4F4F6]"
            >
              Close
            </button>
          </div>
          <textarea
            id="subtitle-raw-import"
            rows={5}
            value={rawImport}
            onChange={(e) => setRawImport(e.target.value)}
            placeholder={`WEBVTT\n\n00:00:01.000 --> 00:00:04.500\nFirst line of dialogue`}
            className="w-full rounded-lg border border-[#232736] bg-[#0A0B0F] p-3 font-mono text-xs text-[#F4F4F6] placeholder-[#6B7085] focus:border-[#E5484D] focus:outline-none"
          />
          {importFeedback && <p className="text-xs text-amber-300">{importFeedback}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-[#E5484D] px-4 py-2 text-xs font-medium text-white hover:bg-[#D13B40]"
            >
              Parse &amp; Replace Cues
            </button>
          </div>
        </form>
      )}

      {/* Active Output & Dual-Language Routing */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        <section className="space-y-6 lg:col-span-5">
          {/* Dual-Language Stage Output */}
          <div className="rounded-2xl border border-[#232736] bg-[#12141C] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#F4F4F6]">Cast Stage Subtitle Routing</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sub-primary-select" className="block text-xs font-medium text-[#9499AD]">
                  Primary Language
                </label>
                <select
                  id="sub-primary-select"
                  value={primaryLang}
                  onChange={(e) => {
                    const next = e.target.value as SubtitleLanguage | 'off';
                    onPrimaryChange(next);
                    if (next !== 'off') setEditingLang(next);
                  }}
                  className="mt-1.5 w-full min-h-[42px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-2 text-sm text-[#F4F4F6] focus:border-[#E5484D] focus:outline-none"
                >
                  <option value="off">Disabled</option>
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {tracks[lang].label} ({tracks[lang].nativeLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="sub-secondary-select" className="block text-xs font-medium text-[#9499AD]">
                  Dual-Sub Secondary
                </label>
                <select
                  id="sub-secondary-select"
                  value={secondaryLang}
                  onChange={(e) => onSecondaryChange(e.target.value as SubtitleLanguage | 'off')}
                  className="mt-1.5 w-full min-h-[42px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-2 text-sm text-[#F4F4F6] focus:border-[#E5484D] focus:outline-none"
                >
                  <option value="off">Single Track Only</option>
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {tracks[lang].label} ({tracks[lang].nativeLabel})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Precision Offset & Framerate Calibration */}
          <div className="rounded-2xl border border-[#232736] bg-[#12141C] p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[#F4F4F6]">Track Timing Calibration</h2>
              <div className="flex items-center gap-1 rounded-lg border border-[#232736] bg-[#0A0B0F] p-1">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setEditingLang(lang)}
                    className={`min-h-[32px] rounded-md px-2.5 py-1 text-xs font-medium uppercase transition-colors ${
                      editingLang === lang
                        ? 'bg-[#232736] text-white'
                        : 'text-[#9499AD] hover:text-white'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sub-offset-slider" className="font-medium text-[#9499AD]">
                  Manual Offset ({activeTrack.label})
                </label>
                <span className="font-mono-tabular text-sm font-semibold text-[#F4F4F6]" data-testid="subtitle-offset-value">
                  {activeTrack.offsetMs >= 0 ? `+${activeTrack.offsetMs}` : activeTrack.offsetMs} ms
                </span>
              </div>
              <input
                id="sub-offset-slider"
                type="range"
                min={-5000}
                max={5000}
                step={25}
                value={Math.max(-5000, Math.min(5000, activeTrack.offsetMs))}
                onChange={(e) => onUpdateTrackOffset(editingLang, Number(e.target.value))}
                className="kuro-slider mt-2.5 w-full"
              />

              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {[-1000, -250, 0, 250, 1000].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() =>
                      onUpdateTrackOffset(
                        editingLang,
                        delta === 0 ? 0 : activeTrack.offsetMs + delta
                      )
                    }
                    className="min-h-[38px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-2 py-1.5 font-mono-tabular text-xs text-[#D6D9E4] transition-colors hover:border-[#3A4158] hover:text-white"
                  >
                    {delta === 0 ? 'Reset' : delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </div>

            {/* Framerate Presets */}
            <div className="border-t border-[#232736] pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#9499AD]">Framerate Drift Scale</span>
                <span className="font-mono-tabular text-[#F4F4F6]">
                  {activeTrack.rateScale.toFixed(4)}x
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateTrackRate(editingLang, 23.976 / 25)}
                  className="min-h-[36px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-1.5 text-xs text-[#D6D9E4] hover:border-[#3A4158]"
                >
                  25 → 23.976 fps
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateTrackRate(editingLang, 25 / 23.976)}
                  className="min-h-[36px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-1.5 text-xs text-[#D6D9E4] hover:border-[#3A4158]"
                >
                  23.976 → 25 fps
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateTrackRate(editingLang, 1);
                    onUpdateTrackOffset(editingLang, 0);
                    setDriftFeedback(null);
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#232736] bg-[#0A0B0F] px-3 py-1.5 text-xs text-[#9499AD] hover:text-[#F4F4F6]"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  1.0000x
                </button>
              </div>
            </div>

            {/* Two-Point Drift Calibration */}
            <form onSubmit={handleApplyTwoPoint} className="border-t border-[#232736] pt-4 space-y-3">
              <p className="text-xs font-medium text-[#D6D9E4]">
                Two-Point Anchor Sync (Linear Drift Solver)
              </p>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label htmlFor="anchor-a-src" className="text-[#9499AD]">
                    Anchor A Source (s)
                  </label>
                  <input
                    id="anchor-a-src"
                    type="number"
                    step="0.1"
                    value={anchorASource}
                    onChange={(e) => setAnchorASource(e.target.value)}
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-2.5 py-1.5 font-mono-tabular text-[#F4F4F6]"
                  />
                </div>
                <div>
                  <label htmlFor="anchor-a-tgt" className="text-[#9499AD]">
                    Anchor A Heard (s)
                  </label>
                  <input
                    id="anchor-a-tgt"
                    type="number"
                    step="0.1"
                    value={anchorATarget}
                    onChange={(e) => setAnchorATarget(e.target.value)}
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-2.5 py-1.5 font-mono-tabular text-[#F4F4F6]"
                  />
                </div>
                <div>
                  <label htmlFor="anchor-b-src" className="text-[#9499AD]">
                    Anchor B Source (s)
                  </label>
                  <input
                    id="anchor-b-src"
                    type="number"
                    step="0.1"
                    value={anchorBSource}
                    onChange={(e) => setAnchorBSource(e.target.value)}
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-2.5 py-1.5 font-mono-tabular text-[#F4F4F6]"
                  />
                </div>
                <div>
                  <label htmlFor="anchor-b-tgt" className="text-[#9499AD]">
                    Anchor B Heard (s)
                  </label>
                  <input
                    id="anchor-b-tgt"
                    type="number"
                    step="0.1"
                    value={anchorBTarget}
                    onChange={(e) => setAnchorBTarget(e.target.value)}
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-[#232736] bg-[#0A0B0F] px-2.5 py-1.5 font-mono-tabular text-[#F4F4F6]"
                  />
                </div>
              </div>
              {driftFeedback && <p className="text-xs text-[#D6D9E4]">{driftFeedback}</p>}
              <button
                type="submit"
                className="min-h-[40px] w-full rounded-lg border border-[#343B52] bg-[#1A1D28] px-3 py-2 text-xs font-medium text-[#F4F4F6] transition-colors hover:bg-[#24293A]"
              >
                Solve &amp; Apply Linear Calibration
              </button>
            </form>
          </div>
        </section>

        {/* Live Synchronized Cue Inspector */}
        <section className="rounded-2xl border border-[#232736] bg-[#12141C] p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#232736] pb-3.5">
            <div>
              <h2 className="text-base font-semibold text-[#F4F4F6]">
                Cue Timeline — {activeTrack.label}
              </h2>
              <p className="mt-0.5 font-mono-tabular text-xs text-[#9499AD]">
                Stage clock: {formatMsToWebVtt(playbackMs)} · {effectiveCues.length} cues
              </p>
            </div>
            <span className="text-xs text-[#9499AD]">Click any timestamp to scrub stage</span>
          </div>

          <div className="mt-3 divide-y divide-[#232736]" data-testid="subtitle-cue-list">
            {effectiveCues.map((cue) => {
              const isActive = playbackMs >= cue.startMs && playbackMs <= cue.endMs;
              return (
                <div
                  key={cue.id}
                  className={`flex flex-col gap-2 py-3 transition-colors sm:flex-row sm:items-center sm:gap-4 ${
                    isActive ? 'bg-[#1A1D28]/60 -mx-2 px-2 rounded-lg' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onJumpToSec(Math.floor(cue.startMs / 1000))}
                    className={`shrink-0 text-left font-mono-tabular text-xs transition-colors hover:text-white ${
                      isActive ? 'font-semibold text-[#E5484D]' : 'text-[#9499AD]'
                    }`}
                  >
                    {formatMsToWebVtt(cue.startMs)} → {formatMsToWebVtt(cue.endMs)}
                  </button>
                  <label htmlFor={`cue-edit-${cue.id}`} className="sr-only">
                    Edit cue text
                  </label>
                  <input
                    id={`cue-edit-${cue.id}`}
                    type="text"
                    value={cue.text}
                    onChange={(e) => onUpdateCueText(editingLang, cue.id, e.target.value)}
                    className="w-full min-h-[38px] rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-[#F4F4F6] hover:border-[#232736] focus:border-[#E5484D] focus:bg-[#0A0B0F] focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
