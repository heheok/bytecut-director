import { useState, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { DEFAULT_LTX_PARAMS } from '../../types/project';
import type { Shot, Take } from '../../types/project';
import { formatTimestamp } from '../../utils/time';
import { buildShotStem } from '../../utils/filename';

interface ExportItem {
  id: string;
  label: string;
  sectionName: string;
  shotIndex: number;
  shot: Shot;
  take?: Take;
  hasImage: boolean;
  hasEndImage: boolean;
  hasAudio: boolean;
  hasPrompt: boolean;
  isApproved: boolean;
}

export function ExportPanel() {
  const project = useProjectStore((s) => s.project);
  const setExportPanelOpen = useUIStore((s) => s.setExportPanelOpen);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'with_images' | 'ready'>('all');
  const [approvalFilter, setApprovalFilter] = useState<'any' | 'approved' | 'not_approved'>('any');

  const items = useMemo(() => {
    if (!project) return [];

    const result: ExportItem[] = [];
    for (const section of project.sections) {
      for (let si = 0; si < section.shots.length; si++) {
        const shot = section.shots[si];
        if (shot.type === 'multi' && shot.takes && shot.takes.length > 0) {
          // Each take becomes a separate export item
          for (const take of shot.takes) {
            const hasImg = take.refImages.length > 0;
            const hasEndImg = (take.endRefImages || []).length > 0;
            result.push({
              id: `${shot.id}_${take.id}`,
              label: `${shot.name} > ${take.label}`,
              sectionName: section.name,
              shotIndex: si,
              shot,
              take,
              hasImage: hasImg,
              hasEndImage: hasEndImg,
              hasAudio: !!shot.audioFile,
              hasPrompt: !!shot.prompt,
              isApproved: !!take.approved,
            });
          }
        } else {
          result.push({
            id: shot.id,
            label: shot.name,
            sectionName: section.name,
            shotIndex: si,
            shot,
            hasImage: shot.refImages.length > 0,
            hasEndImage: (shot.endRefImages || []).length > 0,
            hasAudio: !!shot.audioFile,
            hasPrompt: !!shot.prompt,
            isApproved: !!shot.approved,
          });
        }
      }
    }
    return result;
  }, [project]);

  const filteredItems = useMemo(() => {
    let result = items;
    switch (filter) {
      case 'with_images':
        result = result.filter((i) => i.hasImage);
        break;
      case 'ready':
        result = result.filter((i) => i.hasImage && i.hasPrompt);
        break;
    }
    switch (approvalFilter) {
      case 'approved':
        result = result.filter((i) => i.isApproved);
        break;
      case 'not_approved':
        result = result.filter((i) => !i.isApproved);
        break;
    }
    return result;
  }, [items, filter, approvalFilter]);

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredItems.map((i) => i.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const handleExport = async () => {
    if (!project) return;
    setExporting(true);

    const exportShots = filteredItems
      .filter((item) => selectedIds.has(item.id))
      .map((item) => {
        const selectedImage = item.take
          ? item.take.refImages.find((i) => i.id === item.take!.selectedRefImageId)
          : item.shot.refImages.find((i) => i.id === item.shot.selectedRefImageId);

        const selectedEndImage = item.take
          ? (item.take.endRefImages || []).find((i) => i.id === item.take!.selectedEndRefImageId)
          : (item.shot.endRefImages || []).find((i) => i.id === item.shot.selectedEndRefImageId);

        const outputName = buildShotStem(
          item.sectionName, item.shotIndex, item.shot.name,
          item.take?.label
        );

        return {
          prompt: item.shot.prompt,
          refImagePath: selectedImage?.filename || null,
          endRefImagePath: selectedEndImage?.filename || null,
          audioPath: item.shot.audioFile || null,
          params: {
            ...DEFAULT_LTX_PARAMS,
            ...project.defaultParams,
            ...item.shot.params,
            output_filename: outputName,
          },
        };
      });

    try {
      const res = await fetch('/api/export/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shots: exportShots,
          defaultParams: { ...DEFAULT_LTX_PARAMS, ...project.defaultParams },
        }),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'queue.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    }
    setExporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-100 border border-surface-300 rounded-lg w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-surface-300 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-200">Export Queue.zip</h2>
          <button
            className="text-gray-500 hover:text-gray-300 text-xs"
            onClick={() => setExportPanelOpen(false)}
          >
            Close
          </button>
        </div>

        {/* Filter + actions */}
        <div className="px-5 py-2 border-b border-surface-300 flex items-center gap-3 flex-wrap">
          <div className="flex bg-surface-200 rounded-md p-0.5">
            {(['all', 'with_images', 'ready'] as const).map((f) => (
              <button
                key={f}
                className={`px-2 py-1 rounded text-[11px] ${
                  filter === f ? 'bg-surface-400 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'with_images' ? 'Has Image' : 'Ready'}
              </button>
            ))}
          </div>

          <div className="flex bg-surface-200 rounded-md p-0.5">
            {(['any', 'approved', 'not_approved'] as const).map((f) => (
              <button
                key={f}
                className={`px-2 py-1 rounded text-[11px] ${
                  approvalFilter === f
                    ? f === 'approved' ? 'bg-amber-600 text-white' : 'bg-surface-400 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setApprovalFilter(f)}
              >
                {f === 'any' ? 'Any' : f === 'approved' ? 'Approved' : 'Not Approved'}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <button className="btn btn-ghost text-[11px]" onClick={selectAll}>
            Select All ({filteredItems.length})
          </button>
          <button className="btn btn-ghost text-[11px]" onClick={selectNone}>
            Select None
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1">
          {filteredItems.map((item) => (
            <label
              key={item.id}
              className={`flex items-center gap-3 px-3 py-1.5 rounded cursor-pointer
                text-xs hover:bg-surface-200 ${
                  selectedIds.has(item.id) ? 'bg-surface-200' : ''
                }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => toggleItem(item.id)}
                className="rounded"
              />
              <span className="flex-1 text-gray-300 truncate">{item.label}</span>
              <span className={`w-2 h-2 rounded-full ${item.hasImage ? 'bg-green-500' : 'bg-surface-500'}`} title="Start Image" />
              <span className={`w-2 h-2 rounded-full ${item.hasEndImage ? 'bg-blue-500' : 'bg-surface-500'}`} title="End Image" />
              <span className={`w-2 h-2 rounded-full ${item.hasAudio ? 'bg-green-500' : 'bg-surface-500'}`} title="Audio" />
              <span className={`w-2 h-2 rounded-full ${item.hasPrompt ? 'bg-green-500' : 'bg-surface-500'}`} title="Prompt" />
              <span className={`w-2 h-2 rounded-full ${item.isApproved ? 'bg-amber-500' : 'bg-surface-500'}`} title="Approved" />
            </label>
          ))}

          {filteredItems.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-8">
              No items match the current filter
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-300 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {selectedIds.size} of {filteredItems.length} selected
          </span>
          <button
            className="btn btn-primary"
            disabled={selectedIds.size === 0 || exporting}
            onClick={handleExport}
          >
            {exporting ? 'Building ZIP...' : `Export ${selectedIds.size} shots`}
          </button>
        </div>
      </div>
    </div>
  );
}
