import { useRef, useEffect, useCallback, useState } from 'react';
import { formatAudioTime } from '../../utils/audioUtils';

interface Props {
  peaks: number[];
  duration: number;
  regionStart: number;
  regionEnd: number;
  playheadTime: number | null;
  onRegionChange: (start: number, end: number) => void;
}

type DragMode = 'none' | 'create' | 'move' | 'resize-left' | 'resize-right' | 'pan';

const BAR_GAP = 1;
const RULER_HEIGHT = 20;
const SCROLLBAR_HEIGHT = 10;
const MIN_REGION_SEC = 0.05;
const MIN_ZOOM = 1;
const MAX_ZOOM = 200;
const ZOOM_SPEED = 1.15;

export function WaveformCanvas({
  peaks,
  duration,
  regionStart,
  regionEnd,
  playheadTime,
  onRegionChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Zoom/pan state: viewStart..viewEnd is the visible time window
  const [zoom, setZoom] = useState(1); // 1 = full track
  const [viewStart, setViewStart] = useState(0); // seconds

  const viewDuration = duration / zoom;
  const viewEnd = Math.min(viewStart + viewDuration, duration);

  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    origStart: number;
    origEnd: number;
    origViewStart: number;
  }>({ mode: 'none', startX: 0, origStart: 0, origEnd: 0, origViewStart: 0 });

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

  // Clamp viewStart when zoom or duration changes
  useEffect(() => {
    setViewStart((prev) => clampViewStart(prev, duration, zoom));
  }, [zoom, duration]);

  // Convert pixel X (relative to canvas) to time in seconds
  const xToTime = useCallback(
    (clientX: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const x = clientX - rect.left;
      const t = viewStart + (x / rect.width) * viewDuration;
      return Math.max(0, Math.min(duration, t));
    },
    [viewStart, viewDuration, duration]
  );

  // Convert time to pixel X
  const timeToX = useCallback(
    (t: number) => {
      return ((t - viewStart) / viewDuration) * size.width;
    },
    [viewStart, viewDuration, size.width]
  );

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || peaks.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const w = size.width;
    const h = size.height - RULER_HEIGHT - SCROLLBAR_HEIGHT;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, size.height);

    // Region highlight (viewport-relative)
    if (regionEnd > regionStart) {
      const rStartX = timeToX(regionStart);
      const rEndX = timeToX(regionEnd);
      ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
      ctx.fillRect(rStartX, 0, rEndX - rStartX, h);
    }

    // Which peaks are visible?
    const peakStartIdx = Math.floor((viewStart / duration) * peaks.length);
    const peakEndIdx = Math.ceil((viewEnd / duration) * peaks.length);
    const visiblePeaks = peakEndIdx - peakStartIdx;
    const barWidth = Math.max(1, (w / visiblePeaks) - BAR_GAP);
    const mid = h / 2;

    for (let i = peakStartIdx; i < peakEndIdx && i < peaks.length; i++) {
      const peakTime = (i / peaks.length) * duration;
      const x = timeToX(peakTime);
      if (x < -barWidth || x > w + barWidth) continue;

      const inRegion =
        regionEnd > regionStart &&
        peakTime >= regionStart &&
        peakTime <= regionEnd;

      const amplitude = peaks[i] * mid * 0.9;
      ctx.fillStyle = inRegion ? '#dc2626' : '#6b7280';
      ctx.fillRect(x, mid - amplitude, barWidth, amplitude * 2);
    }

    // Region edge lines + handles
    if (regionEnd > regionStart) {
      const rStartX = timeToX(regionStart);
      const rEndX = timeToX(regionEnd);

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;

      // Left edge
      if (rStartX >= -2 && rStartX <= w + 2) {
        ctx.beginPath();
        ctx.moveTo(rStartX, 0);
        ctx.lineTo(rStartX, h);
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(rStartX - 3, h / 2 - 8, 6, 16);
      }
      // Right edge
      if (rEndX >= -2 && rEndX <= w + 2) {
        ctx.beginPath();
        ctx.moveTo(rEndX, 0);
        ctx.lineTo(rEndX, h);
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(rEndX - 3, h / 2 - 8, 6, 16);
      }
    }

    // Playhead
    if (playheadTime !== null && playheadTime >= 0) {
      const px = timeToX(playheadTime);
      if (px >= 0 && px <= w) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
    }

    // Time ruler
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, h, w, RULER_HEIGHT);

    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    const targetLabels = Math.floor(w / 70);
    const interval = getTimeInterval(viewDuration, targetLabels);
    const firstTick = Math.floor(viewStart / interval) * interval;

    for (let t = firstTick; t <= viewEnd + interval; t += interval) {
      const x = timeToX(t);
      if (x < -20 || x > w + 20) continue;
      // Tick
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(x, h, 1, 4);
      // Label
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(formatAudioTime(t), x, h + 15);
    }

    // Sub-ticks (smaller intervals)
    const subInterval = interval / 4;
    if (subInterval > 0) {
      const firstSub = Math.floor(viewStart / subInterval) * subInterval;
      for (let t = firstSub; t <= viewEnd + subInterval; t += subInterval) {
        const x = timeToX(t);
        if (x < 0 || x > w) continue;
        ctx.fillStyle = '#374151';
        ctx.fillRect(x, h, 1, 2);
      }
    }

    // Scrollbar track
    const sbY = h + RULER_HEIGHT;
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, sbY, w, SCROLLBAR_HEIGHT);

    // Scrollbar thumb
    const thumbFrac = 1 / zoom;
    const thumbX = (viewStart / duration) * w;
    const thumbW = Math.max(20, thumbFrac * w);
    ctx.fillStyle = '#4b5563';
    roundRect(ctx, thumbX, sbY + 2, thumbW, SCROLLBAR_HEIGHT - 4, 3);
    ctx.fill();
  }, [peaks, duration, regionStart, regionEnd, playheadTime, size, viewStart, viewDuration, viewEnd, timeToX, zoom]);

  const getCursorMode = useCallback(
    (clientX: number, clientY: number): DragMode => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return 'create';
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const h = rect.height - RULER_HEIGHT - SCROLLBAR_HEIGHT;

      // Scrollbar area = pan
      if (y > h + RULER_HEIGHT) return 'pan';

      // Region edges
      if (regionEnd > regionStart) {
        const rStartX = timeToX(regionStart);
        const rEndX = timeToX(regionEnd);
        const EDGE = 8;
        if (Math.abs(x - rStartX) < EDGE) return 'resize-left';
        if (Math.abs(x - rEndX) < EDGE) return 'resize-right';
        if (x > rStartX + EDGE && x < rEndX - EDGE) return 'move';
      }
      return 'create';
    },
    [regionStart, regionEnd, timeToX]
  );

  // Wheel: Ctrl+scroll = zoom, plain scroll = pan
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (e.ctrlKey || e.metaKey) {
        // Zoom centered on cursor
        const cursorX = e.clientX - rect.left;
        const cursorTime = viewStart + (cursorX / rect.width) * viewDuration;
        const factor = e.deltaY < 0 ? ZOOM_SPEED : 1 / ZOOM_SPEED;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
        const newViewDuration = duration / newZoom;
        // Keep cursor at same screen position
        const newViewStart = cursorTime - (cursorX / rect.width) * newViewDuration;
        setZoom(newZoom);
        setViewStart(clampViewStart(newViewStart, duration, newZoom));
      } else {
        // Pan
        const panAmount = (e.deltaY / rect.width) * viewDuration * 0.5;
        setViewStart((prev) => clampViewStart(prev + panAmount, duration, zoom));
      }
    },
    [zoom, viewStart, viewDuration, duration]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle click = pan
      if (e.button === 1) {
        e.preventDefault();
        dragRef.current = {
          mode: 'pan',
          startX: e.clientX,
          origStart: 0,
          origEnd: 0,
          origViewStart: viewStart,
        };
      } else {
        const mode = getCursorMode(e.clientX, e.clientY);
        dragRef.current = {
          mode,
          startX: e.clientX,
          origStart: regionStart,
          origEnd: regionEnd,
          origViewStart: viewStart,
        };

        if (mode === 'create') {
          const t = xToTime(e.clientX);
          onRegionChange(t, t);
        }
      }

      const onMove = (ev: MouseEvent) => {
        const d = dragRef.current;

        if (d.mode === 'pan') {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const dx = ev.clientX - d.startX;
          const dtSec = -(dx / rect.width) * viewDuration;
          setViewStart(clampViewStart(d.origViewStart + dtSec, duration, zoom));
          return;
        }

        const t = xToTime(ev.clientX);

        switch (d.mode) {
          case 'create': {
            const startT = xToTime(d.startX);
            onRegionChange(Math.min(startT, t), Math.max(startT, t));
            break;
          }
          case 'move': {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) break;
            const dx = ev.clientX - d.startX;
            const dtSec = (dx / rect.width) * viewDuration;
            const len = d.origEnd - d.origStart;
            let newStart = d.origStart + dtSec;
            let newEnd = d.origEnd + dtSec;
            if (newStart < 0) { newStart = 0; newEnd = len; }
            if (newEnd > duration) { newEnd = duration; newStart = duration - len; }
            onRegionChange(newStart, newEnd);
            break;
          }
          case 'resize-left': {
            const clamped = Math.min(t, d.origEnd - MIN_REGION_SEC);
            onRegionChange(Math.max(0, clamped), d.origEnd);
            break;
          }
          case 'resize-right': {
            const clamped = Math.max(t, d.origStart + MIN_REGION_SEC);
            onRegionChange(d.origStart, Math.min(duration, clamped));
            break;
          }
        }
      };

      const onUp = () => {
        dragRef.current.mode = 'none';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [regionStart, regionEnd, viewStart, viewDuration, duration, zoom, xToTime, getCursorMode, onRegionChange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current.mode !== 'none') return;
      const mode = getCursorMode(e.clientX, e.clientY);
      const canvas = canvasRef.current;
      if (!canvas) return;
      switch (mode) {
        case 'resize-left':
        case 'resize-right':
          canvas.style.cursor = 'ew-resize';
          break;
        case 'move':
          canvas.style.cursor = 'grab';
          break;
        case 'pan':
          canvas.style.cursor = 'grab';
          break;
        default:
          canvas.style.cursor = 'crosshair';
      }
    },
    [getCursorMode]
  );

  // Drag start for drag-to-assign
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (regionEnd <= regionStart) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('media-type', 'audio-crop');
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({ regionStart, regionEnd })
      );
      e.dataTransfer.effectAllowed = 'copy';

      const el = document.createElement('div');
      el.textContent = `${formatAudioTime(regionStart)} - ${formatAudioTime(regionEnd)}`;
      el.style.cssText =
        'position:absolute;top:-100px;background:#dc2626;color:white;padding:4px 8px;border-radius:4px;font-size:11px;white-space:nowrap;';
      document.body.appendChild(el);
      e.dataTransfer.setDragImage(el, 0, 0);
      requestAnimationFrame(() => document.body.removeChild(el));
    },
    [regionStart, regionEnd]
  );

  // Zoom controls exposed to parent
  const zoomIn = useCallback(() => {
    const center = viewStart + viewDuration / 2;
    const newZoom = Math.min(MAX_ZOOM, zoom * 1.5);
    const newVD = duration / newZoom;
    setZoom(newZoom);
    setViewStart(clampViewStart(center - newVD / 2, duration, newZoom));
  }, [zoom, viewStart, viewDuration, duration]);

  const zoomOut = useCallback(() => {
    const center = viewStart + viewDuration / 2;
    const newZoom = Math.max(MIN_ZOOM, zoom / 1.5);
    const newVD = duration / newZoom;
    setZoom(newZoom);
    setViewStart(clampViewStart(center - newVD / 2, duration, newZoom));
  }, [zoom, viewStart, viewDuration, duration]);

  const zoomToFit = useCallback(() => {
    setZoom(1);
    setViewStart(0);
  }, []);

  const zoomToRegion = useCallback(() => {
    if (regionEnd <= regionStart) return;
    const regionLen = regionEnd - regionStart;
    const padding = regionLen * 0.1;
    const targetLen = regionLen + padding * 2;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, duration / targetLen));
    setZoom(newZoom);
    setViewStart(clampViewStart(regionStart - padding, duration, newZoom));
  }, [regionStart, regionEnd, duration]);

  return (
    <div ref={containerRef} className="flex-1 min-w-0 h-full relative flex flex-col">
      {/* Zoom controls bar */}
      <div className="flex items-center gap-1 px-2 py-0.5 bg-surface-50 border-b border-surface-300 shrink-0">
        <button className="btn-ghost px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 rounded" onClick={zoomIn} title="Zoom in (Ctrl+Scroll Up)">+</button>
        <button className="btn-ghost px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 rounded" onClick={zoomOut} title="Zoom out (Ctrl+Scroll Down)">&minus;</button>
        <button className="btn-ghost px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 rounded" onClick={zoomToFit} title="Fit whole track">Fit</button>
        {regionEnd > regionStart && (
          <button className="btn-ghost px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-200 rounded" onClick={zoomToRegion} title="Zoom to selection">Zoom to Sel</button>
        )}
        <span className="text-[9px] text-gray-600 ml-1">
          {zoom > 1 ? `${zoom.toFixed(1)}x` : '1x'}
          {' '}|{' '}
          {formatAudioTime(viewStart)} – {formatAudioTime(viewEnd)}
        </span>
        <span className="text-[9px] text-gray-600 ml-auto">
          Ctrl+Scroll: zoom | Scroll: pan | Middle-click drag: pan
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ width: size.width, height: size.height - 22 }}
          draggable={regionEnd > regionStart}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
          onDragStart={handleDragStart}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}

function clampViewStart(vs: number, duration: number, zoom: number): number {
  const viewDuration = duration / zoom;
  return Math.max(0, Math.min(duration - viewDuration, vs));
}

function getTimeInterval(viewDuration: number, targetLabels: number): number {
  const intervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const approx = viewDuration / Math.max(1, targetLabels);
  for (const iv of intervals) {
    if (iv >= approx) return iv;
  }
  return 300;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
