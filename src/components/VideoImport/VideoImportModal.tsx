import { useState, useMemo, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { buildShotStem, matchVideoFiles } from '../../utils/filename';
import { api } from '../../utils/api';

interface ScannedFile {
  filename: string;
  path: string;
  stem: string;
}

interface DirEntry {
  name: string;
  path: string;
}

interface MatchResult {
  stem: string;
  label: string;
  file: ScannedFile | null;
}

type Phase = 'browse' | 'preview' | 'done';

export function VideoImportModal() {
  const project = useProjectStore((s) => s.project);
  const importVideosFromFolder = useProjectStore((s) => s.importVideosFromFolder);
  const clearAllVideos = useProjectStore((s) => s.clearAllVideos);
  const saveProject = useProjectStore((s) => s.saveProject);
  const setVideoImportOpen = useUIStore((s) => s.setVideoImportOpen);
  const [confirmClear, setConfirmClear] = useState(false);

  const [phase, setPhase] = useState<Phase>('browse');

  // Browse state
  const [currentDir, setCurrentDir] = useState('');
  const [parentDir, setParentDir] = useState<string | null>(null);
  const [dirs, setDirs] = useState<DirEntry[]>([]);
  const [videoCount, setVideoCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pathInput, setPathInput] = useState('');

  // Preview state
  const [scannedFiles, setScannedFiles] = useState<ScannedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ matched: number; unmatched: string[] } | null>(null);

  // Load drive roots on mount
  useEffect(() => {
    api.getVideoRoots().then((data) => {
      setCurrentDir(data.home);
      setPathInput(data.home);
      navigateTo(data.home);
    }).catch(() => {});
  }, []);

  const navigateTo = async (dir: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.browseVideos(dir);
      setCurrentDir(data.currentDir);
      setParentDir(data.parentDir);
      setDirs(data.dirs);
      setVideoCount(data.files.length);
      setPathInput(data.currentDir);
    } catch (e: any) {
      setError(e.message || 'Failed to browse directory');
    }
    setLoading(false);
  };

  const handlePathSubmit = () => {
    if (pathInput.trim()) {
      navigateTo(pathInput.trim());
    }
  };

  const handleSelectFolder = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.browseVideos(currentDir);
      setScannedFiles(data.files);
      if (data.files.length === 0) {
        setError('No video files (.mp4, .webm) found in this folder.');
        setLoading(false);
        return;
      }
      setPhase('preview');
    } catch (e: any) {
      setError(e.message || 'Failed to scan folder');
    }
    setLoading(false);
  };

  // Compute expected filenames for all shots/takes
  const expectedItems = useMemo(() => {
    if (!project) return [];
    const items: { stem: string; label: string }[] = [];
    for (const section of project.sections) {
      for (let si = 0; si < section.shots.length; si++) {
        const shot = section.shots[si];
        if (shot.type === 'multi' && shot.takes && shot.takes.length > 0) {
          for (const take of shot.takes) {
            items.push({
              stem: buildShotStem(section.name, si, shot.name, take.label),
              label: `${section.name} > ${shot.name} > ${take.label}`,
            });
          }
        } else {
          items.push({
            stem: buildShotStem(section.name, si, shot.name),
            label: `${section.name} > ${shot.name}`,
          });
        }
      }
    }
    return items;
  }, [project]);

  // Match scanned files to expected stems using two-phase matching
  const { matches, unmatchedFiles, matchedCount } = useMemo(() => {
    if (scannedFiles.length === 0) {
      return { matches: [] as MatchResult[], unmatchedFiles: [] as ScannedFile[], matchedCount: 0 };
    }

    const result = matchVideoFiles(
      expectedItems.map((i) => i.stem),
      scannedFiles
    );

    // Build label lookup
    const labelMap = new Map(expectedItems.map((i) => [i.stem.toLowerCase(), i.label]));
    const fileMap = new Map(scannedFiles.map((f) => [f.path, f]));

    const matchResults: MatchResult[] = expectedItems.map((item) => {
      const paths = result.matches.get(item.stem.toLowerCase());
      const matchedFile = paths?.[0] ? scannedFiles.find((f) => f.path === paths[0]) ?? null : null;
      return {
        stem: item.stem,
        label: item.label,
        file: matchedFile,
      };
    });

    const unmatchedStems = new Set(result.unmatched);
    const unmatched = scannedFiles.filter((f) => unmatchedStems.has(f.stem.toLowerCase()));

    return {
      matches: matchResults,
      unmatchedFiles: unmatched,
      matchedCount: matchResults.filter((m) => m.file).length,
    };
  }, [expectedItems, scannedFiles]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await importVideosFromFolder(currentDir);
      setResult(res);
      setPhase('done');
      await saveProject();
    } catch (e: any) {
      setError(e.message || 'Import failed');
    }
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-100 border border-surface-300 rounded-lg w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-surface-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-gray-200">Import Generated Videos</h2>
            {phase !== 'browse' && (
              <button
                className="text-[11px] text-gray-500 hover:text-gray-300"
                onClick={() => {
                  setPhase('browse');
                  setScannedFiles([]);
                  setResult(null);
                  setError('');
                }}
              >
                &larr; Back to browser
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {confirmClear ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-red-400">Clear all videos?</span>
                <button
                  className="text-[11px] text-red-400 font-semibold hover:text-red-300"
                  onClick={async () => {
                    clearAllVideos();
                    await saveProject();
                    setConfirmClear(false);
                  }}
                >
                  Yes
                </button>
                <button
                  className="text-[11px] text-gray-500 hover:text-gray-300"
                  onClick={() => setConfirmClear(false)}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                className="text-[11px] text-red-400/70 hover:text-red-400"
                onClick={() => setConfirmClear(true)}
              >
                Clear All
              </button>
            )}
            <button
              className="text-gray-500 hover:text-gray-300 text-xs"
              onClick={() => setVideoImportOpen(false)}
            >
              Close
            </button>
          </div>
        </div>

        {phase === 'browse' && (
          <>
            {/* Path input */}
            <div className="px-5 py-2 border-b border-surface-300">
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-xs"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePathSubmit()}
                  placeholder="Enter path and press Enter..."
                />
                <button
                  className="btn btn-ghost text-xs"
                  onClick={handlePathSubmit}
                  disabled={loading}
                >
                  Go
                </button>
              </div>
            </div>

            {/* Directory listing */}
            <div className="flex-1 overflow-y-auto px-5 py-2">
              {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

              {loading ? (
                <p className="text-xs text-gray-500 text-center py-8 animate-pulse">Loading...</p>
              ) : (
                <div className="space-y-0.5">
                  {/* Parent directory */}
                  {parentDir && (
                    <button
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs
                                 text-gray-400 hover:bg-surface-200 text-left"
                      onClick={() => navigateTo(parentDir)}
                    >
                      <span className="text-gray-500 w-4 text-center">..</span>
                      <span>Parent directory</span>
                    </button>
                  )}

                  {/* Subdirectories */}
                  {dirs.map((d) => (
                    <button
                      key={d.path}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs
                                 text-gray-300 hover:bg-surface-200 text-left"
                      onClick={() => navigateTo(d.path)}
                    >
                      <span className="text-yellow-500 w-4 text-center text-sm">&#128193;</span>
                      <span className="truncate">{d.name}</span>
                    </button>
                  ))}

                  {dirs.length === 0 && !parentDir && (
                    <p className="text-xs text-gray-600 text-center py-4">
                      No subdirectories found
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer with select button */}
            <div className="px-5 py-3 border-t border-surface-300 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {videoCount > 0
                  ? `${videoCount} video file(s) in this folder`
                  : 'No videos in current folder'}
              </span>
              <button
                className="btn btn-primary text-xs"
                disabled={videoCount === 0 || loading}
                onClick={handleSelectFolder}
              >
                Select This Folder ({videoCount} videos)
              </button>
            </div>
          </>
        )}

        {phase === 'preview' && (
          <>
            {/* Match preview */}
            <div className="px-5 py-2 border-b border-surface-300">
              <p className="text-xs text-gray-400">
                <span className="text-gray-300 font-medium">{currentDir}</span>
                {' '}&mdash; {scannedFiles.length} video(s), {matchedCount} matched to shots
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1">
              {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

              {/* Matched items */}
              {matches.map((m) => (
                <div
                  key={m.stem}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs ${
                    m.file ? 'bg-green-900/20' : 'bg-surface-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      m.file ? 'bg-green-500' : 'bg-surface-500'
                    }`}
                  />
                  <span className="text-gray-300 truncate flex-1">{m.label}</span>
                  <span className="text-[10px] text-gray-500 truncate max-w-[200px]">
                    {m.file ? m.file.filename : 'no match'}
                  </span>
                </div>
              ))}

              {/* Unmatched files */}
              {unmatchedFiles.length > 0 && (
                <>
                  <p className="text-xs text-yellow-400 pt-2 pb-1">Unmatched video files:</p>
                  {unmatchedFiles.map((f) => (
                    <div
                      key={f.path}
                      className="flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-yellow-900/10"
                    >
                      <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                      <span className="text-gray-400 truncate">{f.filename}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-surface-300 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {matchedCount} of {expectedItems.length} shots will receive videos
              </span>
              <button
                className="btn btn-primary"
                disabled={matchedCount === 0 || importing}
                onClick={handleImport}
              >
                {importing ? 'Importing...' : `Import ${matchedCount} videos`}
              </button>
            </div>
          </>
        )}

        {phase === 'done' && result && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <div className="text-center">
                <p className="text-sm text-green-400 font-semibold mb-2">
                  Import complete: {result.matched} videos matched
                </p>
                {result.unmatched.length > 0 && (
                  <div className="mt-3 text-left">
                    <p className="text-xs text-yellow-400 mb-1">
                      {result.unmatched.length} unmatched file(s):
                    </p>
                    {result.unmatched.map((f) => (
                      <p key={f} className="text-[11px] text-gray-500 pl-2">{f}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-surface-300 flex justify-end">
              <button
                className="btn btn-primary text-xs"
                onClick={() => setVideoImportOpen(false)}
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
