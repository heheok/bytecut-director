import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Project, Section, Shot, Take, RefImage, LTXParams } from '../types/project';
import { DEFAULT_LTX_PARAMS } from '../types/project';
import { sanitizeFilename, matchVideoFiles } from '../utils/filename';
import { api } from '../utils/api';

interface ProjectState {
  project: Project | null;
  loading: boolean;
  error: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';

  setProject: (project: Project) => void;
  updateProjectName: (name: string) => void;
  updateDefaultParams: (params: Partial<LTXParams>) => void;
  createProject: (name: string) => void;
  closeProject: () => void;

  addSection: (afterSectionId?: string) => void;
  removeSection: (sectionId: string) => void;
  reorderSections: (sectionIds: string[]) => void;
  updateSection: (sectionId: string, updates: Partial<Section>) => void;

  addShot: (sectionId: string, afterShotId?: string) => void;
  removeShot: (sectionId: string, shotId: string) => void;
  duplicateShot: (sectionId: string, shotId: string) => void;

  updateShot: (sectionId: string, shotId: string, updates: Partial<Shot>) => void;
  addRefImageToShot: (sectionId: string, shotId: string, image: RefImage) => void;
  removeRefImageFromShot: (sectionId: string, shotId: string, imageId: string) => void;
  setSelectedRefImage: (sectionId: string, shotId: string, imageId: string) => void;
  addEndRefImageToShot: (sectionId: string, shotId: string, image: RefImage) => void;
  removeEndRefImageFromShot: (sectionId: string, shotId: string, imageId: string) => void;
  setSelectedEndRefImage: (sectionId: string, shotId: string, imageId: string) => void;
  setShotAudio: (sectionId: string, shotId: string, audioFile: string | undefined) => void;
  setMasterAudio: (filename: string | undefined) => void;
  updateShotParams: (sectionId: string, shotId: string, params: Partial<LTXParams>) => void;

  addTake: (sectionId: string, shotId: string) => void;
  removeTake: (sectionId: string, shotId: string, takeId: string) => void;
  updateTake: (sectionId: string, shotId: string, takeId: string, updates: Partial<Take>) => void;
  addRefImageToTake: (sectionId: string, shotId: string, takeId: string, image: RefImage) => void;
  removeRefImageFromTake: (sectionId: string, shotId: string, takeId: string, imageId: string) => void;
  setSelectedRefImageForTake: (sectionId: string, shotId: string, takeId: string, imageId: string) => void;
  addShotVideo: (sectionId: string, shotId: string, videoPath: string) => void;
  removeShotVideo: (sectionId: string, shotId: string, index: number) => void;
  setShotVideoIdx: (sectionId: string, shotId: string, index: number) => void;
  addTakeVideo: (sectionId: string, shotId: string, takeId: string, videoPath: string) => void;
  removeTakeVideo: (sectionId: string, shotId: string, takeId: string, index: number) => void;
  setTakeVideoIdx: (sectionId: string, shotId: string, takeId: string, index: number) => void;
  importVideosFromFolder: (folderPath: string) => Promise<{ matched: number; unmatched: string[] }>;
  clearAllVideos: () => void;

  addEndRefImageToTake: (sectionId: string, shotId: string, takeId: string, image: RefImage) => void;
  removeEndRefImageFromTake: (sectionId: string, shotId: string, takeId: string, imageId: string) => void;
  setSelectedEndRefImageForTake: (sectionId: string, shotId: string, takeId: string, imageId: string) => void;

  loadProject: (id: string) => Promise<void>;
  saveProject: () => Promise<void>;
  importMarkdown: (files: File[]) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  loading: false,
  error: null,
  saveStatus: 'idle' as const,

  setProject: (project) => set({ project, error: null }),

  updateProjectName: (name) => set((state) => {
    if (!state.project) return state;
    return { project: { ...state.project, name } };
  }),

  createProject: (name) => set({
    project: {
      id: uuid(),
      name,
      bpm: 120,
      sections: [],
      defaultParams: {} as any,
    },
    error: null,
  }),

