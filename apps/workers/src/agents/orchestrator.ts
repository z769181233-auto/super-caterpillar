import { AgentRole, AgentContext, AgentResult } from './types';
import { BaseAgent } from './base-agent';

export class AgentOrchestrator {
  private agents: Map<AgentRole, BaseAgent> = new Map();

  registerAgent(agent: BaseAgent) {
    this.agents.set(agent.role, agent);
  }

  /**
   * 按顺序执行 Agent 链路
   * Writer -> Director -> Auditor
   */
  async executeChain(context: AgentContext): Promise<AgentContext> {
    const rolesInOrder = [AgentRole.WRITER, AgentRole.DIRECTOR, AgentRole.AUDITOR];

    for (const role of rolesInOrder) {
      const agent = this.agents.get(role);
      if (!agent) {
        console.warn(`[Orchestrator] No agent registered for role: ${role}. Skipping.`);
        continue;
      }

      console.log(`[Orchestrator] Running Agent: ${role}...`);
      const result = await agent.run(context);

      if (!result.success) {
        throw new Error(`Agent ${role} failed: ${result.error}`);
      }

      // 将结果存入 context 供后续 Agent 使用
      context.previousResults[role] = result.data;
      console.log(`[Orchestrator] Agent ${role} completed successfully.`);
    }

    return context;
  }
}
