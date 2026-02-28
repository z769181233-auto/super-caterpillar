import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !['en', 'zh', 'vi'].includes(locale)) {
    locale = 'en';
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') {
        // Enforce strong consistency fail-fast policy across the entire site
        throw new Error(`[i18n Gate] Missing key: ${error.message}`);
      }
      console.error("[i18n Error]", error);
    },
    getMessageFallback({ namespace, key, error }) {
      throw new Error(`[i18n Gate] Missing key fallback triggered for: ${namespace ? namespace + '.' : ''}${key}`);
    }
  };
});
