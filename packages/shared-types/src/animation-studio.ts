export type ProductionStage =
  | 'imported'
  | 'analyzing'
  | 'story_bible_ready'
  | 'characters_ready'
  | 'locations_ready'
  | 'episodes_ready'
  | 'director_script_ready'
  | 'shot_script_ready'
  | 'storyboard_ready'
  | 'video_prompt_ready'
  | 'video_generating'
  | 'review_required'
  | 'revision_required'
  | 'approved'
  | 'exported'
  | 'failed';

export type StudioCapabilityStatus = 'done' | 'missing' | 'running' | 'failed' | 'blocked';

export interface ProductionStageDTO {
  key: ProductionStage;
  label: string;
  status: StudioCapabilityStatus;
  evidence: string[];
  missingReason: string | null;
  nextAction: string | null;
}

export interface ProductionLegacyDataSummaryDTO {
  projectName: string | null;
  hasStorySource: boolean;
  storySourceCount: number;
  hasNovelSource: boolean;
  novelTitle: string | null;
  novelFileName: string | null;
  novelChapterCount: number;
  episodeCount: number;
  sceneCount: number;
  shotCount: number;
  storyboardImageCount: number;
  videoJobCount: number;
  qualityScoreCount: number;
  sceneCandidateCoverage?: ProductionSceneCandidateCoverageDTO;
}

export interface ShotScriptQualityGateDTO {
  status: 'passed' | 'blocked' | 'prerequisite_missing' | 'not_evaluated';
  source: 'studio_shot_scripts' | 'studio_director_scripts' | 'none';
  candidateShotCount: number;
  minShotCount: number;
  dialogueExtractionRate: number | null;
  minDialogueExtractionRate: number;
  characterBindingRate: number | null;
  minCharacterBindingRate: number;
  locationBindingRate: number | null;
  minLocationBindingRate: number;
  evidenceBindingRate: number | null;
  minEvidenceBindingRate: number;
  hasPlaceholderText: boolean;
  reasons: string[];
  nextAction: string | null;
  checkedAt: string | null;
}

export interface ProductionStateDTO {
  projectId: string;
  currentStage: ProductionStage;
  stages: ProductionStageDTO[];
  missingCapabilities: string[];
  nextActions: string[];
  legacyDataSummary: ProductionLegacyDataSummaryDTO;
  shotScriptQualityGate: ShotScriptQualityGateDTO;
  riskFlags: string[];
}

export interface ProductionSceneCandidateCoverageDTO {
  sceneDraftCount: number;
  coverageReportCount: number;
  sceneCandidateCount: number;
  usableSceneCandidateCount: number;
  chapterCount: number;
  coverageStatus: 'missing' | 'insufficient' | 'ready';
  qualityGateStatus: string | null;
  qualityGateScore: number | null;
  missingCapabilities: string[];
  blockerReason: string | null;
  nextAction: string | null;
}

export type StorySourceKind = 'novel_import' | 'ai_original' | 'legacy_novel_source' | 'unknown';

