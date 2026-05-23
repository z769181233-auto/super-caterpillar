import { NextRequest, NextResponse } from 'next/server';
import { buildApiUrl, extractForwardHeaders, forwardSetCookies } from '@/lib/server/novel-import-proxy';
import {
  buildAuthFailureLocation,
  buildAuthSuccessLocation,
  isHtmlFormSubmission,
  parseAuthFailureReason,
} from '@/lib/server/auth-form-flow';

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type');
  const isFormRequest = isHtmlFormSubmission(contentType);
  const formData = isFormRequest ? await request.formData() : null;
  const fallbackEmail = formData ? String(formData.get('email') || '') : null;
  const body = formData
    ? JSON.stringify({
        email: String(formData.get('email') || ''),
        password: String(formData.get('password') || ''),
      })
    : await request.text();
  const forwardHeaders = extractForwardHeaders(request);
  let response: Response;
  let text = '';

  try {
    response = await fetch(buildApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: {
        ...Object.fromEntries(Object.entries(forwardHeaders)),
        'content-type': 'application/json',
      },
      body,
    });

    text = await response.text();
  } catch {
    if (isFormRequest) {
      const locale = request.nextUrl.searchParams.get('locale') || 'en';
      const fromParam = request.nextUrl.searchParams.get('from');
      return new NextResponse(null, {
        status: 303,
        headers: {
          location: buildAuthFailureLocation({
            mode: 'login',
            locale,
            fromParam,
            email: fallbackEmail,
            reason: 'network',
          }),
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Authentication service unavailable',
      },
      { status: 503 }
    );
  }

  if (isFormRequest) {
    const locale = request.nextUrl.searchParams.get('locale') || 'en';
    const fromParam = request.nextUrl.searchParams.get('from');
    const location = response.ok
      ? buildAuthSuccessLocation({ mode: 'login', locale, fromParam })
      : buildAuthFailureLocation({
          mode: 'login',
          locale,
          fromParam,
          email: fallbackEmail,
          reason: parseAuthFailureReason(response.status, text, 'login'),
        });
    const next = new NextResponse(null, {
      status: 303,
      headers: { location },
    });
    forwardSetCookies(response.headers, next.headers);
    return next;
  }

  const next = new NextResponse(text, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
  forwardSetCookies(response.headers, next.headers);
  return next;
}
