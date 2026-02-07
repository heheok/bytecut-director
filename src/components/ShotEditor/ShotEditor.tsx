import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { formatTimestamp, formatDuration } from '../../utils/time';
import { api } from '../../utils/api';
import { TakeEditor } from './TakeEditor';
import { ParamsEditor } from './ParamsEditor';
import { MiniWaveform } from './MiniWaveform';
import { useState } from 'react';

type Tab = 'details' | 'params';

export function ShotEditor() {
  const project = useProjectStore((s) => s.project);
  const updateShot = useProjectStore((s) => s.updateShot);
  const removeShot = useProjectStore((s) => s.removeShot);
  const duplicateShot = useProjectStore((s) => s.duplicateShot);
  const addShot = useProjectStore((s) => s.addShot);
  const addRefImageToShot = useProjectStore((s) => s.addRefImageToShot);
  const removeRefImageFromShot = useProjectStore((s) => s.removeRefImageFromShot);
  const setSelectedRefImage = useProjectStore((s) => s.setSelectedRefImage);
  const addEndRefImageToShot = useProjectStore((s) => s.addEndRefImageToShot);
  const removeEndRefImageFromShot = useProjectStore((s) => s.removeEndRefImageFromShot);
  const setSelectedEndRefImage = useProjectStore((s) => s.setSelectedEndRefImage);
  const setShotAudio = useProjectStore((s) => s.setShotAudio);
  const removeShotVideo = useProjectStore((s) => s.removeShotVideo);
  const setShotVideoIdx = useProjectStore((s) => s.setShotVideoIdx);
  const addTake = useProjectStore((s) => s.addTake);
  const selectedShotId = useUIStore((s) => s.selectedShotId);
  const selectedSectionId = useUIStore((s) => s.selectedSectionId);
  const selectShot = useUIStore((s) => s.selectShot);
  const [tab, setTab] = useState<Tab>('details');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [endImagesOpen, setEndImagesOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(true);

  if (!project || !selectedShotId || !selectedSectionId) return null;

  const section = project.sections.find((s) => s.id === selectedSectionId);
  const shot = section?.shots.find((s) => s.id === selectedShotId);
  if (!section || !shot) return null;

  const duration = shot.endTime - shot.startTime;
  const selectedImage = shot.refImages.find((i) => i.id === shot.selectedRefImageId);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const mediaType = e.dataTransfer.getData('media-type');
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      if (mediaType === 'audio' && parsed.audioFilename) {
        setShotAudio(selectedSectionId, selectedShotId, parsed.audioFilename);
      } else {
        addRefImageToShot(selectedSectionId, selectedShotId, parsed);
      }
    } catch {}
  };

  const handleEndImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      addEndRefImageToShot(selectedSectionId, selectedShotId, parsed);
    } catch {}
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('audio', file);
    try {
      const res = await fetch('/api/audio/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.files?.[0]) {
        setShotAudio(selectedSectionId, selectedShotId, data.files[0].filename);
      }
    } catch {}
    e.target.value = '';
  };

  return (
    <div className="h-full flex flex-col bg-surface-100">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-300 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-gray-200">{shot.name}</h2>
          <button
            className="text-gray-500 hover:text-gray-300 text-xs"
            onClick={() => selectShot(null, null)}
          >
            Close
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-2">
          <span className={`badge ${shot.type === 'solo' ? 'badge-solo' : 'badge-multi'}`}>
            {shot.type === 'solo' ? 'SOLO' : 'MULTI'}
          </span>
          <span>{formatTimestamp(shot.startTime)} – {formatTimestamp(shot.endTime)}</span>
          <span>({formatDuration(duration)})</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            className="btn btn-ghost text-[10px] py-0.5"
            onClick={() => addShot(selectedSectionId, selectedShotId)}
          >
            + Insert After
          </button>
          <button
            className="btn btn-ghost text-[10px] py-0.5"
            onClick={() => {
              duplicateShot(selectedSectionId, selectedShotId);
            }}
          >
            Duplicate
          </button>
          <button
            className={`btn text-[10px] py-0.5 ${
              shot.approved
                ? 'bg-amber-600 text-white hover:bg-amber-500'
                : 'btn-ghost text-amber-400 hover:text-amber-300'
            }`}
            onClick={() =>
              updateShot(selectedSectionId, selectedShotId, { approved: !shot.approved })
            }
          >
            {shot.approved ? 'Approved' : 'Approve'}
          </button>
          <div className="flex-1" />
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-red-400">Delete?</span>
              <button
                className="btn text-[10px] py-0.5 bg-red-700 text-white hover:bg-red-600"
                onClick={() => {
                  removeShot(selectedSectionId, selectedShotId);
                  selectShot(null, null);
                  setConfirmDelete(false);
                }}
              >
                Yes
              </button>
              <button
                className="btn btn-ghost text-[10px] py-0.5"
                onClick={() => setConfirmDelete(false)}
              >
                No
              </button>
            </div>
          ) : (
            <button
              className="btn btn-ghost text-[10px] py-0.5 text-red-400 hover:text-red-300"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-300 shrink-0">
        <button
          className={`px-4 py-2 text-xs font-medium ${
            tab === 'details'
              ? 'text-crimson-400 border-b-2 border-crimson-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setTab('details')}
        >
          Details
        </button>
        <button
          className={`px-4 py-2 text-xs font-medium ${
            tab === 'params'
              ? 'text-crimson-400 border-b-2 border-crimson-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setTab('params')}
        >
          LTX Params
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'details' ? (
          <div className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                Name
              </label>
              <input
                className="input w-full"
                value={shot.name}
                onChange={(e) =>
                  updateShot(selectedSectionId, selectedShotId, { name: e.target.value })
                }
              />
            </div>

            {/* Type + Timing row */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                  Type
                </label>
                <select
                  className="input w-full"
                  value={shot.type}
                  onChange={(e) =>
                    updateShot(selectedSectionId, selectedShotId, {
                      type: e.target.value as 'solo' | 'multi',
                    })
                  }
                >
                  <option value="solo">SOLO</option>
                  <option value="multi">MULTI</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                  Start
                </label>
                <input
                  className="input w-full"
                  type="number"
                  step="0.01"
                  value={shot.startTime}
                  onChange={(e) =>
                    updateShot(selectedSectionId, selectedShotId, {
                      startTime: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                  End
                </label>
                <input
                  className="input w-full"
                  type="number"
                  step="0.01"
                  value={shot.endTime}
                  onChange={(e) =>
                    updateShot(selectedSectionId, selectedShotId, {
                      endTime: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            {/* Concept */}
            {shot.concept && (
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                  Concept
                </label>
                <p className="text-xs text-gray-300">{shot.concept}</p>
              </div>
            )}

            {/* Lyric */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                Lyric
              </label>
              <input
                className="input w-full"
                value={shot.lyric}
                onChange={(e) =>
                  updateShot(selectedSectionId, selectedShotId, { lyric: e.target.value })
                }
              />
            </div>

            {/* LTX-2 Video Prompt */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                LTX-2 Video Prompt
              </label>
              <textarea
                className="textarea w-full h-28"
                value={shot.prompt}
                onChange={(e) =>
                  updateShot(selectedSectionId, selectedShotId, { prompt: e.target.value })
                }
                placeholder="LTX-2 video generation prompt..."
              />
            </div>

            {/* Ref Image Prompt */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                Ref Image Prompt (Flux/SDXL)
              </label>
              <textarea
                className="textarea w-full h-24"
                value={shot.refImagePrompt}
                onChange={(e) =>
                  updateShot(selectedSectionId, selectedShotId, {
                    refImagePrompt: e.target.value,
                  })
                }
                placeholder="Reference image generation prompt..."
              />
            </div>

            {/* Reference Images */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                Reference Images ({shot.refImages.length})
              </label>
              <div
                className="border border-dashed border-surface-400 rounded-lg p-3 min-h-[80px]"
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
              >
                {shot.refImages.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">
                    Drag images here from the Image Manager
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {shot.refImages.map((img) => (
                      <div
                        key={img.id}
                        className={`relative cursor-pointer rounded overflow-hidden border-2 ${
                          img.id === shot.selectedRefImageId
                            ? 'border-crimson-500'
                            : 'border-transparent hover:border-surface-500'
                        }`}
                        onClick={() =>
                          setSelectedRefImage(selectedSectionId, selectedShotId, img.id)
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
                            removeRefImageFromShot(selectedSectionId, selectedShotId, img.id);
                          }}
                        >
                          x
                        </button>
                        {img.id === shot.selectedRefImageId && (
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

            {/* End Reference Images (collapsible) */}
            <div>
              <button
                className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide hover:text-gray-300"
                onClick={() => setEndImagesOpen(!endImagesOpen)}
              >
                <span className="text-[10px]">{endImagesOpen ? '\u25BC' : '\u25B6'}</span>
                End Reference Images ({(shot.endRefImages || []).length})
              </button>
              {endImagesOpen && (
                <div
                  className="border border-dashed border-surface-400 rounded-lg p-3 min-h-[80px]"
                  onDrop={handleEndImageDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }}
                >
                  {(shot.endRefImages || []).length === 0 ? (
                    <p className="text-xs text-gray-600 text-center py-4">
                      Drag images here for end frame
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {(shot.endRefImages || []).map((img) => (
                        <div
                          key={img.id}
                          className={`relative cursor-pointer rounded overflow-hidden border-2 ${
                            img.id === shot.selectedEndRefImageId
                              ? 'border-crimson-500'
                              : 'border-transparent hover:border-surface-500'
                          }`}
                          onClick={() =>
                            setSelectedEndRefImage(selectedSectionId, selectedShotId, img.id)
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
                              removeEndRefImageFromShot(selectedSectionId, selectedShotId, img.id);
                            }}
                          >
                            x
                          </button>
                          {img.id === shot.selectedEndRefImageId && (
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

            {/* Audio */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Audio
                </label>
                {shot.audioFile && (
                  <button
                    className="btn btn-ghost text-[10px] py-0.5 text-red-400 hover:text-red-300"
                    onClick={() =>
                      setShotAudio(selectedSectionId, selectedShotId, undefined)
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
              {shot.audioFile ? (
                <MiniWaveform
                  audioUrl={api.getAudioUrl(shot.audioFile)}
                  filename={shot.audioFile}
                />
              ) : (
                <label className="btn btn-secondary text-xs cursor-pointer">
                  Upload Audio
                  <input
                    type="file"
                    accept=".wav,.mp3,.ogg,.flac"
                    className="hidden"
                    onChange={handleAudioUpload}
                  />
                </label>
              )}
            </div>

            {/* Generated Video */}
            {(shot.videoFiles?.length ?? 0) > 0 && (() => {
              const vf = shot.videoFiles!;
              const idx = shot.selectedVideoIdx ?? vf.length - 1;
              const current = vf[idx];
              return (
                <div>
                  <button
                    className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 mb-1 uppercase tracking-wide hover:text-gray-300"
                    onClick={() => setVideoOpen(!videoOpen)}
                  >
                    <span className="text-[10px]">{videoOpen ? '\u25BC' : '\u25B6'}</span>
                    Generated Video ({vf.length} version{vf.length > 1 ? 's' : ''})
                  </button>
                  {videoOpen && current && (
                    <div className="space-y-2">
                      <video
                        key={current.path}
                        controls
                        className="w-full rounded border border-surface-400"
                        src={api.getVideoUrl(current.path)}
                      />
                      <div className="flex items-center gap-2">
                        {vf.length > 1 && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              className="text-[11px] text-gray-400 hover:text-white disabled:opacity-30 px-1"
                              disabled={idx <= 0}
                              onClick={() => setShotVideoIdx(selectedSectionId, selectedShotId, idx - 1)}
                            >
                              &larr;
                            </button>
                            <span className="text-[10px] text-gray-400 tabular-nums">
                              v{idx + 1}/{vf.length}
                            </span>
                            <button
                              className="text-[11px] text-gray-400 hover:text-white disabled:opacity-30 px-1"
                              disabled={idx >= vf.length - 1}
                              onClick={() => setShotVideoIdx(selectedSectionId, selectedShotId, idx + 1)}
                            >
                              &rarr;
                            </button>
                          </div>
                        )}
                        <span className="text-[10px] text-gray-500 truncate flex-1">
                          {current.path.split(/[/\\]/).pop()}
                        </span>
                        <button
                          className="btn btn-ghost text-[10px] text-red-400 hover:text-red-300"
                          onClick={() => removeShotVideo(selectedSectionId, selectedShotId, idx)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Takes (for rapid_cut type) */}
            {shot.type === 'multi' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Takes ({(shot.takes || []).length})
                  </label>
                  <button
                    className="btn btn-ghost text-[10px] py-0.5"
                    onClick={() => addTake(selectedSectionId, selectedShotId)}
                  >
                    + Add Take
                  </button>
                </div>
                {(shot.takes || []).length > 0 ? (
                  <div className="space-y-2">
                    {shot.takes!.map((take) => (
                      <TakeEditor
                        key={take.id}
                        take={take}
                        sectionId={selectedSectionId}
                        shotId={selectedShotId}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 text-center py-3 border border-dashed border-surface-400 rounded-lg">
                    No takes yet. Add one to get started.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <ParamsEditor sectionId={selectedSectionId} shotId={selectedShotId} />
        )}
      </div>
    </div>
  );
}
