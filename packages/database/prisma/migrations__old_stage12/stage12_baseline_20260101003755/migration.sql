
> database@1.0.0 prisma /Users/adam/Desktop/adam/毛毛虫宇宙/Super Caterpillar/packages/database
> prisma "migrate" "diff" "--from-empty" "--to-schema-datamodel" "prisma/schema.prisma" "--script"

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
CREATE TYPE "shot_status" AS ENUM ('DRAFT', 'READY', 'RENDERING', 'DONE', 'FAILED', 'GENERATING', 'GENERATED', 'pending', 'running', 'success', 'fail', 'need_fix');

-- CreateEnum
CREATE TYPE "identity_lock_scope" AS ENUM ('EPISODE', 'SEASON', 'PROJECT');

-- CreateEnum
CREATE TYPE "shot_review_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'TRIALING');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRYING', 'DISPATCHED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('SHOT_RENDER', 'NOVEL_ANALYSIS', 'CE06_NOVEL_PARSING', 'CE03_VISUAL_DENSITY', 'CE04_VISUAL_ENRICHMENT', 'CE01_REFERENCE_SHEET', 'CE02_IDENTITY_LOCK', 'CE05_DIRECTOR_CONTROL', 'CE07_MEMORY_UPDATE', 'CE07_STORY_MEMORY', 'CE08_STORY_KG', 'CE09_MEDIA_SECURITY', 'VIDEO_RENDER');

