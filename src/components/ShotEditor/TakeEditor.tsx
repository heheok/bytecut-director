import { useState } from 'react';
import type { Take } from '../../types/project';
import { useProjectStore } from '../../stores/projectStore';
import { api } from '../../utils/api';

interface Props {
  take: Take;
  sectionId: string;
  shotId: string;
}

export function TakeEditor({ take, sectionId, shotId }: Props) {
  const updateTake = useProjectStore((s) => s.updateTake);
  const addRefImageToTake = useProjectStore((s) => s.addRefImageToTake);
  const removeRefImageFromTake = useProjectStore((s) => s.removeRefImageFromTake);
  const setSelectedRefImageForTake = useProjectStore((s) => s.setSelectedRefImageForTake);
  const addEndRefImageToTake = useProjectStore((s) => s.addEndRefImageToTake);
  const removeEndRefImageFromTake = useProjectStore((s) => s.removeEndRefImageFromTake);
  const setSelectedEndRefImageForTake = useProjectStore((s) => s.setSelectedEndRefImageForTake);
  const removeTake = useProjectStore((s) => s.removeTake);
  const removeTakeVideo = useProjectStore((s) => s.removeTakeVideo);
  const setTakeVideoIdx = useProjectStore((s) => s.setTakeVideoIdx);
  const [expanded, setExpanded] = useState(false);
  const [endImagesOpen, setEndImagesOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      try {
        const imageData = JSON.parse(data);
        addRefImageToTake(sectionId, shotId, take.id, imageData);
      } catch {}
    }
  };

  const handleEndImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      try {
        const imageData = JSON.parse(data);
        addEndRefImageToTake(sectionId, shotId, take.id, imageData);
      } catch {}
    }
  };

  return (
    <div className="bg-surface-200 border border-surface-400 rounded-md overflow-hidden">
      {/* Collapsed header — always visible */}
      <div className="flex items-center">
        <button
          className="flex-1 flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface-300 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-[10px] text-gray-500 shrink-0">
            {expanded ? '\u25BC' : '\u25B6'}
          </span>
          <span className="text-xs font-semibold text-amber-400 shrink-0">{take.label}</span>
          <span className="text-[10px] text-gray-600 truncate flex-1">{take.concept}</span>
          {take.refImages.length > 0 && (
            <span className="text-[9px] text-gray-500 shrink-0">{take.refImages.length} img</span>
          )}
        </button>
        <button
          className={`px-1.5 text-[10px] shrink-0 ${
            take.approved
              ? 'text-amber-400 hover:text-amber-300 font-semibold'
              : 'text-gray-600 hover:text-amber-400'
          }`}
          onClick={() => updateTake(sectionId, shotId, take.id, { approved: !take.approved })}
          title={take.approved ? 'Approved' : 'Approve'}
        >
          {take.approved ? 'OK' : '~'}
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1 px-1.5 shrink-0">
            <button
              className="text-[10px] text-red-400 hover:text-red-300 font-semibold"
              onClick={() => removeTake(sectionId, shotId, take.id)}
            >
              Yes
            </button>
            <button
              className="text-[10px] text-gray-500 hover:text-gray-300"
              onClick={() => setConfirmDelete(false)}
            >
              No
            </button>
          </div>
        ) : (
          <button
            className="px-1.5 text-[10px] text-gray-600 hover:text-red-400 shrink-0"
            onClick={() => setConfirmDelete(true)}
            title="Delete take"
          >
            x
          </button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-2.5 border-t border-surface-400">
          {/* Label */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">
              Label
            </label>
            <input
              className="input w-full text-xs"
              value={take.label}
              onChange={(e) =>
                updateTake(sectionId, shotId, take.id, { label: e.target.value })
              }
            />
          </div>

          {/* Concept */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">
              Concept
            </label>
            <textarea
              className="textarea w-full text-xs h-14"
              value={take.concept}
              onChange={(e) =>
                updateTake(sectionId, shotId, take.id, { concept: e.target.value })
              }
            />
          </div>

          {/* Ref Image Prompt — full, editable */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">
              Ref Image Prompt
            </label>
            <textarea
              className="textarea w-full text-xs h-20"
              value={take.refImagePrompt}
              onChange={(e) =>
                updateTake(sectionId, shotId, take.id, { refImagePrompt: e.target.value })
              }
              placeholder="Reference image prompt for this take..."
            />
          </div>

          {/* Take ref images */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">
              Reference Images ({take.refImages.length})
            </label>
            <div
              className="border border-dashed border-surface-500 rounded p-1.5 min-h-[48px]"
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
            >
              {take.refImages.length === 0 ? (
                <p className="text-[10px] text-gray-600 text-center py-2">
                  Drag images here from Image Manager
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {take.refImages.map((img) => (
                    <div
                      key={img.id}
                      className={`relative cursor-pointer rounded overflow-hidden border-2 ${
                        img.id === take.selectedRefImageId
                          ? 'border-crimson-500'
                          : 'border-transparent hover:border-surface-500'
                      }`}
                      onClick={() =>
                        setSelectedRefImageForTake(sectionId, shotId, take.id, img.id)
                      }
                    >
                      <img
                        src={api.getThumbUrl(img.filename)}
                        alt=""
                        className="aspect-video object-cover w-full"
                      />
                      <button
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white
                                   text-[10px] rounded-full flex items-center justify-center
                                   hover:bg-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRefImageFromTake(sectionId, shotId, take.id, img.id);
                        }}
                      >
                        x
                      </button>
                      {img.id === take.selectedRefImageId && (
                        <div className="absolute bottom-0 left-0 right-0 bg-crimson-500/80 text-white text-[8px] text-center py-0.5">
                          SELECTED
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Take end ref images (collapsible) */}
          <div>
            <button
              className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide hover:text-gray-400"
              onClick={() => setEndImagesOpen(!endImagesOpen)}
            >
              <span className="text-[9px]">{endImagesOpen ? '\u25BC' : '\u25B6'}</span>
              End Reference Images ({(take.endRefImages || []).length})
            </button>
            {endImagesOpen && (
              <div
                className="border border-dashed border-surface-500 rounded p-1.5 min-h-[48px]"
                onDrop={handleEndImageDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
              >
                {(take.endRefImages || []).length === 0 ? (
                  <p className="text-[10px] text-gray-600 text-center py-2">
                    Drag images here for end frame
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {(take.endRefImages || []).map((img) => (
                      <div
                        key={img.id}
                        className={`relative cursor-pointer rounded overflow-hidden border-2 ${
                          img.id === take.selectedEndRefImageId
                            ? 'border-crimson-500'
                            : 'border-transparent hover:border-surface-500'
                        }`}
                        onClick={() =>
                          setSelectedEndRefImageForTake(sectionId, shotId, take.id, img.id)
                        }
                      >
                        <img
                          src={api.getThumbUrl(img.filename)}
                          alt=""
                          className="aspect-video object-cover w-full"
                        />
                        <button
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 text-white
                                     text-[10px] rounded-full flex items-center justify-center
                                     hover:bg-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEndRefImageFromTake(sectionId, shotId, take.id, img.id);
                          }}
                        >
                          x
                        </button>
                        {img.id === take.selectedEndRefImageId && (
                          <div className="absolute bottom-0 left-0 right-0 bg-crimson-500/80 text-white text-[8px] text-center py-0.5">
                            SELECTED
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Generated Video */}
          {(take.videoFiles?.length ?? 0) > 0 && (() => {
            const vf = take.videoFiles!;
            const idx = take.selectedVideoIdx ?? vf.length - 1;
            const current = vf[idx];
            return (
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">
                  Generated Video ({vf.length} version{vf.length > 1 ? 's' : ''})
                </label>
                {current && (
                  <>
                    <video
                      key={current.path}
                      controls
                      className="w-full rounded border border-surface-500"
                      src={api.getVideoUrl(current.path)}
                    />
                    <div className="flex items-center gap-2 mt-1">
                      {vf.length > 1 && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            className="text-[10px] text-gray-500 hover:text-white disabled:opacity-30 px-0.5"
                            disabled={idx <= 0}
                            onClick={() => setTakeVideoIdx(sectionId, shotId, take.id, idx - 1)}
                          >
                            &larr;
                          </button>
                          <span className="text-[9px] text-gray-500 tabular-nums">
                            v{idx + 1}/{vf.length}
                          </span>
                          <button
                            className="text-[10px] text-gray-500 hover:text-white disabled:opacity-30 px-0.5"
                            disabled={idx >= vf.length - 1}
                            onClick={() => setTakeVideoIdx(sectionId, shotId, take.id, idx + 1)}
                          >
                            &rarr;
                          </button>
                        </div>
                      )}
                      <span className="text-[9px] text-gray-600 truncate flex-1">
                        {current.path.split(/[/\\]/).pop()}
                      </span>
                      <button
                        className="text-[10px] text-red-400 hover:text-red-300"
                        onClick={() => removeTakeVideo(sectionId, shotId, take.id, idx)}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
