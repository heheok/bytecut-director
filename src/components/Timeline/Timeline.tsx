import { useRef, useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { formatTimestamp } from '../../utils/time';
import { api } from '../../utils/api';

const DEFAULT_H_ZOOM = 8;
const DEFAULT_V_ZOOM = 56;
const MIN_H_ZOOM = 3;
const MAX_H_ZOOM = 50;
const MIN_V_ZOOM = 32;
const MAX_V_ZOOM = 280;
const SECTION_GAP = 6;
const LABEL_HEIGHT = 16;
const LEFT_PAD = 200; // px before 0:00 mark

const SECTION_COLOR_PALETTE = [
  'bg-emerald-900/40 border-emerald-700/40',
  'bg-blue-900/40 border-blue-700/40',
  'bg-purple-900/40 border-purple-700/40',
  'bg-crimson-700/40 border-crimson-600/40',
  'bg-amber-900/40 border-amber-700/40',
  'bg-cyan-900/40 border-cyan-700/40',
  'bg-rose-900/40 border-rose-700/40',
  'bg-indigo-900/40 border-indigo-700/40',
  'bg-teal-900/40 border-teal-700/40',
  'bg-gray-800/40 border-gray-600/40',
];

function getSectionColor(index: number): string {
  return SECTION_COLOR_PALETTE[index % SECTION_COLOR_PALETTE.length];
}

const SHOT_TYPE_COLORS = {
  solo: 'bg-blue-800/60 border-blue-600/60 hover:bg-blue-700/60',
  multi: 'bg-amber-800/60 border-amber-600/60 hover:bg-amber-700/60',
};

export function Timeline() {
  const project = useProjectStore((s) => s.project);
  const selectedShotId = useUIStore((s) => s.selectedShotId);
  const selectShot = useUIStore((s) => s.selectShot);
  const [hZoom, setHZoom] = useState(DEFAULT_H_ZOOM);
  const [vZoom, setVZoom] = useState(DEFAULT_V_ZOOM);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Track Space key for space+drag panning
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle mouse button OR space+left click
      if (e.button === 1 || (e.button === 0 && spaceHeld)) {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        isPanning.current = true;
        setDragging(true);
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: container.scrollLeft,
          scrollTop: container.scrollTop,
        };
      }
    },
    [spaceHeld]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const container = containerRef.current;
    if (!container) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    container.scrollLeft = panStart.current.scrollLeft - dx;
    container.scrollTop = panStart.current.scrollTop - dy;
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    setDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setHZoom((z) =>
          Math.min(MAX_H_ZOOM, Math.max(MIN_H_ZOOM, z - e.deltaY * 0.05))
        );
      } else if (e.shiftKey) {
        e.preventDefault();
        setVZoom((z) =>
          Math.min(MAX_V_ZOOM, Math.max(MIN_V_ZOOM, z - e.deltaY * 0.3))
        );
      }
    },
    []
  );

  if (!project) return null;

  const totalDuration = Math.max(
    ...project.sections.flatMap((s) => s.shots.map((sh) => sh.endTime)),
    231
  );
  const totalWidth = totalDuration * hZoom + LEFT_PAD + 200;

  // Time markers — adapt spacing to zoom level
  const markerInterval = hZoom >= 20 ? 5 : hZoom >= 10 ? 10 : 15;
  const markers: number[] = [];
  for (let t = 0; t <= totalDuration; t += markerInterval) {
    markers.push(t);
  }

  // At what vertical size do we show images as backgrounds
  const showImageBg = vZoom >= 80;
  const showLabels = vZoom >= 44;
  const showLyrics = vZoom >= 100;

  const totalHeight =
    32 +
    project.sections.length * (vZoom + SECTION_GAP + LABEL_HEIGHT) +
    40;

  return (
    <div className="h-full flex flex-col" onWheel={handleWheel}>
      {/* Zoom controls */}
      <div className="flex items-center gap-4 px-4 py-2 bg-surface-100 border-b border-surface-300 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-6">H</span>
          <input
            type="range"
            min={MIN_H_ZOOM}
            max={MAX_H_ZOOM}
            step={0.5}
            value={hZoom}
            onChange={(e) => setHZoom(Number(e.target.value))}
            className="w-28"
          />
          <span className="text-[10px] text-gray-500 w-14">{hZoom.toFixed(0)}px/s</span>
        </div>

        <div className="w-px h-4 bg-surface-400" />

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-6">V</span>
          <input
            type="range"
            min={MIN_V_ZOOM}
            max={MAX_V_ZOOM}
            step={1}
            value={vZoom}
            onChange={(e) => setVZoom(Number(e.target.value))}
            className="w-28"
          />
          <span className="text-[10px] text-gray-500 w-14">{vZoom}px</span>
        </div>

        <div className="w-px h-4 bg-surface-400" />

        <span className="text-[10px] text-gray-600">
          Ctrl+Scroll = H zoom | Shift+Scroll = V zoom | Space+Drag or Middle-click = Pan
        </span>
      </div>

      <div
        ref={containerRef}
        className={`flex-1 overflow-auto ${spaceHeld || dragging ? 'cursor-grab' : ''} ${dragging ? '!cursor-grabbing select-none' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{ width: totalWidth, height: totalHeight }}
          className="relative p-4"
        >
          {/* Time ruler */}
          <div className="h-6 relative mb-2 sticky top-0 z-20 bg-surface-50/80 backdrop-blur-sm">
            {markers.map((t) => (
              <div
                key={t}
                className="absolute top-0 text-[10px] text-gray-600"
                style={{ left: LEFT_PAD + t * hZoom }}
              >
                <div className="h-3 border-l border-surface-400" />
                {formatTimestamp(t)}
              </div>
            ))}
          </div>

          {/* Section lanes */}
          {project.sections.map((section, idx) => {
            const sectionColor = getSectionColor(idx);
            const top =
              32 + idx * (vZoom + SECTION_GAP + LABEL_HEIGHT);

            return (
              <div key={section.id}>
                {/* Section label */}
                <div
                  className="absolute text-[10px] font-bold text-gray-400 tracking-wider flex items-center gap-2"
                  style={{ top, left: 4 }}
                >
                  {section.name}
                  <span className="text-[9px] font-normal text-gray-600">
                    {section.shots.length} shots
                  </span>
                </div>

                {/* Section background bar */}
                {section.startTime > 0 && (
                  <div
                    className={`absolute rounded border ${sectionColor} opacity-20`}
                    style={{
                      left: LEFT_PAD + section.startTime * hZoom,
                      width: Math.max(
                        (section.endTime - section.startTime) * hZoom,
                        20
                      ),
                      top: top + LABEL_HEIGHT,
                      height: vZoom,
                    }}
                  />
                )}

                {/* Shot blocks */}
                {section.shots.map((shot) => {
                  const isSelected = selectedShotId === shot.id;
                  const shotColor = SHOT_TYPE_COLORS[shot.type];
                  const shotWidth = Math.max(
                    (shot.endTime - shot.startTime) * hZoom,
                    16
                  );
                  const shotHeight = vZoom - 4;
                  const selectedImage = shot.refImages.find(
                    (i) => i.id === shot.selectedRefImageId
                  );

                  return (
                    <div
                      key={shot.id}
                      className={`absolute rounded border cursor-pointer transition-all overflow-hidden
                        ${shotColor} ${isSelected ? 'ring-2 ring-crimson-500 z-10' : ''}`}
                      style={{
                        left: LEFT_PAD + shot.startTime * hZoom,
                        width: shotWidth,
                        top: top + LABEL_HEIGHT + 2,
                        height: shotHeight,
                      }}
                      onClick={() => selectShot(section.id, shot.id)}
                      title={`${shot.name}\n${formatTimestamp(shot.startTime)} – ${formatTimestamp(shot.endTime)}`}
                    >
                      {/* Background image when zoomed in */}
                      {showImageBg && selectedImage && (
                        <img
                          src={api.getThumbUrl(selectedImage.filename)}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-50"
                          loading="lazy"
                        />
                      )}

                      {/* Content overlay */}
                      <div className="relative h-full flex flex-col justify-end p-1 overflow-hidden">
                        {/* Small thumbnail (when NOT using bg image) */}
                        {!showImageBg && selectedImage && shotWidth > 30 && (
                          <div className="flex items-center h-full px-0.5 gap-1">
                            <img
                              src={api.getThumbUrl(selectedImage.filename)}
                              alt=""
                              className="h-6 w-6 object-cover rounded shrink-0"
                              loading="lazy"
                            />
                            {showLabels && shotWidth > 60 && (
                              <span className="text-[9px] font-semibold text-gray-200 truncate">
                                {shot.name}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Labels on image bg */}
                        {showImageBg && (
                          <div className="mt-auto bg-black/60 -mx-1 -mb-1 px-1.5 py-0.5 backdrop-blur-sm">
                            {showLabels && (
                              <div className="text-[10px] font-semibold text-gray-100 truncate">
                                {shot.name}
                              </div>
                            )}
                            <div className="text-[9px] text-gray-300">
                              {formatTimestamp(shot.startTime)} – {formatTimestamp(shot.endTime)}
                            </div>
                            {showLyrics && shot.lyric && (
                              <div className="text-[9px] text-gray-400 italic truncate">
                                "{shot.lyric}"
                              </div>
                            )}
                          </div>
                        )}

                        {/* Label only (no image, not bg mode) */}
                        {!showImageBg && !selectedImage && showLabels && shotWidth > 40 && (
                          <div className="flex items-center h-full px-0.5">
                            <span className="text-[9px] font-semibold text-gray-200 truncate">
                              {shot.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
