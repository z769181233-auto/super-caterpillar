export const PIPELINE_PROD_VIDEO_V1 = {
  id: 'pipeline_prod_video_v1',
  version: '1.0.0',
  description: 'Production Slice V1: CE06->CE03->CE04->SHOT->VIDEO->CE09',
  stages: [
    {
      id: 'step_2_density',
      engineKey: 'ce03_visual_density',
      next: ['step_3_enrichment'],
    },
    {
      id: 'step_3_enrichment',
      engineKey: 'ce04_visual_enrichment',
      next: ['step_4_shot_render'],
    },
    {
      id: 'step_4_shot_render',
      engineKey: 'real_shot_render', // Correct Key for Real SD
      next: ['step_5_video_render'],
    },
    {
      id: 'step_5_video_render',
      engineKey: 'video_merge', // Legacy key, mapped to Real FFmpeg
      next: ['step_6_media_security'],
    },
    {
      id: 'step_6_media_security',
      engineKey: 'ce09_security_real', // Correct Key for Real Watermark
      next: [], // End
    },
  ],
};
