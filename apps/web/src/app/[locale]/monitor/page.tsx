import { SystemMonitorPage } from '@/features/monitor/pages/SystemMonitorPage';
import { setRequestLocale } from 'next-intl/server';

export default async function MonitorIndexPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  return <SystemMonitorPage />;
}
