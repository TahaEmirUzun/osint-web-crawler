import { useEffect, useState } from 'react';
import { getSources } from '../api/sourcesService';
import type { Source } from '../api/sourcesService';
import { CheckCircle, XCircle, Plus } from 'lucide-react';

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    getSources()
      .then((data) => {
        setSources(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Kaynaklar çekilirken hata oluştu:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: '#1e293b' }}>Kaynak Yönetimi</h1>
        <button style={{ 
          display: 'flex', alignItems: 'center', gap: '0.5rem', 
          backgroundColor: '#3b82f6', color: 'white', border: 'none', 
          padding: '0.75rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
        }}>
          <Plus size={18} /> Yeni Kaynak Ekle
        </button>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '1rem', color: '#64748b' }}>Kaynak Adı</th>
              <th style={{ padding: '1rem', color: '#64748b' }}>Hedef URL</th>
              <th style={{ padding: '1rem', color: '#64748b' }}>Gecikme (Sn)</th>
              <th style={{ padding: '1rem', color: '#64748b' }}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center' }}>Yükleniyor...</td></tr>
            ) : sources.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center' }}>Kayıtlı kaynak bulunamadı.</td></tr>
            ) : (
              sources.map((source) => (
                <tr key={source.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{source.name}</td>
                  <td style={{ padding: '1rem' }}>
                    <a href={source.base_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                      {source.base_url}
                    </a>
                  </td>
                  <td style={{ padding: '1rem' }}>{source.request_delay_seconds}s</td>
                  <td style={{ padding: '1rem' }}>
                    {source.enabled ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#10b981', backgroundColor: '#d1fae5', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.875rem' }}>
                        <CheckCircle size={16} /> Aktif
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', backgroundColor: '#fee2e2', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.875rem' }}>
                        <XCircle size={16} /> Pasif
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}