import { CheckCircle, XCircle, StopCircle, Clock, Activity, Loader } from 'lucide-react';
import type { CrawlStatus } from '../api/crawlsService';

const STATUS_STYLES: Record<CrawlStatus, { label: string; color: string; bg: string; Icon: typeof CheckCircle }> = {
  queued: { label: 'Sırada', color: '#b45309', bg: '#fef3c7', Icon: Clock },
  running: { label: 'Çalışıyor', color: '#1d4ed8', bg: '#dbeafe', Icon: Activity },
  completed: { label: 'Tamamlandı', color: '#047857', bg: '#d1fae5', Icon: CheckCircle },
  failed: { label: 'Başarısız', color: '#b91c1c', bg: '#fee2e2', Icon: XCircle },
  stopping: { label: 'Durduruluyor', color: '#7c2d12', bg: '#ffedd5', Icon: Loader },
  stopped: { label: 'Durduruldu', color: '#475569', bg: '#f1f5f9', Icon: StopCircle },
};

export default function StatusBadge({ status }: { status: CrawlStatus | string }) {
  const style = STATUS_STYLES[status as CrawlStatus] ?? STATUS_STYLES.stopped;
  const { Icon } = style;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: style.color, backgroundColor: style.bg, padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
      <Icon size={14} aria-hidden="true" /> {style.label}
    </span>
  );
}
