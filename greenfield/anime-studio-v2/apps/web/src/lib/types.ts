export interface Project {
  id: string;
  name: string;
  description?: string;
  stage: string;
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
}

export interface CharacterProfile {
  id: string;
  name: string;
  role: string;
  identitySummary: string;
  speechStyle: string;
}

export interface EpisodeOutline {
  id: string;
  episodeNo: number;
  title: string;
  theme: string;
  logline: string;
  storyGoal: string;
  climax: string;
  endingHook: string;
}

export interface SceneScript {
  id: string;
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
  evidenceLevel: string;
}

export interface ShotScript {
  id: string;
  shotNo: number;
  shotType: string;
  cameraAngle: string;
  cameraMove: string;
  durationSec: number;
  visualFocus: string;
  performanceFocus: string;
}

export interface ConsistencyIssue {
  id: string;
  type: string;
  severity: string;
  description: string;
  suggestion: string;
}

export interface VersionRecord {
  id: string;
  projectId: string;
  versionNo: number;
  stage: string;
  action: string;
  summary: string;
  detail: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface PreviewAsset {
  kind: string;
  title: string;
  content: string;
}

export interface PreviewVideoJob {
  id: string;
  projectId: string;
  episodeOutlineId: string;
  episodeNo: number;
  provider: string;
  status: string;
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
  kind: string;
  title: string;
  url: string;
  mimeType: string;
}

export interface RenderJob {
  id: string;
  projectId: string;
  previewJobId: string;
  episodeNo: number;
  provider: string;
  status: string;
  qualityPreset: string;
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
  status: string;
  chunks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AssetLibraryItem {
  id: string;
  projectId: string;
  name: string;
  type: string;
  status: string;
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
  kind: string;
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
  status: string;
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

export interface EpisodePackage {
  outline: EpisodeOutline;
  scenes: SceneScript[];
  shots: ShotScript[];
  issues: ConsistencyIssue[];
}
