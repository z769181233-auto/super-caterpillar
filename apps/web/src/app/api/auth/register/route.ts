import { NextRequest, NextResponse } from 'next/server';
import { buildApiUrl, extractForwardHeaders } from '@/lib/server/novel-import-proxy';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const forwardHeaders = extractForwardHeaders(request);

  const response = await fetch(buildApiUrl('/api/auth/register'), {
    method: 'POST',
    headers: {
      ...Object.fromEntries(Object.entries(forwardHeaders)),
      'content-type': 'application/json',
    },
    body,
  });

  const text = await response.text();
  const next = new NextResponse(text, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    next.headers.set('set-cookie', setCookie);
  }
  return next;
}
