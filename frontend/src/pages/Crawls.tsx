import { useEffect, useState } from 'react';
import { getCrawlHistory, startCrawl } from '../api/crawlsService';
import type { CrawlJob } from '../api/crawlsService';
import { getSources } from '../api/sourcesService';
import { Play, CheckCircle, XCircle, Loader, Activity, Clock, StopCircle } from 'lucide-react';

export default function Crawls() {
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStarting, setIsStarting] = useState<boolean>(false);

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
      // 1. Önce aktif kaynakların ID'lerini çekiyoruz
      const sources = await getSources();
      const activeSourceIds = sources.filter(s => s.enabled).map(s => s.id);

      if (activeSourceIds.length === 0) {
        alert('Taranacak aktif kaynak bulunamadı! Lütfen Kaynaklar sayfasından en az bir kaynağı aktif yapın.');
        setIsStarting(false);
        return;
      }

      // 2. Backend'in beklediği JSON formatıyla POST isteği atıyoruz
      const response = await startCrawl({ source_ids: activeSourceIds });
      alert(`Tarama başarıyla başlatıldı! Görev ID: ${response.job_id}`);
      
      // 3. Tabloyu anında güncelle
      fetchJobs();
    } catch (err) {
      console.error('Tarama başlatma hatası:', err);
      alert('Tarama başlatılırken bir hata oluştu.');
    } finally {
      setIsStarting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={16} /> Tamamlandı</span>;
      case 'failed':
        return <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><XCircle size={16} /> Başarısız</span>;
      case 'running':
        return <span style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Loader size={16} className="spin" /> Çalışıyor</span>;
      case 'queued':
        return <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={16} /> Sırada</span>;
      case 'stopped':
        return <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><StopCircle size={16} /> Durduruldu</span>;
      default:
        return <span>{status}</span>;
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px', fontSize: '0.875rem' }}>
            <thead style={{ borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Görev ID</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Durum</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Ziyaret Edilen</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Toplanan Zafiyet</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Başlangıç</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Bitiş</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Veriler yükleniyor...</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Henüz kayıtlı bir tarama görevi bulunmuyor. Butona basarak ilk taramayı başlatabilirsiniz.</td></tr>
              ) : (
                jobs.map((job) => (
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
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                      {job.completed_date ? new Date(job.completed_date).toLocaleString('tr-TR') : '-'}
                    </td>
                  </tr>
                ))
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