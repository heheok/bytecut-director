import { useRef, useEffect, useCallback, useState } from 'react';
import { formatAudioTime } from '../../utils/audioUtils';

interface Props {
  audioUrl: string;
  filename: string;
}

const BAR_GAP = 1;
const NUM_BINS = 300;
const RULER_HEIGHT = 14;

export function MiniWaveform({ audioUrl, filename }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animRef = useRef<number>(0);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [peaks, setPeaks] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playheadTime, setPlayheadTime] = useState<number | null>(null);
  const startTimeRef = useRef(0);
  const startOffsetRef = useRef(0);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fetch and decode audio
  useEffect(() => {
    let cancelled = false;
    setPeaks([]);
    setDuration(0);
    setPlayheadTime(null);
    setPlaying(false);

    (async () => {
      try {
        const res = await fetch(audioUrl);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;

        setDuration(buffer.duration);

        // Extract peaks
        const data = buffer.getChannelData(0);
        const samplesPerBin = Math.floor(data.length / NUM_BINS);
        const p: number[] = new Array(NUM_BINS);
        for (let i = 0; i < NUM_BINS; i++) {
          let max = 0;
          const start = i * samplesPerBin;
          const end = Math.min(start + samplesPerBin, data.length);
          for (let j = start; j < end; j++) {
            const abs = Math.abs(data[j]);
            if (abs > max) max = abs;
          }
          p[i] = max;
        }
        setPeaks(p);
      } catch {}
    })();

    return () => {
      cancelled = true;
      stopPlayback();
    };
  }, [audioUrl]);

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(async () => {
    if (playing) {
      stopPlayback();
      setPlayheadTime(null);
      return;
    }

    const ctx = audioCtxRef.current;
    if (!ctx) return;

    try {
      // Re-decode for a fresh buffer source
      const res = await fetch(audioUrl);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const offset = playheadTime ?? 0;
      startOffsetRef.current = offset;
      startTimeRef.current = ctx.currentTime;
      source.start(0, offset);
      sourceRef.current = source;
      setPlaying(true);

      source.onended = () => {
        setPlaying(false);
        setPlayheadTime(null);
        sourceRef.current = null;
        if (animRef.current) {
          cancelAnimationFrame(animRef.current);
          animRef.current = 0;
        }
      };

      // Animate playhead
      const animate = () => {
        const elapsed = ctx.currentTime - startTimeRef.current + startOffsetRef.current;
        if (elapsed <= buffer.duration) {
          setPlayheadTime(elapsed);
          animRef.current = requestAnimationFrame(animate);
        }
      };
      animRef.current = requestAnimationFrame(animate);
    } catch {}
  }, [playing, audioUrl, playheadTime, stopPlayback]);

  // Click on waveform to seek
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (duration <= 0 || peaks.length === 0) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const t = (x / rect.width) * duration;
      const clamped = Math.max(0, Math.min(duration, t));

      if (playing) {
        // Restart from new position
        stopPlayback();
        setPlayheadTime(clamped);
        // Small delay to let state settle then auto-play from new pos
        setTimeout(() => {
          startOffsetRef.current = clamped;
          togglePlay();
        }, 50);
      } else {
        setPlayheadTime(clamped);
      }
    },
    [duration, peaks, playing, stopPlayback, togglePlay]
  );

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || peaks.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const w = size.width;
    const waveH = size.height - RULER_HEIGHT;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, size.height);

    const barWidth = Math.max(1, (w / peaks.length) - BAR_GAP);
    const mid = waveH / 2;

    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const amplitude = peaks[i] * mid * 0.9;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x, mid - amplitude, barWidth, amplitude * 2);
    }

    // Playhead
    if (playheadTime !== null && playheadTime >= 0 && duration > 0) {
      const px = (playheadTime / duration) * w;
      if (px >= 0 && px <= w) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, waveH);
        ctx.stroke();
      }
    }

    // Time ruler
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, waveH, w, RULER_HEIGHT);

    ctx.font = '9px monospace';
    ctx.textAlign = 'center';

    const targetLabels = Math.max(2, Math.floor(w / 60));
    const intervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
    const approx = duration / targetLabels;
    let interval = 1;
    for (const iv of intervals) {
      if (iv >= approx) { interval = iv; break; }
    }

    for (let t = 0; t <= duration + interval; t += interval) {
      const x = (t / duration) * w;
      if (x < -10 || x > w + 10) continue;
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(x, waveH, 1, 3);
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(formatAudioTime(t), x, waveH + 11);
    }
  }, [peaks, size, playheadTime, duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [stopPlayback]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          className="btn btn-ghost text-[10px] py-0.5 px-1.5 shrink-0"
          onClick={togglePlay}
          disabled={peaks.length === 0}
        >
          {playing ? '\u25A0 Stop' : '\u25B6 Play'}
        </button>
        <span className="text-[10px] text-gray-500 tabular-nums shrink-0">
          {playheadTime != null ? formatAudioTime(playheadTime) : '0:00.0'}
          {' / '}
          {duration > 0 ? formatAudioTime(duration) : '--:--'}
        </span>
        <span className="text-[10px] text-gray-500 truncate flex-1">
          {filename}
        </span>
      </div>
      <div
        ref={containerRef}
        className="h-16 w-full rounded border border-surface-400 overflow-hidden cursor-pointer"
        onClick={handleClick}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ width: size.width || '100%', height: size.height || '100%' }}
        />
      </div>
    </div>
  );
}
