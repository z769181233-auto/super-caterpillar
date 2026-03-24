const rawApiBase =
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';

function normalizeApiOrigin(value: string): string {
  return value.replace(/\/+$/, '').replace(/\/api$/, '');
}

export const API_ORIGIN = rawApiBase ? normalizeApiOrigin(rawApiBase) : '';

export function buildApiUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return API_ORIGIN ? `${API_ORIGIN}${normalizedPath}` : normalizedPath;
}
