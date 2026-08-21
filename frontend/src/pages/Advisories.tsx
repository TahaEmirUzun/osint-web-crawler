import { useEffect, useState } from 'react';
import { getAdvisories } from '../api/advisoriesService';
import type { Advisory } from '../api/advisoriesService';
import { ShieldAlert, Search, Filter, ExternalLink, X, Calendar, Activity, Database, Hash } from 'lucide-react';
import { formatLocalDateTime } from '../utils/dateUtils';

export default function Advisories() {
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Seçili zafiyet ve modal state'i
  const [selectedAdvisory, setSelectedAdvisory] = useState<Advisory | null>(null);

  useEffect(() => {
    setLoading(true);
    getAdvisories()
      .then((data) => {
        setAdvisories(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Zafiyetler çekilirken hata:', err);
        setAdvisories([]);
        setLoading(false);
      });
  }, []);

  const getSeverityBadge = (severity: string | null) => {
    const sev = severity?.toLowerCase() || 'unknown';
    if (sev.includes('critical') || sev.includes('kritik')) 
      return <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>Kritik</span>;
    if (sev.includes('high') || sev.includes('yüksek')) 
      return <span style={{ backgroundColor: '#ffedd5', color: '#f97316', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>Yüksek</span>;
    if (sev.includes('medium') || sev.includes('orta')) 
      return <span style={{ backgroundColor: '#fef3c7', color: '#eab308', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>Orta</span>;
    if (sev.includes('low') || sev.includes('düşük')) 
      return <span style={{ backgroundColor: '#dbeafe', color: '#3b82f6', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>Düşük</span>;
    return <span style={{ backgroundColor: '#f1f5f9', color: '#64748b', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>Bilinmiyor</span>;
  };

  // Basit Arama Filtresi (Başlık ve CVE'ye göre)
  const filteredAdvisories = advisories.filter(adv => 
    adv.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (adv.cve && adv.cve.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={28} color="#ef4444" /> Zafiyet Veritabanı
        </h1>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Başlık veya CVE Ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '0.5rem 1rem 0.5rem 2.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', width: '250px' }} 
            />
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '0.65rem' }} />
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', color: '#475569', fontWeight: 'bold' }}>
            <Filter size={16} /> Filtrele
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px', fontSize: '0.875rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <tr>
                <th style={{ padding: '1rem', color: '#64748b' }}>Kritiklik</th>
                <th style={{ padding: '1rem', color: '#64748b' }}>Zafiyet Başlığı</th>
                <th style={{ padding: '1rem', color: '#64748b' }}>CVE</th>
                <th style={{ padding: '1rem', color: '#64748b' }}>Kaynak Platform</th>
                <th style={{ padding: '1rem', color: '#64748b' }}>Tarih</th>
                <th style={{ padding: '1rem', color: '#64748b', textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Zafiyetler yükleniyor...</td></tr>
              ) : filteredAdvisories.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Arama kriterlerine uygun zafiyet bulunamadı.</td></tr>
              ) : (
                filteredAdvisories.map((adv) => (
                  <tr key={adv.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '1rem' }}>{getSeverityBadge(adv.severity)}</td>
                    <td style={{ padding: '1rem', fontWeight: '500', color: '#334155', maxWidth: '300px' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {adv.title}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: '#475569', fontWeight: 'bold' }}>{adv.cve || '-'}</td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>{adv.product || adv.source_domain || 'Bilinmiyor'}</td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>
                      {formatLocalDateTime(adv.collection_date)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button 
                        onClick={() => setSelectedAdvisory(adv)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                      >
                        İncele
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ZAFİYET DETAY MODALI */}
      {selectedAdvisory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#f8fafc' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  {getSeverityBadge(selectedAdvisory.severity)}
                  <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.875rem' }}>{selectedAdvisory.cve || 'CVE YOK'}</span>
                </div>
                <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', lineHeight: '1.4' }}>{selectedAdvisory.title}</h2>
              </div>
              <button onClick={() => setSelectedAdvisory(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase' }}>Zafiyet Özeti</h4>
                <p style={{ margin: 0, color: '#334155', lineHeight: '1.6', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  {selectedAdvisory.summary || 'Bu zafiyet için henüz detaylı bir özet metni bulunmamaktadır.'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#475569' }}>
                  <Database size={18} color="#64748b" />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Etkilenen Ürün / Sağlayıcı</div>
                    <div style={{ color: '#1e293b', fontWeight: '500' }}>{selectedAdvisory.product || 'Bilinmiyor'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#475569' }}>
                  <Calendar size={18} color="#64748b" />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Sisteme Eklenme Tarihi</div>
                    <div style={{ color: '#1e293b', fontWeight: '500' }}>{selectedAdvisory.collection_date ? new Date(selectedAdvisory.collection_date).toLocaleString('tr-TR') : '-'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#475569' }}>
                  <Activity size={18} color="#64748b" />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Kaynak Domain</div>
                    <div style={{ color: '#1e293b', fontWeight: '500' }}>{selectedAdvisory.source_domain || '-'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#475569' }}>
                  <Hash size={18} color="#64748b" />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Tarama Görev ID</div>
                    <div style={{ color: '#1e293b', fontWeight: '500', fontSize: '0.875rem' }}>{selectedAdvisory.crawl_job_id || '-'}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <a 
                  href={selectedAdvisory.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1e293b', color: 'white', textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', fontWeight: 'bold' }}
                >
                  <ExternalLink size={18} /> Orijinal Kaynağa Git
                </a>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}