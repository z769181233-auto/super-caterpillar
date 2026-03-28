import type { ProjectStage, VersionAction, VersionRecord } from '../../../packages/domain/src';
import { createId } from './id';
import type { ProjectRecord } from './repository';

function now(): string {
  return new Date().toISOString();
}

export function appendVersion(
  record: ProjectRecord,
  input: {
    stage: ProjectStage;
    action: VersionAction;
    summary: string;
    detail: string;
    metadata?: VersionRecord['metadata'];
  }
): VersionRecord {
  const nextVersionNo = (record.versions.at(-1)?.versionNo || 0) + 1;
  const version: VersionRecord = {
    id: createId('version'),
    projectId: record.project.id,
    versionNo: nextVersionNo,
    stage: input.stage,
    action: input.action,
    summary: input.summary,
    detail: input.detail,
    metadata: input.metadata,
    createdAt: now()
  };

  record.versions = record.versions.concat(version);
  return version;
}
