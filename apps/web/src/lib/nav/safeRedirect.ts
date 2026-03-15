/**
 * Provides security validation for `?from=` redirect URLs
 * to ensure we never bounce users to external or malicious paths.
 */
export function getSafeRedirect(
  rawPath: string | null | undefined,
  currentLocale: string,
  fallback: string = '/projects'
): string {
  if (!rawPath) return fallback;

  try {
    // 1. Must be a relative path (starting with /)
    if (!rawPath.startsWith('/')) {
      return fallback;
    }

    // 2. Prevent double-slash Protocol Relative URLs (e.g. //evil.com)
    if (rawPath.startsWith('//')) {
      return fallback;
    }

    // 3. Must not have a host parsing success if it's truly a path
    //    Using a truth base to test parsing
    const url = new URL(rawPath, 'http://truth-base.local');
    if (url.hostname !== 'truth-base.local') {
      return fallback;
    }

    // 4. (Optional but strict) Must match an allowed base route shape
    //    We allow returning to localized builds, projects, or tasks
    const pathOnly = url.pathname;
    const isValidFormat =
      new RegExp(`^/(zh|en|vi)/(projects|builds|tasks)(/|$)`).test(pathOnly) ||
      new RegExp(`^/(projects|builds|tasks)(/|$)`).test(pathOnly);

    if (!isValidFormat) {
      // If it doesn't match our core workspace routes, we still fallback to projects
      // to avoid returning to landing or somewhere weird post-login
      return fallback;
    }

    return rawPath;
  } catch (e) {
    return fallback;
  }
}
