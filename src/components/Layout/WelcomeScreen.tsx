import { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';

export function WelcomeScreen() {
  const loadProject = useProjectStore((s) => s.loadProject);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const error = useProjectStore((s) => s.error);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleLoadProjects = async () => {
    try {
      const res = await fetch('/api/project');
      const data = await res.json();
      setProjects(data);
      setLoaded(true);
    } catch {
      setProjects([]);
      setLoaded(true);
    }
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createProject(name);
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-surface-50">
      <div className="max-w-md w-full mx-auto p-8">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ByteSound" className="w-24 h-24 rounded-full mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-crimson-400 mb-2">ByteCut Director</h1>
          <p className="text-gray-500 text-sm">AI Video Production Tool — by ByteSound</p>
        </div>

        <div className="space-y-4">
          {/* Create New Project */}
          {!showCreate ? (
            <button
              className="w-full btn btn-primary py-3 text-base"
              onClick={() => setShowCreate(true)}
            >
              Create New Project
            </button>
          ) : (
            <div className="bg-surface-200 border border-surface-400 rounded-md p-4 space-y-3">
              <input
                type="text"
                placeholder="Project name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-100 border border-surface-400 rounded text-sm text-gray-100 placeholder-gray-500 focus:border-crimson-500 focus:outline-none"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <div className="flex items-center gap-2">
                <div className="flex-1" />
                <button
                  className="btn btn-ghost text-xs"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary text-xs"
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-400" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-surface-50 px-2 text-gray-500">or</span>
            </div>
          </div>

          <button
            className="w-full btn btn-secondary py-2"
            onClick={handleLoadProjects}
          >
            Load Existing Project
          </button>

          {loaded && projects.length === 0 && (
            <p className="text-xs text-gray-500 text-center">No saved projects found</p>
          )}

          {projects.length > 0 && (
            <div className="space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2"
                >
                  <button
                    className="flex-1 text-left px-4 py-2 bg-surface-200 border border-surface-400 rounded-md
                               hover:border-crimson-500 hover:bg-surface-300 transition-colors text-sm"
                    onClick={() => loadProject(p.id)}
                  >
                    {p.name}
                  </button>
                  {confirmDeleteId === p.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        className="btn btn-ghost text-[10px] text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(p.id)}
                      >
                        Confirm
                      </button>
                      <button
                        className="btn btn-ghost text-[10px]"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-ghost text-[10px] text-gray-500 hover:text-red-400"
                      onClick={() => setConfirmDeleteId(p.id)}
                      title="Delete project"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
