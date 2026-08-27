import { useEffect, useState } from 'react';
import { getSources, addSource, downloadSourceCsv } from '../api/sourcesService';
import type { Source, SourceCreate } from '../api/sourcesService';
import { CheckCircle, XCircle, Plus, X, Download, Edit3, ShieldAlert } from 'lucide-react';

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
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

  // Port 3000 / Port 8000 ve trailing slash uyumsuzluklarını otomatik çözen yardımcı istek fonksiyonu
  const makeRequest = async (path: string, options: RequestInit) => {
    const urls = [
      path,
      `http://localhost:8000${path}`,
      `${path}/`,
      `http://localhost:8000${path}/`
    ];
    
    for (const url of urls) {
      try {
        const res = await fetch(url, options);
        if (res.ok) return res;
      } catch {
        // Sonraki URL kombinasyonunu dene
      }
    }
    throw new Error('İstek gerçekleştirilemedi');
  };

  const handleToggleStatus = async (source: Source) => {
    const updatedEnabled = !source.enabled;
    const payload = {
      name: source.name,
      base_url: source.base_url,
      enabled: updatedEnabled,
      request_delay_seconds: source.request_delay_seconds,
      request_delay: source.request_delay_seconds
    };

    try {
      try {
        await makeRequest(`/api/sources/${source.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: updatedEnabled })
        });
      } catch {
        await makeRequest(`/api/sources/${source.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      fetchSources();
    } catch (err) {
      console.error('Durum değiştirilemedi:', err);
      alert('Kaynak durumu güncellenemedi.');
    }
  };

  const handleOpenEdit = (source: Source) => {
    setSelectedSourceId(source.id);
    setIsEditMode(true);
    setFormData({
      name: source.name,
      base_url: source.base_url,
      enabled: source.enabled,
      request_delay_seconds: source.request_delay_seconds
    });
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setSelectedSourceId(null);
    setIsEditMode(false);
    setFormData({ name: '', base_url: '', enabled: true, request_delay_seconds: 2 });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const payload = {
      name: formData.name,
      base_url: formData.base_url,
      enabled: formData.enabled,
      request_delay_seconds: Number(formData.request_delay_seconds),
      request_delay: Number(formData.request_delay_seconds)
    };

    try {
      if (isEditMode && selectedSourceId) {
        await makeRequest(`/api/sources/${selectedSourceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await addSource(payload as any);
      }
      setIsSubmitting(false);
      setIsModalOpen(false);
      fetchSources();
    } catch (err) {
      console.error('Kayıt hatası:', err);
      alert('İşlem sırasında bir hata oluştu! Konsolu kontrol edin.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: '#1e293b' }}>Kaynak Yönetimi</h1>
        <button 
          onClick={handleOpenCreate}
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
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '1rem', color: '#64748b' }}>Kaynak Adı</th>
                <th style={{ padding: '1rem', color: '#64748b' }}>Hedef URL</th>
                <th style={{ padding: '1rem', color: '#64748b' }}>Gecikme</th>
                <th style={{ padding: '1rem', color: '#64748b' }}>Robots.txt Durumu</th>
                <th style={{ padding: '1rem', color: '#64748b' }}>Durum</th>
                <th style={{ padding: '1rem', color: '#64748b', textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Yükleniyor...</td></tr>
              ) : sources.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Kayıtlı kaynak bulunamadı.</td></tr>
              ) : (
                sources.map((source) => (
                  <tr key={source.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '1rem', fontWeight: '500', color: '#1e293b' }}>{source.name}</td>
                    <td style={{ padding: '1rem' }}>
                      <a href={source.base_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                        {source.base_url}
                      </a>
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>{source.request_delay_seconds}s</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b', backgroundColor: '#fef3c7', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        <ShieldAlert size={14} /> Tarama Anında Kontrol Edilir
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button
                        onClick={() => handleToggleStatus(source)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        title="Durumu Değiştirmek İçin Tıklayın"
                      >
                        {source.enabled ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#10b981', backgroundColor: '#d1fae5', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <CheckCircle size={15} /> Aktif
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', backgroundColor: '#fee2e2', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <XCircle size={15} /> Pasif
                          </span>
                        )}
                      </button>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleOpenEdit(source)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
                          padding: '0.35rem 0.65rem', borderRadius: '4px', cursor: 'pointer',
                          fontWeight: 'bold', fontSize: '0.75rem'
                        }}
                        title="Kaynağı Düzenle"
                      >
                        <Edit3 size={14} /> Düzenle
                      </button>
                      <button
                        onClick={() => downloadSourceCsv(source.id, source.name)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          backgroundColor: '#f1f5f9', color: '#3b82f6', border: '1px solid #cbd5e1',
                          padding: '0.35rem 0.65rem', borderRadius: '4px', cursor: 'pointer',
                          fontWeight: 'bold', fontSize: '0.75rem'
                        }}
                        title="Zafiyetleri CSV Olarak İndir"
                      >
                        <Download size={14} /> CSV
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{isEditMode ? 'Kaynağı Düzenle' : 'Yeni Kaynak Ekle'}</h2>
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
                {isSubmitting ? 'İşleniyor...' : (isEditMode ? 'Güncelle' : 'Kaydet')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}