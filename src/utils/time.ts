/**
 * Converts a time string (e.g., "01:23", "00:01:23", "01:23 - 01:45") to seconds.
 * Takes the start time when given a range.
 */
export function parseTimestampToSeconds(ts: string): number {
  if (!ts) return 0;
  
  // If it's a range like "00:15 - 00:30", take the first part
  const firstPart = ts.split('-')[0].trim();
  const parts = firstPart.split(':').map((p) => parseFloat(p.trim()));
  
  if (parts.some((p) => isNaN(p))) return 0;
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

/**
 * Parses end time from range (e.g. "00:15 - 00:30") or null if single point
 */
export function parseRangeToSeconds(ts: string): { start: number; end: number | null } {
  if (!ts) return { start: 0, end: null };
  const parts = ts.split('-');
  const start = parseTimestampToSeconds(parts[0]);
  const end = parts.length > 1 ? parseTimestampToSeconds(parts[1]) : null;
  return { start, end };
}

/**
 * Formats seconds into "MM:SS" or "HH:MM:SS"
 */
export function formatSecondsToTimestamp(totalSeconds: number, includeHours = false): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (h > 0 || includeHours) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Standard playback speed steps for shortcuts and selector
 */
export const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

/**
 * Gets the next slower playback rate (1 step lower)
 */
export function getNextSlowerRate(currentRate: number): number {
  const closestIdx = PLAYBACK_RATES.reduce((bestIdx, rate, idx) => {
    return Math.abs(rate - currentRate) < Math.abs(PLAYBACK_RATES[bestIdx] - currentRate) ? idx : bestIdx;
  }, 0);
  const nextIdx = Math.max(0, closestIdx - 1);
  return PLAYBACK_RATES[nextIdx];
}

/**
 * Gets the next faster playback rate (1 step higher)
 */
export function getNextFasterRate(currentRate: number): number {
  const closestIdx = PLAYBACK_RATES.reduce((bestIdx, rate, idx) => {
    return Math.abs(rate - currentRate) < Math.abs(PLAYBACK_RATES[bestIdx] - currentRate) ? idx : bestIdx;
  }, 0);
  const nextIdx = Math.min(PLAYBACK_RATES.length - 1, closestIdx + 1);
  return PLAYBACK_RATES[nextIdx];
}
