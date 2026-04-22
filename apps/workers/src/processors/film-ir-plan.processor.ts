import { ProcessorContext } from '../types/processor-context';

export async function processFilmIRPlanJob(
  context: ProcessorContext
): Promise<{ success: boolean; output?: any; error?: string }> {
  const { job, apiClient } = context;
  const payload = (job.payload || {}) as Record<string, any>;

  const sceneId = payload.scene_id || payload.sceneId;
  if (!sceneId || typeof sceneId !== 'string') {
    return {
      success: false,
      error: 'Missing scene_id/sceneId for CE_FILM_IR_PLAN job',
    };
  }

  const response = await apiClient.planFilmIR({
    scene_id: sceneId,
    source_text: payload.source_text ?? payload.sourceText,
    source_context_summary: payload.source_context_summary ?? payload.sourceContextSummary,
    dramatic_goal: payload.dramatic_goal ?? payload.dramaticGoal,
    relationship_before: payload.relationship_before ?? payload.relationshipBefore,
    relationship_after: payload.relationship_after ?? payload.relationshipAfter,
    planner_version: payload.planner_version ?? payload.plannerVersion,
    dry_run: payload.dry_run ?? payload.dryRun ?? false,
    save_as_draft: payload.save_as_draft ?? payload.saveAsDraft ?? true,
  });

  return {
    success: true,
    output: response,
  };
}
