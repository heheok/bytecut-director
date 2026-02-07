const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getProject: (id: string) => request<any>(`/project/${id}`),

  saveProject: (project: any) =>
    request<any>('/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    }),

  listProjects: () => request<string[]>('/project'),

  importMarkdown: (formData: FormData) =>
    request<any>('/import/markdown', {
      method: 'POST',
      body: formData,
    }),

  uploadImages: (formData: FormData) =>
    request<{ files: Array<{ filename: string; path: string }> }>('/images/upload', {
      method: 'POST',
      body: formData,
    }),

  browseImages: (dir?: string) =>
    request<{ files: Array<{ filename: string; path: string }> }>(
      `/images/browse${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`
    ),

  getImageUrl: (filename: string) => `${BASE}/images/${encodeURIComponent(filename)}`,

  getThumbUrl: (filename: string) => `${BASE}/images/thumb/${encodeURIComponent(filename)}`,

  generateThumbnails: () =>
    request<{ total: number; generated: number; skipped: number; failed: number }>(
      '/images/generate-thumbnails',
      { method: 'POST' }
    ),

  uploadAudio: (formData: FormData) =>
    request<{ files: Array<{ filename: string; path: string }> }>('/audio/upload', {
      method: 'POST',
      body: formData,
    }),

  getAudioUrl: (filename: string) => `${BASE}/audio/${encodeURIComponent(filename)}`,

  browseVideos: (dir: string) =>
    request<{
      files: Array<{ filename: string; path: string; stem: string }>;
      dirs: Array<{ name: string; path: string }>;
      currentDir: string;
      parentDir: string | null;
    }>(`/videos/browse?dir=${encodeURIComponent(dir)}`),

  getVideoRoots: () =>
    request<{ roots: string[]; home: string }>('/videos/roots'),

  getVideoUrl: (absolutePath: string) =>
    `${BASE}/videos/external?path=${encodeURIComponent(absolutePath)}`,

  exportQueue: async (body: any): Promise<Blob> => {
    const res = await fetch(`${BASE}/export/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
  },
};
