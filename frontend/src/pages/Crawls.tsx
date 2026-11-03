import { useCallback, useEffect, useState } from 'react';
import { ACTIVE_CRAWL_STATUSES, getCrawlHistory, getCrawlJob, startCrawl, stopCrawlJob } from '../api/crawlsService';
import type { CrawlJob, CrawlRequest } from '../api/crawlsService';
import { getSources } from '../api/sourcesService';
import type { Source } from '../api/sourcesService';
import { getSystemLogs } from '../api/logsService';
import type { SystemLog } from '../api/logsService';
import { getErrorMessage } from '../api/client';
import { Play, Loader, Activity, StopCircle, Plus, X, Info, FileText } from 'lucide-react';
import { formatLocalDateTime } from '../utils/dateUtils';
import { MAX_CRAWL_DEPTH, MAX_CRAWL_PAGES, parseKeywords, validateCrawlForm } from '../utils/validation';
import type { CrawlFormValues, FormErrors } from '../utils/validation';
import StatusBadge from '../components/StatusBadge';
import ProgressBar from '../components/ProgressBar';
import LastUpdated from '../components/LastUpdated';
import { useToast } from '../components/Toast';

const POLL_INTERVAL_MS = 3000;

const isActive = (job: CrawlJob) => ACTIVE_CRAWL_STATUSES.includes(job.status);

