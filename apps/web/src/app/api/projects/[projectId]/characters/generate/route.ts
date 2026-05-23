import { NextRequest, NextResponse } from 'next/server';
import { buildApiUrl, extractForwardHeaders } from '@/lib/server/novel-import-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const forwardHeaders = extractForwardHeaders(request);

  const response = await fetch(buildApiUrl(`/api/projects/${projectId}/characters/generate`), {
    method: 'POST',
    headers: {
      ...Object.fromEntries(Object.entries(forwardHeaders)),
    },
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
}
