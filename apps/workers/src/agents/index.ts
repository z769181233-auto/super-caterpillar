import { AgentOrchestrator } from './orchestrator';
import { WriterAgent } from './writer.agent';
import { DirectorAgent } from './director.agent';
import { AuditorAgent } from './auditor.agent';
import { AgentContext, AgentRole } from './types';

export * from './types';
export * from './orchestrator';
export * from './llm-client';

export async function runMultiAgentAnalysis(context: AgentContext): Promise<any> {
  const orchestrator = new AgentOrchestrator();

  orchestrator.registerAgent(new WriterAgent());
  orchestrator.registerAgent(new DirectorAgent());
  orchestrator.registerAgent(new AuditorAgent());

  const finalContext = await orchestrator.executeChain(context);

  // Return the auditor's final output
  return finalContext.previousResults[AgentRole.AUDITOR]?.finalOutput;
}
