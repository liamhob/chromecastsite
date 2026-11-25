import type {SubtitleCue} from '../types/media';

export interface EffectiveSubtitleCue {
  id: string;
  originalStartMs: number;
  originalEndMs: number;
  startMs: number;
  endMs: number;
  text: string;
}

export function parseTimestampToMs(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  const match = cleaned.match(/^(?:(\d{1,2}):)?(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) {
    return null;
  }
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millisStr = (match[4] ?? '0').padEnd(3, '0');
  const millis = Number(millisStr);

  if (minutes > 59 || seconds > 59) {
    return null;
  }

  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

export function formatMsToWebVtt(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = safe % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function formatMsCompact(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

export function applyCueTiming(
  cue: SubtitleCue,
  offsetMs: number,
  rateScale = 1
): EffectiveSubtitleCue {
  const safeScale = rateScale > 0 && Number.isFinite(rateScale) ? rateScale : 1;
  const startMs = Math.max(0, Math.round(cue.startMs * safeScale + offsetMs));
  const rawEnd = Math.round(cue.endMs * safeScale + offsetMs);
  const endMs = Math.max(startMs + 250, rawEnd);

  return {
    id: cue.id,
    originalStartMs: cue.startMs,
    originalEndMs: cue.endMs,
    startMs,
    endMs,
    text: cue.text,
  };
}

export function applyTrackTiming(
  cues: SubtitleCue[],
  offsetMs: number,
  rateScale = 1
): EffectiveSubtitleCue[] {
  return cues
    .map((cue) => applyCueTiming(cue, offsetMs, rateScale))
    .sort((a, b) => a.startMs - b.startMs);
}

/**
 * Finds active cues at playbackTimeMs using binary search upper-bound scan
 * to support overlapping multi-speaker cues cleanly in O(log n + k).
 */
export function findActiveCues(
  cues: SubtitleCue[],
  playbackTimeMs: number,
  offsetMs: number,
  rateScale = 1
): EffectiveSubtitleCue[] {
  if (cues.length === 0) {
    return [];
  }
  const adjusted = applyTrackTiming(cues, offsetMs, rateScale);
  const active: EffectiveSubtitleCue[] = [];

  // Binary search for the first cue with startMs > playbackTimeMs
  let low = 0;
  let high = adjusted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (adjusted[mid].startMs <= playbackTimeMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  // Scan backwards while cues can still overlap playbackTimeMs
  for (let i = low - 1; i >= 0; i--) {
    const cue = adjusted[i];
    if (cue.startMs <= playbackTimeMs && playbackTimeMs <= cue.endMs) {
      active.push(cue);
    } else if (playbackTimeMs - cue.startMs > 30_000) {
      break;
    }
  }

  return active.reverse();
}

/**
 * Calculates linear rateScale and offsetMs from two observed anchor points
 * (e.g., first line drifts slightly and final line drifts heavily due to PAL/NTSC fps mismatch).
 */
export function calculateTwoPointCalibration(
  sourcePointAMs: number,
  targetPointAMs: number,
  sourcePointBMs: number,
  targetPointBMs: number
): {offsetMs: number; rateScale: number} | null {
  const deltaSource = sourcePointBMs - sourcePointAMs;
  const deltaTarget = targetPointBMs - targetPointAMs;
  if (deltaSource <= 0 || deltaTarget <= 0) {
    return null;
  }
  const rateScale = Number((deltaTarget / deltaSource).toFixed(6));
  const offsetMs = Math.round(targetPointAMs - sourcePointAMs * rateScale);
  return {offsetMs, rateScale};
}

export function parseSubtitleText(raw: string): SubtitleCue[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const body = normalized.replace(/^WEBVTT[^\n]*\n+/i, '');
  const blocks = body.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (let idx = 0; idx < blocks.length; idx++) {
    const lines = blocks[idx]
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      continue;
    }

    const timingIdx = lines.findIndex((line) => line.includes('-->'));
    if (timingIdx === -1) {
      continue;
    }

    const timingLine = lines[timingIdx];
    const [rawStart, rawEndPart] = timingLine.split('-->');
    if (!rawStart || !rawEndPart) {
      continue;
    }
    const rawEnd = rawEndPart.trim().split(/\s+/)[0];
    const startMs = parseTimestampToMs(rawStart);
    const endMs = parseTimestampToMs(rawEnd);

    if (startMs === null || endMs === null || endMs <= startMs) {
      continue;
    }

    const text = lines
      .slice(timingIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (!text) {
      continue;
    }

    cues.push({
      id: `cue-${idx + 1}`,
      startMs,
      endMs,
      text,
    });
  }

  return cues.sort((a, b) => a.startMs - b.startMs);
}

export function serializeWebVTT(
  cues: SubtitleCue[],
  offsetMs: number,
  rateScale = 1
): string {
  const shifted = applyTrackTiming(cues, offsetMs, rateScale);
  const lines: string[] = ['WEBVTT', ''];

  shifted.forEach((cue, index) => {
    lines.push(String(index + 1));
    lines.push(`${formatMsToWebVtt(cue.startMs)} --> ${formatMsToWebVtt(cue.endMs)}`);
    lines.push(cue.text);
    lines.push('');
  });

  return lines.join('\n');
}
