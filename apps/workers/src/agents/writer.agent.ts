import { AgentRole, AgentContext } from './types';
import { BaseAgent } from './base-agent';

export class WriterAgent extends BaseAgent {
  public role = AgentRole.WRITER;

  protected getSystemPrompt(context: AgentContext): string {
    return `
你是一个专业的编剧 Agent。你的任务是将小说原文转化为结构化的剧本分镜基础。
你专注于：
1. **场景切分**：识别物理时空的变换。
2. **角色行为**：提取角色的具体动作、神态和对白。
3. **叙事节奏**：保留原有的文学张力，并转化为可拍摄的视觉线索。

上下文参考：
${context.memories?.longTerm || ''}
${context.memories?.shortTerm || ''}
${context.memories?.entityStates || ''}

输出必须是 JSON 格式。
`.trim();
  }

  protected getUserPrompt(context: AgentContext): string {
    return `
分析以下小说文本片段：

章节：${context.chapterTitle || '未知'}
内容：
${context.rawText}

要求：
1. 识别所有场景 (Scenes)。
2. 每个场景包含多个镜头 (Shots)。
3. 每个镜头必须包含：
   - text: 镜头的原始文本或动作描述。
   - summary: 镜头的简短摘要。
   - characters: 场景中出现的角色列表。

输出 JSON Schema:
{
  "scenes": [
    {
      "index": number,
      "title": "场景标题",
      "summary": "场景描述",
      "shots": [
        {
          "index": number,
          "text": "描述性文本",
          "summary": "简短描述",
          "characters": ["角色A", "角色B"]
        }
      ]
    }
  ]
}
`.trim();
  }
}
