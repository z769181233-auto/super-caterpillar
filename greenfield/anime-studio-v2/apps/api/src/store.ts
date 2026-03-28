import type {
  AssetLibraryItem,
  CharacterProfile,
  ConsistencyIssue,
  EpisodeOutline,
  ImportJob,
  NovelImport,
  NovelUploadSession,
  ProjectSnapshot,
  PreviewVideoJob,
  RenderJob,
  SceneScript,
  ShotScript,
  StoredFile,
  VersionRecord
} from '../../../packages/domain/src';
import type { ProjectRepository, ProjectRecord } from './repository';

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, ProjectRecord>();

  async create(record: ProjectRecord): Promise<ProjectRecord> {
    this.projects.set(record.project.id, record);
    return record;
  }

  async list(): Promise<ProjectSnapshot[]> {
    return Array.from(this.projects.values()).map((record) => ({ ...record }));
  }

  async get(projectId: string): Promise<ProjectRecord | undefined> {
    return this.projects.get(projectId);
  }

  async save(record: ProjectRecord): Promise<ProjectRecord> {
    this.projects.set(record.project.id, record);
    return record;
  }
}

export type {
  AssetLibraryItem,
  CharacterProfile,
  ConsistencyIssue,
  EpisodeOutline,
  ImportJob,
  NovelImport,
  NovelUploadSession,
  ProjectRecord,
  ProjectSnapshot,
  PreviewVideoJob,
  RenderJob,
  SceneScript,
  ShotScript,
  StoredFile,
  VersionRecord
};
