import { UserSettingsPage } from '@/features/settings/pages/UserSettingsPage';
import { setRequestLocale } from 'next-intl/server';

export default async function SettingsIndexPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  return <UserSettingsPage />;
}
