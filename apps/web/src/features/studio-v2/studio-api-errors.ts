type StudioApiErrorLike = {
  error?: {
    message?: unknown;
  };
  message?: unknown;
};

function normalizeMessage(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => (typeof item === 'string' ? item.trim() : null))
      .filter(Boolean) as string[];
    return parts.length > 0 ? parts.join('\n') : null;
  }
  return null;
}

export function extractStudioApiErrorMessage(
  result: StudioApiErrorLike | null | undefined,
  fallback: string
): string {
  return (
    normalizeMessage(result?.error?.message) ||
    normalizeMessage(result?.message) ||
    fallback
  );
}
