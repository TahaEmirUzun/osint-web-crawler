import { useEffect, useState } from 'react';
import { getAdvisories } from '../api/advisoriesService';
import type { Advisory } from '../api/advisoriesService';
import { Search, ExternalLink } from 'lucide-react';

export default function Advisories() {
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Hangi satırların tam metninin açık olduğunu tutan state
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  useEffect(() => {
    getAdvisories()
      .then((data) => {
        setAdvisories(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Zafiyetler çekilirken hata oluştu:', err);
        setLoading(false);
      });
  }, []);

  const filteredAdvisories = advisories.filter(adv => 
    (adv.title && adv.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (adv.cve && adv.cve.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (adv.product && adv.product.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getSeverityColor = (severity: string) => {
    const s = severity?.toLowerCase();
    if (s === 'critical') return { bg: '#fee2e2', text: '#ef4444' };
    if (s === 'high') return { bg: '#ffedd5', text: '#f97316' };
    if (s === 'medium') return { bg: '#fef9c3', text: '#eab308' };
    return { bg: '#dbeafe', text: '#3b82f6' };
  };

  // Tıklanan satırın ID'sini listeye ekle/çıkar
  const toggleExpand = (id: number) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: '#1e293b' }}>Toplanan Zafiyetler</h1>
        
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="CVE, Başlık veya Ürün ara..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
          />
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px', fontSize: '0.875rem' }}>
          <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '0.75rem 1rem', color: '#64748b', width: '120px' }}>CVE</th>
              <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Başlık</th>
              <th style={{ padding: '0.75rem 1rem', color: '#64748b', width: '100px' }}>Seviye</th>
              <th style={{ padding: '0.75rem 1rem', color: '#64748b', width: '150px' }}>Ürün / Sağlayıcı</th>
              <th style={{ padding: '0.75rem 1rem', color: '#64748b', width: '120px' }}>Tarih</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>Veriler yükleniyor...</td></tr>
            ) : filteredAdvisories.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>Herhangi bir kayıt bulunamadı.</td></tr>
            ) : (
              filteredAdvisories.map((adv) => {
                const colors = getSeverityColor(adv.severity);
                const isExpanded = expandedIds.includes(adv.id); // Bu satır açık mı?

                return (
                  <tr key={adv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#334155' }}>
                      {adv.cve || 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span 
                          onClick={() => toggleExpand(adv.id)} // Tıklanınca aç/kapat
                          title={isExpanded ? "Daralt" : "Tamamını gör"}
                          style={{ 
                            fontWeight: '500', 
                            color: '#0f172a',
                            cursor: 'pointer', // Fare imlecini tıklanabilir yap
                            display: isExpanded ? 'block' : '-webkit-box',
                            WebkitLineClamp: isExpanded ? 'unset' : 2, // Açıksa sınırı kaldır, değilse 2 satırda kes
                            WebkitBoxOrient: 'vertical',
                            overflow: isExpanded ? 'visible' : 'hidden',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {adv.title}
                        </span>
                        <a href={adv.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none', width: 'fit-content' }}>
                          Orijinal Kaynak <ExternalLink size={12} />
                        </a>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ backgroundColor: colors.bg, color: colors.text, padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {adv.severity || 'UNKNOWN'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                      {adv.product || adv.organization || 'Bilinmiyor'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                      {adv.publication_date 
                        ? new Date(adv.publication_date).toLocaleDateString('tr-TR') 
                        : adv.collection_date 
                          ? new Date(adv.collection_date).toLocaleDateString('tr-TR') 
                          : 'Tarih Yok'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}