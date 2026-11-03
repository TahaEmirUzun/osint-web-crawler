import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getStatisticsSummary, getTimeline } from '../api/statisticsService';
import type { StatisticsSummary, TimelineData } from '../api/statisticsService';
import { getRecentAdvisories } from '../api/advisoriesService';
import type { Advisory } from '../api/advisoriesService';
import { getErrorMessage } from '../api/client';
import { Shield, AlertTriangle, AlertCircle, Database, Activity, XCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import SeverityBadge from '../components/SeverityBadge';
import LastUpdated from '../components/LastUpdated';
import { formatLocalDateTime } from '../utils/dateUtils';

const StatCard = ({ title, value, icon, color, bgColor }: { title: string, value: number, icon: ReactNode, color: string, bgColor: string }) => (
  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <div aria-hidden="true" style={{ backgroundColor: bgColor, color: color, padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </div>
    <div>
      <div style={{ color: '#475569', fontSize: '0.875rem', fontWeight: 'bold' }}>{title}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>{value}</div>
    </div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState<StatisticsSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [recent, setRecent] = useState<Advisory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([getStatisticsSummary(), getTimeline(), getRecentAdvisories(5)])
      .then(([summaryData, timelineData, recentData]) => {
        setStats(summaryData);
        setTimeline(Array.isArray(timelineData) ? timelineData : []);
        setRecent(Array.isArray(recentData) ? recentData : []);
        setError(null);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        console.error('İstatistikler çekilemedi:', err);
        setError(getErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !stats) {
    return <div role="status" style={{ padding: '2rem', textAlign: 'center' }}>Veriler yükleniyor...</div>;
  }

  if (error && !stats) {
    return (
      <div role="alert" style={{ padding: '2rem', textAlign: 'center', color: '#b91c1c', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
        <p style={{ margin: '0 0 1rem 0' }}>İstatistikler yüklenemedi: {error}</p>
        <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #b91c1c', background: 'white', color: '#b91c1c', cursor: 'pointer', fontWeight: 'bold' }}>Tekrar Dene</button>
      </div>
    );
  }

  const severityData = [
    { name: 'Kritik', value: stats?.critical || 0, fill: '#ef4444' },
    { name: 'Yüksek', value: stats?.high || 0, fill: '#f97316' },
    { name: 'Orta', value: stats?.medium || 0, fill: '#eab308' },
    { name: 'Düşük', value: stats?.low || 0, fill: '#3b82f6' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem' }}>Gösterge Paneli</h1>
        <LastUpdated date={lastUpdated} onRefresh={loadData} loading={loading} />
      </div>
      {error && <div role="alert" style={{ color: '#b91c1c', fontSize: '0.875rem' }}>Yenileme başarısız: {error}</div>}
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <StatCard title="Toplam Zafiyet" value={stats?.total_advisories || 0} icon={<Shield size={24} />} color="#6366f1" bgColor="#e0e7ff" />
        <StatCard title="Kritik Zafiyetler" value={stats?.critical || 0} icon={<AlertCircle size={24} />} color="#ef4444" bgColor="#fee2e2" />
        <StatCard title="Yüksek Seviye" value={stats?.high || 0} icon={<AlertTriangle size={24} />} color="#f97316" bgColor="#ffedd5" />
        <StatCard title="Aktif Kaynaklar" value={stats?.active_sources || 0} icon={<Database size={24} />} color="#10b981" bgColor="#d1fae5" />
        <StatCard title="Tamamlanan Taramalar" value={stats?.completed_crawls || 0} icon={<Activity size={24} />} color="#8b5cf6" bgColor="#ede9fe" />
        <StatCard title="Başarısız Taramalar" value={stats?.failed_crawls || 0} icon={<XCircle size={24} />} color="#b91c1c" bgColor="#fee2e2" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#334155', textAlign: 'center' }}>Zafiyet Dağılımı</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(value) => [value, 'Zafiyet Sayısı']} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#334155', textAlign: 'center' }}>Günlük Toplanan Zafiyetler</h3>
          <div style={{ height: '300px' }}>
            {timeline.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748b' }}>Henüz zaman çizelgesi verisi yok.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={(tick) => new Date(tick).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                  />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    labelFormatter={(label) => {
                      const value = Array.isArray(label) ? label[0] : label;
                      if (typeof value !== 'string' && typeof value !== 'number') return 'Tarih yok';
                      return new Date(value).toLocaleDateString('tr-TR');
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    name="Toplanan Zafiyet"
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: 'white' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <h3 style={{ margin: 0, padding: '1rem 1.5rem', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>Son Toplanan Zafiyetler</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem', minWidth: '600px' }}>
            <thead style={{ backgroundColor: '#f8fafc' }}>
              <tr>
                <th scope="col" style={{ padding: '0.75rem 1.5rem', color: '#475569' }}>Kritiklik</th>
                <th scope="col" style={{ padding: '0.75rem 1rem', color: '#475569' }}>Başlık</th>
                <th scope="col" style={{ padding: '0.75rem 1rem', color: '#475569' }}>Kurum</th>
                <th scope="col" style={{ padding: '0.75rem 1rem', color: '#475569' }}>Toplama Tarihi</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>Henüz toplanmış zafiyet bulunmuyor.</td></tr>
              ) : recent.map(adv => (
                <tr key={adv.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem 1.5rem' }}><SeverityBadge severity={adv.severity} /></td>
                  <td style={{ padding: '0.75rem 1rem', color: '#334155', maxWidth: '420px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={adv.title}>{adv.title}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{adv.organization || adv.product || '-'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{formatLocalDateTime(adv.collection_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
