import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { DEFAULT_LTX_PARAMS } from '../../types/project';
import { useState } from 'react';
import { PARAM_GROUPS, RESOLUTION_GROUPS, RESOLUTION_OPTIONS, FPS_OPTIONS, resolutionValue } from './paramGroups';

export function GlobalParamsEditor() {
  const project = useProjectStore((s) => s.project);
  const updateDefaultParams = useProjectStore((s) => s.updateDefaultParams);
  const setGlobalParamsOpen = useUIStore((s) => s.setGlobalParamsOpen);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['Core Generation']));

  if (!project) return null;

  const effectiveParams = { ...DEFAULT_LTX_PARAMS, ...project.defaultParams };

  const toggleGroup = (label: string) => {
    const next = new Set(openGroups);
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    setOpenGroups(next);
  };

  const handleParamChange = (key: string, rawValue: string) => {
    const defaultVal = (DEFAULT_LTX_PARAMS as any)[key];
    let value: any = rawValue;
    if (typeof defaultVal === 'number') {
      value = rawValue === '' ? 0 : Number(rawValue);
    }
    updateDefaultParams({ [key]: value });
  };

  const resetParam = (key: string) => {
    // Remove this key from project.defaultParams by setting it back to the hardcoded default
    const hardcodedDefault = (DEFAULT_LTX_PARAMS as any)[key];
    updateDefaultParams({ [key]: hardcodedDefault });
  };

  const isGlobalOverridden = (key: string) => {
    return key in (project.defaultParams || {});
  };

  const overrideCount = Object.keys(project.defaultParams || {}).length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface-100 border border-surface-300 rounded-lg w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-surface-300 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-200">Global LTX-2 Params</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              These apply to all shots unless overridden per-shot. {overrideCount > 0 && (
                <span className="text-crimson-400">{overrideCount} customized</span>
              )}
            </p>
          </div>
          <button
            className="text-gray-500 hover:text-gray-300 text-xs"
            onClick={() => setGlobalParamsOpen(false)}
          >
            Close
          </button>
        </div>

        {/* Param groups */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Quick Settings */}
          <div className="border border-surface-300 rounded bg-surface-50/50 p-3 space-y-2">
            <div className="text-[11px] font-semibold text-gray-300 mb-1">Quick Settings</div>

            {/* Resolution */}
            <div className="flex items-center gap-2">
              <label className={`text-[10px] w-28 shrink-0 ${isGlobalOverridden('resolution') ? 'text-crimson-400' : 'text-gray-500'}`}>
                Resolution
              </label>
              <select
                className="input text-[11px] flex-1 py-0.5"
                value={effectiveParams.resolution}
                onChange={(e) => handleParamChange('resolution', e.target.value)}
              >
                {!RESOLUTION_OPTIONS.some((o) => o.startsWith(effectiveParams.resolution)) && (
                  <option value={effectiveParams.resolution}>{effectiveParams.resolution}</option>
                )}
                {RESOLUTION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((opt) => (
                      <option key={opt} value={resolutionValue(opt)}>{opt}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {isGlobalOverridden('resolution') && (
                <button className="text-[9px] text-gray-500 hover:text-crimson-400 shrink-0" onClick={() => resetParam('resolution')} title="Reset to default">reset</button>
              )}
            </div>

            {/* Video Length */}
            <div className="flex items-center gap-2">
              <label className={`text-[10px] w-28 shrink-0 ${isGlobalOverridden('video_length') ? 'text-crimson-400' : 'text-gray-500'}`}>
                Video Length
              </label>
              <input
                type="number"
                min={1}
                max={700}
                className="input text-[11px] flex-1 py-0.5"
                value={effectiveParams.video_length}
                onChange={(e) => handleParamChange('video_length', e.target.value)}
              />
              {isGlobalOverridden('video_length') && (
                <button className="text-[9px] text-gray-500 hover:text-crimson-400 shrink-0" onClick={() => resetParam('video_length')} title="Reset to default">reset</button>
              )}
            </div>

            {/* Force FPS */}
            <div className="flex items-center gap-2">
              <label className={`text-[10px] w-28 shrink-0 ${isGlobalOverridden('force_fps') ? 'text-crimson-400' : 'text-gray-500'}`}>
                Force FPS
              </label>
              <select
                className="input text-[11px] flex-1 py-0.5"
                value={effectiveParams.force_fps}
                onChange={(e) => handleParamChange('force_fps', e.target.value)}
              >
                {FPS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {isGlobalOverridden('force_fps') && (
                <button className="text-[9px] text-gray-500 hover:text-crimson-400 shrink-0" onClick={() => resetParam('force_fps')} title="Reset to default">reset</button>
              )}
            </div>

            {/* Duration preview */}
            {(() => {
              const fps = Number(effectiveParams.force_fps) || 24;
              const frames = effectiveParams.video_length || 0;
              const seconds = (frames / fps).toFixed(1);
              return (
                <div className="text-[10px] text-gray-400 pt-1 border-t border-surface-300">
                  {frames} frames / {fps} fps = <span className="text-gray-200 font-medium">{seconds}s</span> of video
                </div>
              );
            })()}
          </div>

          {PARAM_GROUPS.map((group) => (
            <div key={group.label} className="border border-surface-300 rounded">
              <button
                className="w-full px-3 py-1.5 text-left text-[11px] font-semibold text-gray-400
                           hover:bg-surface-200 flex items-center justify-between"
                onClick={() => toggleGroup(group.label)}
              >
                {group.label}
                <span className="text-[10px]">{openGroups.has(group.label) ? '-' : '+'}</span>
              </button>

              {openGroups.has(group.label) && (
                <div className="px-3 pb-2 space-y-1.5">
                  {group.keys.map((key) => {
                    const value = (effectiveParams as any)[key];
                    const overridden = isGlobalOverridden(key);

                    return (
                      <div key={key} className="flex items-center gap-2">
                        <label
                          className={`text-[10px] w-40 shrink-0 ${
                            overridden ? 'text-crimson-400' : 'text-gray-500'
                          }`}
                        >
                          {key}
                        </label>
                        <input
                          className="input text-[11px] flex-1 py-0.5"
                          value={value?.toString() ?? ''}
                          onChange={(e) => handleParamChange(key, e.target.value)}
                        />
                        {overridden && (
                          <button
                            className="text-[9px] text-gray-500 hover:text-crimson-400 shrink-0"
                            onClick={() => resetParam(key)}
                            title="Reset to default"
                          >
                            reset
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
