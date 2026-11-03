import { RefreshCw } from 'lucide-react';

export default function LastUpdated({ date, onRefresh, loading }: { date: Date | null; onRefresh?: () => void; loading?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
      <span>Son güncelleme: {date ? date.toLocaleTimeString('tr-TR') : '-'}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={loading}
          aria-label="Verileri yenile"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: loading ? 'not-allowed' : 'pointer', color: '#334155', fontSize: '0.8rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : undefined} aria-hidden="true" /> Yenile
        </button>
      )}
    </div>
  );
}
