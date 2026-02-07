export function parseTimestamp(ts: string): number {
  // Formats: "0:00.12", "1:03.90", "3:51.10"
  const cleaned = ts.trim();
  const match = cleaned.match(/^(\d+):(\d+)\.(\d+)$/);
  if (!match) return 0;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const fraction = parseInt(match[3], 10) / 100;
  return minutes * 60 + seconds + fraction;
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const whole = Math.floor(secs);
  const frac = Math.round((secs - whole) * 100)
    .toString()
    .padStart(2, '0');
  return `${mins}:${whole.toString().padStart(2, '0')}.${frac}`;
}

export function formatDuration(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

export function timeToPixels(seconds: number, pixelsPerSecond: number): number {
  return seconds * pixelsPerSecond;
}

export function pixelsToTime(pixels: number, pixelsPerSecond: number): number {
  return pixels / pixelsPerSecond;
}
