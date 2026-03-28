export function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_ANIME_STUDIO_V2_API_URL || '';
  }

  return process.env.ANIME_STUDIO_V2_SERVER_API_URL || 'http://127.0.0.1:4310';
}

function resolveUploadBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_ANIME_STUDIO_V2_UPLOAD_API_URL || 'http://127.0.0.1:4310';
  }

  return resolveApiBaseUrl();
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export async function getProjects<T>(): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/projects`, { cache: 'no-store' });
  return handle<T>(response);
}

export async function getProject<T>(projectId: string): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/projects/${projectId}`, { cache: 'no-store' });
  return handle<T>(response);
}

export async function createProject<T>(payload: { name: string; description?: string }): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handle<T>(response);
}

export async function importNovel<T>(
  projectId: string,
  payload: { title: string; author?: string; text: string }
): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/projects/${projectId}/novel/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handle<T>(response);
}

export async function generateEpisodePackage<T>(
  projectId: string,
  payload: { episodeNo: number; adaptationMode?: 'faithful' | 'commercial' | 'fast_paced'; estimatedMinutes?: number }
): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/projects/${projectId}/pipeline/episode-package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handle<T>(response);
}

export async function createPreviewVideoJob<T>(
  projectId: string,
  payload: { episodeNo: number; provider?: 'mock_storyboard' | 'sora' | 'jimeng'; objective?: string }
): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/projects/${projectId}/preview-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handle<T>(response);
}

export async function createRenderJob<T>(
  projectId: string,
  payload: { episodeNo: number; provider?: 'mock_video' | 'sora' | 'jimeng'; qualityPreset?: 'draft' | 'preview' | 'final' }
): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/projects/${projectId}/render-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handle<T>(response);
}

export async function createUploadSession<T>(
  projectId: string,
  payload: { title: string; author?: string; totalChunks: number }
): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/projects/${projectId}/novel/upload-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handle<T>(response);
}

export async function uploadSessionChunk<T>(
  uploadSessionId: string,
  payload: { index: number; content: string }
): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/upload-sessions/${uploadSessionId}/chunks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handle<T>(response);
}

export async function finalizeUploadSession<T>(uploadSessionId: string): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/upload-sessions/${uploadSessionId}/finalize`, {
    method: 'POST'
  });
  return handle<T>(response);
}

export async function createAssetItem<T>(
  projectId: string,
  payload: {
    name: string;
    type: 'character_sheet' | 'location_board' | 'prop_sheet' | 'reference_frame' | 'music_brief' | 'style_bible';
    description: string;
    sourceUrl?: string;
    sourceFileId?: string;
    tags?: string[];
    promptHint?: string;
  }
): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/projects/${projectId}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handle<T>(response);
}

export async function createStoredFile<T>(
  projectId: string,
  payload: {
    name: string;
    kind: 'novel_source' | 'asset_attachment';
    mimeType: string;
    contentBase64: string;
  }
): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/projects/${projectId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handle<T>(response);
}

export async function uploadStoredFile<T>(
  projectId: string,
  payload: {
    file: File;
    kind: 'novel_source' | 'asset_attachment';
  }
): Promise<T> {
  const params = new URLSearchParams({
    name: payload.file.name,
    kind: payload.kind,
    mimeType: payload.file.type || 'application/octet-stream'
  });

  const response = await fetch(`${resolveUploadBaseUrl()}/api/projects/${projectId}/files/upload?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': payload.file.type || 'application/octet-stream'
    },
    body: payload.file
  });
  return handle<T>(response);
}

export async function createImportJob<T>(
  projectId: string,
  payload: { fileId: string; title: string; author?: string }
): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}/api/projects/${projectId}/import-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handle<T>(response);
}
