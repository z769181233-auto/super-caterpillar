-- CreateEnum
CREATE TYPE "user_type" AS ENUM ('individual', 'organization_member', 'admin');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('VIEWER', 'EDITOR', 'CREATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_tier" AS ENUM ('Free', 'Pro', 'Studio', 'Enterprise');

-- CreateEnum
CREATE TYPE "membership_role" AS ENUM ('OWNER', 'ADMIN', 'CREATOR', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "text_safety_decision" AS ENUM ('PASS', 'WARN', 'BLOCK');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('in_progress', 'completed');

-- CreateEnum
CREATE TYPE "shot_status" AS ENUM ('DRAFT', 'READY', 'GENERATING', 'GENERATED', 'FAILED', 'pending', 'running', 'success', 'fail', 'need_fix');

-- CreateEnum
CREATE TYPE "shot_review_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'TRIALING');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRYING', 'DISPATCHED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('SHOT_RENDER', 'NOVEL_ANALYSIS', 'CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT', 'CE01_REFERENCE_SHEET', 'CE02_IDENTITY_LOCK', 'CE05_DIRECTOR_CONTROL', 'CE07_STORY_MEMORY', 'CE07_MEMORY_UPDATE', 'CE08_STORY_KG', 'CE09_MEDIA_SECURITY', 'VIDEO_RENDER');

-- CreateEnum
CREATE TYPE "job_engine_binding_status" AS ENUM ('BOUND', 'EXECUTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "engine_task_type" AS ENUM ('scene_parse', 'shot_plan', 'shot_enhance', 'inpainting', 'visual_enhance', 'consistency_calibrate');

-- CreateEnum
CREATE TYPE "engine_task_status" AS ENUM ('pending', 'running', 'success', 'fail');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('NOVEL_IMPORT', 'NOVEL_ANALYSIS', 'SHOT_RENDER', 'CE_CORE_PIPELINE', 'VIDEO_RENDER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "worker_job_type" AS ENUM ('render', 'engine_task', 'synthesis', 'fix');

-- CreateEnum
CREATE TYPE "worker_job_status" AS ENUM ('pending', 'running', 'success', 'fail');

-- CreateEnum
CREATE TYPE "worker_status" AS ENUM ('idle', 'busy', 'offline', 'online');

-- CreateEnum
CREATE TYPE "model_type" AS ENUM ('foundation', 'sub_model', 'character', 'pose', 'style', 'embedding', 'lora');

-- CreateEnum
CREATE TYPE "template_type" AS ENUM ('pose', 'camera', 'style');

-- CreateEnum
CREATE TYPE "risk_level" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('pass', 'reject', 'require_human_review');

-- CreateEnum
CREATE TYPE "billing_status" AS ENUM ('PENDING', 'BILLING', 'BILLED', 'FAILED');

-- CreateEnum
CREATE TYPE "review_type" AS ENUM ('auto', 'semi_auto', 'human');

-- CreateEnum
CREATE TYPE "review_result" AS ENUM ('pass', 'reject', 'require_review');

-- CreateEnum
CREATE TYPE "organization_role" AS ENUM ('OWNER', 'ADMIN', 'CREATOR', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "scene_draft_status" AS ENUM ('DRAFT', 'ANALYZED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "novel_analysis_job_type" AS ENUM ('ANALYZE_ALL', 'ANALYZE_CHAPTER');

-- CreateEnum
CREATE TYPE "novel_analysis_status" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "api_key_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AssetOwnerType" AS ENUM ('SCENE', 'SHOT');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('IMAGE', 'VIDEO', 'MODEL');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('GENERATED', 'LOCKED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatar" TEXT,
    "userType" "user_type" NOT NULL DEFAULT 'individual',
    "role" "user_role" NOT NULL DEFAULT 'VIEWER',
    "tier" "user_tier" NOT NULL DEFAULT 'Free',
    "quota" JSONB,
    "defaultOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" TEXT,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "membership_role" NOT NULL,
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "project_status" NOT NULL DEFAULT 'in_progress',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settingsJson" JSONB,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "projectId" TEXT,
    "index" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "chapterId" TEXT,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "sceneDraftId" TEXT,
    "characters" JSONB,
    "enrichedText" TEXT,
    "projectId" TEXT,
    "visualDensityScore" DOUBLE PRECISION,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shots" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "qualityScore" JSONB NOT NULL DEFAULT '{}',
    "reviewedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "organizationId" TEXT,
    "enrichedPrompt" TEXT,

    CONSTRAINT "shots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semantic_enhancements" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nodeType" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "engineKey" TEXT NOT NULL,
    "engineVersion" TEXT,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "semantic_enhancements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shot_plannings" (
    "id" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "engineKey" TEXT NOT NULL,
    "engineVersion" TEXT,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "shot_plannings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structure_quality_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "engineKey" TEXT NOT NULL,
    "engineVersion" TEXT,

    CONSTRAINT "structure_quality_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine_tasks" (
    "id" TEXT NOT NULL,
    "type" "engine_task_type" NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "shotId" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "engineVersion" TEXT NOT NULL,
    "status" "engine_task_status" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engine_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engines" (
    "id" TEXT NOT NULL,
    "engineKey" TEXT NOT NULL,
    "adapterName" TEXT NOT NULL,
    "adapterType" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT,
    "defaultVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "engines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine_versions" (
    "id" TEXT NOT NULL,
    "engineId" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rolloutWeight" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engine_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_engine_bindings" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "engineId" TEXT NOT NULL,
    "engineVersionId" TEXT,
    "engineKey" TEXT NOT NULL,
    "status" "job_engine_binding_status" NOT NULL DEFAULT 'BOUND',
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_engine_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nonce_store" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nonce_store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "traceId" TEXT NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,
    "immutable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxRetry" INTEGER NOT NULL DEFAULT 3,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "output" JSONB,
    "traceId" TEXT,
    "workerId" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_jobs" (
    "id" TEXT NOT NULL,
    "type" "worker_job_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "worker_job_status" NOT NULL DEFAULT 'pending',
    "workerId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "traceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "engineVersion" TEXT,
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shot_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "taskId" TEXT,
    "workerId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "type" "JobType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "maxRetry" INTEGER NOT NULL DEFAULT 3,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_until" TIMESTAMP(3),
    "locked_by" TEXT,
    "payload" JSONB,
    "engineConfig" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "traceId" TEXT,
    "result" JSONB,

    CONSTRAINT "shot_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_nodes" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "name" TEXT,
    "status" "worker_status" NOT NULL DEFAULT 'offline',
    "gpuCount" INTEGER NOT NULL DEFAULT 0,
    "gpuMemory" INTEGER NOT NULL DEFAULT 0,
    "gpuType" TEXT NOT NULL DEFAULT 'unknown',
    "tasksRunning" INTEGER NOT NULL DEFAULT 0,
    "temperature" DOUBLE PRECISION,
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_heartbeats" (
    "worker_id" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ALIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_heartbeats_pkey" PRIMARY KEY ("worker_id")
);

-- CreateTable
CREATE TABLE "model_registry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "model_type" NOT NULL,
    "version" TEXT NOT NULL,
    "changelog" TEXT,
    "compatibleEngines" JSONB NOT NULL,
    "performanceMetrics" JSONB,
    "fineTuneInfo" JSONB,
    "seed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_presets" (
    "id" TEXT NOT NULL,
    "type" "template_type" NOT NULL,
    "name" TEXT NOT NULL,
    "preset" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_scores" (
    "id" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "visualDensityScore" DOUBLE PRECISION NOT NULL,
    "consistencyScore" DOUBLE PRECISION NOT NULL,
    "motionScore" DOUBLE PRECISION NOT NULL,
    "clarityScore" DOUBLE PRECISION NOT NULL,
    "aestheticScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_results" (
    "id" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "textScore" DOUBLE PRECISION NOT NULL,
    "imageScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" "risk_level" NOT NULL,
    "reviewStatus" "review_status" NOT NULL DEFAULT 'require_human_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safety_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "cost_ledger_id" TEXT,
    "project_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CONSUME',
    "credits_delta" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budget" DOUBLE PRECISION NOT NULL,
    "currentCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "planId" TEXT NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing_reviews" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT,
    "shotId" TEXT,
    "reviewType" "review_type" NOT NULL,
    "reviewerId" TEXT,
    "result" "review_result" NOT NULL,
    "reviewLog" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishing_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "organization_role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_sources" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "novelTitle" TEXT,
    "novelAuthor" TEXT,
    "rawText" TEXT NOT NULL,
    "filePath" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "characterCount" INTEGER,
    "chapterCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novel_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_chapters" (
    "id" TEXT NOT NULL,
    "novelSourceId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "start_paragraph" INTEGER,
    "end_paragraph" INTEGER,
    "character_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,

    CONSTRAINT "novel_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_drafts" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "characters" JSONB,
    "location" TEXT,
    "emotions" JSONB,
    "rawTextRange" JSONB,
    "status" "scene_draft_status" NOT NULL DEFAULT 'DRAFT',
    "analysisResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_analysis_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "novelSourceId" TEXT,
    "chapterId" TEXT,
    "jobType" "novel_analysis_job_type" NOT NULL DEFAULT 'ANALYZE_ALL',
    "status" "novel_analysis_status" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "progress" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novel_analysis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "secretHash" TEXT,
    "name" TEXT,
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "status" "api_key_status" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "secretEnc" TEXT,
    "secretEncIv" TEXT,
    "secretEncTag" TEXT,
    "secretVersion" INTEGER DEFAULT 1,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "apiKeyId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nonce" TEXT,
    "signature" TEXT,
    "timestamp" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,
    "orgId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_fingerprints" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "fpVector" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shot_variants" (
    "id" TEXT NOT NULL,
    "shotId" TEXT,
    "data" JSONB,
    "consistencyScore" DOUBLE PRECISION,
    "visualScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shot_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_jobs" (
    "id" TEXT NOT NULL,
    "shotId" TEXT,
    "status" TEXT,
    "payload" JSONB,
    "securityProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "referenceSheetUrls" JSONB,
    "embeddingId" TEXT,
    "defaultSeed" TEXT,
    "traits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_volumes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novel_volumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_scenes" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "raw_text" TEXT,
    "enriched_text" TEXT,
    "visual_density_score" DOUBLE PRECISION,
    "character_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "chunk_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "novel_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_short_term" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "chapterId" TEXT,
    "summary" TEXT,
    "characterStates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_short_term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_long_term" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "vectorRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_long_term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_parse_results" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "volumes" JSONB,
    "chapters" JSONB,
    "scenes" JSONB,
    "parsingQuality" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novel_parse_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_metrics" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "jobId" TEXT,
    "traceId" TEXT,
    "visualDensityScore" DOUBLE PRECISION,
    "enrichmentQuality" DOUBLE PRECISION,
    "parsingQuality" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tier" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL,
    "computeSeconds" DOUBLE PRECISION NOT NULL,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "planId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL,
    "computeSeconds" DOUBLE PRECISION NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "models" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "provider" TEXT,
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checksum" TEXT,
    "createdByJobId" TEXT,
    "ownerId" TEXT NOT NULL,
    "ownerType" "AssetOwnerType" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'GENERATED',
    "storageKey" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "text_safety_results" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "decision" "text_safety_decision" NOT NULL,
    "riskLevel" "risk_level" NOT NULL,
    "flags" JSONB DEFAULT '[]',
    "reasons" JSONB DEFAULT '[]',
    "sanitizedDigest" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "text_safety_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_ledgers" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "engineKey" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "costAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingUnit" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traceId" TEXT,
    "orgId" TEXT,
    "totalCost" DOUBLE PRECISION,
    "costType" TEXT,
    "unitCost" DOUBLE PRECISION,
    "modelName" TEXT,
    "totalCredits" DOUBLE PRECISION,
    "unitCostCredits" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billing_status" "billing_status" NOT NULL DEFAULT 'PENDING',
    "billing_event_id" TEXT,
    "billed_at" TIMESTAMP(3),
    "billing_error" TEXT,

    CONSTRAINT "cost_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_ownerId_type_key" ON "organizations"("ownerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_organizationId_key" ON "memberships"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "seasons_projectId_idx" ON "seasons"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_projectId_index_key" ON "seasons"("projectId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_chapterId_key" ON "episodes"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "scenes_sceneDraftId_key" ON "scenes"("sceneDraftId");

-- CreateIndex
CREATE INDEX "scenes_projectId_index_idx" ON "scenes"("projectId", "index");

-- CreateIndex
CREATE INDEX "shots_sceneId_index_idx" ON "shots"("sceneId", "index");

-- CreateIndex
CREATE INDEX "semantic_enhancements_nodeType_nodeId_idx" ON "semantic_enhancements"("nodeType", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "semantic_enhancements_nodeType_nodeId_key" ON "semantic_enhancements"("nodeType", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "shot_plannings_shotId_key" ON "shot_plannings"("shotId");

-- CreateIndex
CREATE UNIQUE INDEX "structure_quality_reports_projectId_key" ON "structure_quality_reports"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "engines_engineKey_key" ON "engines"("engineKey");

-- CreateIndex
CREATE UNIQUE INDEX "engines_code_key" ON "engines"("code");

-- CreateIndex
CREATE UNIQUE INDEX "engine_versions_engineId_versionName_key" ON "engine_versions"("engineId", "versionName");

-- CreateIndex
CREATE UNIQUE INDEX "job_engine_bindings_jobId_key" ON "job_engine_bindings"("jobId");

-- CreateIndex
CREATE INDEX "job_engine_bindings_engineId_status_idx" ON "job_engine_bindings"("engineId", "status");

-- CreateIndex
CREATE INDEX "job_engine_bindings_jobId_idx" ON "job_engine_bindings"("jobId");

-- CreateIndex
CREATE INDEX "job_engine_bindings_engineKey_status_idx" ON "job_engine_bindings"("engineKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "nonce_store_nonce_apiKey_key" ON "nonce_store"("nonce", "apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_userId_projectId_key" ON "project_members"("userId", "projectId");

-- CreateIndex
CREATE INDEX "audit_log_userId_idx" ON "audit_log"("userId");

-- CreateIndex
CREATE INDEX "audit_log_resourceId_idx" ON "audit_log"("resourceId");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("timestamp");

-- CreateIndex
CREATE INDEX "Task_status_createdAt_idx" ON "Task"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "worker_jobs_jobId_key" ON "worker_jobs"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "worker_nodes_workerId_key" ON "worker_nodes"("workerId");

-- CreateIndex
CREATE INDEX "worker_nodes_status_idx" ON "worker_nodes"("status");

-- CreateIndex
CREATE INDEX "worker_heartbeats_status_last_seen_at_idx" ON "worker_heartbeats"("status", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "model_registry_name_version_key" ON "model_registry"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_cost_ledger_id_key" ON "billing_events"("cost_ledger_id");

-- CreateIndex
CREATE INDEX "billing_events_project_id_created_at_idx" ON "billing_events"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_organizationId_idx" ON "subscriptions"("organizationId");

-- CreateIndex
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- CreateIndex
CREATE INDEX "organization_members_organizationId_idx" ON "organization_members"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_userId_organizationId_key" ON "organization_members"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "novel_sources_projectId_idx" ON "novel_sources"("projectId");

-- CreateIndex
CREATE INDEX "novel_chapters_novelSourceId_idx" ON "novel_chapters"("novelSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "novel_chapters_novelSourceId_orderIndex_key" ON "novel_chapters"("novelSourceId", "orderIndex");

-- CreateIndex
CREATE INDEX "scene_drafts_chapterId_idx" ON "scene_drafts"("chapterId");

-- CreateIndex
CREATE INDEX "scene_drafts_status_idx" ON "scene_drafts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "scene_drafts_chapterId_orderIndex_key" ON "scene_drafts"("chapterId", "orderIndex");

-- CreateIndex
CREATE INDEX "novel_analysis_jobs_projectId_idx" ON "novel_analysis_jobs"("projectId");

-- CreateIndex
CREATE INDEX "novel_analysis_jobs_novelSourceId_idx" ON "novel_analysis_jobs"("novelSourceId");

-- CreateIndex
CREATE INDEX "novel_analysis_jobs_chapterId_idx" ON "novel_analysis_jobs"("chapterId");

-- CreateIndex
CREATE INDEX "novel_analysis_jobs_status_idx" ON "novel_analysis_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_key_idx" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_status_idx" ON "api_keys"("status");

-- CreateIndex
CREATE INDEX "api_keys_ownerUserId_idx" ON "api_keys"("ownerUserId");

-- CreateIndex
CREATE INDEX "api_keys_ownerOrgId_idx" ON "api_keys"("ownerOrgId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_apiKeyId_idx" ON "audit_logs"("apiKeyId");

-- CreateIndex
CREATE INDEX "audit_logs_nonce_timestamp_idx" ON "audit_logs"("nonce", "timestamp");

-- CreateIndex
CREATE INDEX "characters_projectId_name_idx" ON "characters"("projectId", "name");

-- CreateIndex
CREATE INDEX "novel_scenes_chapter_id_index_idx" ON "novel_scenes"("chapter_id", "index");

-- CreateIndex
CREATE INDEX "novel_scenes_chunk_index_idx" ON "novel_scenes"("chunk_index");

-- CreateIndex
CREATE UNIQUE INDEX "novel_parse_results_projectId_key" ON "novel_parse_results"("projectId");

-- CreateIndex
CREATE INDEX "novel_parse_results_projectId_idx" ON "novel_parse_results"("projectId");

-- CreateIndex
CREATE INDEX "quality_metrics_projectId_engine_idx" ON "quality_metrics"("projectId", "engine");

-- CreateIndex
CREATE INDEX "quality_metrics_jobId_traceId_idx" ON "quality_metrics"("jobId", "traceId");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "models_name_version_key" ON "models"("name", "version");

-- CreateIndex
CREATE INDEX "assets_projectId_idx" ON "assets"("projectId");

-- CreateIndex
CREATE INDEX "assets_ownerType_ownerId_idx" ON "assets"("ownerType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_ownerType_ownerId_type_key" ON "assets"("ownerType", "ownerId", "type");

-- CreateIndex
CREATE INDEX "text_safety_results_decision_createdat_idx" ON "text_safety_results"("decision", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "text_safety_results_resourcetype_resourceid_idx" ON "text_safety_results"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "text_safety_results_risklevel_createdat_idx" ON "text_safety_results"("riskLevel", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "cost_ledgers_projectId_billing_status_idx" ON "cost_ledgers"("projectId", "billing_status");

-- CreateIndex
CREATE INDEX "cost_ledgers_projectId_idx" ON "cost_ledgers"("projectId");

-- CreateIndex
CREATE INDEX "cost_ledgers_jobId_attempt_idx" ON "cost_ledgers"("jobId", "attempt");

-- CreateIndex
CREATE INDEX "cost_ledgers_created_at_idx" ON "cost_ledgers"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cost_ledgers_jobId_attempt_key" ON "cost_ledgers"("jobId", "attempt");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "novel_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_sceneDraftId_fkey" FOREIGN KEY ("sceneDraftId") REFERENCES "scene_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shots" ADD CONSTRAINT "shots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shots" ADD CONSTRAINT "shots_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_plannings" ADD CONSTRAINT "shot_plannings_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structure_quality_reports" ADD CONSTRAINT "structure_quality_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_tasks" ADD CONSTRAINT "engine_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_tasks" ADD CONSTRAINT "engine_tasks_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_tasks" ADD CONSTRAINT "engine_tasks_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_versions" ADD CONSTRAINT "engine_versions_engineId_fkey" FOREIGN KEY ("engineId") REFERENCES "engines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_engine_bindings" ADD CONSTRAINT "job_engine_bindings_engineId_fkey" FOREIGN KEY ("engineId") REFERENCES "engines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_engine_bindings" ADD CONSTRAINT "job_engine_bindings_engineVersionId_fkey" FOREIGN KEY ("engineVersionId") REFERENCES "engine_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_engine_bindings" ADD CONSTRAINT "job_engine_bindings_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "shot_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_jobs" ADD CONSTRAINT "worker_jobs_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_scores" ADD CONSTRAINT "quality_scores_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_results" ADD CONSTRAINT "safety_results_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_cost_ledger_id_fkey" FOREIGN KEY ("cost_ledger_id") REFERENCES "cost_ledgers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_reviews" ADD CONSTRAINT "publishing_reviews_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_reviews" ADD CONSTRAINT "publishing_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_reviews" ADD CONSTRAINT "publishing_reviews_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_sources" ADD CONSTRAINT "novel_sources_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_chapters" ADD CONSTRAINT "novel_chapters_novelSourceId_fkey" FOREIGN KEY ("novelSourceId") REFERENCES "novel_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_drafts" ADD CONSTRAINT "scene_drafts_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "novel_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_analysis_jobs" ADD CONSTRAINT "novel_analysis_jobs_novelSourceId_fkey" FOREIGN KEY ("novelSourceId") REFERENCES "novel_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_analysis_jobs" ADD CONSTRAINT "novel_analysis_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_scenes" ADD CONSTRAINT "novel_scenes_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "novel_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_parse_results" ADD CONSTRAINT "novel_parse_results_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_metrics" ADD CONSTRAINT "quality_metrics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "Asset_Shot_fkey" FOREIGN KEY ("ownerId") REFERENCES "shots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_createdByJobId_fkey" FOREIGN KEY ("createdByJobId") REFERENCES "shot_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_ledgers" ADD CONSTRAINT "cost_ledgers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_ledgers" ADD CONSTRAINT "cost_ledgers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

