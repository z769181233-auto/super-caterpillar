import { CE03Input, CE03Output } from './types';

export async function ce03RealEngine(input: CE03Input): Promise<CE03Output> {
  const text = input.structured_text || '';

  const words = text.split(/\s+/);
  // Visual words vocabulary (bilingual support)
  const visualWords = [
    '看见',
    '光',
    '暗',
    '红',
    '黑',
    '白',
    '蓝',
    '绿',
    '脸',
    '眼睛',
    '天空',
    '道路',
    '房间',
    '窗',
    '门',
    '手',
    '血',
    'light',
    'shadow',
    'dark',
    'bright',
    'dim',
    'red',
    'blue',
    'green',
    'face',
    'eye',
    'sky',
    'room',
    'window',
  ];

  let visualCount = 0;
  for (const w of words) {
    if (visualWords.some((vw) => w.includes(vw))) {
      visualCount++;
    }
  }

  const density = words.length > 0 ? Math.min(1.0, (visualCount * 5) / words.length) : 0; // *5 to normalize to 0-1 range for sparse visual words

  return {
    visual_density_score: density,
    quality_indicators: {
      text_length: text.length,
      adjective_count: 0, // Fallback to comply with type
      lighting_keywords: visualCount, // Map visual count to lighting/visual keywords roughly
      camera_keywords: 0,
    },
    audit_trail: {
      engine_version: 'real-v1-algo',
      timestamp: new Date().toISOString(),
    },
    billing_usage: {
      promptTokens: text.length,
      completionTokens: 1,
      totalTokens: text.length + 1,
      model: 'ce03-algo-v1',
    },
  };
}
