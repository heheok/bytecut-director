import { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { ShotCard } from './ShotCard';

export function Storyboard() {
  const project = useProjectStore((s) => s.project);
  const addShot = useProjectStore((s) => s.addShot);
  const addSection = useProjectStore((s) => s.addSection);
  const removeSection = useProjectStore((s) => s.removeSection);
  const reorderSections = useProjectStore((s) => s.reorderSections);
  const updateSection = useProjectStore((s) => s.updateSection);

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!project) return null;

  const startRename = (sectionId: string, currentName: string) => {
    setEditingSectionId(sectionId);
    setEditingName(currentName);
  };

  const commitRename = () => {
    if (editingSectionId && editingName.trim()) {
      updateSection(editingSectionId, { name: editingName.trim() });
    }
    setEditingSectionId(null);
  };

  const moveSectionUp = (index: number) => {
    if (index === 0) return;
    const ids = project.sections.map((s) => s.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    reorderSections(ids);
  };

  const moveSectionDown = (index: number) => {
    if (index >= project.sections.length - 1) return;
    const ids = project.sections.map((s) => s.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    reorderSections(ids);
  };

  const handleDeleteSection = (sectionId: string) => {
    removeSection(sectionId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="p-4 space-y-6">
      {project.sections.map((section, index) => (
        <div key={section.id} className={`rounded-lg p-4 ${index % 2 === 1 ? 'bg-surface-100' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            {/* Section name — double-click to rename */}
            {editingSectionId === section.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingSectionId(null);
                }}
                className="text-sm font-bold bg-surface-100 border border-crimson-500 rounded px-2 py-0.5 text-crimson-400 tracking-wider focus:outline-none"
                autoFocus
              />
            ) : (
              <h2
                className="text-sm font-bold text-crimson-400 tracking-wider cursor-pointer hover:text-crimson-300"
                onDoubleClick={() => startRename(section.id, section.name)}
                title="Double-click to rename"
              >
                {section.name}
              </h2>
            )}

            {section.description && (
              <span className="text-xs text-gray-500 italic">{section.description}</span>
            )}
            <span className="text-xs text-gray-600">
              {section.shots.length} shots
            </span>

            <div className="flex-1" />

            {/* Reorder arrows */}
            <button
              className="btn btn-ghost text-[11px] px-1 disabled:opacity-30"
              onClick={() => moveSectionUp(index)}
              disabled={index === 0}
              title="Move section up"
            >
              &uarr;
            </button>
            <button
              className="btn btn-ghost text-[11px] px-1 disabled:opacity-30"
              onClick={() => moveSectionDown(index)}
              disabled={index >= project.sections.length - 1}
              title="Move section down"
            >
              &darr;
            </button>

            {/* Delete section */}
            {confirmDeleteId === section.id ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-red-400">
                  Delete section & {section.shots.length} shots?
                </span>
                <button
                  className="btn btn-ghost text-[10px] text-red-400 hover:text-red-300"
                  onClick={() => handleDeleteSection(section.id)}
                >
                  Yes
                </button>
                <button
                  className="btn btn-ghost text-[10px]"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                className="btn btn-ghost text-[10px] text-gray-500 hover:text-red-400"
                onClick={() => setConfirmDeleteId(section.id)}
                title="Delete section"
              >
                Delete
              </button>
            )}

            <button
              className="btn btn-ghost text-[11px] border border-dashed border-surface-400 hover:border-crimson-500"
              onClick={() => addShot(section.id)}
            >
              + Add Shot
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {section.shots.map((shot) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                sectionId={section.id}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Add Section button */}
      <button
        className="w-full py-3 border-2 border-dashed border-surface-400 rounded-lg text-sm text-gray-500 hover:border-crimson-500 hover:text-crimson-400 transition-colors"
        onClick={() => addSection()}
      >
        + Add Section
      </button>
    </div>
  );
}
