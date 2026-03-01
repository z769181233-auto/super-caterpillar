import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale, requestLocale }) => {
  // Use explicit locale if provided (prevents bailout in static export)
  // Fallback to awaiting requestLocale only if needed
  let resolvedLocale = locale || (await requestLocale);

  if (!resolvedLocale || !['en', 'zh', 'vi'].includes(resolvedLocale)) {
    resolvedLocale = 'en';
  }

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default,
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') {
        // Enforce strong consistency fail-fast policy across the entire site
        throw new Error(`[i18n Gate] Missing key: ${error.message}`);
      }
      console.error('[i18n Error]', error);
    },
    getMessageFallback({ namespace, key, error }) {
      throw new Error(
        `[i18n Gate] Missing key fallback triggered for: ${namespace ? namespace + '.' : ''}${key}`
      );
    },
  };
});
