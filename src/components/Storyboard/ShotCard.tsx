import { useState, useRef, useCallback } from 'react';
import type { Shot } from '../../types/project';
import { useUIStore } from '../../stores/uiStore';
import { formatTimestamp, formatDuration } from '../../utils/time';
import { api } from '../../utils/api';

const TYPE_BADGES = {
  solo: { label: 'SOLO', className: 'badge-solo' },
  multi: { label: 'MULTI', className: 'badge-multi' },
} as const;

interface Props {
  shot: Shot;
  sectionId: string;
}

export function ShotCard({ shot, sectionId }: Props) {
  const selectedShotId = useUIStore((s) => s.selectedShotId);
  const selectShot = useUIStore((s) => s.selectShot);
  const isSelected = selectedShotId === shot.id;

  const badge = TYPE_BADGES[shot.type];
  const duration = shot.endTime - shot.startTime;

  const selectedImage = shot.refImages.find((i) => i.id === shot.selectedRefImageId);
  const hasImage = shot.refImages.length > 0;
  const hasEndImage = (shot.endRefImages || []).length > 0;
  const hasAudio = !!shot.audioFile;
  const hasPrompt = !!shot.prompt;
  const hasTakes = shot.takes && shot.takes.length > 0;
  const hasVideo = shot.type === 'multi' && hasTakes
    ? shot.takes!.every((c) => (c.videoFiles?.length ?? 0) > 0)
    : (shot.videoFiles?.length ?? 0) > 0;
  const isApproved = !!shot.approved;

  // Get the selected video path for this shot (or first cut's video for rapid_cut)
  const shotVideoPath = (shot.videoFiles?.length ?? 0) > 0
    ? shot.videoFiles![shot.selectedVideoIdx ?? shot.videoFiles!.length - 1]?.path
    : shot.type === 'multi' && shot.takes?.length
      ? (() => {
          const firstCutWithVideo = shot.takes.find((c) => (c.videoFiles?.length ?? 0) > 0);
          if (!firstCutWithVideo) return undefined;
          const vf = firstCutWithVideo.videoFiles!;
          return vf[firstCutWithVideo.selectedVideoIdx ?? vf.length - 1]?.path;
        })()
      : undefined;

  // Video preview state
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [hoveredTakeId, setHoveredCutId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // For held/visual shots: hover thumbnail to preview
  const handleThumbEnter = useCallback(() => {
    if (shot.type !== 'multi' && shotVideoPath) {
      setPreviewVideoUrl(api.getVideoUrl(shotVideoPath));
      // If video is already showing (no image fallback), just play it
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [shot.type, shotVideoPath]);

  const handleThumbLeave = useCallback(() => {
    if (shot.type !== 'multi') {
      setPreviewVideoUrl(null);
      // Pause and reset the static video fallback if it exists
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [shot.type]);

  // For rapid_cut: hover cut tag to preview that cut's selected video version
  const handleTakeEnter = useCallback((cutId: string, videoPath?: string) => {
    setHoveredCutId(cutId);
    if (videoPath) {
      setPreviewVideoUrl(api.getVideoUrl(videoPath));
    }
  }, []);

  const handleTakeLeave = useCallback(() => {
    setHoveredCutId(null);
    setPreviewVideoUrl(null);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const mediaType = e.dataTransfer.getData('media-type');
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      if (mediaType === 'audio-crop' && parsed.regionStart != null && parsed.regionEnd != null) {
        window.dispatchEvent(new CustomEvent('assign-audio-crop', {
          detail: { sectionId, shotId: shot.id, regionStart: parsed.regionStart, regionEnd: parsed.regionEnd },
        }));
      } else if (mediaType === 'audio' && parsed.audioFilename) {
        window.dispatchEvent(new CustomEvent('assign-audio', {
          detail: { sectionId, shotId: shot.id, audioFilename: parsed.audioFilename },
        }));
      } else {
        window.dispatchEvent(new CustomEvent('assign-image', {
          detail: { sectionId, shotId: shot.id, image: parsed },
        }));
      }
    } catch {}
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Find the image to show for a hovered cut (its selected ref image)
  const hoveredTake = hoveredTakeId ? shot.takes?.find((c) => c.id === hoveredTakeId) : null;
  const hoveredTakeImage = hoveredTake
    ? hoveredTake.refImages.find((i) => i.id === hoveredTake.selectedRefImageId)
    : null;

  // Determine what to show in the thumbnail: video preview > hovered cut image > selected shot image
  const showVideo = !!previewVideoUrl;
  const displayImage = hoveredTakeImage || selectedImage;

  return (
    <div
      className={`shot-card ${isSelected ? 'selected' : ''}`}
      onClick={() => selectShot(sectionId, shot.id)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Thumbnail */}
      <div
        className="aspect-video bg-surface-50 rounded mb-2 overflow-hidden flex items-center justify-center relative"
        onMouseEnter={handleThumbEnter}
        onMouseLeave={handleThumbLeave}
      >
        {showVideo ? (
          <video
            ref={videoRef}
            src={previewVideoUrl!}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : displayImage ? (
          <img
            src={api.getThumbUrl(displayImage.filename)}
            alt={shot.name}
            className="w-full h-full object-cover"
          />
        ) : shotVideoPath ? (
          <video
            ref={videoRef}
            src={api.getVideoUrl(shotVideoPath)}
            muted
            loop
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-gray-600 text-xs text-center px-2">
            {shot.type === 'solo' ? 'Drop image or audio' : `${shot.takes?.length || 0} takes`}
          </div>
        )}

        {/* Play indicator for held/visual shots with video */}
        {shot.type !== 'multi' && shotVideoPath && !showVideo && (
          <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5">
            <span className="text-[9px] text-green-400">&#9654; VID</span>
          </div>
        )}
      </div>

      {/* Take tags for rapid_cut shots */}
      {hasTakes && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {shot.takes!.map((take) => {
            const takeVf = take.videoFiles || [];
            const takeHasVideo = takeVf.length > 0;
            const takeVideoPath = takeHasVideo
              ? takeVf[take.selectedVideoIdx ?? takeVf.length - 1]?.path
              : undefined;
            const isHovered = hoveredTakeId === take.id;
            return (
              <span
                key={take.id}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium cursor-default transition-colors
                  ${isHovered
                    ? 'bg-crimson-500/30 text-crimson-300 ring-1 ring-crimson-500/50'
                    : takeHasVideo
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-surface-300 text-gray-500'
                  }`}
                onMouseEnter={() => handleTakeEnter(take.id, takeVideoPath)}
                onMouseLeave={handleTakeLeave}
              >
                <span
                  className={`w-1 h-1 rounded-full ${takeHasVideo ? 'bg-green-500' : 'bg-surface-500'}`}
                />
                {take.label}
                {takeVf.length > 1 && (
                  <span className="text-[8px] opacity-60">v{(take.selectedVideoIdx ?? takeVf.length - 1) + 1}</span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <h3 className="text-xs font-semibold text-gray-200 leading-tight truncate flex-1">
          {shot.name}
        </h3>
        <span className={`badge ${badge.className} shrink-0`}>
          {badge.label}
        </span>
      </div>

      {/* Time */}
      <div className="text-[10px] text-gray-500 mb-1">
        {formatTimestamp(shot.startTime)} – {formatTimestamp(shot.endTime)} ({formatDuration(duration)})
      </div>

      {/* Lyric snippet */}
      {shot.lyric && (
        <p className="text-[11px] text-gray-400 italic truncate mb-1.5">
          "{shot.lyric}"
        </p>
      )}

      {/* Status dots */}
      <div className="flex items-center gap-2 mt-auto">
        <StatusDot active={hasImage} label="IMG" />
        <StatusDot active={hasEndImage} label="END" />
        <StatusDot active={hasAudio} label="AUD" />
        <StatusDot active={hasPrompt} label="LTX" />
        <StatusDot active={hasVideo} label="VID" />
        <StatusDot active={isApproved} label="OK" color="amber" />
      </div>
    </div>
  );
}

function StatusDot({ active, label, color = 'green' }: { active: boolean; label: string; color?: 'green' | 'amber' }) {
  const activeColor = color === 'amber' ? 'bg-amber-500' : 'bg-green-500';
  return (
    <span className="flex items-center gap-0.5">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active ? activeColor : 'bg-surface-500'
        }`}
      />
      <span className="text-[10px] text-gray-500">{label}</span>
    </span>
  );
}
