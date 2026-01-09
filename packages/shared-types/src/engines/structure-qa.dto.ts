// Stage4: Structure Quality Assessment Engine DTO (MVP)

export interface StructureQAEngineInput {
  projectId: string;
  options?: Record<string, unknown>;
}

export interface StructureQAEngineOutput {
  overallScore: number;
  issues: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
  }>;
}
