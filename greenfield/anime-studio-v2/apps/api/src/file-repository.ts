import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ProjectSnapshot } from '../../../packages/domain/src';
import type { ProjectRepository, ProjectRecord } from './repository';

interface FilePayload {
  projects: ProjectRecord[];
}

function normalizeRecord(record: ProjectRecord): ProjectRecord {
  return {
    ...record,
    characters: record.characters || [],
    episodeOutlines: record.episodeOutlines || [],
    scenes: record.scenes || [],
    shots: record.shots || [],
    issues: record.issues || [],
    versions: record.versions || [],
    previewJobs: record.previewJobs || [],
    renderJobs: record.renderJobs || [],
    uploadSessions: record.uploadSessions || [],
    assets: record.assets || [],
    storedFiles: record.storedFiles || [],
    importJobs: record.importJobs || []
  };
}

export class FileProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, ProjectRecord>();

  constructor(private readonly filePath: string) {
    this.load();
  }

  async create(record: ProjectRecord): Promise<ProjectRecord> {
    this.projects.set(record.project.id, normalizeRecord(record));
    this.persist();
    return normalizeRecord(record);
  }

  async list(): Promise<ProjectSnapshot[]> {
    return Array.from(this.projects.values()).map((record) => ({ ...record }));
  }

  async get(projectId: string): Promise<ProjectRecord | undefined> {
    const record = this.projects.get(projectId);
    return record ? normalizeRecord(record) : undefined;
  }

  async save(record: ProjectRecord): Promise<ProjectRecord> {
    this.projects.set(record.project.id, normalizeRecord(record));
    this.persist();
    return normalizeRecord(record);
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    const raw = readFileSync(this.filePath, 'utf8');
    if (!raw.trim()) {
      return;
    }

    const payload = JSON.parse(raw) as FilePayload;
    for (const record of payload.projects || []) {
      this.projects.set(record.project.id, normalizeRecord(record));
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const payload: FilePayload = {
      projects: Array.from(this.projects.values())
    };
    writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}
