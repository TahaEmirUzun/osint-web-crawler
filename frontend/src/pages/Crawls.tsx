import { useEffect, useState } from 'react';
import { getCrawlHistory, startCrawl, stopCrawlJob } from '../api/crawlsService'; // stopCrawlJob eklendi
import type { CrawlJob } from '../api/crawlsService';
import { getSources } from '../api/sourcesService';
import { Play, CheckCircle, XCircle, Loader, Activity, Clock, StopCircle } from 'lucide-react';

export default function Crawls() {
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [stoppingIds, setStoppingIds] = useState<string[]>([]); // Hangi job'ların durdurulma isteği atıldı onu tutar

  const fetchJobs = () => {
    setLoading(true);
    getCrawlHistory()
      .then((data) => {
        setJobs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Tarama geçmişi çekilemedi:', err);
        setJobs([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleStartCrawl = async () => {
    setIsStarting(true);
    try {
      const sources = await getSources();
      const activeSourceIds = sources.filter(s => s.enabled).map(s => s.id);

      if (activeSourceIds.length === 0) {
        alert('Taranacak aktif kaynak bulunamadı! Lütfen Kaynaklar sayfasından en az bir kaynağı aktif yapın.');
        setIsStarting(false);
        return;
      }

      const response = await startCrawl({ source_ids: activeSourceIds });
      alert(`Tarama başarıyla başlatıldı! Görev ID: ${response.job_id}`);
      fetchJobs();
    } catch (err) {
      console.error('Tarama başlatma hatası:', err);
      alert('Tarama başlatılırken bir hata oluştu.');
    } finally {
      setIsStarting(false);
    }
  };

  // YENİ: Durdurma İşlemi Fonksiyonu
  const handleStopJob = async (jobId: string) => {
    if (!window.confirm(`${jobId} numaralı tarama görevini durdurmak istediğinize emin misiniz?`)) {
      return;
    }
    
    setStoppingIds(prev => [...prev, jobId]); // Butonu yükleniyor durumuna al
    
    try {
      await stopCrawlJob(jobId);
      alert('Görev başarıyla durduruldu.');
      fetchJobs(); // Tabloyu yenile ki "Durduruldu" yazsın
    } catch (err) {
      console.error('Görev durdurma hatası:', err);
      alert('Görev durdurulurken bir hata oluştu.');
    } finally {
      setStoppingIds(prev => prev.filter(id => id !== jobId));
    }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem', lineHeight: '1.2' }}>Tarama İşleri (Crawl Jobs)</h1>
        <button 
          onClick={handleStartCrawl}
          disabled={isStarting}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem', 
            backgroundColor: isStarting ? '#94a3b8' : '#8b5cf6', color: 'white', border: 'none', 
            padding: '0.75rem 1.25rem', borderRadius: '6px', cursor: isStarting ? 'not-allowed' : 'pointer', fontWeight: 'bold'
          }}
        >
          {isStarting ? <Loader size={18} className="spin" /> : <Play size={18} />}
          {isStarting ? 'Başlatılıyor...' : 'Aktif Kaynakları Tara'}
        </button>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontWeight: 'bold' }}>
          <Activity size={18} /> Gerçek Tarama Görevleri
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px', fontSize: '0.875rem' }}>
            <thead style={{ borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Görev ID</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Durum</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Ziyaret Edilen</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Toplanan Zafiyet</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Başlangıç</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b', textAlign: 'right' }}>İşlemler</th> {/* YENİ SÜTUN */}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Veriler yükleniyor...</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Henüz kayıtlı bir tarama görevi bulunmuyor.</td></tr>
              ) : (
                jobs.map((job) => {
                  // Sadece çalışan veya sırada bekleyen görevler durdurulabilir
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
                        {job.started_date ? new Date(job.started_date).toLocaleString('tr-TR') : '-'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        {/* DURDUR BUTONU */}
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
                            title="Taramayı Durdur"
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
      
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}