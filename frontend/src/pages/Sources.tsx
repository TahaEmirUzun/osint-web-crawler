import { useCallback, useEffect, useState } from 'react';
import { getSources, addSource, updateSource, updateSourceStatus, downloadSourceCsv, checkSourceRobots } from '../api/sourcesService';
import type { RobotsCheck, Source, SourceCreate } from '../api/sourcesService';
import { getErrorMessage } from '../api/client';
import { CheckCircle, XCircle, Plus, X, Download, Edit3, ShieldAlert, ShieldCheck, Loader } from 'lucide-react';
import { useToast } from '../components/Toast';
import LastUpdated from '../components/LastUpdated';
import { formatLocalDateTime } from '../utils/dateUtils';
import { getSafeExternalUrl } from '../utils/safeUrl';
import { validateSourceForm } from '../utils/validation';

const EMPTY_FORM: SourceCreate = { name: '', base_url: '', enabled: true, request_delay_seconds: 2, maximum_pages: 100 };

const LAST_RESULT_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: 'Başarılı', color: '#047857' },
  failed: { label: 'Başarısız', color: '#b91c1c' },
  blocked: { label: 'Engellendi', color: '#b45309' },
};

export default function Sources() {
  const { showToast } = useToast();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [robotsResults, setRobotsResults] = useState<Record<number, RobotsCheck | 'loading'>>({});
  const [togglingIds, setTogglingIds] = useState<number[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<SourceCreate>(EMPTY_FORM);
  const isEditMode = selectedSourceId !== null;

  const fetchSources = useCallback(() => {
    setLoading(true);
    getSources()
      .then((data) => {
        setSources(Array.isArray(data) ? data : []);
        setLoadError(null);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        console.error('Kaynaklar çekilirken hata oluştu:', err);
        setLoadError(getErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleToggleStatus = async (source: Source) => {
    if (togglingIds.includes(source.id)) return;
    setTogglingIds(prev => [...prev, source.id]);
    try {
      await updateSourceStatus(source.id, !source.enabled);
      showToast(`'${source.name}' ${source.enabled ? 'pasif' : 'aktif'} hale getirildi.`, 'success');
      fetchSources();
    } catch (err) {
      showToast(`Kaynak durumu güncellenemedi: ${getErrorMessage(err)}`, 'error');
    } finally {
      setTogglingIds(prev => prev.filter(id => id !== source.id));
    }
  };

  const handleCheckRobots = async (source: Source) => {
    setRobotsResults(prev => ({ ...prev, [source.id]: 'loading' }));
    try {
      const result = await checkSourceRobots(source.id);
      setRobotsResults(prev => ({ ...prev, [source.id]: result }));
    } catch (err) {
      setRobotsResults(prev => {
        const next = { ...prev };
        delete next[source.id];
        return next;
      });
      showToast(`robots.txt kontrol edilemedi: ${getErrorMessage(err)}`, 'error');
    }
  };

  const handleDownload = async (source: Source) => {
    try {
      await downloadSourceCsv(source.id, source.name);
    } catch (err) {
      showToast(`CSV dosyası indirilemedi: ${getErrorMessage(err)}`, 'error');
    }
  };

  const openModal = (source?: Source) => {
    setSelectedSourceId(source ? source.id : null);
    setFormData(source ? {
      name: source.name,
      base_url: source.base_url,
      enabled: source.enabled,
      request_delay_seconds: source.request_delay_seconds,
      maximum_pages: source.maximum_pages ?? 100,
    } : EMPTY_FORM);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const payload: SourceCreate = {
      ...formData,
      name: formData.name.trim(),
      base_url: formData.base_url.trim(),
      request_delay_seconds: Number(formData.request_delay_seconds),
      maximum_pages: Number(formData.maximum_pages),
    };
    const errors = validateSourceForm(payload);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      if (isEditMode && selectedSourceId) {
        await updateSource(selectedSourceId, payload);
        showToast('Kaynak güncellendi.', 'success');
      } else {
        await addSource(payload);
        showToast('Yeni kaynak eklendi.', 'success');
      }
      setIsModalOpen(false);
      fetchSources();
    } catch (err) {
      setFormErrors({ form: getErrorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRobots = (source: Source) => {
    const result = robotsResults[source.id];
    if (result === 'loading') {
      return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#64748b', fontSize: '0.75rem' }}><Loader size={14} className="spin" aria-hidden="true" /> Kontrol ediliyor...</span>;
    }
    if (result) {
      return result.allowed ? (
        <span title={result.robots_url} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#047857', backgroundColor: '#d1fae5', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
          <ShieldCheck size={14} aria-hidden="true" /> İzin Veriyor
        </span>
      ) : (
        <span title={result.reason || result.robots_url} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#b91c1c', backgroundColor: '#fee2e2', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
          <ShieldAlert size={14} aria-hidden="true" /> İzin Vermiyor
        </span>
      );
    }
    return (
      <button onClick={() => handleCheckRobots(source)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#b45309', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>
        <ShieldAlert size={14} aria-hidden="true" /> Kontrol Et
      </button>
    );
  };

  const inputStyle = (field: string) => ({ padding: '0.75rem', border: `1px solid ${formErrors[field] ? '#ef4444' : '#cbd5e1'}`, borderRadius: '6px' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem' }}>Kaynak Yönetimi</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <LastUpdated date={lastUpdated} onRefresh={fetchSources} loading={loading} />
          <button 
            onClick={() => openModal()}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              backgroundColor: '#2563eb', color: 'white', border: 'none', 
              padding: '0.75rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            <Plus size={18} aria-hidden="true" /> Yeni Kaynak Ekle
          </button>
        </div>
      </div>

      <p style={{ margin: 0, color: '#475569', fontSize: '0.875rem' }}>
        Etik kurallar gereği her kaynak eklenmeden önce incelenmeli ve sadece herkese açık güvenlik duyurusu sayfaları aktif edilmelidir.
      </p>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '960px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th scope="col" style={{ padding: '1rem', color: '#475569' }}>Kaynak Adı</th>
                <th scope="col" style={{ padding: '1rem', color: '#475569' }}>Hedef URL</th>
                <th scope="col" style={{ padding: '1rem', color: '#475569' }}>Gecikme</th>
                <th scope="col" style={{ padding: '1rem', color: '#475569' }}>Son Tarama</th>
                <th scope="col" style={{ padding: '1rem', color: '#475569' }}>Robots.txt</th>
                <th scope="col" style={{ padding: '1rem', color: '#475569' }}>Durum</th>
                <th scope="col" style={{ padding: '1rem', color: '#475569', textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading && sources.length === 0 ? (
                <tr><td colSpan={7} role="status" style={{ padding: '2rem', textAlign: 'center' }}>Yükleniyor...</td></tr>
              ) : loadError && sources.length === 0 ? (
                <tr><td colSpan={7} role="alert" style={{ padding: '2rem', textAlign: 'center', color: '#b91c1c' }}>Kaynaklar yüklenemedi: {loadError}</td></tr>
              ) : sources.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Kayıtlı kaynak bulunamadı. "Yeni Kaynak Ekle" ile başlayın.</td></tr>
              ) : (
                sources.map((source) => {
                  const safeUrl = getSafeExternalUrl(source.base_url);
                  const lastResult = source.last_crawl_status ? LAST_RESULT_LABELS[source.last_crawl_status] : null;
                  return (
                    <tr key={source.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem', fontWeight: '500', color: '#1e293b' }}>{source.name}</td>
                      <td style={{ padding: '1rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {safeUrl ? (
                          <a href={safeUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }} title={source.base_url}>
                            {source.base_url}
                          </a>
                        ) : source.base_url}
                      </td>
                      <td style={{ padding: '1rem', color: '#475569' }}>{source.request_delay_seconds}s</td>
                      <td style={{ padding: '1rem', color: '#475569', fontSize: '0.8rem' }}>
                        <div>{formatLocalDateTime(source.last_crawl_date)}</div>
                        {lastResult && (
                          <div style={{ color: lastResult.color, fontWeight: 'bold' }}>
                            {lastResult.label}{source.last_crawl_records != null ? ` · ${source.last_crawl_records} yeni kayıt` : ''}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>{renderRobots(source)}</td>
                      <td style={{ padding: '1rem' }}>
                        <button
                          onClick={() => handleToggleStatus(source)}
                          disabled={togglingIds.includes(source.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          aria-label={`${source.name} kaynağını ${source.enabled ? 'pasif' : 'aktif'} yap`}
                          title="Durumu Değiştirmek İçin Tıklayın"
                        >
                          {source.enabled ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#047857', backgroundColor: '#d1fae5', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              <CheckCircle size={15} aria-hidden="true" /> Aktif
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#b91c1c', backgroundColor: '#fee2e2', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              <XCircle size={15} aria-hidden="true" /> Pasif
                            </span>
                          )}
                        </button>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button
                            onClick={() => openModal(source)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                              backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1',
                              padding: '0.35rem 0.65rem', borderRadius: '4px', cursor: 'pointer',
                              fontWeight: 'bold', fontSize: '0.75rem'
                            }}
                            aria-label={`${source.name} kaynağını düzenle`}
                          >
                            <Edit3 size={14} aria-hidden="true" /> Düzenle
                          </button>
                          <button
                            onClick={() => handleDownload(source)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                              backgroundColor: '#f1f5f9', color: '#1d4ed8', border: '1px solid #cbd5e1',
                              padding: '0.35rem 0.65rem', borderRadius: '4px', cursor: 'pointer',
                              fontWeight: 'bold', fontSize: '0.75rem'
                            }}
                            aria-label={`${source.name} zafiyetlerini CSV olarak indir`}
                          >
                            <Download size={14} aria-hidden="true" /> CSV
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="source-modal-title" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 id="source-modal-title" style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>{isEditMode ? 'Kaynağı Düzenle' : 'Yeni Kaynak Ekle'}</h2>
              <button onClick={() => setIsModalOpen(false)} aria-label="Pencereyi kapat" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="source-name" style={{ fontWeight: '500', fontSize: '0.875rem', color: '#334155' }}>Kaynak Adı</label>
                <input id="source-name" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} type="text" placeholder="Örn: Debian Advisories" style={inputStyle('name')} aria-invalid={!!formErrors.name} />
                {formErrors.name && <p className="form-error">{formErrors.name}</p>}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="source-url" style={{ fontWeight: '500', fontSize: '0.875rem', color: '#334155' }}>Hedef URL</label>
                <input id="source-url" required value={formData.base_url} onChange={(e) => setFormData({...formData, base_url: e.target.value})} type="url" placeholder="https://..." style={inputStyle('base_url')} aria-invalid={!!formErrors.base_url} />
                {formErrors.base_url && <p className="form-error">{formErrors.base_url}</p>}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <label htmlFor="source-delay" style={{ fontWeight: '500', fontSize: '0.875rem', color: '#334155' }}>Gecikme (Saniye)</label>
                  <input id="source-delay" required value={formData.request_delay_seconds} onChange={(e) => setFormData({...formData, request_delay_seconds: Number(e.target.value)})} type="number" min="1" max="60" style={inputStyle('request_delay_seconds')} aria-invalid={!!formErrors.request_delay_seconds} />
                  {formErrors.request_delay_seconds && <p className="form-error">{formErrors.request_delay_seconds}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <label htmlFor="source-max-pages" style={{ fontWeight: '500', fontSize: '0.875rem', color: '#334155' }}>Maksimum Sayfa</label>
                  <input id="source-max-pages" required value={formData.maximum_pages} onChange={(e) => setFormData({...formData, maximum_pages: Number(e.target.value)})} type="number" min="1" max="500" style={inputStyle('maximum_pages')} aria-invalid={!!formErrors.maximum_pages} />
                  {formErrors.maximum_pages && <p className="form-error">{formErrors.maximum_pages}</p>}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input type="checkbox" id="enabledCheck" checked={formData.enabled} onChange={(e) => setFormData({...formData, enabled: e.target.checked})} style={{ width: '1rem', height: '1rem' }} />
                <label htmlFor="enabledCheck" style={{ fontWeight: '500', fontSize: '0.875rem', cursor: 'pointer', color: '#334155' }}>Kaynak incelendi ve aktif edilsin</label>
              </div>

              {formErrors.form && <p role="alert" className="form-error">{formErrors.form}</p>}

              <button disabled={isSubmitting} type="submit" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#047857', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? 'İşleniyor...' : (isEditMode ? 'Güncelle' : 'Kaydet')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
