import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdvisories, deleteAdvisory } from '../api/advisoriesService';
import type { Advisory } from '../api/advisoriesService';
import { getErrorMessage } from '../api/client';
import { formatLocalDate, formatLocalDateTime, toTimestamp } from '../utils/dateUtils';
import { getSafeExternalUrl } from '../utils/safeUrl';
import { ShieldAlert, Search, ExternalLink, X, Calendar, Activity, Database, Hash, ChevronLeft, ChevronRight, Trash2, Download, Building2, ArrowUp, ArrowDown, ArrowUpDown, FilterX } from 'lucide-react';
import SeverityBadge, { SEVERITY_OPTIONS, normalizeSeverity } from '../components/SeverityBadge';
import LastUpdated from '../components/LastUpdated';
import { useToast } from '../components/Toast';

type SortKey = 'severity' | 'title' | 'organization' | 'publication_date' | 'cve' | 'product' | 'source_domain' | 'collection_date';
type Filters = { search: string; severity: string; organization: string; source: string; dateFrom: string; dateTo: string };

const EMPTY_FILTERS: Filters = { search: '', severity: '', organization: '', source: '', dateFrom: '', dateTo: '' };
const SEVERITY_RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1, Unknown: 0 };
const ITEMS_PER_PAGE = 10;

const COLUMNS: { key: SortKey; label: string; width?: string }[] = [
  { key: 'severity', label: 'Kritiklik', width: '100px' },
  { key: 'title', label: 'Zafiyet Başlığı', width: '280px' },
  { key: 'organization', label: 'Kurum' },
  { key: 'publication_date', label: 'Yayın Tarihi' },
  { key: 'cve', label: 'CVE', width: '160px' },
  { key: 'product', label: 'Ürün' },
  { key: 'source_domain', label: 'Kaynak' },
];

function sortValue(adv: Advisory, key: SortKey): string | number {
  if (key === 'severity') return SEVERITY_RANK[normalizeSeverity(adv.severity)];
  if (key === 'publication_date' || key === 'collection_date') return toTimestamp(adv[key]);
  return (adv[key] || '').toString().toLowerCase();
}

function effectiveDate(adv: Advisory): string {
  return (adv.publication_date || adv.collection_date || '').slice(0, 10);
}

