'use client';

import type {
  CharacterBibleDTO,
  DirectorScriptDTO,
  EpisodePlanDTO,
  LocationBibleDTO,
  ProductionStateDTO,
  ShotScriptDTO,
  StoryboardAssetDTO,
  StoryBibleDTO,
  StorySourceCompatibilityDTO,
  VideoPromptDTO,
} from '@scu/shared-types';
import { extractStudioApiErrorMessage } from './studio-api-errors';

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: {
    message?: string;
  };
};

export interface StoryboardImageReadinessDTO {
  projectId: string;
  status: 'ready' | 'blocked';
  blockers: string[];
  readyShotCount: number;
  textBindingCoverageRate: number;
  characterBindingRate: number;
  locationBindingRate: number;
  promptCompletenessRate: number;
  continuityCoverageRate: number;
  estimatedCostUnits: number;
  imageAssetCount: number;
  willCreateJob: false;
  willCallProvider: false;
  willGenerateImage: false;
  nextAction: string;
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

export class StudioApiError extends Error {
  status: number;
  apiBaseUrl: string;
  detail: string;

  constructor(message: string, options: { status: number; apiBaseUrl?: string; detail?: string }) {
    super(message);
    this.name = 'StudioApiError';
    this.status = options.status;
    this.apiBaseUrl = options.apiBaseUrl || '/api';
    this.detail = options.detail || message;
  }
}

function productionStateErrorMessage(status: number): string {
  if (status === 401) return '登录态已失效，请先登录。';
  if (status === 403) return '当前账号可能没有访问该项目的权限。';
  if (status === 0) return 'API 服务可能未启动。';
  return '暂时无法读取制作状态。';
}

export async function getStudioProductionState(projectId: string): Promise<ProductionStateDTO> {
  const response = await fetch(`/api/projects/${projectId}/production-state`, {
    cache: 'no-store',
    credentials: 'include',
  });
  let result: ApiEnvelope<ProductionStateDTO>;
  try {
    result = (await response.json()) as ApiEnvelope<ProductionStateDTO>;
  } catch {
    throw new StudioApiError(productionStateErrorMessage(response.status), {
      status: response.status,
      detail: `ProductionState API returned non-JSON response with status ${response.status}.`,
    });
  }

  if (!response.ok || !result.success || !result.data) {
    const detail = extractStudioApiErrorMessage(result, 'Failed to fetch Studio production state');
    throw new StudioApiError(productionStateErrorMessage(response.status), {
      status: response.status,
      detail,
    });
  }

  return result.data;
}

export async function getStorySourceCompatibility(
  projectId: string
): Promise<StorySourceCompatibilityDTO> {
  const response = await fetch(`/api/projects/${projectId}/story-source/compatibility`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<StorySourceCompatibilityDTO>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch StorySource compatibility');
  }

  return result.data;
}

export async function getStudioStoryBible(projectId: string): Promise<StoryBibleDTO> {
  const response = await fetch(`/api/projects/${projectId}/story-bible`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<StoryBibleDTO>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch Studio StoryBible');
  }

  return result.data;
}

export async function generateStudioStoryBible(projectId: string): Promise<StoryBibleDTO> {
  const response = await fetch(`/api/projects/${projectId}/story-bible/generate`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<StoryBibleDTO>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to generate Studio StoryBible');
  }

  return result.data;
}

export async function getStudioCharacterBibles(projectId: string): Promise<CharacterBibleDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/characters`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<CharacterBibleDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch Studio CharacterBible');
  }

  return result.data;
}

export async function generateStudioCharacterBibles(
  projectId: string
): Promise<CharacterBibleDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/characters/generate`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<CharacterBibleDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to generate Studio CharacterBible');
  }

  return result.data;
}

export async function getStudioLocationBibles(projectId: string): Promise<LocationBibleDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/locations`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<LocationBibleDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch Studio LocationBible');
  }

  return result.data;
}

export async function generateStudioLocationBibles(projectId: string): Promise<LocationBibleDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/locations/generate`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<LocationBibleDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to generate Studio LocationBible');
  }

  return result.data;
}

export async function getStudioEpisodePlans(projectId: string): Promise<EpisodePlanDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/episode-plans`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<EpisodePlanDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch Studio EpisodePlan');
  }

  return result.data;
}

export async function generateStudioEpisodePlans(projectId: string): Promise<EpisodePlanDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/episode-plans/generate`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<EpisodePlanDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      extractStudioApiErrorMessage(result, 'Failed to generate Studio EpisodePlan')
    );
  }

  return result.data;
}

export async function getStudioDirectorScripts(projectId: string): Promise<DirectorScriptDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/director-scripts`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<DirectorScriptDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch Studio DirectorScript');
  }

  return result.data;
}

export async function generateStudioDirectorScripts(
  projectId: string
): Promise<DirectorScriptDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/director-scripts/generate`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<DirectorScriptDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      extractStudioApiErrorMessage(result, 'Failed to generate Studio DirectorScript')
    );
  }

  return result.data;
}

export async function getStudioShotScripts(projectId: string): Promise<ShotScriptDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/shot-scripts`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<ShotScriptDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch Studio ShotScript');
  }

  return result.data;
}

export async function generateStudioShotScripts(projectId: string): Promise<ShotScriptDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/shot-scripts/generate`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<ShotScriptDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      extractStudioApiErrorMessage(result, 'Failed to generate Studio ShotScript')
    );
  }

  return result.data;
}

export async function getStudioStoryboardAssets(projectId: string): Promise<StoryboardAssetDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/storyboard-assets`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<StoryboardAssetDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch Studio StoryboardAsset');
  }

  return result.data;
}

export async function generateStudioStoryboardAssets(
  projectId: string
): Promise<StoryboardAssetDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/storyboard-assets/generate`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<StoryboardAssetDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      extractStudioApiErrorMessage(result, 'Failed to generate Studio StoryboardAsset')
    );
  }

  return result.data;
}

export async function getStudioStoryboardImageReadiness(
  projectId: string
): Promise<StoryboardImageReadinessDTO> {
  const response = await fetch(`/api/projects/${projectId}/storyboard-images/readiness`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<StoryboardImageReadinessDTO>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch Studio storyboard image readiness');
  }

  return result.data;
}

export async function dryRunStudioStoryboardImageGeneration(
  projectId: string,
  payload: StoryboardImageGenerationDryRunRequestDTO = {}
): Promise<StoryboardImageGenerationDryRunDTO> {
  const response = await fetch(`/api/projects/${projectId}/storyboard-images/generate`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as ApiEnvelope<StoryboardImageGenerationDryRunDTO>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to dry-run Studio storyboard image generation');
  }

  return result.data;
}

export async function generateOneStudioStoryboardImage(
  projectId: string,
  payload: StoryboardImageGenerateOneRequestDTO
): Promise<StoryboardImageGenerateOneDTO> {
  const response = await fetch(`/api/projects/${projectId}/storyboard-images/generate-one`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as ApiEnvelope<StoryboardImageGenerateOneDTO>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to generate one mock Studio storyboard image');
  }

  return result.data;
}

export async function getStudioVideoPrompts(projectId: string): Promise<VideoPromptDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/video-prompts`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<VideoPromptDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to fetch Studio VideoPrompt');
  }

  return result.data;
}

export async function generateStudioVideoPrompts(projectId: string): Promise<VideoPromptDTO[]> {
  const response = await fetch(`/api/projects/${projectId}/video-prompts/generate`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  });
  const result = (await response.json()) as ApiEnvelope<VideoPromptDTO[]>;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to generate Studio VideoPrompt');
  }

  return result.data;
}
