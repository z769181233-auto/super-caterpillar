'use client';

import type {
  CharacterBibleDTO,
  DirectorScriptDTO,
  EpisodePlanDTO,
  LocationBibleDTO,
  ProductionStateDTO,
  ShotScriptDTO,
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

export async function getStudioProductionState(projectId: string): Promise<ProductionStateDTO> {
  const response = await fetch(`/api/projects/${projectId}/production-state`, {
    cache: 'no-store',
    credentials: 'include',
  });
  let result: ApiEnvelope<ProductionStateDTO>;
  try {
    result = (await response.json()) as ApiEnvelope<ProductionStateDTO>;
  } catch {
    throw new StudioApiError('暂时无法读取制作状态。', {
      status: response.status,
      detail: `ProductionState API returned non-JSON response with status ${response.status}.`,
    });
  }

  if (!response.ok || !result.success || !result.data) {
    const detail = result.error?.message || 'Failed to fetch Studio production state';
    throw new StudioApiError('暂时无法读取制作状态。', {
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
