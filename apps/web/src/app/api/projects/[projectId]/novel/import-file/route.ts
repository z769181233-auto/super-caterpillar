import { NextRequest, NextResponse } from 'next/server';
import {
  buildApiUrl,
  buildSignedMultipartHeaders,
  extractForwardHeaders,
} from '@/lib/server/novel-import-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const formData = await request.formData();
  const forwardHeaders = extractForwardHeaders(request);
  const signedHeaders = await buildSignedMultipartHeaders();

  const response = await fetch(buildApiUrl(`/api/projects/${projectId}/novel/import-file`), {
    method: 'POST',
    headers: {
      ...Object.fromEntries(Object.entries(forwardHeaders)),
      ...signedHeaders,
    },
    body: formData,
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
}
