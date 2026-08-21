import { useEffect, useState } from 'react';
import { getCrawlHistory, startCrawl, stopCrawlJob } from '../api/crawlsService';
import type { CrawlJob, CrawlRequest } from '../api/crawlsService';
import { getSources } from '../api/sourcesService';
import type { Source } from '../api/sourcesService';
import { Play, CheckCircle, XCircle, Loader, Activity, Clock, StopCircle, Plus, X } from 'lucide-react';
import { formatLocalDateTime } from '../utils/dateUtils';

export default function Crawls() {
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [availableSources, setAvailableSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [stoppingIds, setStoppingIds] = useState<string[]>([]);
  
  // YENİ: Gelişmiş Form State'leri
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    selectedSourceIds: [] as number[],
    maximumPages: 100,
    dateFrom: '',
    keywords: ''
  });

  const fetchJobsAndSources = () => {
    setLoading(true);
    // Hem geçmiş işleri hem de seçilebilecek aktif kaynakları çekiyoruz
    Promise.all([getCrawlHistory(), getSources()])
      .then(([jobsData, sourcesData]) => {
        setJobs(Array.isArray(jobsData) ? jobsData : []);
        
        const activeSources = sourcesData.filter(s => s.enabled);
        setAvailableSources(activeSources);
        
        // Form açıldığında varsayılan olarak tüm aktif kaynaklar seçili gelsin (UX iyileştirmesi)
        setFormData(prev => ({ ...prev, selectedSourceIds: activeSources.map(s => s.id) }));
        setLoading(false);
      })
      .catch((err) => {
        console.error('Veriler çekilemedi:', err);
        setJobs([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchJobsAndSources();
  }, []);

  // YENİ: Form Gönderme İşlemi
  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.selectedSourceIds.length === 0) {
      alert('Lütfen taranacak en az bir kaynak seçin!');
      return;
    }

    setIsStarting(true);
    try {
      // Backend'in beklediği formata (CrawlRequest) dönüştürüyoruz
      const payload: CrawlRequest = {
        source_ids: formData.selectedSourceIds,
        maximum_pages: formData.maximumPages,
        // Tarih boşsa undefined gönder
        date_from: formData.dateFrom ? formData.dateFrom : undefined,
        // Kelimeleri virgülden bölüp dizi (array) yapıyoruz
        keywords: formData.keywords ? formData.keywords.split(',').map(k => k.trim()).filter(k => k !== '') : undefined
      };

      const response = await startCrawl(payload);
      alert(`Tarama başarıyla başlatıldı! Görev ID: ${response.job_id}`);
      
      setIsModalOpen(false);
      fetchJobsAndSources(); // Tabloyu yenile
    } catch (err) {
      console.error('Tarama başlatma hatası:', err);
      alert('Tarama başlatılırken bir hata oluştu.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopJob = async (jobId: string) => {
    if (!window.confirm(`${jobId} numaralı tarama görevini durdurmak istediğinize emin misiniz?`)) return;
    setStoppingIds(prev => [...prev, jobId]);
    try {
      await stopCrawlJob(jobId);
      alert('Görev başarıyla durduruldu.');
      fetchJobsAndSources();
    } catch (err) {
      console.error('Görev durdurma hatası:', err);
      alert('Görev durdurulurken bir hata oluştu.');
    } finally {
      setStoppingIds(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleSourceToggle = (sourceId: number) => {
    setFormData(prev => {
      const isSelected = prev.selectedSourceIds.includes(sourceId);
      if (isSelected) {
        return { ...prev, selectedSourceIds: prev.selectedSourceIds.filter(id => id !== sourceId) };
      } else {
        return { ...prev, selectedSourceIds: [...prev.selectedSourceIds, sourceId] };
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={16} /> Tamamlandı</span>;
      case 'failed': return <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><XCircle size={16} /> Başarısız</span>;
      case 'running': return <span style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Loader size={16} className="spin" /> Çalışıyor</span>;
      case 'queued': return <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={16} /> Sırada</span>;
      case 'stopped': return <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><StopCircle size={16} /> Durduruldu</span>;
      default: return <span>{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem', lineHeight: '1.2' }}>Tarama İşleri (Crawl Jobs)</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem', 
            backgroundColor: '#8b5cf6', color: 'white', border: 'none', 
            padding: '0.75rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          <Plus size={18} /> Yeni Tarama Başlat
        </button>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontWeight: 'bold' }}>
          <Activity size={18} /> Gerçek Tarama Görevleri
        </div>
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px', fontSize: '0.875rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Görev ID</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Durum</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Ziyaret Edilen</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Toplanan Zafiyet</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Başlangıç</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b', textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Veriler yükleniyor...</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Henüz kayıtlı bir tarama görevi bulunmuyor.</td></tr>
              ) : (
                jobs.map((job) => {
                  const canBeStopped = job.status === 'running' || job.status === 'queued';
                  const isStopping = stoppingIds.includes(job.id);
                  return (
                    <tr key={job.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#334155' }}>{job.id}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{getStatusBadge(job.status)}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{job.pages_visited} sayfa</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                        <span style={{ backgroundColor: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                          {job.records_extracted} Zafiyet
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                        {formatLocalDateTime(job.started_date)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        {canBeStopped && (
                          <button
                            onClick={() => handleStopJob(job.id)}
                            disabled={isStopping}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                              backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #f87171',
                              padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: isStopping ? 'not-allowed' : 'pointer',
                              fontWeight: 'bold', fontSize: '0.75rem', transition: 'all 0.2s'
                            }}
                          >
                            {isStopping ? <Loader size={14} className="spin" /> : <StopCircle size={14} />}
                            {isStopping ? 'Durduruluyor' : 'İptal Et'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* YENİ: GELİŞMİŞ TARAMA FORMU (MODAL) */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Yeni Tarama Başlat</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleStartCrawl} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Kaynak Seçimi (Çoklu) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#334155' }}>Taranacak Kaynaklar (En az 1)</label>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.75rem', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#f8fafc' }}>
                  {availableSources.length === 0 ? (
                    <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>Aktif kaynak bulunamadı!</span>
                  ) : (
                    availableSources.map(source => (
                      <label key={source.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={formData.selectedSourceIds.includes(source.id)} 
                          onChange={() => handleSourceToggle(source.id)}
                        />
                        {source.name}
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Anahtar Kelimeler */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#334155' }}>Anahtar Kelimeler (İsteğe Bağlı)</label>
                <input 
                  value={formData.keywords} 
                  onChange={(e) => setFormData({...formData, keywords: e.target.value})} 
                  type="text" 
                  placeholder="Virgülle ayırın (örn: critical, rce)" 
                  style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} 
                />
              </div>

              {/* Başlangıç Tarihi ve Maksimum Sayfa Yan Yana */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <label style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#334155' }}>Şu Tarihten İtibaren (İsteğe Bağlı)</label>
                  <input 
                    value={formData.dateFrom} 
                    onChange={(e) => setFormData({...formData, dateFrom: e.target.value})} 
                    type="date" 
                    style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} 
                  />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <label style={{ fontWeight: 'bold', fontSize: '0.875rem', color: '#334155' }}>Maksimum Sayfa</label>
                  <input 
                    required 
                    value={formData.maximumPages} 
                    onChange={(e) => setFormData({...formData, maximumPages: Number(e.target.value)})} 
                    type="number" min="1" 
                    style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} 
                  />
                </div>
              </div>

              <button 
                disabled={isStarting} 
                type="submit" 
                style={{ 
                  marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#8b5cf6', color: 'white', 
                  border: 'none', borderRadius: '6px', fontWeight: 'bold', display: 'flex', 
                  justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                  cursor: isStarting ? 'not-allowed' : 'pointer', opacity: isStarting ? 0.7 : 1 
                }}
              >
                {isStarting ? <Loader size={18} className="spin" /> : <Play size={18} />}
                {isStarting ? 'Başlatılıyor...' : 'Taramayı Başlat'}
              </button>
            </form>
          </div>
        </div>
      )}
      
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}