export default function Crawls() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [availableSources, setAvailableSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [stoppingIds, setStoppingIds] = useState<string[]>([]);
  
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<CrawlJob | null>(null);
  const [jobLogs, setJobLogs] = useState<SystemLog[]>([]);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState<CrawlFormValues>({
    selectedSourceIds: [],
    maximumPages: 100,
    maxDepth: 2,
    dateFrom: '',
    keywords: ''
  });

  const refreshJobs = useCallback(() => {
    return getCrawlHistory()
      .then((jobsData) => {
        setJobs(Array.isArray(jobsData) ? jobsData : []);
        setLoadError(null);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        console.error('Görevler çekilemedi:', err);
        setLoadError(getErrorMessage(err));
      });
  }, []);

  useEffect(() => {
    Promise.all([
      refreshJobs(),
      getSources()
        .then((sourcesData) => {
          const activeSources = sourcesData.filter(s => s.enabled);
          setAvailableSources(activeSources);
          setFormData(prev => ({ ...prev, selectedSourceIds: activeSources.map(s => s.id) }));
        })
        .catch((err) => console.error('Kaynaklar çekilemedi:', err)),
    ]).finally(() => setLoading(false));
  }, [refreshJobs]);

  // Çalışan görev varken tablo periyodik olarak yenilenir (polling)
  const hasActiveJobs = jobs.some(isActive);
  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = setInterval(refreshJobs, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasActiveJobs, refreshJobs]);

  // Detay penceresi açıkken görev durumu ve son loglar periyodik olarak çekilir
  useEffect(() => {
    if (!selectedJobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loadDetails = async () => {
      try {
        const [job, logs] = await Promise.all([
          getCrawlJob(selectedJobId),
          getSystemLogs({ job_id: selectedJobId, limit: 20 }),
        ]);
        if (cancelled) return;
        setSelectedJob(job);
        setJobLogs(Array.isArray(logs) ? logs : []);
        if (isActive(job)) {
          timer = setTimeout(loadDetails, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) showToast(`Görev detayları alınamadı: ${getErrorMessage(err)}`, 'error');
      }
    };

    loadDetails();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selectedJobId, showToast]);

  const openDetails = (job: CrawlJob) => {
    setSelectedJob(job);
    setJobLogs([]);
    setSelectedJobId(job.id);
  };

  const closeDetails = () => {
    setSelectedJobId(null);
    setSelectedJob(null);
  };

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStarting) return;

    const errors = validateCrawlForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsStarting(true);
    try {
      const keywords = parseKeywords(formData.keywords);
      const payload: CrawlRequest = {
        source_ids: formData.selectedSourceIds,
        maximum_pages: formData.maximumPages,
        max_depth: formData.maxDepth,
        date_from: formData.dateFrom || undefined,
        keywords: keywords.length > 0 ? keywords : undefined
      };

      const response = await startCrawl(payload);
      showToast(`Tarama başlatıldı. Görev ID: ${response.job_id}`, 'success');
      setIsModalOpen(false);
      await refreshJobs();
    } catch (err) {
      setFormErrors({ form: getErrorMessage(err) });
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopJob = async (jobId: string) => {
    if (!window.confirm(`${jobId} numaralı tarama görevini durdurmak istediğinize emin misiniz?`)) return;
    setStoppingIds(prev => [...prev, jobId]);
    try {
      await stopCrawlJob(jobId);
      showToast('Durdurma isteği gönderildi. Görev mevcut sayfayı bitirip duracak.', 'info');
      await refreshJobs();
      if (selectedJobId === jobId) {
        setSelectedJob(await getCrawlJob(jobId));
      }
    } catch (err) {
      showToast(`Görev durdurulamadı: ${getErrorMessage(err)}`, 'error');
    } finally {
      setStoppingIds(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleSourceToggle = (sourceId: number) => {
    setFormData(prev => {
      const isSelected = prev.selectedSourceIds.includes(sourceId);
      return {
        ...prev,
        selectedSourceIds: isSelected ? prev.selectedSourceIds.filter(id => id !== sourceId) : [...prev.selectedSourceIds, sourceId],
      };
    });
  };

  const openNewCrawlModal = () => {
    setFormErrors({});
    setIsModalOpen(true);
  };

  const renderStopButton = (job: CrawlJob) => {
    const isStopping = stoppingIds.includes(job.id) || job.status === 'stopping';
    return (
      <button
        onClick={() => handleStopJob(job.id)}
        disabled={isStopping}
        aria-label={`${job.id} görevini durdur`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171',
          padding: '0.35rem 0.6rem', borderRadius: '4px', cursor: isStopping ? 'not-allowed' : 'pointer',
          fontWeight: 'bold', fontSize: '0.75rem', opacity: isStopping ? 0.7 : 1
        }}
      >
        {isStopping ? <Loader size={14} className="spin" aria-hidden="true" /> : <StopCircle size={14} aria-hidden="true" />}
        {isStopping ? 'Durduruluyor' : 'Durdur'}
      </button>
    );
  };

  const thStyle = { padding: '0.75rem 1rem', color: '#475569' };
  const labelStyle = { fontWeight: 'bold' as const, fontSize: '0.875rem', color: '#334155' };
  const inputStyle = (field: string) => ({ padding: '0.75rem', border: `1px solid ${formErrors[field] ? '#ef4444' : '#cbd5e1'}`, borderRadius: '6px' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem', lineHeight: '1.2' }}>Tarama İşleri (Crawl Jobs)</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <LastUpdated date={lastUpdated} onRefresh={refreshJobs} />
          <button 
            onClick={openNewCrawlModal}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              backgroundColor: '#7c3aed', color: 'white', border: 'none', 
              padding: '0.75rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            <Plus size={18} aria-hidden="true" /> Yeni Tarama Başlat
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontWeight: 'bold' }}>
          <Activity size={18} aria-hidden="true" /> Gerçek Tarama Görevleri
        </div>
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1050px', fontSize: '0.875rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <tr>
                <th scope="col" style={thStyle}>Görev ID</th>
                <th scope="col" style={thStyle}>Kaynaklar</th>
                <th scope="col" style={thStyle}>Durum / İlerleme</th>
                <th scope="col" style={thStyle}>Sayfa</th>
                <th scope="col" style={thStyle}>Zafiyet</th>
                <th scope="col" style={thStyle}>Hata</th>
                <th scope="col" style={thStyle}>Başlangıç</th>
                <th scope="col" style={thStyle}>Bitiş</th>
                <th scope="col" style={{ ...thStyle, textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} role="status" style={{ padding: '2rem', textAlign: 'center' }}>Veriler yükleniyor...</td></tr>
              ) : loadError && jobs.length === 0 ? (
                <tr><td colSpan={9} role="alert" style={{ padding: '2rem', textAlign: 'center', color: '#b91c1c' }}>Görevler yüklenemedi: {loadError}</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Henüz kayıtlı bir tarama görevi bulunmuyor.</td></tr>
              ) : (
                jobs.map((job) => {
                  const sourceNames = job.source_names?.join(', ') || '-';
                  return (
                    <tr key={job.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap' }}>{job.id}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sourceNames}>{sourceNames}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '140px' }}>
                          <StatusBadge status={job.status} />
                          {isActive(job) && (
                            <>
                              <ProgressBar value={job.progress || 0} label={`${job.id} ilerlemesi`} />
                              <span style={{ fontSize: '0.75rem', color: '#475569' }}>%{job.progress || 0}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{job.pages_visited}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                        <span style={{ backgroundColor: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>
                          {job.records_extracted}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: job.error_count > 0 ? '#b91c1c' : '#475569', fontWeight: job.error_count > 0 ? 'bold' : 'normal' }}>{job.error_count}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>{formatLocalDateTime(job.started_date)}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>{formatLocalDateTime(job.completed_date)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button
                            onClick={() => openDetails(job)}
                            aria-label={`${job.id} görev detaylarını aç`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                              backgroundColor: '#ede9fe', color: '#6d28d9', border: 'none',
                              padding: '0.35rem 0.65rem', borderRadius: '4px', cursor: 'pointer',
                              fontWeight: 'bold', fontSize: '0.75rem'
                            }}
                          >
                            <Info size={14} aria-hidden="true" /> Detay
                          </button>
                          {isActive(job) && renderStopButton(job)}
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

      {/* DETAY PENCERESİ (CRAWL DETAILS PAGE KARŞILIĞI) */}
      {selectedJob && (
        <div role="dialog" aria-modal="true" aria-labelledby="job-details-title" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div style={{ backgroundColor: 'white', padding: '1.75rem', borderRadius: '8px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem' }}>
              <h2 id="job-details-title" style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={20} color="#7c3aed" aria-hidden="true" /> Görev Detayları: {selectedJob.id}
              </h2>
              <button onClick={closeDetails} aria-label="Detay penceresini kapat" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusBadge status={selectedJob.status} />
                <span style={{ fontWeight: 'bold', color: '#1e293b' }}>%{selectedJob.progress || 0}</span>
              </div>
              <ProgressBar value={selectedJob.progress || 0} height={10} label="Görev ilerlemesi" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              {[
                ['ZİYARET EDİLEN SAYFA', selectedJob.pages_visited],
                ['TOPLANAN ZAFİYET', selectedJob.records_extracted],
                ['HATA SAYISI', selectedJob.error_count],
                ['BAŞLANGIÇ', formatLocalDateTime(selectedJob.started_date)],
                ['BİTİŞ', formatLocalDateTime(selectedJob.completed_date)],
                ['KAYNAKLAR', selectedJob.source_names?.join(', ') || '-'],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 'bold' }}>{label}</div>
                  <div style={{ fontWeight: 'bold', color: label === 'HATA SAYISI' && Number(value) > 0 ? '#b91c1c' : '#1e293b', fontSize: '0.9rem', wordBreak: 'break-word' }}>{value}</div>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: '0.95rem', color: '#334155', margin: '0 0 0.5rem 0' }}>Son Loglar</h3>
            <div style={{ backgroundColor: '#0f172a', borderRadius: '6px', padding: '0.75rem', maxHeight: '220px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.78rem', marginBottom: '1rem' }}>
              {jobLogs.length === 0 ? (
                <div style={{ color: '#94a3b8' }}>Bu görev için henüz log yok.</div>
              ) : jobLogs.map(log => (
                <div key={log.id} style={{ color: log.log_level === 'ERROR' ? '#fca5a5' : log.log_level === 'WARNING' ? '#fcd34d' : '#e2e8f0', marginBottom: '0.25rem', wordBreak: 'break-word' }}>
                  <span style={{ color: '#94a3b8' }}>{formatLocalDateTime(log.timestamp)}</span> [{log.log_level}] {log.message}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {isActive(selectedJob) && renderStopButton(selectedJob)}
              <button onClick={closeDetails} style={{ padding: '0.6rem 1.25rem', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YENİ TARAMA FORMU */}
      {isModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="new-crawl-title" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 id="new-crawl-title" style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Yeni Tarama Başlat</h2>
              <button onClick={() => setIsModalOpen(false)} aria-label="Pencereyi kapat" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleStartCrawl} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <legend style={{ ...labelStyle, marginBottom: '0.5rem' }}>Taranacak Kaynaklar (En az 1)</legend>
                <div style={{ border: `1px solid ${formErrors.sources ? '#ef4444' : '#cbd5e1'}`, borderRadius: '6px', padding: '0.75rem', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#f8fafc' }}>
                  {availableSources.length === 0 ? (
                    <span style={{ color: '#b91c1c', fontSize: '0.875rem' }}>Aktif kaynak bulunamadı!</span>
                  ) : (
                    availableSources.map(source => (
                      <label key={source.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', color: '#334155' }}>
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
                {formErrors.sources && <p role="alert" className="form-error">{formErrors.sources}</p>}
              </fieldset>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="crawl-keywords" style={labelStyle}>Anahtar Kelimeler (İsteğe Bağlı)</label>
                <input 
                  id="crawl-keywords"
                  value={formData.keywords} 
                  onChange={(e) => setFormData({...formData, keywords: e.target.value})} 
                  type="text" 
                  placeholder="Virgülle ayırın (örn: critical, rce)" 
                  style={inputStyle('keywords')} 
                />
                {formErrors.keywords && <p className="form-error">{formErrors.keywords}</p>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="crawl-date-from" style={labelStyle}>Şu Tarihten İtibaren (İsteğe Bağlı)</label>
                <input 
                  id="crawl-date-from"
                  value={formData.dateFrom} 
                  onChange={(e) => setFormData({...formData, dateFrom: e.target.value})} 
                  type="date" 
                  style={inputStyle('dateFrom')} 
                />
                {formErrors.dateFrom && <p className="form-error">{formErrors.dateFrom}</p>}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <label htmlFor="crawl-max-pages" style={labelStyle}>Maksimum Sayfa</label>
                  <input 
                    id="crawl-max-pages"
                    value={formData.maximumPages} 
                    onChange={(e) => setFormData({...formData, maximumPages: Number(e.target.value)})} 
                    type="number" min="1" max={MAX_CRAWL_PAGES}
                    style={inputStyle('maximumPages')} 
                  />
                  {formErrors.maximumPages && <p className="form-error">{formErrors.maximumPages}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <label htmlFor="crawl-depth" style={labelStyle}>Tarama Derinliği</label>
                  <input 
                    id="crawl-depth"
                    value={formData.maxDepth} 
                    onChange={(e) => setFormData({...formData, maxDepth: Number(e.target.value)})} 
                    type="number" min="1" max={MAX_CRAWL_DEPTH}
                    style={inputStyle('maxDepth')} 
                  />
                  {formErrors.maxDepth && <p className="form-error">{formErrors.maxDepth}</p>}
                </div>
              </div>

              {formErrors.form && <p role="alert" className="form-error">{formErrors.form}</p>}

              <button 
                disabled={isStarting} 
                type="submit" 
                style={{ 
                  marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#7c3aed', color: 'white', 
                  border: 'none', borderRadius: '6px', fontWeight: 'bold', display: 'flex', 
                  justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
                  cursor: isStarting ? 'not-allowed' : 'pointer', opacity: isStarting ? 0.7 : 1 
                }}
              >
                {isStarting ? <Loader size={18} className="spin" aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
                {isStarting ? 'Başlatılıyor...' : 'Taramayı Başlat'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