  closeProject: () => set({ project: null, error: null, saveStatus: 'idle' }),

  addSection: (afterSectionId?) => set((state) => {
    if (!state.project) return state;
    const newSection: Section = {
      id: uuid(),
      name: 'New Section',
      startTime: 0,
      endTime: 0,
      description: '',
      shots: [],
    };
    const sections = [...state.project.sections];
    if (afterSectionId) {
      const idx = sections.findIndex((s) => s.id === afterSectionId);
      if (idx !== -1) {
        sections.splice(idx + 1, 0, newSection);
      } else {
        sections.push(newSection);
      }
    } else {
      sections.push(newSection);
    }
    return { project: { ...state.project, sections } };
  }),

  removeSection: (sectionId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.filter((s) => s.id !== sectionId),
      },
    };
  }),

  reorderSections: (sectionIds) => set((state) => {
    if (!state.project) return state;
    const sectionMap = new Map(state.project.sections.map((s) => [s.id, s]));
    const reordered = sectionIds
      .map((id) => sectionMap.get(id))
      .filter((s): s is Section => !!s);
    return { project: { ...state.project, sections: reordered } };
  }),

  updateDefaultParams: (params) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        defaultParams: { ...state.project.defaultParams, ...params },
      },
    };
  }),

  updateSection: (sectionId, updates) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId ? { ...s, ...updates } : s
        ),
      },
    };
  }),

  addShot: (sectionId, afterShotId) => set((state) => {
    if (!state.project) return state;
    const newShot: Shot = {
      id: uuid(),
      name: 'New Shot',
      type: 'solo',
      startTime: 0,
      endTime: 0,
      lyric: '',
      concept: '',
      prompt: '',
      refImagePrompt: '',
      refImages: [],
      endRefImages: [],
    };
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const shots = [...s.shots];
          if (afterShotId) {
            const idx = shots.findIndex((sh) => sh.id === afterShotId);
            if (idx !== -1) {
              // Copy timing from the shot we're inserting after
              const prev = shots[idx];
              newShot.startTime = prev.endTime;
              newShot.endTime = prev.endTime + 2;
              shots.splice(idx + 1, 0, newShot);
            } else {
              shots.push(newShot);
            }
          } else {
            shots.push(newShot);
          }
          return { ...s, shots };
        }),
      },
    };
  }),

  removeShot: (sectionId, shotId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? { ...s, shots: s.shots.filter((sh) => sh.id !== shotId) }
            : s
        ),
      },
    };
  }),

  duplicateShot: (sectionId, shotId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const idx = s.shots.findIndex((sh) => sh.id === shotId);
          if (idx === -1) return s;
          const original = s.shots[idx];
          const copy: Shot = {
            ...JSON.parse(JSON.stringify(original)),
            id: uuid(),
            name: `${original.name} (copy)`,
            refImages: [],
            selectedRefImageId: undefined,
            endRefImages: [],
            selectedEndRefImageId: undefined,
          };
          const shots = [...s.shots];
          shots.splice(idx + 1, 0, copy);
          return { ...s, shots };
        }),
      },
    };
  }),

  updateShot: (sectionId, shotId, updates) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId ? { ...shot, ...updates } : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  addRefImageToShot: (sectionId, shotId, image) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        refImages: [...shot.refImages, image],
                        selectedRefImageId: shot.selectedRefImageId || image.id,
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  removeRefImageFromShot: (sectionId, shotId, imageId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        refImages: shot.refImages.filter((i) => i.id !== imageId),
                        selectedRefImageId:
                          shot.selectedRefImageId === imageId
                            ? shot.refImages.find((i) => i.id !== imageId)?.id
                            : shot.selectedRefImageId,
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  setSelectedRefImage: (sectionId, shotId, imageId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId ? { ...shot, selectedRefImageId: imageId } : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  addEndRefImageToShot: (sectionId, shotId, image) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        endRefImages: [...(shot.endRefImages || []), image],
                        selectedEndRefImageId: shot.selectedEndRefImageId || image.id,
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  removeEndRefImageFromShot: (sectionId, shotId, imageId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        endRefImages: (shot.endRefImages || []).filter((i) => i.id !== imageId),
                        selectedEndRefImageId:
                          shot.selectedEndRefImageId === imageId
                            ? (shot.endRefImages || []).find((i) => i.id !== imageId)?.id
                            : shot.selectedEndRefImageId,
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  setSelectedEndRefImage: (sectionId, shotId, imageId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId ? { ...shot, selectedEndRefImageId: imageId } : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  setShotAudio: (sectionId, shotId, audioFile) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId ? { ...shot, audioFile } : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  addShotVideo: (sectionId, shotId, videoPath) => set((state) => {
    if (!state.project) return state;
    const now = Date.now();
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) => {
                  if (shot.id !== shotId) return shot;
                  const vf = [...(shot.videoFiles || []), { path: videoPath, importedAt: now }];
                  return { ...shot, videoFiles: vf, selectedVideoIdx: vf.length - 1 };
                }),
              }
            : s
        ),
      },
    };
  }),

  removeShotVideo: (sectionId, shotId, index) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) => {
                  if (shot.id !== shotId) return shot;
                  const vf = (shot.videoFiles || []).filter((_, i) => i !== index);
                  const idx = vf.length === 0 ? undefined
                    : Math.min(shot.selectedVideoIdx ?? 0, vf.length - 1);
                  return { ...shot, videoFiles: vf, selectedVideoIdx: idx };
                }),
              }
            : s
        ),
      },
    };
  }),

  setShotVideoIdx: (sectionId, shotId, index) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId ? { ...shot, selectedVideoIdx: index } : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  addTakeVideo: (sectionId, shotId, takeId, videoPath) => set((state) => {
    if (!state.project) return state;
    const now = Date.now();
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        takes: shot.takes?.map((c) => {
                          if (c.id !== takeId) return c;
                          const vf = [...(c.videoFiles || []), { path: videoPath, importedAt: now }];
                          return { ...c, videoFiles: vf, selectedVideoIdx: vf.length - 1 };
                        }),
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  removeTakeVideo: (sectionId, shotId, takeId, index) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        takes: shot.takes?.map((c) => {
                          if (c.id !== takeId) return c;
                          const vf = (c.videoFiles || []).filter((_, i) => i !== index);
                          const idx = vf.length === 0 ? undefined
                            : Math.min(c.selectedVideoIdx ?? 0, vf.length - 1);
                          return { ...c, videoFiles: vf, selectedVideoIdx: idx };
                        }),
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  setTakeVideoIdx: (sectionId, shotId, takeId, index) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        takes: shot.takes?.map((c) =>
                          c.id === takeId ? { ...c, selectedVideoIdx: index } : c
                        ),
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  importVideosFromFolder: async (folderPath) => {
    const { project } = get();
    if (!project) return { matched: 0, unmatched: [] };

    const { files } = await api.browseVideos(folderPath);
    const now = Date.now();

    // Build expected stems for all shots/takes
    const expectedStems: string[] = [];
    const stemToLocation = new Map<string, { sectionId: string; shotId: string; takeId?: string }>();

    for (const section of project.sections) {
      for (const shot of section.shots) {
        if (shot.type === 'multi' && shot.takes && shot.takes.length > 0) {
          for (const take of shot.takes) {
            const stem = `${sanitizeFilename(section.name)}_${sanitizeFilename(shot.name)}_${sanitizeFilename(take.label)}`;
            expectedStems.push(stem);
            stemToLocation.set(stem.toLowerCase(), { sectionId: section.id, shotId: shot.id, takeId: take.id });
          }
        } else {
          const stem = `${sanitizeFilename(section.name)}_${sanitizeFilename(shot.name)}`;
          expectedStems.push(stem);
          stemToLocation.set(stem.toLowerCase(), { sectionId: section.id, shotId: shot.id });
        }
      }
    }

    // Use two-phase matching (exact + relaxed dedup handling)
    const result = matchVideoFiles(expectedStems, files);

    let matched = 0;
    // Build a map of location → video paths to assign
    const assignments = new Map<string, string>(); // "sectionId:shotId[:takeId]" → videoPath
    for (const [stem, paths] of result.matches) {
      const loc = stemToLocation.get(stem);
      if (!loc || paths.length === 0) continue;
      matched++;
      const key = loc.takeId ? `${loc.sectionId}:${loc.shotId}:${loc.takeId}` : `${loc.sectionId}:${loc.shotId}`;
      assignments.set(key, paths[0]);
    }

    // Apply assignments
    const updatedSections = project.sections.map((section) => ({
      ...section,
      shots: section.shots.map((shot) => {
        // Check if this shot has a direct assignment
        const shotKey = `${section.id}:${shot.id}`;
        const shotVideoPath = assignments.get(shotKey);
        let updatedShot = shot;

        if (shotVideoPath) {
          const vf = [...(shot.videoFiles || []), { path: shotVideoPath, importedAt: now }];
          updatedShot = { ...updatedShot, videoFiles: vf, selectedVideoIdx: vf.length - 1 };
        }

        // Check takes
        if (shot.takes && shot.takes.length > 0) {
          const updatedTakes = shot.takes.map((take) => {
            const takeKey = `${section.id}:${shot.id}:${take.id}`;
            const takeVideoPath = assignments.get(takeKey);
            if (takeVideoPath) {
              const vf = [...(take.videoFiles || []), { path: takeVideoPath, importedAt: now }];
              return { ...take, videoFiles: vf, selectedVideoIdx: vf.length - 1 };
            }
            return take;
          });
          updatedShot = { ...updatedShot, takes: updatedTakes };
        }

        return updatedShot;
      }),
    }));

    set({ project: { ...project, sections: updatedSections } });

    // Map unmatched stems back to filenames
    const unmatchedFilenames = files
      .filter((f) => result.unmatched.includes(f.stem.toLowerCase()))
      .map((f) => f.filename);

    return { matched, unmatched: unmatchedFilenames };
  },

  clearAllVideos: () => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) => ({
          ...s,
          shots: s.shots.map((shot) => ({
            ...shot,
            videoFiles: undefined,
            selectedVideoIdx: undefined,
            takes: shot.takes?.map((c) => ({
              ...c,
              videoFiles: undefined,
              selectedVideoIdx: undefined,
            })),
          })),
        })),
      },
    };
  }),

  setMasterAudio: (filename) => set((state) => {
    if (!state.project) return state;
    return { project: { ...state.project, masterAudio: filename } };
  }),

  updateShotParams: (sectionId, shotId, params) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? { ...shot, params: { ...shot.params, ...params } }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  addTake: (sectionId, shotId) => set((state) => {
    if (!state.project) return state;
    const newTake: Take = {
      id: uuid(),
      label: 'New Take',
      startTime: 0,
      endTime: 0,
      concept: '',
      refImagePrompt: '',
      refImages: [],
      endRefImages: [],
    };
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) => {
                  if (shot.id !== shotId) return shot;
                  const takes = [...(shot.takes || [])];
                  // Set timing based on last take or shot
                  if (takes.length > 0) {
                    const last = takes[takes.length - 1];
                    newTake.startTime = last.endTime;
                    newTake.endTime = last.endTime + 1;
                  } else {
                    newTake.startTime = shot.startTime;
                    newTake.endTime = shot.startTime + 1;
                  }
                  newTake.label = `Take ${takes.length + 1}`;
                  takes.push(newTake);
                  return { ...shot, takes };
                }),
              }
            : s
        ),
      },
    };
  }),

  removeTake: (sectionId, shotId, takeId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? { ...shot, takes: (shot.takes || []).filter((c) => c.id !== takeId) }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  updateTake: (sectionId, shotId, takeId, updates) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        takes: shot.takes?.map((c) =>
                          c.id === takeId ? { ...c, ...updates } : c
                        ),
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  addRefImageToTake: (sectionId, shotId, takeId, image) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        takes: shot.takes?.map((c) =>
                          c.id === takeId
                            ? {
                                ...c,
                                refImages: [...c.refImages, image],
                                selectedRefImageId: c.selectedRefImageId || image.id,
                              }
                            : c
                        ),
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  removeRefImageFromTake: (sectionId, shotId, takeId, imageId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        takes: shot.takes?.map((c) =>
                          c.id === takeId
                            ? {
                                ...c,
                                refImages: c.refImages.filter((i) => i.id !== imageId),
                                selectedRefImageId:
                                  c.selectedRefImageId === imageId
                                    ? c.refImages.find((i) => i.id !== imageId)?.id
                                    : c.selectedRefImageId,
                              }
                            : c
                        ),
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  setSelectedRefImageForTake: (sectionId, shotId, takeId, imageId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        takes: shot.takes?.map((c) =>
                          c.id === takeId ? { ...c, selectedRefImageId: imageId } : c
                        ),
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  addEndRefImageToTake: (sectionId, shotId, takeId, image) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        takes: shot.takes?.map((c) =>
                          c.id === takeId
                            ? {
                                ...c,
                                endRefImages: [...(c.endRefImages || []), image],
                                selectedEndRefImageId: c.selectedEndRefImageId || image.id,
                              }
                            : c
                        ),
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  removeEndRefImageFromTake: (sectionId, shotId, takeId, imageId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        takes: shot.takes?.map((c) =>
                          c.id === takeId
                            ? {
                                ...c,
                                endRefImages: (c.endRefImages || []).filter((i) => i.id !== imageId),
                                selectedEndRefImageId:
                                  c.selectedEndRefImageId === imageId
                                    ? (c.endRefImages || []).find((i) => i.id !== imageId)?.id
                                    : c.selectedEndRefImageId,
                              }
                            : c
                        ),
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  setSelectedEndRefImageForTake: (sectionId, shotId, takeId, imageId) => set((state) => {
    if (!state.project) return state;
    return {
      project: {
        ...state.project,
        sections: state.project.sections.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                shots: s.shots.map((shot) =>
                  shot.id === shotId
                    ? {
                        ...shot,
                        takes: shot.takes?.map((c) =>
                          c.id === takeId ? { ...c, selectedEndRefImageId: imageId } : c
                        ),
                      }
                    : shot
                ),
              }
            : s
        ),
      },
    };
  }),

  loadProject: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/project/${id}`);
      if (!res.ok) throw new Error('Failed to load project');
      const project = await res.json();
      // Migrate legacy "cuts" → "takes"
      if (project.sections) {
        for (const section of project.sections) {
          for (const shot of section.shots) {
            if ((shot as any).cuts && !shot.takes) {
              shot.takes = (shot as any).cuts;
              delete (shot as any).cuts;
            }
            // Migrate legacy shot types
            const t = (shot as any).type;
            if (t === 'held' || t === 'visual_only') shot.type = 'solo';
            else if (t === 'rapid_cut') shot.type = 'multi';
            if (shot.takes) {
              for (const take of shot.takes) {
                if (take.label && /^Cut\s+\d+$/i.test(take.label)) {
                  take.label = take.label.replace(/^Cut/i, 'Take');
                }
              }
            }
          }
        }
      }
      set({ project, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  saveProject: async () => {
    const { project } = get();
    if (!project) return;
    set({ loading: true, error: null, saveStatus: 'saving' });
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (!res.ok) throw new Error('Failed to save project');
      set({ loading: false, saveStatus: 'saved' });
      // Reset status after 3 seconds
      setTimeout(() => {
        if (get().saveStatus === 'saved') {
          set({ saveStatus: 'idle' });
        }
      }, 3000);
    } catch (e: any) {
      set({ error: e.message, loading: false, saveStatus: 'error' });
      setTimeout(() => {
        if (get().saveStatus === 'error') {
          set({ saveStatus: 'idle' });
        }
      }, 5000);
    }
  },

  importMarkdown: async (files) => {
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      const res = await fetch('/api/import/markdown', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to import markdown');
      const project = await res.json();
      set({ project, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  deleteProject: async (id) => {
    try {
      const res = await fetch(`/api/project/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete project');
    } catch (e: any) {
      set({ error: e.message });
    }
  },
}));
