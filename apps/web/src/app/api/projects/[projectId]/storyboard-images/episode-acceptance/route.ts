import { NextRequest, NextResponse } from 'next/server';
import { buildApiUrl, extractForwardHeaders } from '@/lib/server/novel-import-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const forwardHeaders = extractForwardHeaders(request);
  const episodeId = request.nextUrl.searchParams.get('episodeId');
  const query = episodeId ? `?episodeId=${encodeURIComponent(episodeId)}` : '';

  const response = await fetch(
    buildApiUrl(`/api/projects/${projectId}/storyboard-images/episode-acceptance${query}`),
    {
      method: 'GET',
      headers: {
        ...Object.fromEntries(Object.entries(forwardHeaders)),
      },
    }
  );

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
}
