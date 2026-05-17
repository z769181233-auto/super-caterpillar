import { NextRequest, NextResponse } from 'next/server';
import { buildApiUrl, extractForwardHeaders, forwardSetCookies } from '@/lib/server/novel-import-proxy';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const forwardHeaders = extractForwardHeaders(request);

  const response = await fetch(buildApiUrl('/api/auth/logout'), {
    method: 'POST',
    headers: {
      ...Object.fromEntries(Object.entries(forwardHeaders)),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body || undefined,
  });

  const text = await response.text();
  const next = new NextResponse(text, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
  forwardSetCookies(response.headers, next.headers);
  return next;
}
