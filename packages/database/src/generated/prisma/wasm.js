Object.defineProperty(exports, '__esModule', { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip,
} = require('./runtime/index-browser.js');

const Prisma = {};

exports.Prisma = Prisma;
exports.$Enums = {};

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: '5.22.0',
  engine: '605197351a3c8bdd595af2d2a9bc3025bca48ea2',
};

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.Decimal = Decimal;

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.validator = Public.validator;

/**
 * Extensions
 */
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`);
};

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull;
Prisma.JsonNull = objectEnumValues.instances.JsonNull;
Prisma.AnyNull = objectEnumValues.instances.AnyNull;

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull,
};

/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable',
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  avatar: 'avatar',
  userType: 'userType',
  role: 'role',
  tier: 'tier',
  quota: 'quota',
  defaultOrganizationId: 'defaultOrganizationId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  ownerId: 'ownerId',
  slug: 'slug',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  credits: 'credits',
  type: 'type',
};

exports.Prisma.MembershipScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  organizationId: 'organizationId',
  role: 'role',
  permissions: 'permissions',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  ownerId: 'ownerId',
  organizationId: 'organizationId',
  status: 'status',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  settingsJson: 'settingsJson',
};

exports.Prisma.SeasonScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  index: 'index',
  title: 'title',
  description: 'description',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.EpisodeScalarFieldEnum = {
  id: 'id',
  seasonId: 'seasonId',
  projectId: 'projectId',
  index: 'index',
  name: 'name',
  summary: 'summary',
  chapterId: 'chapterId',
};

exports.Prisma.SceneScalarFieldEnum = {
  id: 'id',
  chapterId: 'chapterId',
  episodeId: 'episodeId',
  sceneIndex: 'sceneIndex',
  locationSlug: 'locationSlug',
  timeOfDay: 'timeOfDay',
  environmentTags: 'environmentTags',
  enrichedText: 'enrichedText',
  graphStateSnapshot: 'graphStateSnapshot',
  visualDensityScore: 'visualDensityScore',
  visualDensityMeta: 'visualDensityMeta',
  status: 'status',
  title: 'title',
  summary: 'summary',
  sceneDraftId: 'sceneDraftId',
  reviewStatus: 'reviewStatus',
  characters: 'characters',
  projectId: 'projectId',
  directingNotes: 'directingNotes',
  shotType: 'shotType',
  characterIds: 'characterIds',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.ShotScalarFieldEnum = {
  id: 'id',
  sceneId: 'sceneId',
  index: 'index',
  title: 'title',
  description: 'description',
  reviewStatus: 'reviewStatus',
  type: 'type',
  params: 'params',
  qualityScore: 'qualityScore',
  reviewedAt: 'reviewedAt',
  durationSeconds: 'durationSeconds',
  organizationId: 'organizationId',
  enrichedPrompt: 'enrichedPrompt',
  shotType: 'shotType',
  cameraMovement: 'cameraMovement',
  cameraAngle: 'cameraAngle',
  lightingPreset: 'lightingPreset',
  renderStatus: 'renderStatus',
  resultImageUrl: 'resultImageUrl',
  resultVideoUrl: 'resultVideoUrl',
  visualPrompt: 'visualPrompt',
  negativePrompt: 'negativePrompt',
  actionDescription: 'actionDescription',
  dialogueContent: 'dialogueContent',
  soundFx: 'soundFx',
  assetBindings: 'assetBindings',
  controlnetSettings: 'controlnetSettings',
  durationSec: 'durationSec',
};

exports.Prisma.CharacterIdentityAnchorScalarFieldEnum = {
  id: 'id',
  characterId: 'characterId',
  status: 'status',
  provider: 'provider',
  seed: 'seed',
  viewKeyFront: 'viewKeyFront',
  viewKeySide: 'viewKeySide',
  viewKeyBack: 'viewKeyBack',
  viewKeysSha256: 'viewKeysSha256',
  traceId: 'traceId',
  lastError: 'lastError',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.SemanticEnhancementScalarFieldEnum = {
  id: 'id',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  nodeType: 'nodeType',
  nodeId: 'nodeId',
  data: 'data',
  engineKey: 'engineKey',
  engineVersion: 'engineVersion',
  confidence: 'confidence',
};

exports.Prisma.ShotPlanningScalarFieldEnum = {
  id: 'id',
  shotId: 'shotId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  data: 'data',
  engineKey: 'engineKey',
  engineVersion: 'engineVersion',
  confidence: 'confidence',
};

exports.Prisma.StructureQualityReportScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  data: 'data',
  engineKey: 'engineKey',
  engineVersion: 'engineVersion',
};

exports.Prisma.EngineTaskScalarFieldEnum = {
  id: 'id',
  type: 'type',
  projectId: 'projectId',
  sceneId: 'sceneId',
  shotId: 'shotId',
  input: 'input',
  output: 'output',
  engineVersion: 'engineVersion',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.EngineScalarFieldEnum = {
  id: 'id',
  engineKey: 'engineKey',
  adapterName: 'adapterName',
  adapterType: 'adapterType',
  mode: 'mode',
  config: 'config',
  enabled: 'enabled',
  version: 'version',
  defaultVersion: 'defaultVersion',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  code: 'code',
  isActive: 'isActive',
  name: 'name',
  type: 'type',
};

exports.Prisma.EngineVersionScalarFieldEnum = {
  id: 'id',
  engineId: 'engineId',
  versionName: 'versionName',
  config: 'config',
  enabled: 'enabled',
  rolloutWeight: 'rolloutWeight',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.JobEngineBindingScalarFieldEnum = {
  id: 'id',
  jobId: 'jobId',
  engineId: 'engineId',
  engineVersionId: 'engineVersionId',
  engineKey: 'engineKey',
  status: 'status',
  boundAt: 'boundAt',
  executedAt: 'executedAt',
  completedAt: 'completedAt',
  errorMessage: 'errorMessage',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.NonceStoreScalarFieldEnum = {
  id: 'id',
  nonce: 'nonce',
  apiKey: 'apiKey',
  timestamp: 'timestamp',
  usedAt: 'usedAt',
  createdAt: 'createdAt',
};

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  level: 'level',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.PermissionScalarFieldEnum = {
  id: 'id',
  key: 'key',
  scope: 'scope',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.RolePermissionScalarFieldEnum = {
  id: 'id',
  roleId: 'roleId',
  permissionId: 'permissionId',
  createdAt: 'createdAt',
};

exports.Prisma.ProjectMemberScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  projectId: 'projectId',
  roleId: 'roleId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.TaskScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  projectId: 'projectId',
  type: 'type',
  status: 'status',
  payload: 'payload',
  attempts: 'attempts',
  maxRetry: 'maxRetry',
  retryCount: 'retryCount',
  error: 'error',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  output: 'output',
  traceId: 'traceId',
  workerId: 'workerId',
  isVerification: 'isVerification',
  dedupeKey: 'dedupeKey',
};

exports.Prisma.WorkerJobScalarFieldEnum = {
  id: 'id',
  type: 'type',
  payload: 'payload',
  status: 'status',
  workerId: 'workerId',
  retryCount: 'retryCount',
  traceId: 'traceId',
  jobId: 'jobId',
  engineVersion: 'engineVersion',
  modelVersion: 'modelVersion',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.ShotJobScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  projectId: 'projectId',
  episodeId: 'episodeId',
  sceneId: 'sceneId',
  shotId: 'shotId',
  taskId: 'taskId',
  workerId: 'workerId',
  status: 'status',
  type: 'type',
  priority: 'priority',
  maxRetry: 'maxRetry',
  retryCount: 'retryCount',
  attempts: 'attempts',
  leaseUntil: 'leaseUntil',
  lockedBy: 'lockedBy',
  payload: 'payload',
  engineConfig: 'engineConfig',
  lastError: 'lastError',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  traceId: 'traceId',
  isVerification: 'isVerification',
  dedupeKey: 'dedupeKey',
  result: 'result',
  securityProcessed: 'securityProcessed',
};

exports.Prisma.WorkerNodeScalarFieldEnum = {
  id: 'id',
  workerId: 'workerId',
  name: 'name',
  status: 'status',
  gpuCount: 'gpuCount',
  gpuMemory: 'gpuMemory',
  gpuType: 'gpuType',
  tasksRunning: 'tasksRunning',
  temperature: 'temperature',
  capabilities: 'capabilities',
  lastHeartbeat: 'lastHeartbeat',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.WorkerHeartbeatScalarFieldEnum = {
  workerId: 'workerId',
  lastSeenAt: 'lastSeenAt',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.ModelRegistryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  version: 'version',
  changelog: 'changelog',
  compatibleEngines: 'compatibleEngines',
  performanceMetrics: 'performanceMetrics',
  fineTuneInfo: 'fineTuneInfo',
  seed: 'seed',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.TemplatePresetScalarFieldEnum = {
  id: 'id',
  type: 'type',
  name: 'name',
  preset: 'preset',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.QualityScoreScalarFieldEnum = {
  id: 'id',
  shotId: 'shotId',
  visualDensityScore: 'visualDensityScore',
  consistencyScore: 'consistencyScore',
  motionScore: 'motionScore',
  clarityScore: 'clarityScore',
  aestheticScore: 'aestheticScore',
  overallScore: 'overallScore',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.SafetyResultScalarFieldEnum = {
  id: 'id',
  shotId: 'shotId',
  textScore: 'textScore',
  imageScore: 'imageScore',
  riskLevel: 'riskLevel',
  reviewStatus: 'reviewStatus',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.BillingEventScalarFieldEnum = {
  id: 'id',
  costLedgerId: 'costLedgerId',
  projectId: 'projectId',
  orgId: 'orgId',
  userId: 'userId',
  type: 'type',
  creditsDelta: 'creditsDelta',
  currency: 'currency',
  metadata: 'metadata',
  createdAt: 'createdAt',
};

exports.Prisma.CostCenterScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  name: 'name',
  budget: 'budget',
  currentCost: 'currentCost',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.SubscriptionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  organizationId: 'organizationId',
  planId: 'planId',
  status: 'status',
  currentPeriodStart: 'currentPeriodStart',
  currentPeriodEnd: 'currentPeriodEnd',
  cancelAtPeriodEnd: 'cancelAtPeriodEnd',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.PublishingReviewScalarFieldEnum = {
  id: 'id',
  episodeId: 'episodeId',
  shotId: 'shotId',
  reviewType: 'reviewType',
  reviewerId: 'reviewerId',
  result: 'result',
  reviewLog: 'reviewLog',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.OrganizationMemberScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  organizationId: 'organizationId',
  role: 'role',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.NovelScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  title: 'title',
  author: 'author',
  organizationId: 'organizationId',
  rawFileUrl: 'rawFileUrl',
  totalTokens: 'totalTokens',
  status: 'status',
  metadata: 'metadata',
  fileName: 'fileName',
  fileSize: 'fileSize',
  fileType: 'fileType',
  characterCount: 'characterCount',
  chapterCount: 'chapterCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.SceneDraftScalarFieldEnum = {
  id: 'id',
  chapterId: 'chapterId',
  index: 'index',
  title: 'title',
  summary: 'summary',
  characters: 'characters',
  location: 'location',
  emotions: 'emotions',
  rawTextRange: 'rawTextRange',
  status: 'status',
  analysisResult: 'analysisResult',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.NovelAnalysisJobScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  novelSourceId: 'novelSourceId',
  chapterId: 'chapterId',
  jobType: 'jobType',
  status: 'status',
  errorMessage: 'errorMessage',
  progress: 'progress',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.ApiKeyScalarFieldEnum = {
  id: 'id',
  key: 'key',
  secretHash: 'secretHash',
  name: 'name',
  ownerUserId: 'ownerUserId',
  ownerOrgId: 'ownerOrgId',
  status: 'status',
  lastUsedAt: 'lastUsedAt',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  secretEnc: 'secretEnc',
  secretEncIv: 'secretEncIv',
  secretEncTag: 'secretEncTag',
  secretVersion: 'secretVersion',
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  apiKeyId: 'apiKeyId',
  action: 'action',
  resourceType: 'resourceType',
  resourceId: 'resourceId',
  ip: 'ip',
  userAgent: 'userAgent',
  details: 'details',
  createdAt: 'createdAt',
  nonce: 'nonce',
  signature: 'signature',
  timestamp: 'timestamp',
  payload: 'payload',
  orgId: 'orgId',
};

exports.Prisma.SecurityFingerprintScalarFieldEnum = {
  id: 'id',
  assetId: 'assetId',
  fpVector: 'fpVector',
  createdAt: 'createdAt',
};

exports.Prisma.ShotVariantScalarFieldEnum = {
  id: 'id',
  shotId: 'shotId',
  data: 'data',
  consistencyScore: 'consistencyScore',
  visualScore: 'visualScore',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.VideoJobScalarFieldEnum = {
  id: 'id',
  shotId: 'shotId',
  status: 'status',
  payload: 'payload',
  securityProcessed: 'securityProcessed',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.CharacterScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  name: 'name',
  description: 'description',
  referenceSheetUrls: 'referenceSheetUrls',
  embeddingId: 'embeddingId',
  defaultSeed: 'defaultSeed',
  traits: 'traits',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.NovelVolumeScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  novelSourceId: 'novelSourceId',
  index: 'index',
  title: 'title',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.NovelChapterScalarFieldEnum = {
  id: 'id',
  volumeId: 'volumeId',
  novelSourceId: 'novelSourceId',
  index: 'index',
  title: 'title',
  rawContent: 'rawContent',
  summary: 'summary',
  isSystemControlled: 'isSystemControlled',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  visualDensityScore: 'visualDensityScore',
  visualDensityMeta: 'visualDensityMeta',
};

exports.Prisma.MemoryShortTermScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  chapterId: 'chapterId',
  summary: 'summary',
  characterStates: 'characterStates',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.MemoryLongTermScalarFieldEnum = {
  id: 'id',
  entityId: 'entityId',
  entityType: 'entityType',
  vectorRef: 'vectorRef',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.NovelParseResultScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  organizationId: 'organizationId',
  idempotencyKey: 'idempotencyKey',
  status: 'status',
  parsingQuality: 'parsingQuality',
  modelVersion: 'modelVersion',
  rawOutput: 'rawOutput',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.QualityMetricsScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  engine: 'engine',
  jobId: 'jobId',
  traceId: 'traceId',
  visualDensityScore: 'visualDensityScore',
  enrichmentQuality: 'enrichmentQuality',
  parsingQuality: 'parsingQuality',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.SystemSettingScalarFieldEnum = {
  id: 'id',
  key: 'key',
  value: 'value',
  category: 'category',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.BillingPlanScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  tier: 'tier',
  price: 'price',
  credits: 'credits',
  computeSeconds: 'computeSeconds',
  features: 'features',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.BillingRecordScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  organizationId: 'organizationId',
  planId: 'planId',
  amount: 'amount',
  credits: 'credits',
  computeSeconds: 'computeSeconds',
  periodStart: 'periodStart',
  periodEnd: 'periodEnd',
  status: 'status',
  invoiceId: 'invoiceId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.ModelScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  version: 'version',
  provider: 'provider',
  config: 'config',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.AssetScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  createdAt: 'createdAt',
  checksum: 'checksum',
  createdByJobId: 'createdByJobId',
  ownerId: 'ownerId',
  ownerType: 'ownerType',
  status: 'status',
  storageKey: 'storageKey',
  type: 'type',
  shotId: 'shotId',
  hlsPlaylistUrl: 'hlsPlaylistUrl',
  signedUrl: 'signedUrl',
  watermarkMode: 'watermarkMode',
  fingerprintId: 'fingerprintId',
};

exports.Prisma.TextSafetyResultScalarFieldEnum = {
  id: 'id',
  resourceType: 'resourceType',
  resourceId: 'resourceId',
  decision: 'decision',
  riskLevel: 'riskLevel',
  flags: 'flags',
  reasons: 'reasons',
  sanitizedDigest: 'sanitizedDigest',
  traceId: 'traceId',
  createdAt: 'createdAt',
};

exports.Prisma.CostLedgerScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  projectId: 'projectId',
  jobId: 'jobId',
  jobType: 'jobType',
  engineKey: 'engineKey',
  attempt: 'attempt',
  costAmount: 'costAmount',
  currency: 'currency',
  billingUnit: 'billingUnit',
  quantity: 'quantity',
  metadata: 'metadata',
  createdAt: 'createdAt',
  traceId: 'traceId',
  orgId: 'orgId',
  totalCost: 'totalCost',
  costType: 'costType',
  unitCost: 'unitCost',
  modelName: 'modelName',
  totalCredits: 'totalCredits',
  unitCostCredits: 'unitCostCredits',
  timestamp: 'timestamp',
  billingStatus: 'billingStatus',
  billingEventId: 'billingEventId',
  billedAt: 'billedAt',
  billingError: 'billingError',
};

exports.Prisma.PublishedVideoScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  episodeId: 'episodeId',
  assetId: 'assetId',
  storageKey: 'storageKey',
  checksum: 'checksum',
  status: 'status',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.BillingOutboxScalarFieldEnum = {
  id: 'id',
  dedupeKey: 'dedupeKey',
  payload: 'payload',
  status: 'status',
  attempts: 'attempts',
  lastError: 'lastError',
  nextRetryAt: 'nextRetryAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.IdentityAnchorScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  characterId: 'characterId',
  referenceAssetId: 'referenceAssetId',
  identityHash: 'identityHash',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

exports.Prisma.ShotIdentityScoreScalarFieldEnum = {
  id: 'id',
  shotId: 'shotId',
  characterId: 'characterId',
  referenceAnchorId: 'referenceAnchorId',
  targetAssetId: 'targetAssetId',
  identityScore: 'identityScore',
  verdict: 'verdict',
  details: 'details',
  createdAt: 'createdAt',
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc',
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull,
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive',
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull,
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last',
};
exports.UserType = exports.$Enums.UserType = {
  individual: 'individual',
  organization_member: 'organization_member',
  admin: 'admin',
};

exports.UserRole = exports.$Enums.UserRole = {
  viewer: 'viewer',
  editor: 'editor',
  creator: 'creator',
  admin: 'admin',
};

exports.UserTier = exports.$Enums.UserTier = {
  Free: 'Free',
  Pro: 'Pro',
  Studio: 'Studio',
  Enterprise: 'Enterprise',
};

exports.MembershipRole = exports.$Enums.MembershipRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  CREATOR: 'CREATOR',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
};

exports.ProjectStatus = exports.$Enums.ProjectStatus = {
  in_progress: 'in_progress',
  completed: 'completed',
};

exports.ShotReviewStatus = exports.$Enums.ShotReviewStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FINALIZED: 'FINALIZED',
};

exports.ShotRenderStatus = exports.$Enums.ShotRenderStatus = {
  PENDING: 'PENDING',
  RENDERING: 'RENDERING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

exports.EngineTaskType = exports.$Enums.EngineTaskType = {
  scene_parse: 'scene_parse',
  shot_plan: 'shot_plan',
  shot_enhance: 'shot_enhance',
  inpainting: 'inpainting',
  visual_enhance: 'visual_enhance',
  consistency_calibrate: 'consistency_calibrate',
};

exports.EngineTaskStatus = exports.$Enums.EngineTaskStatus = {
  pending: 'pending',
  running: 'running',
  success: 'success',
  fail: 'fail',
};

exports.JobEngineBindingStatus = exports.$Enums.JobEngineBindingStatus = {
  BOUND: 'BOUND',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

exports.TaskType = exports.$Enums.TaskType = {
  NOVEL_IMPORT: 'NOVEL_IMPORT',
  NOVEL_ANALYSIS: 'NOVEL_ANALYSIS',
  SHOT_RENDER: 'SHOT_RENDER',
  CE_CORE_PIPELINE: 'CE_CORE_PIPELINE',
  VIDEO_RENDER: 'VIDEO_RENDER',
  PIPELINE_TIMELINE_COMPOSE: 'PIPELINE_TIMELINE_COMPOSE',
  TIMELINE_RENDER: 'TIMELINE_RENDER',
  PIPELINE_E2E_VIDEO: 'PIPELINE_E2E_VIDEO',
};

exports.TaskStatus = exports.$Enums.TaskStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
};

exports.WorkerJobType = exports.$Enums.WorkerJobType = {
  render: 'render',
  engine_task: 'engine_task',
  synthesis: 'synthesis',
  fix: 'fix',
};

exports.WorkerJobStatus = exports.$Enums.WorkerJobStatus = {
  pending: 'pending',
  running: 'running',
  success: 'success',
  fail: 'fail',
};

exports.JobStatus = exports.$Enums.JobStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
  DISPATCHED: 'DISPATCHED',
};

exports.JobType = exports.$Enums.JobType = {
  SHOT_RENDER: 'SHOT_RENDER',
  NOVEL_ANALYSIS: 'NOVEL_ANALYSIS',
  CE06_NOVEL_PARSING: 'CE06_NOVEL_PARSING',
  NOVEL_SCAN_TOC: 'NOVEL_SCAN_TOC',
  NOVEL_CHUNK_PARSE: 'NOVEL_CHUNK_PARSE',
  CE02_VISUAL_DENSITY: 'CE02_VISUAL_DENSITY',
  CE03_VISUAL_DENSITY: 'CE03_VISUAL_DENSITY',
  CE04_VISUAL_ENRICHMENT: 'CE04_VISUAL_ENRICHMENT',
  CE01_REFERENCE_SHEET: 'CE01_REFERENCE_SHEET',
  CE02_IDENTITY_LOCK: 'CE02_IDENTITY_LOCK',
  CE05_DIRECTOR_CONTROL: 'CE05_DIRECTOR_CONTROL',
  CE07_STORY_MEMORY: 'CE07_STORY_MEMORY',
  CE07_MEMORY_UPDATE: 'CE07_MEMORY_UPDATE',
  CE08_STORY_KG: 'CE08_STORY_KG',
  CE09_MEDIA_SECURITY: 'CE09_MEDIA_SECURITY',
  VIDEO_RENDER: 'VIDEO_RENDER',
  PIPELINE_E2E_VIDEO: 'PIPELINE_E2E_VIDEO',
  PIPELINE_STAGE1_NOVEL_TO_VIDEO: 'PIPELINE_STAGE1_NOVEL_TO_VIDEO',
  PIPELINE_TIMELINE_COMPOSE: 'PIPELINE_TIMELINE_COMPOSE',
  TIMELINE_RENDER: 'TIMELINE_RENDER',
  TIMELINE_PREVIEW: 'TIMELINE_PREVIEW',
  PIPELINE_PROD_VIDEO_V1: 'PIPELINE_PROD_VIDEO_V1',
  CE11_SHOT_GENERATOR: 'CE11_SHOT_GENERATOR',
};

exports.WorkerStatus = exports.$Enums.WorkerStatus = {
  idle: 'idle',
  busy: 'busy',
  offline: 'offline',
  online: 'online',
};

exports.ModelType = exports.$Enums.ModelType = {
  foundation: 'foundation',
  sub_model: 'sub_model',
  character: 'character',
  pose: 'pose',
  style: 'style',
  embedding: 'embedding',
  lora: 'lora',
};

exports.TemplateType = exports.$Enums.TemplateType = {
  pose: 'pose',
  camera: 'camera',
  style: 'style',
};

exports.RiskLevel = exports.$Enums.RiskLevel = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
};

exports.ReviewStatus = exports.$Enums.ReviewStatus = {
  pass: 'pass',
  reject: 'reject',
  require_human_review: 'require_human_review',
};

exports.SubscriptionStatus = exports.$Enums.SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
  INCOMPLETE: 'INCOMPLETE',
  TRIALING: 'TRIALING',
};

exports.ReviewType = exports.$Enums.ReviewType = {
  auto: 'auto',
  semi_auto: 'semi_auto',
  human: 'human',
};

exports.ReviewResult = exports.$Enums.ReviewResult = {
  pass: 'pass',
  reject: 'reject',
  require_review: 'require_review',
};

exports.OrganizationRole = exports.$Enums.OrganizationRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  CREATOR: 'CREATOR',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
};

exports.SceneDraftStatus = exports.$Enums.SceneDraftStatus = {
  DRAFT: 'DRAFT',
  ANALYZED: 'ANALYZED',
  FINALIZED: 'FINALIZED',
};

exports.NovelAnalysisJobType = exports.$Enums.NovelAnalysisJobType = {
  ANALYZE_ALL: 'ANALYZE_ALL',
  ANALYZE_CHAPTER: 'ANALYZE_CHAPTER',
};

exports.NovelAnalysisStatus = exports.$Enums.NovelAnalysisStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  DONE: 'DONE',
  FAILED: 'FAILED',
};

exports.ApiKeyStatus = exports.$Enums.ApiKeyStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
};

exports.AssetOwnerType = exports.$Enums.AssetOwnerType = {
  SCENE: 'SCENE',
  SHOT: 'SHOT',
};

exports.AssetStatus = exports.$Enums.AssetStatus = {
  GENERATED: 'GENERATED',
  LOCKED: 'LOCKED',
  PUBLISHED: 'PUBLISHED',
};

exports.AssetType = exports.$Enums.AssetType = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  MODEL: 'MODEL',
  AUDIO_TTS: 'AUDIO_TTS',
  AUDIO_BGM: 'AUDIO_BGM',
};

exports.TextSafetyDecision = exports.$Enums.TextSafetyDecision = {
  PASS: 'PASS',
  WARN: 'WARN',
  BLOCK: 'BLOCK',
};

exports.BillingStatus = exports.$Enums.BillingStatus = {
  PENDING: 'PENDING',
  BILLING: 'BILLING',
  BILLED: 'BILLED',
  FAILED: 'FAILED',
};

exports.Prisma.ModelName = {
  User: 'User',
  Organization: 'Organization',
  Membership: 'Membership',
  Project: 'Project',
  Season: 'Season',
  Episode: 'Episode',
  Scene: 'Scene',
  Shot: 'Shot',
  CharacterIdentityAnchor: 'CharacterIdentityAnchor',
  SemanticEnhancement: 'SemanticEnhancement',
  ShotPlanning: 'ShotPlanning',
  StructureQualityReport: 'StructureQualityReport',
  EngineTask: 'EngineTask',
  Engine: 'Engine',
  EngineVersion: 'EngineVersion',
  JobEngineBinding: 'JobEngineBinding',
  NonceStore: 'NonceStore',
  Role: 'Role',
  Permission: 'Permission',
  RolePermission: 'RolePermission',
  ProjectMember: 'ProjectMember',
  Task: 'Task',
  WorkerJob: 'WorkerJob',
  ShotJob: 'ShotJob',
  WorkerNode: 'WorkerNode',
  WorkerHeartbeat: 'WorkerHeartbeat',
  ModelRegistry: 'ModelRegistry',
  TemplatePreset: 'TemplatePreset',
  QualityScore: 'QualityScore',
  SafetyResult: 'SafetyResult',
  BillingEvent: 'BillingEvent',
  CostCenter: 'CostCenter',
  Subscription: 'Subscription',
  PublishingReview: 'PublishingReview',
  OrganizationMember: 'OrganizationMember',
  Novel: 'Novel',
  SceneDraft: 'SceneDraft',
  NovelAnalysisJob: 'NovelAnalysisJob',
  ApiKey: 'ApiKey',
  AuditLog: 'AuditLog',
  SecurityFingerprint: 'SecurityFingerprint',
  ShotVariant: 'ShotVariant',
  VideoJob: 'VideoJob',
  Character: 'Character',
  NovelVolume: 'NovelVolume',
  NovelChapter: 'NovelChapter',
  MemoryShortTerm: 'MemoryShortTerm',
  MemoryLongTerm: 'MemoryLongTerm',
  NovelParseResult: 'NovelParseResult',
  QualityMetrics: 'QualityMetrics',
  SystemSetting: 'SystemSetting',
  BillingPlan: 'BillingPlan',
  BillingRecord: 'BillingRecord',
  Model: 'Model',
  Asset: 'Asset',
  TextSafetyResult: 'TextSafetyResult',
  CostLedger: 'CostLedger',
  PublishedVideo: 'PublishedVideo',
  BillingOutbox: 'BillingOutbox',
  IdentityAnchor: 'IdentityAnchor',
  ShotIdentityScore: 'ShotIdentityScore',
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message;
        const runtime = getRuntime();
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message =
            'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' +
            runtime.prettyName +
            '`).';
        }

        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`;

        throw new Error(message);
      },
    });
  }
}

exports.PrismaClient = PrismaClient;

Object.assign(exports, Prisma);
