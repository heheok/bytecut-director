import type { LTXParams } from '../../types/project';

export const RESOLUTION_GROUPS = [
  {
    label: '1080p',
    options: [
      '1920x1088 (16:9)',
      '1088x1920 (9:16)',
      '1920x832 (21:9)',
      '832x1920 (9:21)',
    ],
  },
  {
    label: '720p',
    options: [
      '1280x720 (16:9)',
      '720x1280 (9:16)',
      '1280x544 (21:9)',
      '544x1280 (9:21)',
      '1104x832 (4:3)',
      '832x1104 (3:4)',
      '1024x1024 (1:1)',
      '960x960 (1:1)',
    ],
  },
  {
    label: '540p',
    options: [
      '960x544 (16:9)',
      '544x960 (9:16)',
      '832x624 (4:3)',
      '624x832 (3:4)',
      '720x720 (1:1)',
    ],
  },
  {
    label: '480p',
    options: [
      '832x480 (16:9)',
      '480x832 (9:16)',
      '512x512 (1:1)',
    ],
  },
] as const;

// Flat list for lookups
export const RESOLUTION_OPTIONS = RESOLUTION_GROUPS.flatMap((g) => g.options);

// Extract just the WxH portion for storage (strip aspect ratio label)
export function resolutionValue(display: string): string {
  return display.split(' ')[0];
}

// Find the display label for a stored resolution value
export function resolutionDisplay(value: string): string {
  return RESOLUTION_OPTIONS.find((o) => o.startsWith(value)) ?? value;
}

export const FPS_OPTIONS = ['15', '16', '23', '24', '25', '30', '50'] as const;

export const QUICK_SETTINGS_KEYS: (keyof LTXParams)[] = ['resolution', 'video_length', 'force_fps'];

export const PARAM_GROUPS: Array<{ label: string; keys: (keyof LTXParams)[] }> = [
  {
    label: 'Core Generation',
    keys: [
      'duration_seconds', 'batch_size', 'seed',
      'num_inference_steps', 'repeat_generation',
    ],
  },
  {
    label: 'Guidance',
    keys: [
      'guidance_scale', 'guidance2_scale', 'guidance3_scale',
      'embedded_guidance_scale', 'alt_guidance_scale',
      'switch_threshold', 'switch_threshold2',
      'guidance_phases', 'model_switch_phase',
    ],
  },
  {
    label: 'Audio',
    keys: [
      'audio_guidance_scale', 'audio_scale', 'audio_prompt_type',
      'speakers_locations',
    ],
  },
  {
    label: 'Image Input',
    keys: [
      'image_mode', 'image_prompt_type', 'image_refs_relative_size',
      'remove_background_images_ref', 'min_frames_if_references',
    ],
  },
  {
    label: 'Sliding Window',
    keys: [
      'sliding_window_size', 'sliding_window_overlap',
      'sliding_window_color_correction_strength',
      'sliding_window_overlap_noise', 'sliding_window_discard_last_frames',
    ],
  },
  {
    label: 'Advanced',
    keys: [
      'flow_shift', 'sample_solver', 'denoising_strength',
      'masking_strength', 'motion_amplitude', 'mask_expand',
      'skip_steps_cache_type', 'skip_steps_multiplier', 'skip_steps_start_step_perc',
    ],
  },
  {
    label: 'NAG / SLG / APG',
    keys: [
      'NAG_scale', 'NAG_tau', 'NAG_alpha',
      'slg_switch', 'slg_start_perc', 'slg_end_perc',
      'apg_switch', 'cfg_star_switch', 'cfg_zero_step',
    ],
  },
  {
    label: 'Model',
    keys: [
      'model_type', 'base_model_type', 'override_profile', 'override_attention',
      'loras_multipliers', 'settings_version',
    ],
  },
  {
    label: 'Post-Processing',
    keys: [
      'temporal_upsampling', 'spatial_upsampling',
      'film_grain_intensity', 'film_grain_saturation',
    ],
  },
  {
    label: 'MMAudio',
    keys: ['MMAudio_setting', 'MMAudio_prompt', 'MMAudio_neg_prompt'],
  },
  {
    label: 'Other',
    keys: [
      'pace', 'exaggeration', 'temperature', 'top_k',
      'RIFLEx_setting', 'prompt_enhancer', 'multi_prompts_gen_type',
      'multi_images_gen_type',
    ],
  },
];
