import { useState, useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { WaveformCanvas } from './WaveformCanvas';
import {
  decodeAudio,
  extractPeaks,
  cropAudioBuffer,
  audioBufferToWav,
  formatAudioTime,
} from '../../utils/audioUtils';

const NUM_PEAKS = 1200;

export function AudioCropper() {
  const project = useProjectStore((s) => s.project);
  const setMasterAudio = useProjectStore((s) => s.setMasterAudio);
  const setShotAudio = useProjectStore((s) => s.setShotAudio);
  const setAudioCropperOpen = useUIStore((s) => s.setAudioCropperOpen);
  const selectedShotId = useUIStore((s) => s.selectedShotId);
  const selectedSectionId = useUIStore((s) => s.selectedSectionId);

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [regionStart, setRegionStart] = useState(0);
  const [regionEnd, setRegionEnd] = useState(0);
  const [playheadTime, setPlayheadTime] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cropping, setCropping] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const animFrameRef = useRef(0);

  // Find selected shot to auto-suggest region
  const selectedShot = (() => {
    if (!project || !selectedSectionId || !selectedShotId) return null;
    const section = project.sections.find((s) => s.id === selectedSectionId);
    return section?.shots.find((sh) => sh.id === selectedShotId) || null;
  })();

  // Auto-position region when shot selection changes
  useEffect(() => {
    if (selectedShot && audioBuffer) {
      const start = Math.max(0, selectedShot.startTime);
      const end = Math.min(audioBuffer.duration, selectedShot.endTime);
      if (end > start) {
        setRegionStart(start);
        setRegionEnd(end);
      }
    }
  }, [selectedShotId, selectedSectionId]);

  // Load master audio if project already has one
  useEffect(() => {
    if (project?.masterAudio && !audioBuffer && !loading) {
      loadFromServer(project.masterAudio);
    }
  }, [project?.masterAudio]);

  const loadFromServer = async (filename: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audio/${encodeURIComponent(filename)}`);
      const arrayBuf = await res.arrayBuffer();
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(arrayBuf);
      audioCtxRef.current = ctx;
      setAudioBuffer(buffer);
      setPeaks(extractPeaks(buffer, NUM_PEAKS));
    } catch (e) {
      console.error('Failed to load master audio:', e);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      // Decode locally for waveform
      const buffer = await decodeAudio(file);
      setAudioBuffer(buffer);
      setPeaks(extractPeaks(buffer, NUM_PEAKS));

      // Upload to server and save as master
      const formData = new FormData();
      formData.append('audio', file);
      const res = await fetch('/api/audio/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        setMasterAudio(data.files[0].filename);
      }

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
    } catch (err) {
      console.error('Failed to load audio:', err);
    }
    setLoading(false);
    e.target.value = '';
  };

  const handleRegionChange = useCallback((start: number, end: number) => {
    setRegionStart(start);
    setRegionEnd(end);
  }, []);

  // Playback preview
  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    setIsPlaying(false);
    setPlayheadTime(null);
  }, []);

  const playRegion = useCallback(() => {
    if (!audioBuffer || regionEnd <= regionStart) return;
    stopPlayback();

    const ctx = audioCtxRef.current || new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const regionDuration = regionEnd - regionStart;
    source.start(0, regionStart, regionDuration);
    sourceRef.current = source;
    startTimeRef.current = ctx.currentTime;
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);
      setPlayheadTime(null);
      sourceRef.current = null;
    };

    const animate = () => {
      if (!sourceRef.current) return;
      const elapsed = ctx.currentTime - startTimeRef.current;
      setPlayheadTime(regionStart + elapsed);
      if (elapsed < regionDuration) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);
  }, [audioBuffer, regionStart, regionEnd, stopPlayback]);

  // Crop and assign to a specific shot
  const cropAndAssign = useCallback(
    async (sectionId: string, shotId: string, start: number, end: number) => {
      if (!audioBuffer) return;
      setCropping(true);
      try {
        const cropped = await cropAudioBuffer(audioBuffer, start, end);
        const wavBlob = audioBufferToWav(cropped);
        const formData = new FormData();
        formData.append('audio', wavBlob, `crop_${start.toFixed(2)}-${end.toFixed(2)}.wav`);
        const res = await fetch('/api/audio/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          setShotAudio(sectionId, shotId, data.files[0].filename);
        }
      } catch (err) {
        console.error('Crop failed:', err);
      }
      setCropping(false);
    },
    [audioBuffer, setShotAudio]
  );

  // Assign to currently selected shot
  const assignToSelected = useCallback(() => {
    if (!selectedSectionId || !selectedShotId) return;
    cropAndAssign(selectedSectionId, selectedShotId, regionStart, regionEnd);
  }, [selectedSectionId, selectedShotId, regionStart, regionEnd, cropAndAssign]);

  // Listen for audio-crop events dispatched from ShotCard drops
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.sectionId && detail?.shotId && detail?.regionStart != null && detail?.regionEnd != null) {
        cropAndAssign(detail.sectionId, detail.shotId, detail.regionStart, detail.regionEnd);
      }
    };
    window.addEventListener('assign-audio-crop', handler);
    return () => window.removeEventListener('assign-audio-crop', handler);
  }, [cropAndAssign]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const hasRegion = regionEnd > regionStart;
  const regionDuration = regionEnd - regionStart;

  return (
    <div className="h-full flex flex-col bg-surface-100">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-surface-300 shrink-0">
        <span className="text-xs font-semibold text-gray-300">Track</span>

        {!audioBuffer ? (
          <label className={`btn btn-primary text-[11px] cursor-pointer ${loading ? 'opacity-50' : ''}`}>
            {loading ? 'Loading...' : 'Load Audio'}
            <input
              type="file"
              accept=".wav,.mp3,.ogg,.flac"
              className="hidden"
              onChange={handleFileUpload}
              disabled={loading}
            />
          </label>
        ) : (
          <>
            <span className="text-[10px] text-gray-500">
              {formatAudioTime(audioBuffer.duration)} total
              {audioBuffer.numberOfChannels > 1 ? ' | stereo' : ' | mono'}
              {' | '}{audioBuffer.sampleRate}Hz
            </span>

            <div className="w-px h-5 bg-surface-400" />

            {/* Playback controls */}
            <button
              className={`btn text-[11px] ${isPlaying ? 'btn-primary' : 'btn-ghost'}`}
              onClick={isPlaying ? stopPlayback : playRegion}
              disabled={!hasRegion}
              title={isPlaying ? 'Stop preview' : 'Preview selection'}
            >
              {isPlaying ? 'Stop' : 'Play'}
            </button>

            {hasRegion && (
              <span className="text-[10px] text-crimson-400">
                {formatAudioTime(regionStart)} – {formatAudioTime(regionEnd)}
                {' '}({regionDuration.toFixed(2)}s)
              </span>
            )}

            <div className="w-px h-5 bg-surface-400" />

            <button
              className="btn btn-primary text-[11px]"
              disabled={!hasRegion || !selectedShotId || cropping}
              onClick={assignToSelected}
              title="Crop and assign to selected shot"
            >
              {cropping ? 'Cropping...' : 'Assign to Shot'}
            </button>

            {hasRegion && (
              <span className="text-[10px] text-gray-500">
                or drag selection onto a shot card
              </span>
            )}

            <div className="flex-1" />

            <label className="btn btn-ghost text-[11px] cursor-pointer">
              Replace
              <input
                type="file"
                accept=".wav,.mp3,.ogg,.flac"
                className="hidden"
                onChange={handleFileUpload}
                disabled={loading}
              />
            </label>
          </>
        )}

        <div className="flex-1" />

        <button
          className="text-gray-500 hover:text-gray-300 text-xs"
          onClick={() => setAudioCropperOpen(false)}
        >
          Close
        </button>
      </div>

      {/* Waveform or empty state */}
      <div className="flex-1 overflow-hidden">
        {audioBuffer && peaks.length > 0 ? (
          <WaveformCanvas
            peaks={peaks}
            duration={audioBuffer.duration}
            regionStart={regionStart}
            regionEnd={regionEnd}
            playheadTime={playheadTime}
            onRegionChange={handleRegionChange}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-600 text-sm">
            {loading ? 'Decoding audio...' : 'Upload a full track to get started'}
          </div>
        )}
      </div>
    </div>
  );
}
