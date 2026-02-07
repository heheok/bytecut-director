import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../utils/api';
import { v4 as uuid } from 'uuid';
import type { RefImage } from '../../types/project';
import { Lightbox } from './Lightbox';

type MediaTab = 'images' | 'audio';

interface BrowseImage {
  filename: string;
  path: string;
  url: string;
}

interface BrowseDir {
  name: string;
  path: string;
}

interface AudioFile {
  filename: string;
  originalName?: string;
  path: string;
}

export function ImageManager() {
  const addRefImageToShot = useProjectStore((s) => s.addRefImageToShot);
  const setShotAudio = useProjectStore((s) => s.setShotAudio);
  const selectedShotId = useUIStore((s) => s.selectedShotId);
  const selectedSectionId = useUIStore((s) => s.selectedSectionId);
  const setImageManagerOpen = useUIStore((s) => s.setImageManagerOpen);

  const [tab, setTab] = useState<MediaTab>('images');
  const [previewImage, setPreviewImage] = useState<BrowseImage | null>(null);

  // Image state
  const [images, setImages] = useState<BrowseImage[]>([]);
  const [dirs, setDirs] = useState<BrowseDir[]>([]);
  const [currentDir, setCurrentDir] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [browseDir, setBrowseDir] = useState('');

  // Audio state
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  useEffect(() => {
    loadImages();
    loadAudio();
  }, []);

  // Listen for assign-image events from drag & drop on shot cards
  useEffect(() => {
    const imageHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.sectionId && detail?.shotId && detail?.image) {
        addRefImageToShot(detail.sectionId, detail.shotId, detail.image);
      }
    };
    const audioHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.sectionId && detail?.shotId && detail?.audioFilename) {
        setShotAudio(detail.sectionId, detail.shotId, detail.audioFilename);
      }
    };
    window.addEventListener('assign-image', imageHandler);
    window.addEventListener('assign-audio', audioHandler);
    return () => {
      window.removeEventListener('assign-image', imageHandler);
      window.removeEventListener('assign-audio', audioHandler);
    };
  }, [addRefImageToShot, setShotAudio]);

  // === Image functions ===
  const loadImages = async (dir?: string) => {
    try {
      const res = await fetch(`/api/images/browse${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`);
      const data = await res.json();
      setImages(data.files || []);
      setDirs(data.dirs || []);
      setCurrentDir(data.currentDir || '');
    } catch {
      setImages([]);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append('images', f));
    try {
      await fetch('/api/images/upload', { method: 'POST', body: formData });
      await loadImages(currentDir || undefined);
    } catch {}
    setUploading(false);
    e.target.value = '';
  };

  const handleBrowse = () => {
    if (browseDir) loadImages(browseDir);
  };

  const handleDirClick = (dirPath: string) => {
    loadImages(dirPath);
    setBrowseDir(dirPath);
  };

  const handleGoUp = () => {
    if (!currentDir) return;
    const parent = currentDir.replace(/[\\/][^\\/]+$/, '');
    if (parent !== currentDir) {
      loadImages(parent);
      setBrowseDir(parent);
    }
  };

  const handleImageDragStart = (e: React.DragEvent, img: BrowseImage) => {
    const refImage: RefImage = {
      id: uuid(),
      filename: img.filename,
      path: img.url || `/api/images/${img.filename}`,
      thumbnailPath: img.url || `/api/images/${img.filename}`,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(refImage));
    e.dataTransfer.setData('media-type', 'image');
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleImageClick = (img: BrowseImage) => {
    setPreviewImage(img);
  };

  const handleAssignFromPreview = () => {
    if (!previewImage || !selectedSectionId || !selectedShotId) return;
    if (previewImage.url && previewImage.url.includes('external')) {
      importAndAssign(previewImage);
    } else {
      const refImage: RefImage = {
        id: uuid(),
        filename: previewImage.filename,
        path: `/api/images/${previewImage.filename}`,
        thumbnailPath: `/api/images/${previewImage.filename}`,
      };
      addRefImageToShot(selectedSectionId, selectedShotId, refImage);
    }
    setPreviewImage(null);
  };

  const importAndAssign = async (img: BrowseImage) => {
    try {
      const res = await fetch('/api/images/import-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: img.path }),
      });
      const data = await res.json();
      if (data.filename && selectedSectionId && selectedShotId) {
        const refImage: RefImage = {
          id: uuid(),
          filename: data.filename,
          path: data.path,
          thumbnailPath: data.path,
        };
        addRefImageToShot(selectedSectionId, selectedShotId, refImage);
      }
    } catch {}
  };

  // === Audio functions ===
  const loadAudio = async () => {
    try {
      const res = await fetch('/api/audio/browse');
      const data = await res.json();
      setAudioFiles(data.files || []);
    } catch {
      setAudioFiles([]);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingAudio(true);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append('audio', f));
    try {
      await fetch('/api/audio/upload', { method: 'POST', body: formData });
      await loadAudio();
    } catch {}
    setUploadingAudio(false);
    e.target.value = '';
  };

  const handleAudioDragStart = (e: React.DragEvent, audio: AudioFile) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ audioFilename: audio.filename })
    );
    e.dataTransfer.setData('media-type', 'audio');
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAudioClick = (audio: AudioFile) => {
    if (!selectedSectionId || !selectedShotId) return;
    setShotAudio(selectedSectionId, selectedShotId, audio.filename);
  };

  return (
    <div className="h-full flex flex-col bg-surface-100">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-surface-300 shrink-0">
        {/* Tab toggle */}
        <div className="flex bg-surface-200 rounded-md p-0.5">
          <button
            className={`px-3 py-1 rounded text-[11px] font-medium ${
              tab === 'images' ? 'bg-surface-400 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setTab('images')}
          >
            Images ({images.length})
          </button>
          <button
            className={`px-3 py-1 rounded text-[11px] font-medium ${
              tab === 'audio' ? 'bg-surface-400 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setTab('audio')}
          >
            Audio ({audioFiles.length})
          </button>
        </div>

        <div className="w-px h-5 bg-surface-400" />

        {tab === 'images' ? (
          <>
            <label className={`btn btn-primary text-[11px] cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
              {uploading ? 'Uploading...' : 'Upload'}
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.bmp"
                multiple
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>

            <input
              className="input text-[11px] w-56 py-1"
              placeholder="Browse folder path..."
              value={browseDir}
              onChange={(e) => setBrowseDir(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBrowse()}
            />
            <button className="btn btn-secondary text-[11px]" onClick={handleBrowse}>
              Browse
            </button>

            {currentDir && (
              <>
                <button className="btn btn-ghost text-[11px]" onClick={handleGoUp}>
                  Up
                </button>
                <span className="text-[10px] text-gray-600 truncate max-w-[200px]">
                  {currentDir}
                </span>
              </>
            )}
          </>
        ) : (
          <label className={`btn btn-primary text-[11px] cursor-pointer ${uploadingAudio ? 'opacity-50' : ''}`}>
            {uploadingAudio ? 'Uploading...' : 'Upload Audio'}
            <input
              type="file"
              accept=".wav,.mp3,.ogg,.flac"
              multiple
              className="hidden"
              onChange={handleAudioUpload}
              disabled={uploadingAudio}
            />
          </label>
        )}

        <div className="flex-1" />

        {selectedShotId && (
          <span className="text-[10px] text-crimson-400">
            {tab === 'images'
              ? 'Click or drag image to assign to selected shot'
              : 'Click or drag audio to assign to selected shot'}
          </span>
        )}

        <button
          className="text-gray-500 hover:text-gray-300 text-xs"
          onClick={() => setImageManagerOpen(false)}
        >
          Close
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-2">
        {tab === 'images' ? (
          <div className="flex flex-wrap gap-2">
            {dirs.map((dir) => (
              <button
                key={dir.path}
                className="flex items-center gap-1 px-3 py-2 bg-surface-200 border border-surface-400
                           rounded text-xs text-gray-400 hover:bg-surface-300 hover:text-gray-200"
                onClick={() => handleDirClick(dir.path)}
              >
                <span className="text-sm">📁</span>
                {dir.name}
              </button>
            ))}

            {images.map((img) => (
              <div
                key={img.path || img.filename}
                className="w-24 h-16 rounded overflow-hidden border border-surface-400
                           hover:border-crimson-500 cursor-pointer transition-colors shrink-0"
                draggable
                onDragStart={(e) => handleImageDragStart(e, img)}
                onClick={() => handleImageClick(img)}
                title={img.filename}
              >
                <img
                  src={img.url ? img.url : api.getThumbUrl(img.filename)}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}

            {images.length === 0 && dirs.length === 0 && (
              <p className="text-xs text-gray-600 py-4 px-2">
                No images found. Upload images or browse a folder.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {audioFiles.map((audio) => (
              <div
                key={audio.filename}
                className="flex items-center gap-2 px-3 py-2 bg-surface-200 border border-surface-400
                           rounded hover:border-crimson-500 cursor-pointer transition-colors shrink-0"
                draggable
                onDragStart={(e) => handleAudioDragStart(e, audio)}
                onClick={() => handleAudioClick(audio)}
                title={audio.originalName || audio.filename}
              >
                <div className="w-8 h-8 rounded bg-surface-300 flex items-center justify-center text-gray-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-gray-300 truncate max-w-[140px]">
                    {audio.originalName || audio.filename}
                  </div>
                  <div className="text-[9px] text-gray-600 truncate">
                    {audio.filename}
                  </div>
                </div>
              </div>
            ))}

            {audioFiles.length === 0 && (
              <p className="text-xs text-gray-600 py-4 px-2">
                No audio files found. Upload WAV, MP3, OGG, or FLAC files.
              </p>
            )}
          </div>
        )}
      </div>

      {previewImage && (
        <Lightbox
          src={previewImage.url || `/api/images/${previewImage.filename}`}
          filename={previewImage.filename}
          onClose={() => setPreviewImage(null)}
          onAssign={handleAssignFromPreview}
          canAssign={!!selectedShotId && !!selectedSectionId}
        />
      )}
    </div>
  );
}