export interface StorySourceDTO {
  id: string | null;
  projectId: string;
  kind: StorySourceKind;
  title: string | null;
  author: string | null;
  fileName: string | null;
  chapterCount: number;
  hasCanonicalStorySource: boolean;
  compatibleLegacyNovelSourceId: string | null;
  compatibleMappingMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type StorySourceCompatibilityStatus =
  | 'canonical'
  | 'legacy_mappable'
  | 'missing'
  | 'conflict';

export interface StorySourceCompatibilityDTO {
  projectId: string;
  compatibilityStatus: StorySourceCompatibilityStatus;
  hasCanonicalStorySource: boolean;
  canMapFromLegacy: boolean;
  canonicalStorySource: {
    id: string;
    name: string;
    path: string;
    size: number;
    textHash: string;
    chunkCount: number;
    createdAt: string;
    updatedAt: string;
  } | null;
  legacyNovelSource: {
    novelSourceId: string | null;
    novelId: string | null;
    title: string | null;
    author: string | null;
    fileName: string | null;
    fileSize: number | null;
    chapterCount: number;
    status: string | null;
    rawTextAvailability: 'available' | 'unknown' | 'missing';
    updatedAt: string | null;
  } | null;
  mappingPreview: {
    targetKind: StorySourceKind;
    title: string | null;
    author: string | null;
    fileName: string | null;
    chapterCount: number;
    sourceTable: 'story_sources' | 'novel_sources' | 'novels' | null;
    sourceId: string | null;
    missingFields: string[];
  };
  warnings: string[];
  nextAction: string;
}

export interface StoryBibleDTO {
  id: string | null;
  project_id?: string;
  projectId: string;
  source_type?: StorySourceKind;
  status: StudioCapabilityStatus | 'draft' | 'ready';
  title: string | null;
  logline?: string | null;
  genre: string | null;
  theme?: string | null;
  tone?: string | null;
  story_world?: {
    setting: string | null;
    time_period?: string | null;
    core_locations: Array<{
      location_id: string;
      name: string;
      description: string | null;
    }>;
  } | null;
  main_characters?: Array<{
    character_id: string;
    name: string;
    role: string | null;
    motivation: string | null;
    conflict: string | null;
    visual_identity?: string | null;
  }>;
  worldview: string | null;
  mainConflict: string | null;
  emotionalArc: string | null;
  characterRelationship: string | null;
  longTermForeshadowing: string[];
  season_arc?: string | null;
  continuity_rules?: string[];
  visualStyle: string | null;
  targetPlatform: string | null;
  adaptationStrategy: string | null;
  audienceHook: string | null;
  sourceSummary: string | null;
  sourceEvidence: string[];
  source_evidence?: string[];
  quality_score?: number | null;
  blockers?: string[];
  missingReasons?: string[];
  generatedAt: string | null;
  version: string;
  missingReason: string | null;
}

export interface CharacterBibleDTO {
  id: string | null;
  projectId: string;
  characterId: string | null;
  name: string;
  status: StudioCapabilityStatus;
  identity: string | null;
  age: string | null;
  personality: string | null;
  appearance: string | null;
  relationshipRole: string | null;
  profilePrompt: string | null;
  threeViewPrompt: string | null;
  expressionPrompt: string | null;
  costumePrompt: string | null;
  hairAccessoryPrompt: string | null;
  propPrompt: string | null;
  voiceStyle: string | null;
  linkedEpisodeIds: string[];
  linkedShotIds: string[];
  assetIds: string[];
  sourceEvidence: string[];
  generatedAt: string | null;
  version: string;
  missingReason: string | null;
}

export interface LocationBibleDTO {
  id: string | null;
  projectId: string;
  locationId: string | null;
  name: string;
  status: StudioCapabilityStatus;
  functionRole: string | null;
  architectureStyle: string | null;
  lightingMood: string | null;
  props: string[];
  reusableShotPrompts: string[];
  visualPrompt: string | null;
  linkedEpisodeIds: string[];
  linkedShotIds: string[];
  assetIds: string[];
  sourceEvidence: string[];
  generatedAt: string | null;
  version: string;
  missingReason: string | null;
}

export interface EpisodePlanDTO {
  id: string | null;
  project_id?: string;
  projectId: string;
  episode_id?: string | null;
  episodeId: string | null;
  story_bible_id?: string | null;
  episodeNo: number;
  episode_no?: number;
  title: string;
  status: StudioCapabilityStatus | 'draft' | 'ready';
  durationSec: number | null;
  duration_target_sec?: number | null;
  logline?: string | null;
  beginning?: string | null;
  middle?: string | null;
  end?: string | null;
  plotGoal: string | null;
  emotionCurve: string[];
  emotional_curve?: string[];
  key_scenes?: Array<{
    scene_id: string;
    title: string;
    summary: string;
    function: string;
    source_evidence: string[];
  }>;
  coolPoints: string[];
  hook: string | null;
  characters?: string[];
  locations?: string[];
  appearingCharacterNames: string[];
  appearingLocationNames: string[];
  productionStatus: string | null;
  sourceEvidence: string[];
  source_evidence?: string[];
  quality_score?: number | null;
  blockers?: string[];
  missingReasons?: string[];
  generatedAt: string | null;
  version: string;
  missingReason: string | null;
}

export interface DirectorScriptDTO {
  id: string | null;
  director_script_id?: string;
  project_id?: string;
  projectId: string;
  episode_id?: string;
  episodeId: string;
  episodeNo: number | null;
  title: string;
  status: StudioCapabilityStatus | 'draft' | 'ready';
  logline: string | null;
  beats: string[];
  sceneBeats: string[];
  visual_strategy?: string | null;
  pacing_strategy?: string | null;
  camera_strategy?: string | null;
  character_blocking?: string | null;
  lighting_strategy?: string | null;
  sound_strategy?: string | null;
  scene_beats?: Array<{
    beat_id: string;
    scene_id: string;
    dramatic_function: string;
    action: string;
    camera_intent: string;
    source_evidence: string[];
  }>;
  keyCharacters: string[];
  keyLocations: string[];
  visualTone: string | null;
  dialogueStyle: string | null;
  soundDesign: string | null;
  pacingNotes: string | null;
  directorNotes: string[];
  transition_notes?: string[];
  sourceEpisodePlanId: string | null;
  sourceEvidence: string[];
  source_evidence?: string[];
  quality_score?: number | null;
  blockers?: string[];
  missingReasons?: string[];
  generatedAt: string | null;
  version: string;
  missingReason: string | null;
}

export type ShotScriptStatus =
  | 'draft'
  | 'ready'
  | 'blocked'
  | 'locked'
  | 'storyboard_ready'
  | 'video_prompt_ready'
  | 'video_generating'
  | 'review_required'
  | 'approved'
  | 'revision_required'
  | 'failed'
  | 'missing';

export interface ShotScriptCharacterDTO {
  character_id: string;
  character_name: string;
  costume_id: string | null;
  expression: string | null;
  position: string | null;
  action: string | null;
  asset_ids: string[];
}

export interface ShotScriptDialogueDTO {
  character_id: string | null;
  character_name: string | null;
  text: string;
  delivery: string | null;
}

export interface ShotScriptQualityScoreDTO {
  overall: number | null;
  story_clarity: number | null;
  character_consistency: number | null;
  location_consistency: number | null;
  cinematic_quality: number | null;
  publish_readiness: number | null;
  needs_revision: boolean;
}

export interface ShotScriptDTO {
  project_id: string;
  shot_id: string;
  episode_id: string;
  shot_no: number;
  duration_sec: number;
  location_id: string | null;
  scene_id: string;
  characters: ShotScriptCharacterDTO[];
  character_id: string | null;
  costume_id: string | null;
  expression: string | null;
  position: string | null;
  action: string;
  shot_size: string;
  camera_movement: string;
  dialogue: ShotScriptDialogueDTO[];
  voiceover: string | null;
  sound_design: string[];
  lighting: string;
  emotion: string;
  visual_goal: string;
  plot_function: string;
  storyboard_prompt: string;
  video_prompt: string;
  continuity_notes: string[];
  quality_score: ShotScriptQualityScoreDTO | null;
  status: ShotScriptStatus;
  blockers?: string[];
  missingReasons?: string[];
  source_director_script_id: string | null;
  source_evidence: string[];
  generated_at: string | null;
  version: string;
  missing_reason: string | null;
}

export interface StoryboardAssetDTO {
  id: string | null;
  projectId: string;
  shotId: string | null;
  episodeId: string | null;
  shotNo: number | null;
  sceneId: string | null;
  status: StudioCapabilityStatus;
  assetKind: 'text_binding' | 'image';
  assetUrl: string | null;
  assetStorageKey?: string | null;
  prompt: string | null;
  frameDescription: string | null;
  cameraLanguage: string | null;
  characters: string[];
  locationId: string | null;
  sourceShotScriptId: string | null;
  sourcePrompt: string | null;
  continuityNotes: string[];
  imageProvider?: string | null;
  imageModel?: string | null;
  imageSize?: string | null;
  imageQuality?: string | null;
  imagePrompt?: string | null;
  imageGeneratedAt?: string | null;
  generationMode?: 'single_shot' | 'batch' | null;
  estimatedCostUnit?: number | null;
  locked: boolean;
  generatedAt: string | null;
  version: string;
  missingReason: string | null;
}

export interface StoryboardImageGenerationDryRunRequestDTO {
  episodeId?: string | null;
  shotIds?: string[];
  imageModel?: string | null;
  imageSize?: string | null;
  imageQuality?: string | null;
  confirmCost?: boolean;
}

export interface StoryboardImageGenerationPlanItemDTO {
  shotId: string | null;
  shotNo: number | null;
  episodeId: string | null;
  sourceStoryboardAssetId: string | null;
  sourcePrompt: string | null;
  imagePrompt: string | null;
  estimatedCostUnit: number;
  blockers: string[];
}

export interface StoryboardImageGenerationDryRunDTO {
  projectId: string;
  status: 'ready' | 'blocked';
  mode: 'dry_run';
  requestedEpisodeId: string | null;
  requestedShotIds: string[];
  plannedImageCount: number;
  existingImageAssetCount: number;
  estimatedCostUnits: number;
  imageModel: string | null;
  imageSize: string | null;
  imageQuality: string | null;
  assets: StoryboardImageGenerationPlanItemDTO[];
  blockers: string[];
  willCreateJob: false;
  willCallProvider: false;
  willGenerateImage: false;
  willWriteMetadata: false;
  nextAction: string;
}

export interface StoryboardImageGenerateOneRequestDTO {
  shotId: string;
  imageModel: string;
  imageSize: string;
  imageQuality: string;
  confirmCost: true;
  confirmSingleShot: true;
  confirmNoVideo: true;
  confirmProviderCall?: true;
  confirmRealImageGeneration?: true;
}

export interface StoryboardImageProviderResultDTO {
  provider: 'mock' | 'openai';
  assetUrl: string;
  assetStorageKey: string;
  attempted: boolean;
}

export interface StoryboardImageGenerateOneDTO {
  projectId: string;
  status: 'ready' | 'blocked' | 'failed';
  mode: 'single_shot';
  asset: StoryboardAssetDTO | null;
  blockers: string[];
  providerCall: {
    attempted: boolean;
    provider: 'mock' | 'openai' | null;
    model: string | null;
    confirmed: boolean;
  };
  auditLog: {
    planned: boolean;
    recorded: boolean;
    preflightRecorded: boolean;
    providerAttemptRecorded: boolean;
    providerSuccessRecorded: boolean;
    providerFailureRecorded: boolean;
    action: string;
    resourceType: string;
    resourceId: string | null;
    failureReason: string | null;
  };
  rollback: {
    required: boolean;
    reason: string | null;
    metadataWritten: boolean;
    metadataRestored: boolean;
  };
  willCreateJob: false;
  willGenerateVideo: false;
  nextAction: string;
}

export interface StoryboardEpisodeAcceptanceDTO {
  projectId: string;
  episodeId: string;
  scopeLabel: string;
  totalStoryboardAssets: number;
  textBindingCount: number;
  imageAssetCount: number;
  lockedImageCount: number;
  missingImageCount: number;
  regeneratableCount: number;
  readyForExport: boolean;
  exportBlockedReason: string | null;
  exportBoundary: string;
  nextActions: string[];
}

export interface VideoPromptDTO {
  id: string | null;
  projectId: string;
  shotId: string | null;
  episodeId: string | null;
  shotNo: number | null;
  sceneId: string | null;
  locationId: string | null;
  status: StudioCapabilityStatus;
  prompt: string | null;
  negativePrompt: string | null;
  durationSec: number | null;
  aspectRatio: string | null;
  cameraLanguage: string | null;
  characters: string[];
  dialogueCue: string | null;
  soundCue: string | null;
  lightingCue: string | null;
  motionCue: string | null;
  sourceShotScriptId: string | null;
  sourceStoryboardAssetId: string | null;
  sourceStoryboardPrompt: string | null;
  continuityNotes: string[];
  qualityScore?: number | null;
  blockers?: string[];
  missingReasons?: string[];
  shotCoverageRate?: number | null;
  storyboardBindingRate?: number | null;
  characterBindingRate?: number | null;
  locationBindingRate?: number | null;
  continuityCoverageRate?: number | null;
  generatedAt: string | null;
  version: string;
  missingReason: string | null;
}

export interface QualityReviewDTO {
  id: string | null;
  projectId: string;
  scope: 'project' | 'episode' | 'shot';
  scopeId: string | null;
  status: StudioCapabilityStatus;
  overallScore: number | null;
  needsRevision: boolean;
  findings: string[];
  missingReason: string | null;
}

export interface ExportPackageDTO {
  id: string | null;
  projectId: string;
  status: StudioCapabilityStatus;
  packageType: string | null;
  assetIds: string[];
  downloadUrl: string | null;
  missingReason: string | null;
}
