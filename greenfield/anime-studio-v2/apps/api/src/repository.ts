import type {
  AssetLibraryItem,
  CharacterProfile,
  ConsistencyIssue,
  EpisodeOutline,
  ImportJob,
  NovelImport,
  NovelUploadSession,
  Project,
  ProjectSnapshot,
  PreviewVideoJob,
  RenderJob,
  SceneScript,
  ShotScript,
  StoredFile,
  VersionRecord
} from '../../../packages/domain/src';

export interface ProjectRecord {
  project: Project;
  novel?: NovelImport;
  characters: CharacterProfile[];
  episodeOutlines: EpisodeOutline[];
  scenes: SceneScript[];
  shots: ShotScript[];
  issues: ConsistencyIssue[];
  versions: VersionRecord[];
  previewJobs: PreviewVideoJob[];
  renderJobs: RenderJob[];
  uploadSessions: NovelUploadSession[];
  assets: AssetLibraryItem[];
  storedFiles: StoredFile[];
  importJobs: ImportJob[];
}

export interface ProjectRepository {
  create(record: ProjectRecord): Promise<ProjectRecord>;
  list(): Promise<ProjectSnapshot[]>;
  get(projectId: string): Promise<ProjectRecord | undefined>;
  save(record: ProjectRecord): Promise<ProjectRecord>;
}
