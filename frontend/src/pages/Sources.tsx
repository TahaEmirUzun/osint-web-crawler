import { useEffect, useState } from 'react';
import { getSources, addSource } from '../api/sourcesService';
import type { Source, SourceCreate } from '../api/sourcesService';
import { CheckCircle, XCircle, Plus, X } from 'lucide-react';

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Modal (Açılır pencere) ve Form state'leri
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<SourceCreate>({
    name: '',
    base_url: '',
    enabled: true,
    request_delay_seconds: 2,
  });

  const fetchSources = () => {
    setLoading(true);
    getSources()
      .then((data) => {
        setSources(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Kaynaklar çekilirken hata oluştu:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    addSource(formData)
      .then(() => {
        setIsSubmitting(false);
        setIsModalOpen(false);
        setFormData({ name: '', base_url: '', enabled: true, request_delay_seconds: 2 }); // Formu sıfırla
        fetchSources(); // Tabloyu güncelle
      })
      .catch((err) => {
        console.error('Kaynak eklenirken hata:', err);
        alert('Kaynak eklenirken bir hata oluştu!');
        setIsSubmitting(false);
      });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: '#1e293b' }}>Kaynak Yönetimi</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem', 
            backgroundColor: '#3b82f6', color: 'white', border: 'none', 
            padding: '0.75rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
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

      {/* MODAL (YENİ KAYNAK EKLEME FORMU) */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Yeni Kaynak Ekle</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: '500', fontSize: '0.875rem' }}>Kaynak Adı</label>
                <input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} type="text" placeholder="Örn: Debian Advisories" style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: '500', fontSize: '0.875rem' }}>Hedef URL</label>
                <input required value={formData.base_url} onChange={(e) => setFormData({...formData, base_url: e.target.value})} type="url" placeholder="https://..." style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: '500', fontSize: '0.875rem' }}>Gecikme Süresi (Saniye)</label>
                <input required value={formData.request_delay_seconds} onChange={(e) => setFormData({...formData, request_delay_seconds: Number(e.target.value)})} type="number" min="0" style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input type="checkbox" id="enabledCheck" checked={formData.enabled} onChange={(e) => setFormData({...formData, enabled: e.target.checked})} style={{ width: '1rem', height: '1rem' }} />
                <label htmlFor="enabledCheck" style={{ fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer' }}>Kaynak Aktif Mi?</label>
              </div>

              <button disabled={isSubmitting} type="submit" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}