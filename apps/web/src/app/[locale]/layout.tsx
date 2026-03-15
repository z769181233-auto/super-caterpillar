import { setRequestLocale } from 'next-intl/server';
import { Inter, Outfit } from 'next/font/google';

import { getTranslations } from 'next-intl/server';

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'zh' }, { locale: 'vi' }];
}

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Index' });
  return {
    title: t('navTitle'),
    description: 'AI 驱动的动漫生产平台', // Description could also be translated if needed
  };
}

import '../globals.css';

import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Nav } from './Nav'; // Moving client-side nav to separate component to use useTranslations
import UnauthorizedRedirectProvider from '@/components/auth/UnauthorizedRedirectProvider';

// Initialize fonts
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  const { children } = props;
  // Static export requirement: cache the locale for server-side functions
  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} className={`${inter.variable} ${outfit.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <UnauthorizedRedirectProvider />
          <Nav />
          <main className="container animate-fade-in">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
