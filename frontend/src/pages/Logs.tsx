import { useEffect, useState } from 'react';
import { getSystemLogs } from '../api/logsService';
import type { SystemLog } from '../api/logsService';
import { Terminal, AlertTriangle, Info, XCircle, Filter } from 'lucide-react';

export default function Logs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<string>(''); // Boş ise tümü

  const fetchLogs = (selectedFilter: string) => {
    setLoading(true);
    getSystemLogs(selectedFilter)
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Loglar çekilemedi:', err);
        setLogs([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs(filter);
  }, [filter]);

  const getLogLevelBadge = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <span style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}><XCircle size={14} /> ERROR</span>;
      case 'WARNING':
        return <span style={{ color: '#f59e0b', backgroundColor: '#fef3c7', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}><AlertTriangle size={14} /> WARN</span>;
      default:
        return <span style={{ color: '#3b82f6', backgroundColor: '#dbeafe', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}><Info size={14} /> INFO</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={28} /> Sistem Logları
        </h1>
        
        {/* Filtreleme Butonları */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'white', padding: '0.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <Filter size={16} color="#64748b" style={{ margin: '0 0.5rem' }} />
          <button onClick={() => setFilter('')} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: filter === '' ? '#1e293b' : 'transparent', color: filter === '' ? 'white' : '#64748b' }}>Tümü</button>
          <button onClick={() => setFilter('INFO')} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: filter === 'INFO' ? '#3b82f6' : 'transparent', color: filter === 'INFO' ? 'white' : '#64748b' }}>Bilgi</button>
          <button onClick={() => setFilter('WARNING')} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: filter === 'WARNING' ? '#f59e0b' : 'transparent', color: filter === 'WARNING' ? 'white' : '#64748b' }}>Uyarı</button>
          <button onClick={() => setFilter('ERROR')} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: filter === 'ERROR' ? '#ef4444' : 'transparent', color: filter === 'ERROR' ? 'white' : '#64748b' }}>Hata</button>
        </div>
      </div>

      <div style={{ backgroundColor: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {/* Konsol hissi için yazı tipini monospace (kod stili) yapıyoruz */}
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px', fontSize: '0.875rem', fontFamily: 'monospace' }}>
            <thead style={{ borderBottom: '1px solid #334155', backgroundColor: '#1e293b' }}>
              <tr>
                <th style={{ padding: '1rem', color: '#94a3b8', width: '180px' }}>Tarih / Saat</th>
                <th style={{ padding: '1rem', color: '#94a3b8', width: '100px' }}>Seviye</th>
                <th style={{ padding: '1rem', color: '#94a3b8', width: '200px' }}>Görev ID</th>
                <th style={{ padding: '1rem', color: '#94a3b8' }}>Mesaj / Detay</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Log kayıtları getiriliyor...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Bu kriterlere uygun log kaydı bulunamadı.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                      {new Date(log.timestamp).toLocaleString('tr-TR')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{getLogLevelBadge(log.log_level)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{log.crawl_job_id}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#e2e8f0', wordBreak: 'break-word' }}>
                      {log.message}
                      {log.source && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Kaynak: {log.source}</div>}
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