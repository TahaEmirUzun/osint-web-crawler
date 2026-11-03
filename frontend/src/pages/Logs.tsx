import { useCallback, useEffect, useState } from 'react';
import { getSystemLogs } from '../api/logsService';
import type { LogFilters, SystemLog } from '../api/logsService';
import { getErrorMessage } from '../api/client';
import { Terminal, AlertTriangle, Info, XCircle, Filter, FilterX } from 'lucide-react';
import { formatLocalDateTime } from '../utils/dateUtils';
import LastUpdated from '../components/LastUpdated';

const LEVELS = [
  { value: '', label: 'Tümü', color: '#1e293b' },
  { value: 'INFO', label: 'Bilgi', color: '#2563eb' },
  { value: 'WARNING', label: 'Uyarı', color: '#b45309' },
  { value: 'ERROR', label: 'Hata', color: '#b91c1c' },
];

const EMPTY_FILTERS: LogFilters = { level: '', job_id: '', source: '', date_from: '', date_to: '' };

export default function Logs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filters, setFilters] = useState<LogFilters>(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<LogFilters>(EMPTY_FILTERS);

  // Metin alanlarında her tuşta istek atmamak için kısa bir gecikme uygulanır
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 400);
    return () => clearTimeout(timer);
  }, [filters]);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    getSystemLogs({ ...debouncedFilters, limit: 200 })
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setError(null);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        console.error('Loglar çekilemedi:', err);
        setError(getErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [debouncedFilters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const updateFilter = (key: keyof LogFilters, value: string) => setFilters(prev => ({ ...prev, [key]: value }));
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const getLogLevelBadge = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <span style={{ color: '#b91c1c', backgroundColor: '#fee2e2', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}><XCircle size={14} aria-hidden="true" /> ERROR</span>;
      case 'WARNING':
        return <span style={{ color: '#92400e', backgroundColor: '#fef3c7', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}><AlertTriangle size={14} aria-hidden="true" /> WARN</span>;
      default:
        return <span style={{ color: '#1d4ed8', backgroundColor: '#dbeafe', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}><Info size={14} aria-hidden="true" /> INFO</span>;
    }
  };

  const inputStyle = { padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', backgroundColor: 'white', color: '#1e293b' };
  const labelStyle = { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold' as const, color: '#475569' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={28} aria-hidden="true" /> Sistem Logları
        </h1>
        <LastUpdated date={lastUpdated} onRefresh={fetchLogs} loading={loading} />
      </div>

      {/* Filtreler */}
      <div role="search" style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div role="group" aria-label="Log seviyesi" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={16} color="#64748b" aria-hidden="true" style={{ margin: '0 0.25rem' }} />
          {LEVELS.map(level => {
            const active = (filters.level || '') === level.value;
            return (
              <button
                key={level.label}
                onClick={() => updateFilter('level', level.value)}
                aria-pressed={active}
                style={{ padding: '0.5rem 1rem', border: `1px solid ${active ? level.color : '#e2e8f0'}`, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: active ? level.color : 'transparent', color: active ? 'white' : '#475569' }}
              >
                {level.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <label style={labelStyle}>
            Görev ID
            <input type="text" value={filters.job_id} onChange={(e) => updateFilter('job_id', e.target.value)} placeholder="crawl_20260821_001" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Kaynak
            <input type="text" value={filters.source} onChange={(e) => updateFilter('source', e.target.value)} placeholder="ubuntu.com" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Başlangıç Tarihi
            <input type="date" value={filters.date_from} onChange={(e) => updateFilter('date_from', e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Bitiş Tarihi
            <input type="date" value={filters.date_to} onChange={(e) => updateFilter('date_to', e.target.value)} style={inputStyle} />
          </label>
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            disabled={!hasActiveFilters}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: hasActiveFilters ? 'white' : '#f1f5f9', color: hasActiveFilters ? '#334155' : '#94a3b8', cursor: hasActiveFilters ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: 'bold' }}
          >
            <FilterX size={16} aria-hidden="true" /> Filtreleri Temizle
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 380px)', minHeight: '240px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px', fontSize: '0.875rem', fontFamily: 'monospace' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#1e293b', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              <tr>
                <th scope="col" style={{ padding: '1rem', color: '#cbd5e1', width: '180px' }}>Tarih / Saat</th>
                <th scope="col" style={{ padding: '1rem', color: '#cbd5e1', width: '100px' }}>Seviye</th>
                <th scope="col" style={{ padding: '1rem', color: '#cbd5e1', width: '200px' }}>Görev ID</th>
                <th scope="col" style={{ padding: '1rem', color: '#cbd5e1' }}>Mesaj / Detay</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr><td colSpan={4} role="status" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Log kayıtları getiriliyor...</td></tr>
              ) : error && logs.length === 0 ? (
                <tr><td colSpan={4} role="alert" style={{ padding: '2rem', textAlign: 'center', color: '#fca5a5' }}>Loglar yüklenemedi: {error}</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Bu kriterlere uygun log kaydı bulunamadı.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>
                      {formatLocalDateTime(log.timestamp)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{getLogLevelBadge(log.log_level)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{log.crawl_job_id || '-'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#e2e8f0', wordBreak: 'break-word' }}>
                      {log.message}
                      {log.source && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Kaynak: {log.source}</div>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
