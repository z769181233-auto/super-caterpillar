import { LandingPage } from '@/components/landing/LandingPage';

interface PageProps {
  params: {
    locale: string;
  };
}

export default function Page({ params: { locale } }: PageProps) {
  // Determine language, defaulting to 'zh' if 'zh' is requested, else 'en'
  // logic can be improved based on strict app routing, but for this specific landing page requirement:
  const lang = locale === 'zh' ? 'zh' : 'en';

  return <LandingPage lang={lang} />;
}
