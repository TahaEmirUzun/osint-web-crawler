import { useEffect, useState } from 'react';
import { getCrawlHistory, startCrawl } from '../api/crawlsService';
import type { CrawlJob } from '../api/crawlsService';
import { Play, CheckCircle, XCircle, Loader, Activity } from 'lucide-react';

export default function Crawls() {
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  const fetchJobs = () => {
    setLoading(true);
    getCrawlHistory().then((data) => {
      setJobs(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleStartCrawl = () => {
    setIsStarting(true);
    startCrawl()
      .then(() => {
        alert('Tarama başarıyla tetiklendi! Arka planda çalışıyor.');
        fetchJobs(); 
      })
      .catch((err) => {
        console.error(err);
        alert('Tarama başlatılırken kritik bir hata oluştu.');
      })
      .finally(() => {
        setIsStarting(false);
      });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={16} /> Tamamlandı</span>;
      case 'failed': return <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><XCircle size={16} /> Başarısız</span>;
      case 'running': return <span style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Loader size={16} className="spin" /> Çalışıyor</span>;
      default: return <span>{status}</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* BAŞLIK DÜZELTİLMESİ: flexWrap eklendi, gap eklendi ve başlık sadeleştirildi */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem', lineHeight: '1.2' }}>Tarama İşleri</h1>
        
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
          {isStarting ? 'Başlatılıyor...' : 'Tüm Kaynakları Tara'}
        </button>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontWeight: 'bold' }}>
          <Activity size={18} /> Son Tarama Geçmişi
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px', fontSize: '0.875rem' }}>
            <thead style={{ borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Kaynak</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Durum</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Bulunan Kayıt</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Başlangıç</th>
                <th style={{ padding: '0.75rem 1rem', color: '#64748b' }}>Bitiş</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center' }}>Yükleniyor...</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center' }}>Geçmiş tarama kaydı bulunamadı.</td></tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#334155' }}>{job.source_name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{getStatusIcon(job.status)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                      <span style={{ backgroundColor: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                        {job.items_found} Zafiyet
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{new Date(job.start_time).toLocaleString('tr-TR')}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{job.end_time ? new Date(job.end_time).toLocaleString('tr-TR') : '-'}</td>
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