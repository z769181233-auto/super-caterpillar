import { VG05Input, VG05Output, VFXPreset } from './types';
import { LLMClient } from '@scu/shared';

/**
 * VG05 VFX Compositor Engine - Real Implementation
 *
 * Uses AI to choose artistic post-processing filters.
 */
export async function vg05RealEngine(input: VG05Input): Promise<VG05Output> {
  const context = input.scene_context || '';

  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  const isAiMode = !!apiKey && process.env.ENABLE_VG05_AI === '1';

  if (isAiMode && apiKey) {
    try {
      const llmClient = new LLMClient();
      const provider = process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai';
      const model = provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4-turbo-preview';

      const response = await llmClient.chat({
        provider: provider as any,
        model,
        apiKey,
        messages: [
          {
            role: 'system',
            content: `你是一个专业的电影后期调色师和特效师。请根据场景描述和节奏感选择最合适的后期视觉效果。
可选预设：
- grain: 电影胶片颗粒
- vignette: 暗角
- sepia: 怀旧色板
- scanlines: 扫描线（科幻/监控感）
- bloom: 柔光扩散
- glitch: 信号故障（赛博朋克/惊悚）
- dreamy: 梦幻/朦胧

返回格式为 JSON：
{
  "vfx_preset": "grain",
  "intensity": 0.5,
  "reason": "为了增强质感..."
}`,
          },
          {
            role: 'user',
            content: `场景：${context}\n节奏分：${input.pacing_score || 0.5}`,
          },
        ],
        temperature: 0.1,
        responseFormat: 'json_object',
      });

      const result = JSON.parse(response.content);
      const vfx = result.vfx_preset as VFXPreset;
      const intensity = result.intensity;

      return {
        vfx_preset: vfx,
        intensity,
        filter_string: generateFilterString(vfx, intensity),
        description: result.reason || context,
        audit_trail: {
          engine_version: `real-v1-ai-${model}`,
          timestamp: new Date().toISOString(),
        },
        billing_usage: response.usage ? { ...response.usage, model } : undefined,
      };
    } catch (error: any) {
      console.warn(`[VG05] AI VFX design failed, falling back to rule logic: ${error.message}`);
    }
  }

  // Fallback Rule-based logic
  let vfx: VFXPreset = 'grain';
  if (context.includes('梦') || context.includes('幻')) vfx = 'dreamy';
  else if (context.includes('电脑') || context.includes('警告')) vfx = 'glitch';

  return {
    vfx_preset: vfx,
    intensity: 0.5,
    filter_string: generateFilterString(vfx, 0.5),
    description: `Fallback: ${vfx}`,
    audit_trail: {
      engine_version: 'real-v1-fallback',
      timestamp: new Date().toISOString(),
    },
  };
}

function generateFilterString(vfx: VFXPreset, intensity: number): string {
  const i = intensity;
  switch (vfx) {
    case 'grain':
      return `noise=alls=${Math.floor(i * 30)}:allf=t+u`;
    case 'vignette':
      return `vignette=PI/${Math.max(2, 6 - i * 4)}`;
    case 'sepia':
      return 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';
    case 'scanlines':
      return 'drawbox=y=ih/2:w=iw:h=1:color=black@0.5:t=fill';
    case 'bloom':
      return 'unsharp=7:7:0.8:7:7:0.5';
    case 'glitch':
      return 'frei0r=filter_name=glitch0r'; // Assuming frei0r is available
    case 'dreamy':
      return 'gblur=sigma=2,unsharp=5:5:1.0:5:5:0.0';
    default:
      return 'null';
  }
}
