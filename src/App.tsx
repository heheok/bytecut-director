import { useProjectStore } from './stores/projectStore';
import { useUIStore } from './stores/uiStore';
import { Toolbar } from './components/Layout/Toolbar';
import { Storyboard } from './components/Storyboard/Storyboard';
import { Timeline } from './components/Timeline/Timeline';
import { ShotEditor } from './components/ShotEditor/ShotEditor';
import { ImageManager } from './components/ImageManager/ImageManager';
import { AudioCropper } from './components/AudioCropper/AudioCropper';
import { ExportPanel } from './components/Export/ExportPanel';
import { GlobalParamsEditor } from './components/ShotEditor/GlobalParamsEditor';
import { VideoImportModal } from './components/VideoImport/VideoImportModal';
import { WelcomeScreen } from './components/Layout/WelcomeScreen';

export default function App() {
  const project = useProjectStore((s) => s.project);
  const viewMode = useUIStore((s) => s.viewMode);
  const selectedShotId = useUIStore((s) => s.selectedShotId);
  const imageManagerOpen = useUIStore((s) => s.imageManagerOpen);
  const audioCropperOpen = useUIStore((s) => s.audioCropperOpen);
  const exportPanelOpen = useUIStore((s) => s.exportPanelOpen);
  const globalParamsOpen = useUIStore((s) => s.globalParamsOpen);
  const videoImportOpen = useUIStore((s) => s.videoImportOpen);

  if (!project) {
    return <WelcomeScreen />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Toolbar />

      <div className="flex-1 flex overflow-hidden">
        {/* Main View */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'storyboard' ? <Storyboard /> : <Timeline />}
        </div>

        {/* Shot Editor - right panel */}
        {selectedShotId && (
          <div className="w-[420px] border-l border-surface-300 overflow-y-auto">
            <ShotEditor />
          </div>
        )}
      </div>

      {/* Image Manager - bottom panel */}
      {imageManagerOpen && (
        <div className="h-64 border-t border-surface-300 overflow-hidden">
          <ImageManager />
        </div>
      )}

      {/* Audio Cropper - bottom panel */}
      {audioCropperOpen && (
        <div className="h-56 border-t border-surface-300 overflow-hidden">
          <AudioCropper />
        </div>
      )}

      {/* Export Panel - modal overlay */}
      {exportPanelOpen && <ExportPanel />}

      {/* Global Params - modal overlay */}
      {globalParamsOpen && <GlobalParamsEditor />}

      {/* Video Import - modal overlay */}
      {videoImportOpen && <VideoImportModal />}
    </div>
  );
}
