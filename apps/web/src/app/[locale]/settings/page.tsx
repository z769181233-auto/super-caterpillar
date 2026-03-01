import { UserSettingsPage } from '@/features/settings/pages/UserSettingsPage';
import { setRequestLocale } from 'next-intl/server';

export default function SettingsIndexPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <UserSettingsPage />;
}
