import { SystemMonitorPage } from '@/features/monitor/pages/SystemMonitorPage';
import { setRequestLocale } from 'next-intl/server';

export default function MonitorIndexPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <SystemMonitorPage />;
}
