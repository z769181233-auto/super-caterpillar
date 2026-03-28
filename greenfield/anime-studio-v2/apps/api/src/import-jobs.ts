import type { CreateImportJobInput, ImportJob, NovelImport } from '../../../packages/domain/src';
import { createId } from './id';

function now(): string {
  return new Date().toISOString();
}

export function createImportJob(projectId: string, input: CreateImportJobInput): ImportJob {
  return {
    id: createId('importjob'),
    projectId,
    fileId: input.fileId,
    title: input.title.trim(),
    author: input.author?.trim() || undefined,
    status: 'queued',
    createdAt: now(),
    updatedAt: now()
  };
}

export function markImportJobRunning(job: ImportJob): void {
  job.status = 'running';
  job.updatedAt = now();
  job.errorMessage = undefined;
}

export function markImportJobCompleted(job: ImportJob, novel: NovelImport): void {
  job.status = 'completed';
  job.importedWordCount = novel.wordCount;
  job.updatedAt = now();
}

export function markImportJobFailed(job: ImportJob, errorMessage: string): void {
  job.status = 'failed';
  job.errorMessage = errorMessage;
  job.updatedAt = now();
}
