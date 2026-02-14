import { VG04Input, VG04Output, CameraMotionMode, CameraKeyframe } from './types';
import { LLMClient } from '@scu/shared';

/**
 * VG04 Camera Path Engine - Real Implementation
 * 
 * Uses AI to decide the best camera motion based on narrative context.
 */
export async function vg04RealEngine(input: VG04Input): Promise<VG04Output> {
    const description = input.shot_description || '';
    const duration = input.duration || 5;
    const fps = input.fps || 24;

    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const isAiMode = !!apiKey && process.env.ENABLE_VG04_AI === '1';

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
                        content: `你是一个专业的电影摄影指导 (DP)。请为给定的镜头描述选择最合适的运镜方式。
可选模式：
- static: 固定机位
- pan: 水平摇镜头
- tilt: 垂直摇镜头
- zoom: 变焦（推/拉）
- dolly: 移镜头
- orbit: 环绕镜头

请返回 JSON 格式：
{
  "mode": "pan",
  "reason": "为了追踪角色的跑动..."
}`,
                    },
                    {
                        role: 'user',
                        content: `镜头描述：${description}\n节奏感：${input.pacing_score || 0.5}`,
                    },
                ],
                temperature: 0.1,
                responseFormat: 'json_object',
            });

            const result = JSON.parse(response.content);
            const mode = result.mode as CameraMotionMode;

            return {
                mode,
                duration,
                fps,
                description: result.reason || description,
                keyframes: generateKeyframes(mode, duration, fps),
                audit_trail: {
                    engine_version: `real-v1-ai-${model}`,
                    timestamp: new Date().toISOString(),
                },
                billing_usage: response.usage ? { ...response.usage, model } : undefined,
            };
        } catch (error: any) {
            console.warn(`[VG04] AI Camera path generation failed, falling back to rule logic: ${error.message}`);
        }
    }

    // Fallback Rule-based logic
    let mode: CameraMotionMode = 'static';
    if (description.includes('跑') || description.includes('追')) mode = 'dolly';
    else if (description.includes('环视') || description.includes('全景')) mode = 'pan';
    else if (description.includes('特写') || description.includes('注视')) mode = 'zoom';

    return {
        mode,
        duration,
        fps,
        description: `Fallback: ${mode}`,
        keyframes: generateKeyframes(mode, duration, fps),
        audit_trail: {
            engine_version: 'real-v1-fallback',
            timestamp: new Date().toISOString(),
        },
    };
}

function generateKeyframes(mode: CameraMotionMode, duration: number, fps: number): CameraKeyframe[] {
    const keyframes: CameraKeyframe[] = [];
    const totalFrames = Math.floor(duration * fps);
    const steps = 5;

    for (let i = 0; i <= totalFrames; i += Math.ceil(fps / steps)) {
        let x = 0, y = 0, z = 0;
        const progress = i / totalFrames;

        if (mode === 'pan') x = progress * 10;
        else if (mode === 'zoom') z = progress * 5;
        else if (mode === 'tilt') y = progress * 5;
        else if (mode === 'dolly') z = progress * 10;
        else if (mode === 'orbit') {
            x = Math.sin(progress * Math.PI) * 10;
            z = Math.cos(progress * Math.PI) * 10;
        }

        keyframes.push({
            frame: i,
            x: parseFloat(x.toFixed(2)),
            y: parseFloat(y.toFixed(2)),
            z: parseFloat(z.toFixed(2))
        });
    }
    return keyframes;
}