export default function Advisories() {
  const { showToast } = useToast();
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'publication_date', direction: 'desc' });
  const [selectedAdvisory, setSelectedAdvisory] = useState<Advisory | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const fetchAdvisories = useCallback(() => {
    setLoading(true);
    getAdvisories()
      .then((data) => {
        setAdvisories(Array.isArray(data) ? data : []);
        setLoadError(null);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        console.error('Zafiyetler çekilirken hata:', err);
        setLoadError(getErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAdvisories();
  }, [fetchAdvisories]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const toggleSort = (key: SortKey) => {
    setSort(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const organizations = useMemo(() => Array.from(new Set(advisories.map(a => a.organization).filter(Boolean) as string[])).sort(), [advisories]);
  const sources = useMemo(() => Array.from(new Set(advisories.map(a => a.source_domain).filter(Boolean) as string[])).sort(), [advisories]);

  const filteredAdvisories = useMemo(() => {
    const searchLower = filters.search.trim().toLowerCase();
    const result = advisories.filter(adv => {
      if (searchLower) {
        const haystack = [adv.title, adv.cve, adv.summary, adv.product].join(' ').toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      if (filters.severity && normalizeSeverity(adv.severity) !== filters.severity) return false;
      if (filters.organization && adv.organization !== filters.organization) return false;
      if (filters.source && adv.source_domain !== filters.source) return false;
      const date = effectiveDate(adv);
      if (filters.dateFrom && (!date || date < filters.dateFrom)) return false;
      if (filters.dateTo && (!date || date > filters.dateTo)) return false;
      return true;
    });

    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...result].sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      if (left < right) return -1 * direction;
      if (left > right) return 1 * direction;
      return b.id - a.id;
    });
  }, [advisories, filters, sort]);

  const handleDelete = async (adv: Advisory) => {
    if (!window.confirm(`"${adv.title}" kaydını veritabanından kalıcı olarak silmek istediğinize emin misiniz?`)) return;
    setDeletingId(adv.id);
    try {
      await deleteAdvisory(adv.id);
      showToast('Zafiyet kaydı silindi.', 'success');
      if (selectedAdvisory?.id === adv.id) setSelectedAdvisory(null);
      fetchAdvisories();
    } catch (err) {
      showToast(`Silme işlemi başarısız oldu: ${getErrorMessage(err)}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCSV = () => {
    if (filteredAdvisories.length === 0) {
      showToast('Dışa aktarılacak zafiyet bulunmuyor.', 'info');
      return;
    }
    
    // Metinlerin içindeki tırnak, alt satır (\n) ve fazla boşlukları temizler; Excel formül enjeksiyonunu engeller
    const cleanText = (text: unknown) => {
      if (text === null || text === undefined) return '""';
      let value = text.toString().replace(/"/g, '""').replace(/[\n\r]+/g, ' ').trim();
      if (/^[=+\-@]/.test(value)) value = `'${value}`;
      return `"${value}"`;
    };

    const headers = ["ID", "Zafiyet Başlığı", "Kurum", "Yayın Tarihi", "CVE", "Kritiklik", "Ürün", "Kaynak Domain", "Toplama Tarihi", "Orijinal URL"];
    const rows = filteredAdvisories.map(a => [
      a.id,
      cleanText(a.title),
      cleanText(a.organization),
      cleanText(a.publication_date?.slice(0, 10)),
      cleanText(a.cve),
      cleanText(a.severity),
      cleanText(a.product),
      cleanText(a.source_domain),
      cleanText(a.collection_date),
      cleanText(a.url)
    ]);

    // Excel ve Türkçe Windows uyumu: Sütun ayracı olarak ';' ve UTF-8 BOM (﻿) kullanılır
    const csvContent = "﻿" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `zafiyetler_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(filteredAdvisories.length / ITEMS_PER_PAGE) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAdvisories = filteredAdvisories.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const selectedUrl = getSafeExternalUrl(selectedAdvisory?.url);

  const filterStyle = { padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', backgroundColor: 'white', color: '#1e293b' };
  const filterLabelStyle = { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold' as const, color: '#475569' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={28} color="#ef4444" aria-hidden="true" /> Zafiyet Veritabanı
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <LastUpdated date={lastUpdated} onRefresh={fetchAdvisories} loading={loading} />
          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              backgroundColor: '#047857', color: 'white', border: 'none',
              padding: '0.55rem 1rem', borderRadius: '6px', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '0.85rem'
            }}
          >
            <Download size={16} aria-hidden="true" /> CSV Dışa Aktar
          </button>
        </div>
      </div>

      {/* FİLTRELER */}
      <div role="search" style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <label style={{ ...filterLabelStyle, gridColumn: 'span 2' }}>
          Arama
          <span style={{ position: 'relative' }}>
            <input 
              type="search" 
              placeholder="Başlık, CVE, ürün veya özet..." 
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              style={{ ...filterStyle, padding: '0.5rem 0.75rem 0.5rem 2.25rem', width: '100%', boxSizing: 'border-box' }} 
            />
            <Search size={16} color="#94a3b8" aria-hidden="true" style={{ position: 'absolute', left: '0.65rem', top: '0.6rem' }} />
          </span>
        </label>
        <label style={filterLabelStyle}>
          Kritiklik
          <select value={filters.severity} onChange={(e) => updateFilter('severity', e.target.value)} style={filterStyle}>
            <option value="">Tümü</option>
            {SEVERITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={filterLabelStyle}>
          Kurum
          <select value={filters.organization} onChange={(e) => updateFilter('organization', e.target.value)} style={filterStyle}>
            <option value="">Tümü</option>
            {organizations.map(org => <option key={org} value={org}>{org}</option>)}
          </select>
        </label>
        <label style={filterLabelStyle}>
          Kaynak
          <select value={filters.source} onChange={(e) => updateFilter('source', e.target.value)} style={filterStyle}>
            <option value="">Tümü</option>
            {sources.map(source => <option key={source} value={source}>{source.replace(/^https?:\/\//, '')}</option>)}
          </select>
        </label>
        <label style={filterLabelStyle}>
          Başlangıç Tarihi
          <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} style={filterStyle} />
        </label>
        <label style={filterLabelStyle}>
          Bitiş Tarihi
          <input type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} style={filterStyle} />
        </label>
        <button
          onClick={() => { setFilters(EMPTY_FILTERS); setCurrentPage(1); }}
          disabled={!hasActiveFilters}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: hasActiveFilters ? 'white' : '#f1f5f9', color: hasActiveFilters ? '#334155' : '#94a3b8', cursor: hasActiveFilters ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: 'bold' }}
        >
          <FilterX size={16} aria-hidden="true" /> Filtreleri Temizle
        </button>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 420px)', minHeight: '240px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1100px', fontSize: '0.875rem' }}>
            <caption className="sr-only">Toplanan güvenlik duyuruları. Sütun başlıklarına tıklayarak sıralayabilirsiniz.</caption>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                {COLUMNS.map(column => {
                  const active = sort.key === column.key;
                  const SortIcon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <th key={column.key} scope="col" aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ padding: '0.75rem 1rem', width: column.width }}>
                      <button onClick={() => toggleSort(column.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: active ? '#1e293b' : '#475569', fontWeight: 'bold', fontSize: '0.875rem' }}>
                        {column.label} <SortIcon size={14} aria-hidden="true" />
                      </button>
                    </th>
                  );
                })}
                <th scope="col" style={{ padding: '0.75rem 1rem', color: '#475569', textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading && advisories.length === 0 ? (
                <tr><td colSpan={8} role="status" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Zafiyetler yükleniyor...</td></tr>
              ) : loadError && advisories.length === 0 ? (
                <tr><td colSpan={8} role="alert" style={{ padding: '2rem', textAlign: 'center', color: '#b91c1c' }}>Zafiyetler yüklenemedi: {loadError}</td></tr>
              ) : paginatedAdvisories.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>{advisories.length === 0 ? 'Henüz toplanmış zafiyet yok. Bir tarama başlatın.' : 'Arama kriterlerine uygun zafiyet bulunamadı.'}</td></tr>
              ) : (
                paginatedAdvisories.map((adv) => (
                  <tr key={adv.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem 1rem' }}><SeverityBadge severity={adv.severity} /></td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: '500', color: '#334155', maxWidth: '280px' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={adv.title || 'Başlık Yok'}>
                        {adv.title || 'Başlık Yok'}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{adv.organization || '-'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatLocalDate(adv.publication_date)}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569', fontWeight: 'bold', maxWidth: '160px' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={adv.cve || '-'}>
                        {adv.cve || '-'}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{adv.product || '-'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#475569', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={adv.source_domain || ''}>
                      {(adv.source_domain || '-').replace(/^https?:\/\//, '')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button 
                          onClick={() => setSelectedAdvisory(adv)}
                          aria-label={`${adv.title} detaylarını incele`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#e0e7ff', color: '#4338ca', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
                        >
                          İncele
                        </button>
                        <button 
                          onClick={() => handleDelete(adv)}
                          disabled={deletingId === adv.id}
                          aria-label={`${adv.title} kaydını sil`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', padding: '0.35rem 0.5rem', borderRadius: '4px', cursor: deletingId === adv.id ? 'not-allowed' : 'pointer' }}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#475569' }}>
            Toplam <strong>{filteredAdvisories.length}</strong> zafiyet ({safePage} / {totalPages} sayfa)
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage(Math.max(safePage - 1, 1))}
              disabled={safePage === 1}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.4rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px',
                backgroundColor: safePage === 1 ? '#f1f5f9' : 'white',
                color: safePage === 1 ? '#94a3b8' : '#334155',
                cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.875rem'
              }}
            >
              <ChevronLeft size={16} aria-hidden="true" /> Önceki
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(safePage + 1, totalPages))}
              disabled={safePage === totalPages}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.4rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px',
                backgroundColor: safePage === totalPages ? '#f1f5f9' : 'white',
                color: safePage === totalPages ? '#94a3b8' : '#334155',
                cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.875rem'
              }}
            >
              Sonraki <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {selectedAdvisory && (
        <div role="dialog" aria-modal="true" aria-labelledby="advisory-title" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#f8fafc', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <SeverityBadge severity={selectedAdvisory.severity} />
                  <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.875rem', wordBreak: 'break-word' }}>
                    {selectedAdvisory.cve || 'CVE YOK'}
                  </span>
                </div>
                <h2 id="advisory-title" style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', lineHeight: '1.4', wordBreak: 'break-word' }}>{selectedAdvisory.title || 'Başlık Yok'}</h2>
              </div>
              <button onClick={() => setSelectedAdvisory(null)} aria-label="Detay penceresini kapat" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#475569', fontSize: '0.875rem', textTransform: 'uppercase' }}>Zafiyet Özeti</h3>
                {/* Tarayıcıdan gelen içerik düz metin olarak gösterilir (HTML yorumlanmaz) */}
                <p style={{ margin: 0, color: '#334155', lineHeight: '1.6', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', whiteSpace: 'pre-line' }}>
                  {selectedAdvisory.summary || 'Bu zafiyet için henüz detaylı bir özet metni bulunmamaktadır.'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                {[
                  { icon: <Building2 size={18} color="#64748b" />, label: 'Yayınlayan Kurum', value: selectedAdvisory.organization || 'Bilinmiyor' },
                  { icon: <Database size={18} color="#64748b" />, label: 'Etkilenen Ürün', value: selectedAdvisory.product || 'Bilinmiyor' },
                  { icon: <Calendar size={18} color="#64748b" />, label: 'Yayın Tarihi', value: formatLocalDate(selectedAdvisory.publication_date) },
                  { icon: <Calendar size={18} color="#64748b" />, label: 'Sisteme Eklenme Tarihi', value: formatLocalDateTime(selectedAdvisory.collection_date) },
                  { icon: <Activity size={18} color="#64748b" />, label: 'Kaynak Domain', value: selectedAdvisory.source_domain || '-' },
                  { icon: <Hash size={18} color="#64748b" />, label: 'Tarama Görev ID', value: selectedAdvisory.crawl_job_id || '-' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#475569' }}>
                    <span aria-hidden="true">{item.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.label}</div>
                      <div style={{ color: '#1e293b', fontWeight: '500', wordBreak: 'break-word' }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                {selectedUrl ? (
                  <a 
                    href={selectedUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1e293b', color: 'white', textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', fontWeight: 'bold' }}
                  >
                    <ExternalLink size={18} aria-hidden="true" /> Orijinal Kaynağa Git <span className="sr-only">(yeni sekmede açılır)</span>
                  </a>
                ) : (
                  <span style={{ color: '#b91c1c', fontSize: '0.875rem' }}>Kaynak bağlantısı güvenli değil veya bulunamadı.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
