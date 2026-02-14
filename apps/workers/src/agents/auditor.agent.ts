import { AgentRole, AgentContext } from './types';
import { BaseAgent } from './base-agent';

export class AuditorAgent extends BaseAgent {
  public role = AgentRole.AUDITOR;

  protected getSystemPrompt(context: AgentContext): string {
    return `
你是一个专业的剧本审核 Agent。你的任务是确保剧本和导演指令的逻辑一致性、内容安全性和审美质量。
你专注于：
1. **一致性检查**：角色是否在不该出现的时候出现？环境描述是否前后矛盾？
2. **逻辑合理性**：动作描述是否符合常识？
3. **指令有效性**：导演指令是否清晰且可执行？

如果发现问题，请在 output 中标记 "issues" 数组。
`.trim();
  }

  protected getUserPrompt(context: AgentContext): string {
    const directorOutput = context.previousResults[AgentRole.DIRECTOR];
    return `
请审核以下剧本及导演指令：
${JSON.stringify(directorOutput, null, 2)}

输出要求：
1. 返回 finalOutput: 经过修正（如有必要）后的最终 JSON。
2. 返回 auditReport: 包含 "isPassed" (boolean) 和 "issues" (string[])。

输出 JSON Schema:
{
  "finalOutput": { ... 同 Director 输出 ... },
  "auditReport": {
    "isPassed": boolean,
    "issues": ["问题A", "问题B"]
  }
}
`.trim();
  }
}
