import { AgentRole, AgentContext, AgentResult } from './types';
import { defaultLLMClient, LLMClient } from './llm-client';

export abstract class BaseAgent {
  public abstract role: AgentRole;
  protected llm: LLMClient = defaultLLMClient;

  constructor() {}

  /**
   * 构建 System Prompt
   */
  protected abstract getSystemPrompt(context: AgentContext): string;

  /**
   * 构建 User Prompt
   */
  protected abstract getUserPrompt(context: AgentContext): string;

  /**
   * 执行 Agent 逻辑
   */
  async run(context: AgentContext): Promise<AgentResult> {
    try {
      const systemPrompt = this.getSystemPrompt(context);
      const userPrompt = this.getUserPrompt(context);

      const data = await this.llm.call({
        systemPrompt,
        userPrompt,
      });

      return {
        role: this.role,
        success: true,
        data,
      };
    } catch (e: any) {
      return {
        role: this.role,
        success: false,
        data: null,
        error: e.message,
      };
    }
  }
}
