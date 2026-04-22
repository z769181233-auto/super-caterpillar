import { NextRequest, NextResponse } from 'next/server';
import {
  buildApiUrl,
  buildSignedJsonHashRequest,
  extractForwardHeaders,
} from '@/lib/server/novel-import-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const raw = await request.text();
  const signed = await buildSignedJsonHashRequest(raw);
  const forwardHeaders = extractForwardHeaders(request);

  const response = await fetch(buildApiUrl(`/api/projects/${projectId}/novel/analyze`), {
    method: 'POST',
    headers: {
      ...Object.fromEntries(Object.entries(forwardHeaders)),
      ...signed.headers,
    },
    body: signed.body,
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
}
