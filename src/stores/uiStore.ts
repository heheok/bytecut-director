import { create } from 'zustand';

export type ViewMode = 'storyboard' | 'timeline';

interface UIState {
  viewMode: ViewMode;
  selectedShotId: string | null;
  selectedSectionId: string | null;
  imageManagerOpen: boolean;
  exportPanelOpen: boolean;
  audioCropperOpen: boolean;
  globalParamsOpen: boolean;
  videoImportOpen: boolean;

  setViewMode: (mode: ViewMode) => void;
  selectShot: (sectionId: string | null, shotId: string | null) => void;
  toggleImageManager: () => void;
  setImageManagerOpen: (open: boolean) => void;
  toggleExportPanel: () => void;
  setExportPanelOpen: (open: boolean) => void;
  toggleAudioCropper: () => void;
  setAudioCropperOpen: (open: boolean) => void;
  toggleGlobalParams: () => void;
  setGlobalParamsOpen: (open: boolean) => void;
  toggleVideoImport: () => void;
  setVideoImportOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'storyboard',
  selectedShotId: null,
  selectedSectionId: null,
  imageManagerOpen: false,
  exportPanelOpen: false,
  audioCropperOpen: false,
  globalParamsOpen: false,
  videoImportOpen: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  selectShot: (sectionId, shotId) =>
    set({ selectedSectionId: sectionId, selectedShotId: shotId }),
  toggleImageManager: () =>
    set((s) => ({ imageManagerOpen: !s.imageManagerOpen })),
  setImageManagerOpen: (open) => set({ imageManagerOpen: open }),
  toggleExportPanel: () =>
    set((s) => ({ exportPanelOpen: !s.exportPanelOpen })),
  setExportPanelOpen: (open) => set({ exportPanelOpen: open }),
  toggleAudioCropper: () =>
    set((s) => ({ audioCropperOpen: !s.audioCropperOpen })),
  setAudioCropperOpen: (open) => set({ audioCropperOpen: open }),
  toggleGlobalParams: () =>
    set((s) => ({ globalParamsOpen: !s.globalParamsOpen })),
  setGlobalParamsOpen: (open) => set({ globalParamsOpen: open }),
  toggleVideoImport: () =>
    set((s) => ({ videoImportOpen: !s.videoImportOpen })),
  setVideoImportOpen: (open) => set({ videoImportOpen: open }),
}));