-- CreateEnum
CREATE TYPE "job_engine_binding_status" AS ENUM ('BOUND', 'EXECUTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "engine_task_type" AS ENUM ('scene_parse', 'shot_plan', 'shot_enhance', 'inpainting', 'visual_enhance', 'consistency_calibrate');

-- CreateEnum
CREATE TYPE "engine_task_status" AS ENUM ('pending', 'running', 'success', 'fail');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('NOVEL_IMPORT', 'NOVEL_ANALYSIS', 'SHOT_RENDER', 'CE_CORE_PIPELINE', 'VIDEO_RENDER', 'STAGE4_ORCHESTRATOR', 'STAGE4_SAFETY_EVAL', 'STAGE4_QUALITY_EVAL', 'STAGE4_PUBLISHING_DECISION');

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
CREATE TYPE "billing_event_type" AS ENUM ('subscription', 'pay_as_you_go', 'organization_billing', 'auto_fix', 'render', 'model_call');

-- CreateEnum
CREATE TYPE "billing_status" AS ENUM ('pending', 'reserved', 'completed', 'settled', 'failed', 'refunded');

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
CREATE TYPE "AssetStatus" AS ENUM ('CREATING', 'READY', 'FAILED', 'GENERATED', 'LOCKED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "BillingRecordType" AS ENUM ('RESERVE', 'SETTLE', 'REFUND', 'GRANT', 'DEBIT');

-- CreateEnum
CREATE TYPE "video_job_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BudgetWindow" AS ENUM ('DAILY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "owner_type" AS ENUM ('ORGANIZATION', 'PROJECT', 'USER');

-- CreateEnum
CREATE TYPE "credit_action" AS ENUM ('REFILL', 'RESERVE', 'SETTLE', 'RELEASE', 'REFUND', 'GRANT');

-- CreateEnum
CREATE TYPE "budget_action" AS ENUM ('WARN', 'BLOCK');

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
    "credits" DECIMAL(20,6) NOT NULL DEFAULT 0,
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
    "status" "shot_status" NOT NULL DEFAULT 'DRAFT',
    "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentVariantId" TEXT,
    "params" JSONB NOT NULL DEFAULT '{}',
    "qualityScore" JSONB NOT NULL DEFAULT '{}',
    "reviewedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "organizationId" TEXT,
    "enrichedPrompt" TEXT,
    "identity_lock_token" TEXT,

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
    "payload" JSONB,
    "engineConfig" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "traceId" TEXT,
    "engineKey" TEXT,

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
    "supportedJobTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
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
    "calcVersion" INTEGER NOT NULL DEFAULT 1,
    "weightsSnapshot" JSONB,
    "thresholdSnapshot" JSONB,
    "traceId" TEXT,
    "inputsSnapshotHash" TEXT,
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
    "version" INTEGER NOT NULL DEFAULT 1,
    "reasons" JSONB,
    "evidenceRef" TEXT,
    "traceId" TEXT,
    "inputsSnapshotHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "safety_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "eventType" "billing_event_type" NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "projectId" TEXT,
    "jobId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "creditsConsumed" DOUBLE PRECISION NOT NULL,
    "computeSecondsUsed" DOUBLE PRECISION NOT NULL,
    "gpuCost" DOUBLE PRECISION NOT NULL,
    "modelCost" DOUBLE PRECISION NOT NULL,
    "storageCost" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "billingStatus" "billing_status" NOT NULL DEFAULT 'pending',
    "invoiceId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

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
    "decisionVersion" INTEGER NOT NULL DEFAULT 1,
    "reasons" JSONB,
    "traceId" TEXT,
    "inputsSnapshotHash" TEXT,
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
CREATE TABLE "memory_short_term" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "project_id" TEXT,
    "chapter_id" TEXT NOT NULL,
    "summary" TEXT,
    "character_state_json" JSONB,
    "key_events_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_short_term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_update_logs" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_update_logs_pkey" PRIMARY KEY ("id")
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
    "timestamp" TIMESTAMP(3),
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
    "name" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "parameters" JSONB,
    "qualityScore" JSONB,
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
    "variantId" TEXT,
    "projectId" TEXT,
    "organizationId" TEXT,
    "status" "video_job_status" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB DEFAULT '{}',
    "reservedCredits" INTEGER DEFAULT 0,
    "settledCredits" INTEGER DEFAULT 0,
    "creditReservationId" TEXT,
    "reservedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "gpuSecondsEstimated" INTEGER DEFAULT 0,
    "gpuSecondsActual" INTEGER DEFAULT 0,
    "idempotencyKey" TEXT,
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
    "reference_sheet_urls" JSONB,
    "embedding_id" TEXT,
    "default_seed" TEXT,
    "reference_sheet_id" TEXT,
    "identity_lock_token" TEXT,
    "identity_lock_scope" "identity_lock_scope" DEFAULT 'PROJECT',
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
    "raw_text" TEXT NOT NULL,
    "enriched_text" TEXT,
    "visual_density_score" DOUBLE PRECISION,
    "character_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novel_scenes_pkey" PRIMARY KEY ("id")
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
    "projectId" TEXT,
    "jobId" TEXT,
    "traceId" TEXT,
    "planId" TEXT,
    "type" "BillingRecordType" NOT NULL DEFAULT 'SETTLE',
    "amount" DECIMAL(20,6) NOT NULL,
    "credits" DOUBLE PRECISION,
    "computeSeconds" DOUBLE PRECISION,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT,
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
    "traceId" TEXT,
    "ownerId" TEXT NOT NULL,
    "ownerType" "AssetOwnerType" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'GENERATED',
    "storageKey" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "contentType" TEXT,
    "sizeBytes" BIGINT,
    "durationMs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "fps" INTEGER,
    "signed_url" TEXT,
    "hls_playlist_url" TEXT,
    "watermark_mode" TEXT,
    "fingerprint_id" TEXT,

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
CREATE TABLE "ce06_ledger_runs" (
    "id" TEXT NOT NULL,
    "ce06RunId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "engineKey" TEXT NOT NULL,
    "engineVer" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ce06_ledger_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ce06_ledger_costs" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ce06_ledger_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ce06_ledger_quality" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ce06_ledger_quality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ce06_ledger_sla" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ce06_ledger_sla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ce06_ledger_invoice_links" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ce06_ledger_invoice_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_skus" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "billing_status" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_ledgers" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "billing_status" NOT NULL,
    "refId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_records" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "jobId" TEXT,
    "workerId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "payload" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_ledgers" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "costType" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_profiler" (
    "key" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "missCount" INTEGER NOT NULL DEFAULT 0,
    "savingSize" BIGINT NOT NULL DEFAULT 0,
    "lastRef" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cache_profiler_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "credit_wallets" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerType" "owner_type" NOT NULL,
    "balance" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledgers" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "traceId" TEXT,
    "jobId" TEXT,
    "amount" DECIMAL(20,6) NOT NULL,
    "action" "credit_action" NOT NULL,
    "costType" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actual_cost" DOUBLE PRECISION,
    "reserved_cost" DOUBLE PRECISION,
    "drift" DOUBLE PRECISION,
    "snapshot" JSONB,

    CONSTRAINT "credit_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" "owner_type" NOT NULL,
    "window" "BudgetWindow" NOT NULL DEFAULT 'DAILY',
    "limitCredits" DECIMAL(20,6) NOT NULL,
    "action" "budget_action" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_window_states" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "window" "BudgetWindow" NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "reservedCredits" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "spentCredits" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_window_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_quotas" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "limitType" TEXT NOT NULL,
    "limitValue" DECIMAL(20,6) NOT NULL,
    "action" "budget_action" NOT NULL DEFAULT 'BLOCK',

    CONSTRAINT "plan_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_plans" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "project_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_statements" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalCost" DECIMAL(20,6) NOT NULL,
    "creditsConsumed" DECIMAL(20,6) NOT NULL,
    "status" TEXT NOT NULL,
    "s3Url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_snapshots" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ledgerData" JSONB NOT NULL,

    CONSTRAINT "settlement_snapshots_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "shot_jobs_status_createdAt_idx" ON "shot_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "shot_jobs_type_status_idx" ON "shot_jobs"("type", "status");

-- CreateIndex
CREATE INDEX "shot_jobs_engineKey_status_idx" ON "shot_jobs"("engineKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "worker_nodes_workerId_key" ON "worker_nodes"("workerId");

-- CreateIndex
CREATE INDEX "worker_nodes_status_idx" ON "worker_nodes"("status");

-- CreateIndex
CREATE INDEX "worker_nodes_status_lastHeartbeat_idx" ON "worker_nodes"("status", "lastHeartbeat");

-- CreateIndex
CREATE INDEX "worker_heartbeats_status_last_seen_at_idx" ON "worker_heartbeats"("status", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "model_registry_name_version_key" ON "model_registry"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "quality_scores_shotId_calcVersion_key" ON "quality_scores"("shotId", "calcVersion");

-- CreateIndex
CREATE UNIQUE INDEX "safety_results_shotId_version_key" ON "safety_results"("shotId", "version");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_organizationId_idx" ON "subscriptions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "publishing_reviews_shotId_decisionVersion_key" ON "publishing_reviews"("shotId", "decisionVersion");

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
CREATE UNIQUE INDEX "memory_short_term_chapter_id_key" ON "memory_short_term"("chapter_id");

-- CreateIndex
CREATE INDEX "memory_short_term_chapter_id_idx" ON "memory_short_term"("chapter_id");

-- CreateIndex
CREATE INDEX "memory_short_term_project_id_chapter_id_idx" ON "memory_short_term"("project_id", "chapter_id");

-- CreateIndex
CREATE INDEX "memory_short_term_updated_at_idx" ON "memory_short_term"("updated_at");

-- CreateIndex
CREATE INDEX "memory_update_logs_chapter_id_idx" ON "memory_update_logs"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "memory_update_logs_chapter_id_payload_hash_key" ON "memory_update_logs"("chapter_id", "payload_hash");

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
CREATE UNIQUE INDEX "video_jobs_idempotencyKey_key" ON "video_jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "video_jobs_status_createdAt_idx" ON "video_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "characters_projectId_name_idx" ON "characters"("projectId", "name");

-- CreateIndex
CREATE INDEX "novel_scenes_chapter_id_index_idx" ON "novel_scenes"("chapter_id", "index");

-- CreateIndex
CREATE UNIQUE INDEX "novel_parse_results_projectId_key" ON "novel_parse_results"("projectId");

-- CreateIndex
CREATE INDEX "novel_parse_results_projectId_idx" ON "novel_parse_results"("projectId");

-- CreateIndex
CREATE INDEX "quality_metrics_projectId_engine_idx" ON "quality_metrics"("projectId", "engine");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "billing_records_idempotencyKey_key" ON "billing_records"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "models_name_version_key" ON "models"("name", "version");

-- CreateIndex
CREATE INDEX "assets_projectId_idx" ON "assets"("projectId");

-- CreateIndex
CREATE INDEX "assets_ownerType_ownerId_idx" ON "assets"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "assets_status_projectId_idx" ON "assets"("status", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_ownerType_ownerId_type_key" ON "assets"("ownerType", "ownerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "assets_createdByJobId_type_key" ON "assets"("createdByJobId", "type");

-- CreateIndex
CREATE INDEX "text_safety_results_decision_createdat_idx" ON "text_safety_results"("decision", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "text_safety_results_resourcetype_resourceid_idx" ON "text_safety_results"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "text_safety_results_risklevel_createdat_idx" ON "text_safety_results"("riskLevel", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ce06_ledger_runs_ce06RunId_key" ON "ce06_ledger_runs"("ce06RunId");

-- CreateIndex
CREATE UNIQUE INDEX "skus_code_key" ON "skus"("code");

-- CreateIndex
CREATE INDEX "asset_skus_status_createdAt_idx" ON "asset_skus"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "asset_skus_assetId_skuId_key" ON "asset_skus"("assetId", "skuId");

-- CreateIndex
CREATE INDEX "billing_ledgers_assetId_createdAt_idx" ON "billing_ledgers"("assetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "billing_ledgers_status_createdAt_idx" ON "billing_ledgers"("status", "createdAt");

-- CreateIndex
CREATE INDEX "telemetry_records_traceId_idx" ON "telemetry_records"("traceId");

-- CreateIndex
CREATE INDEX "telemetry_records_jobId_idx" ON "telemetry_records"("jobId");

-- CreateIndex
CREATE INDEX "telemetry_records_workerId_idx" ON "telemetry_records"("workerId");

-- CreateIndex
CREATE INDEX "telemetry_records_kind_name_timestamp_idx" ON "telemetry_records"("kind", "name", "timestamp");

-- CreateIndex
CREATE INDEX "cost_ledgers_traceId_idx" ON "cost_ledgers"("traceId");

-- CreateIndex
CREATE INDEX "cost_ledgers_projectId_orgId_timestamp_idx" ON "cost_ledgers"("projectId", "orgId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "credit_wallets_ownerType_ownerId_key" ON "credit_wallets"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "credit_ledgers_traceId_idx" ON "credit_ledgers"("traceId");

-- CreateIndex
CREATE INDEX "credit_ledgers_jobId_idx" ON "credit_ledgers"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledgers_walletId_traceId_jobId_action_key" ON "credit_ledgers"("walletId", "traceId", "jobId", "action");

-- CreateIndex
CREATE INDEX "budgets_targetId_targetType_idx" ON "budgets"("targetId", "targetType");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_targetId_window_key" ON "budgets"("targetId", "window");

-- CreateIndex
CREATE INDEX "budget_window_states_targetId_window_idx" ON "budget_window_states"("targetId", "window");

-- CreateIndex
CREATE UNIQUE INDEX "budget_window_states_targetId_window_windowStart_key" ON "budget_window_states"("targetId", "window", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "project_plans_projectId_key" ON "project_plans"("projectId");

-- CreateIndex
CREATE INDEX "billing_statements_orgId_periodStart_idx" ON "billing_statements"("orgId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_snapshots_jobId_key" ON "settlement_snapshots"("jobId");

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
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "worker_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "memory_short_term" ADD CONSTRAINT "memory_short_term_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "novel_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "Asset_Shot_fkey" FOREIGN KEY ("ownerId") REFERENCES "shots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_createdByJobId_fkey" FOREIGN KEY ("createdByJobId") REFERENCES "shot_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_skus" ADD CONSTRAINT "asset_skus_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_quotas" ADD CONSTRAINT "plan_quotas_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_plans" ADD CONSTRAINT "project_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_plans" ADD CONSTRAINT "project_plans_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "billing_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

