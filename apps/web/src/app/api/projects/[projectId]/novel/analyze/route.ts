import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  buildApiUrl,
  buildSignedJsonRequest,
  extractForwardHeaders,
} from '@/lib/server/novel-import-proxy';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const parsed = await request.json().catch(() => ({}));
  const incomingTraceId =
    parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).traceId : undefined;
  const traceId =
    typeof incomingTraceId === 'string' && incomingTraceId.length > 0
      ? incomingTraceId
      : `web-novel-analyze-${randomUUID()}`;
  const payload =
    parsed && typeof parsed === 'object'
      ? {
          ...parsed,
          traceId,
        }
      : { traceId };
  const signed = await buildSignedJsonRequest(payload);
  const forwardHeaders = extractForwardHeaders(request);

  const response = await fetch(buildApiUrl(`/api/projects/${projectId}/novel/analyze`), {
    method: 'POST',
    headers: {
      ...Object.fromEntries(Object.entries(forwardHeaders)),
      'x-trace-id': traceId,
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
