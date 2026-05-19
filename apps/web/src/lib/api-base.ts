function normalizeApiOrigin(value: string): string {
  return value.replace(/\/+$/, '').replace(/\/api$/, '');
}

function readExplicitApiBase(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    process.env.API_URL ||
    undefined
  );
}

export function resolveApiOrigin(): string {
  const explicitApiBase = readExplicitApiBase();
  if (explicitApiBase) {
    return normalizeApiOrigin(explicitApiBase);
  }

  return typeof window === 'undefined' ? 'http://127.0.0.1:3000' : '';
}

export const API_ORIGIN = resolveApiOrigin();

export function buildApiUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const apiOrigin = resolveApiOrigin();
  return apiOrigin ? `${apiOrigin}${normalizedPath}` : normalizedPath;
}
