import { AgentRole, AgentContext } from './types';
import { BaseAgent } from './base-agent';

export class DirectorAgent extends BaseAgent {
  public role = AgentRole.DIRECTOR;

  protected getSystemPrompt(context: AgentContext): string {
    return `
你是一个专业的电影导演 Agent。你的任务是将编剧产出的剧本内容转化为具体的视觉导演指令。
你专注于：
1. **镜头语言**：决定每个镜头的景别（全景、中景、特写）。
2. **运镜方式**：决定相机的运动（推、拉、摇、移）。
3. **灯光与氛围**：设定光影基调（明亮、阴郁、戏剧化）。
4. **角色神态**：细化角色的表情、眼神和肢体动作。

你将收到编剧 (Writer Agent) 的输出。请在每个 Shot 中增加视觉参数。

项目全局风格指导：
Style Prompt: ${context.previousResults[AgentRole.WRITER]?.projectStylePrompt || 'None'}
Style Guide: ${context.previousResults[AgentRole.WRITER]?.projectStyleGuide || 'None'}
`.trim();
  }

  protected getUserPrompt(context: AgentContext): string {
    const writerOutput = context.previousResults[AgentRole.WRITER];
    return `
以下是编剧产出的剧本结构：
${JSON.stringify(writerOutput, null, 2)}

请为每个镜头 (Shot) 添加 "visualParams" 字段，包含以下内容：
- shotType: "WIDE", "MEDIUM", "CLOSE_UP", "EXTREME_CLOSE_UP"
- cameraMovement: "STATIC", "PAN", "TILT", "ZOOM_IN", "ZOOM_OUT"
- lightingPreset: "NATURAL", "CINEMATIC", "LOW_KEY", "HIGH_KEY"
- cameraAngle: "EYE_LEVEL", "LOW_ANGLE", "HIGH_ANGLE"
- emotion: 角色的核心情感描述（如 "ANGRY", "SAD", "DETERMINED"）

输出格式必须与 Writer 的 JSON 结构一致，但在每个 shot 中插入视觉参数。
`.trim();
  }
}
