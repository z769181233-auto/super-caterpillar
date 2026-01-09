import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';

const intlMiddleware = createIntlMiddleware({
  // A list of all locales that are supported
  locales: ['en', 'zh'],

  // Used when no locale matches
  defaultLocale: 'en',

  // Prefix strategy
  localePrefix: 'as-needed',
});

function pickLocale(req: NextRequest): 'zh' | 'en' {
  // 1) cookie 优先（按你们项目实际 cookie 名，如果没有就删掉这一段）
  const raw = req.cookies.get('NEXT_LOCALE')?.value || req.cookies.get('locale')?.value || '';

  const norm = raw.toLowerCase();

  // accept zh, zh-cn, zh-tw, etc.
  if (norm === 'zh' || norm.startsWith('zh-')) return 'zh';
  if (norm === 'en' || norm.startsWith('en-')) return 'en';

  // 2) Accept-Language
  const al = (req.headers.get('accept-language') || '').toLowerCase();
  if (al.includes('zh')) return 'zh';
  return 'en';
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Handle root /tasks redirect (respect locale)
  if (pathname === '/tasks') {
    const locale = pickLocale(req);
    const url = new URL(`/${locale}/tasks`, req.url);
    url.search = req.nextUrl.search; // 保留 querystring
    return NextResponse.redirect(url);
  }

  // Define protected routes (workbenches)
  // Matches /en/projects, /zh/projects, /projects, /en/tasks...
  const isProtected = /^\/((zh|en)\/)?(projects|tasks)(\/|$)/.test(pathname);

  if (isProtected) {
    // Check for token in cookies (User specified 'accessToken')
    const token = req.cookies.get('accessToken')?.value || req.cookies.get('auth_token')?.value;

    if (!token) {
      // Create redirect URL to login
      // Extract locale or default to 'en'
      const match = pathname.match(/^\/(zh|en)(\/|$)/);
      const locale = match ? match[1] : 'en';

      const loginUrl = new URL(`/${locale}/login`, req.url);

      // Append return URL to query params
      loginUrl.searchParams.set('from', req.nextUrl.pathname + req.nextUrl.search);

      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
