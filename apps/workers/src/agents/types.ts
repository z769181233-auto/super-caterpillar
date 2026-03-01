export enum AgentRole {
  WRITER = 'WRITER',
  DIRECTOR = 'DIRECTOR',
  AUDITOR = 'AUDITOR',
}

export interface AgentContext {
  projectId: string;
  traceId: string;
  rawText: string;
  chapterTitle?: string;
  chapterIndex?: number;

  // Shared state between agents
  previousResults: Record<AgentRole, any>;

  // Context from DB (Memory, States)
  memories?: {
    longTerm: string;
    shortTerm: string;
    entityStates: string;
  };

  // Metadata
  pipelineRunId?: string;
  organizationId: string;
}

export interface AgentResult {
  role: AgentRole;
  success: boolean;
  data: any;
  error?: string;
}
