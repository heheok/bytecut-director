import { useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';

const SAVE_LABELS = {
  idle: 'Save',
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Save Failed',
} as const;

const SAVE_CLASSES = {
  idle: 'btn-ghost',
  saving: 'btn-ghost text-yellow-400 animate-pulse',
  saved: 'btn-ghost text-green-400',
  error: 'btn-ghost text-red-400',
} as const;

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const saveProject = useProjectStore((s) => s.saveProject);
  const saveStatus = useProjectStore((s) => s.saveStatus);
  const closeProject = useProjectStore((s) => s.closeProject);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const toggleImageManager = useUIStore((s) => s.toggleImageManager);
  const imageManagerOpen = useUIStore((s) => s.imageManagerOpen);
  const toggleAudioCropper = useUIStore((s) => s.toggleAudioCropper);
  const audioCropperOpen = useUIStore((s) => s.audioCropperOpen);
  const setExportPanelOpen = useUIStore((s) => s.setExportPanelOpen);
  const toggleGlobalParams = useUIStore((s) => s.toggleGlobalParams);
  const globalParamsOpen = useUIStore((s) => s.globalParamsOpen);
  const setVideoImportOpen = useUIStore((s) => s.setVideoImportOpen);
  useEffect(() => {
    document.title = project ? `${project.name} — ByteCut Director` : 'ByteCut Director';
  }, [project?.name]);

  const totalShots = project?.sections.reduce((acc, s) => acc + s.shots.length, 0) || 0;
  const shotsWithImages = project?.sections.reduce(
    (acc, s) => acc + s.shots.filter((sh) => sh.refImages.length > 0 || (sh.takes && sh.takes.some((t) => t.refImages.length > 0))).length,
    0
  ) || 0;

  return (
    <div className="h-12 bg-surface-100 border-b border-surface-300 flex items-center px-4 gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <button
          className="btn btn-ghost text-xs text-gray-400 hover:text-gray-200"
          onClick={closeProject}
          title="Back to projects"
        >
          &larr;
        </button>
        <span className="text-crimson-400 font-bold text-sm tracking-wide">
          {project?.name || 'ByteCut Director'}
        </span>
        {project && (
          <span className="text-xs text-gray-500">
            {totalShots} shots | {shotsWithImages} with images
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* View toggle */}
      <div className="flex bg-surface-200 rounded-md p-0.5">
        <button
          className={`btn-ghost px-3 py-1 rounded text-xs ${viewMode === 'storyboard' ? 'bg-surface-400 text-white' : ''}`}
          onClick={() => setViewMode('storyboard')}
        >
          Storyboard
        </button>
        <button
          className={`btn-ghost px-3 py-1 rounded text-xs ${viewMode === 'timeline' ? 'bg-surface-400 text-white' : ''}`}
          onClick={() => setViewMode('timeline')}
        >
          Timeline
        </button>
      </div>

      <div className="w-px h-6 bg-surface-400" />

      <button
        className={`btn text-xs ${imageManagerOpen ? 'btn-primary' : 'btn-ghost'}`}
        onClick={toggleImageManager}
      >
        Images
      </button>

      <button
        className={`btn text-xs ${audioCropperOpen ? 'btn-primary' : 'btn-ghost'}`}
        onClick={toggleAudioCropper}
      >
        Track
      </button>

      <button
        className={`btn text-xs ${globalParamsOpen ? 'btn-primary' : 'btn-ghost'}`}
        onClick={toggleGlobalParams}
      >
        Params
      </button>

      <button
        className={`btn text-xs ${SAVE_CLASSES[saveStatus]}`}
        onClick={() => saveProject()}
        disabled={saveStatus === 'saving'}
      >
        {SAVE_LABELS[saveStatus]}
      </button>

      <button
        className="btn btn-ghost text-xs"
        onClick={() => setVideoImportOpen(true)}
      >
        Import Videos
      </button>

      <button
        className="btn btn-primary text-xs"
        onClick={() => setExportPanelOpen(true)}
      >
        Export ZIP
      </button>
    </div>
  );
}
