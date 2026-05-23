import { NextRequest, NextResponse } from 'next/server';
import { buildApiUrl, extractForwardHeaders } from '@/lib/server/novel-import-proxy';

export async function GET(request: NextRequest) {
  const forwardHeaders = extractForwardHeaders(request);

  const response = await fetch(buildApiUrl('/api/projects'), {
    method: 'GET',
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

export async function POST(request: NextRequest) {
  const body = await request.text();
  const forwardHeaders = extractForwardHeaders(request);

  const response = await fetch(buildApiUrl('/api/projects'), {
    method: 'POST',
    headers: {
      ...Object.fromEntries(Object.entries(forwardHeaders)),
      'content-type': 'application/json',
    },
    body,
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
}
