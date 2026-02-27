export interface Project {
  id: string;
  name: string;
  bpm: number;
  sections: Section[];
  defaultParams: LTXParams;
  masterAudio?: string;
}

export interface Section {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  description: string;
  shots: Shot[];
}

export interface VideoFile {
  path: string;
  importedAt: number;
}

export interface Shot {
  id: string;
  name: string;
  type: 'solo' | 'multi';
  startTime: number;
  endTime: number;
  lyric: string;
  concept: string;
  prompt: string;
  refImagePrompt: string;
  refImages: RefImage[];
  selectedRefImageId?: string;
  endRefImages: RefImage[];
  selectedEndRefImageId?: string;
  audioFile?: string;
  videoFiles?: VideoFile[];
  selectedVideoIdx?: number;
  takes?: Take[];
  params?: Partial<LTXParams>;
  approved?: boolean;
}

export interface Take {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  concept: string;
  refImagePrompt: string;
  refImages: RefImage[];
  selectedRefImageId?: string;
  endRefImages: RefImage[];
  selectedEndRefImageId?: string;
  videoFiles?: VideoFile[];
  selectedVideoIdx?: number;
  approved?: boolean;
}

export interface RefImage {
  id: string;
  filename: string;
  path: string;
  thumbnailPath: string;
}

export interface LTXParams {
  image_mode: number;
  prompt: string;
  alt_prompt: string;
  negative_prompt: string;
  resolution: string;
  video_length: number;
  duration_seconds: number;
  batch_size: number;
  seed: number;
  force_fps: string;
  num_inference_steps: number;
  guidance_scale: number;
  guidance2_scale: number;
  guidance3_scale: number;
  switch_threshold: number;
  switch_threshold2: number;
  guidance_phases: number;
  model_switch_phase: number;
  alt_guidance_scale: number;
  audio_guidance_scale: number;
  audio_scale: number;
  flow_shift: number;
  sample_solver: string;
  embedded_guidance_scale: number;
  repeat_generation: number;
  multi_prompts_gen_type: number;
  multi_images_gen_type: number;
  skip_steps_cache_type: string;
  skip_steps_multiplier: number;
  skip_steps_start_step_perc: number;
  loras_multipliers: string;
  image_prompt_type: string;
  image_start: string | null;
  image_end: string | null;
  model_mode: string | null;
  video_source: string | null;
  keep_frames_video_source: string;
  input_video_strength: number;
  video_guide_outpainting: string;
  video_prompt_type: string;
  image_refs: string | null;
  frames_positions: string | null;
  video_guide: string | null;
  image_guide: string | null;
  keep_frames_video_guide: string;
  denoising_strength: number;
  masking_strength: number;
  video_mask: string | null;
  image_mask: string | null;
  control_net_weight: number;
  control_net_weight2: number;
  control_net_weight_alt: number;
  motion_amplitude: number;
  mask_expand: number;
  audio_guide: string | null;
  audio_guide2: string | null;
  custom_guide: string | null;
  audio_source: string | null;
  audio_prompt_type: string;
  speakers_locations: string;
  sliding_window_size: number;
  sliding_window_overlap: number;
  sliding_window_color_correction_strength: number;
  sliding_window_overlap_noise: number;
  sliding_window_discard_last_frames: number;
  image_refs_relative_size: number;
  remove_background_images_ref: number;
  temporal_upsampling: string;
  spatial_upsampling: string;
  film_grain_intensity: number;
  film_grain_saturation: number;
  MMAudio_setting: number;
  MMAudio_prompt: string;
  MMAudio_neg_prompt: string;
  RIFLEx_setting: number;
  NAG_scale: number;
  NAG_tau: number;
  NAG_alpha: number;
  slg_switch: number;
  slg_layers: number[];
  slg_start_perc: number;
  slg_end_perc: number;
  apg_switch: number;
  cfg_star_switch: number;
  cfg_zero_step: number;
  prompt_enhancer: string;
  min_frames_if_references: number;
  override_profile: number;
  override_attention: string;
  pace: number;
  exaggeration: number;
  temperature: number;
  top_k: number;
  output_filename: string;
  mode: string;
  activated_loras: string[];
  model_type: string;
  settings_version: number;
  base_model_type: string;
}

export const DEFAULT_LTX_PARAMS: LTXParams = {
  image_mode: 0,
  prompt: '',
  alt_prompt: '',
  negative_prompt: '',
  resolution: '960x544',
  video_length: 470,
  duration_seconds: 0,
  batch_size: 1,
  seed: -1,
  force_fps: '24',
  num_inference_steps: 8,
  guidance_scale: 4,
  guidance2_scale: 5,
  guidance3_scale: 5,
  switch_threshold: 0,
  switch_threshold2: 0,
  guidance_phases: 2,
  model_switch_phase: 1,
  alt_guidance_scale: 1,
  audio_guidance_scale: 4,
  audio_scale: 2,
  flow_shift: 5,
  sample_solver: '',
  embedded_guidance_scale: 6,
  repeat_generation: 1,
  multi_prompts_gen_type: 0,
  multi_images_gen_type: 0,
  skip_steps_cache_type: '',
  skip_steps_multiplier: 1.75,
  skip_steps_start_step_perc: 0,
  loras_multipliers: '1.0',
  image_prompt_type: '',
  image_start: null,
  image_end: null,
  model_mode: null,
  video_source: null,
  keep_frames_video_source: '',
  input_video_strength: 1,
  video_guide_outpainting: '',
  video_prompt_type: '',
  image_refs: null,
  frames_positions: null,
  video_guide: null,
  image_guide: null,
  keep_frames_video_guide: '',
  denoising_strength: 1.0,
  masking_strength: 1.0,
  video_mask: null,
  image_mask: null,
  control_net_weight: 1,
  control_net_weight2: 1,
  control_net_weight_alt: 1,
  motion_amplitude: 1.0,
  mask_expand: 0,
  audio_guide: null,
  audio_guide2: null,
  custom_guide: null,
  audio_source: null,
  audio_prompt_type: 'A',
  speakers_locations: '0:45 55:100',
  sliding_window_size: 501,
  sliding_window_overlap: 17,
  sliding_window_color_correction_strength: 0,
  sliding_window_overlap_noise: 0,
  sliding_window_discard_last_frames: 0,
  image_refs_relative_size: 50,
  remove_background_images_ref: 1,
  temporal_upsampling: '',
  spatial_upsampling: '',
  film_grain_intensity: 0,
  film_grain_saturation: 0.5,
  MMAudio_setting: 0,
  MMAudio_prompt: '',
  MMAudio_neg_prompt: '',
  RIFLEx_setting: 0,
  NAG_scale: 1,
  NAG_tau: 3.5,
  NAG_alpha: 0.5,
  slg_switch: 0,
  slg_layers: [29],
  slg_start_perc: 10,
  slg_end_perc: 90,
  apg_switch: 0,
  cfg_star_switch: 0,
  cfg_zero_step: -1,
  prompt_enhancer: '',
  min_frames_if_references: 1,
  override_profile: 2,
  override_attention: 'sage2',
  pace: 0.5,
  exaggeration: 0.5,
  temperature: 0.8,
  top_k: 50,
  output_filename: '',
  mode: '',
  activated_loras: [],
  model_type: 'ltx2_distilled',
  settings_version: 2.45,
  base_model_type: 'ltx2_19B',
};
