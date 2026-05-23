export type ProjectStage =
  | 'project_created'
  | 'novel_imported'
  | 'episode_outlined'
  | 'scene_scripted'
  | 'shot_scripted'
  | 'reviewed'
  | 'preview_prepared'
  | 'render_submitted'
  | 'render_completed';

export type AdaptationMode = 'faithful' | 'commercial' | 'fast_paced';

export type EvidenceLevel =
  | 'source_explicit'
  | 'context_inferred'
  | 'style_enhanced'
  | 'manual_review_required';

export type ConsistencySeverity = 'low' | 'medium' | 'high';
export type VersionAction =
  | 'project_initialized'
  | 'novel_imported'
  | 'upload_session_created'
  | 'upload_session_completed'
  | 'source_file_uploaded'
  | 'import_job_created'
  | 'import_job_completed'
  | 'episode_outline_generated'
  | 'scene_scripts_generated'
  | 'shot_scripts_generated'
  | 'consistency_reviewed'
  | 'episode_package_generated'
  | 'preview_job_prepared'
  | 'render_job_dispatched'
  | 'render_job_completed'
  | 'asset_registered';
export type VersionMetadataValue = string | number | boolean | null;
export type PreviewVideoProvider = 'mock_storyboard' | 'sora' | 'jimeng';
export type PreviewVideoStatus = 'queued' | 'prompt_ready' | 'handoff_ready' | 'failed';
export type RenderProvider = 'mock_video' | 'sora' | 'jimeng';
export type RenderJobStatus = 'queued' | 'submitted' | 'completed' | 'failed';
export type RenderQualityPreset = 'draft' | 'preview' | 'final';
export type UploadSessionStatus = 'receiving' | 'assembled' | 'imported' | 'failed';
export type AssetType =
  | 'character_sheet'
  | 'location_board'
  | 'prop_sheet'
  | 'reference_frame'
  | 'music_brief'
  | 'style_bible';
export type AssetStatus = 'draft' | 'ready' | 'archived';
export type StoredFileKind = 'novel_source' | 'asset_attachment';
export type ImportJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Project {
  id: string;
  name: string;
  description?: string;
  stage: ProjectStage;
  createdAt: string;
  updatedAt: string;
}

export interface NovelChapter {
  id: string;
  chapterNo: number;
  title: string;
  summary: string;
  excerpt: string;
  wordCount: number;
}

export interface NovelImport {
  id: string;
  projectId: string;
  title: string;
  author?: string;
  wordCount: number;
  chapterCount: number;
  chapters: NovelChapter[];
  createdAt: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  role: 'protagonist' | 'supporting';
  identitySummary: string;
  speechStyle: string;
}

export interface EpisodeOutline {
  id: string;
  projectId: string;
  episodeNo: number;
  adaptationMode: AdaptationMode;
  estimatedMinutes: number;
  title: string;
  theme: string;
  logline: string;
  storyGoal: string;
  progressPoint: string;
  climax: string;
  endingHook: string;
  createdAt: string;
}

export interface SceneScript {
  id: string;
  projectId: string;
  episodeOutlineId: string;
  sceneNo: number;
  title: string;
  location: string;
  timeOfDay: string;
  characters: string[];
  sceneGoal: string;
  conflictSource: string;
  actionText: string;
  dialogueText: string;
  emotionGoal: string;
  exitResult: string;
  evidenceLevel: EvidenceLevel;
}

export interface ShotScript {
  id: string;
  projectId: string;
  sceneId: string;
  shotNo: number;
  shotType: 'establishing' | 'wide' | 'medium' | 'closeup' | 'insert';
  cameraAngle: string;
  cameraMove: string;
  durationSec: number;
  visualFocus: string;
  performanceFocus: string;
}

export interface ConsistencyIssue {
  id: string;
  projectId: string;
  type: 'character' | 'location' | 'timeline' | 'narrative';
  severity: ConsistencySeverity;
  description: string;
  suggestion: string;
}

export interface VersionRecord {
  id: string;
  projectId: string;
  versionNo: number;
  stage: ProjectStage;
  action: VersionAction;
  summary: string;
  detail: string;
  metadata?: Record<string, VersionMetadataValue>;
  createdAt: string;
}

export interface PreviewAsset {
  kind: 'prompt_sheet' | 'storyboard_manifest' | 'camera_plan';
  title: string;
  content: string;
}

export interface PreviewVideoJob {
  id: string;
  projectId: string;
  episodeOutlineId: string;
  episodeNo: number;
  provider: PreviewVideoProvider;
  status: PreviewVideoStatus;
  objective: string;
  requestSummary: string;
  promptPacket: string;
  sceneCount: number;
  shotCount: number;
  warnings: string[];
  assets: PreviewAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface RenderArtifact {
  kind: 'video' | 'thumbnail' | 'contact_sheet' | 'provider_payload';
  title: string;
  url: string;
  mimeType: string;
}

export interface RenderJob {
  id: string;
  projectId: string;
  previewJobId: string;
  episodeNo: number;
  provider: RenderProvider;
  status: RenderJobStatus;
  qualityPreset: RenderQualityPreset;
  requestSummary: string;
  outputSummary: string;
  externalJobId?: string;
  warnings: string[];
  artifacts: RenderArtifact[];
  createdAt: string;
  updatedAt: string;
}

export interface NovelUploadSession {
  id: string;
  projectId: string;
  title: string;
  author?: string;
  totalChunks: number;
  receivedChunks: number;
  totalCharacters: number;
  status: UploadSessionStatus;
  chunks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AssetLibraryItem {
  id: string;
  projectId: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  description: string;
  sourceUrl?: string;
  sourceFileId?: string;
  tags: string[];
  promptHint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredFile {
  id: string;
  projectId: string;
  name: string;
  kind: StoredFileKind;
  mimeType: string;
  byteSize: number;
  absolutePath: string;
  createdAt: string;
}

export interface ImportJob {
  id: string;
  projectId: string;
  fileId: string;
  title: string;
  author?: string;
  status: ImportJobStatus;
  errorMessage?: string;
  importedWordCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSnapshot {
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

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface ImportNovelInput {
  title: string;
  author?: string;
  text: string;
}

export interface GenerateEpisodeOutlineInput {
  episodeNo: number;
  estimatedMinutes?: number;
  adaptationMode?: AdaptationMode;
}

export interface EpisodePackage {
  outline: EpisodeOutline;
  scenes: SceneScript[];
  shots: ShotScript[];
  issues: ConsistencyIssue[];
}

export interface CreatePreviewVideoJobInput {
  episodeNo: number;
  provider?: PreviewVideoProvider;
  objective?: string;
}

export interface CreateRenderJobInput {
  episodeNo: number;
  provider?: RenderProvider;
  qualityPreset?: RenderQualityPreset;
}

export interface UpdateRenderJobStatusInput {
  status: Exclude<RenderJobStatus, 'queued'>;
  outputSummary?: string;
  externalJobId?: string;
  warnings?: string[];
  artifacts?: RenderArtifact[];
}

export interface CreateUploadSessionInput {
  title: string;
  author?: string;
  totalChunks: number;
}

export interface UploadChunkInput {
  index: number;
  content: string;
}

export interface CreateAssetItemInput {
  name: string;
  type: AssetType;
  description: string;
  sourceUrl?: string;
  sourceFileId?: string;
  tags?: string[];
  promptHint?: string;
}

export interface CreateStoredFileInput {
  name: string;
  kind: StoredFileKind;
  mimeType: string;
  contentBase64: string;
}

export interface CreateImportJobInput {
  fileId: string;
  title: string;
  author?: string;
}
