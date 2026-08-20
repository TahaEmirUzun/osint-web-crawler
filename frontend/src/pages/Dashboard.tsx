import { useEffect, useState } from 'react';
import { getStatisticsSummary, getTimeline } from '../api/statisticsService';
import type { StatisticsSummary, TimelineData } from '../api/statisticsService';
import { Shield, AlertTriangle, AlertCircle, Database, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState<StatisticsSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    Promise.all([
      getStatisticsSummary(),
      getTimeline()
    ])
      .then(([summaryData, timelineData]) => {
        setStats(summaryData);
        setTimeline(timelineData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('İstatistikler çekilemedi:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Veriler yükleniyor...</div>;
  }

  const severityData = [
    { name: 'Kritik', value: stats?.critical || 0, fill: '#ef4444' },
    { name: 'Yüksek', value: stats?.high || 0, fill: '#f97316' },
    { name: 'Orta', value: stats?.medium || 0, fill: '#eab308' },
    { name: 'Düşük', value: stats?.low || 0, fill: '#3b82f6' },
  ];

  // Kod tekrarını önlemek için ufak bir Kart Bileşeni (Component) oluşturuyoruz
  const StatCard = ({ title, value, icon, color, bgColor }: { title: string, value: number, icon: any, color: string, bgColor: string }) => (
    <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ backgroundColor: bgColor, color: color, padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 'bold' }}>{title}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>{value}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem', textAlign: 'center' }}>Gösterge Paneli</h1>
      
      {/* ÜSTTEKİ KARTLAR - Önceki tasarıma sadık kalınarak yeniden oluşturuldu */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <StatCard title="Toplam Zafiyet" value={stats?.total_advisories || 0} icon={<Shield size={24} />} color="#6366f1" bgColor="#e0e7ff" />
        <StatCard title="Kritik Zafiyetler" value={stats?.critical || 0} icon={<AlertCircle size={24} />} color="#ef4444" bgColor="#fee2e2" />
        <StatCard title="Yüksek Seviye" value={stats?.high || 0} icon={<AlertTriangle size={24} />} color="#f97316" bgColor="#ffedd5" />
        <StatCard title="Aktif Kaynaklar" value={stats?.active_sources || 0} icon={<Database size={24} />} color="#10b981" bgColor="#d1fae5" />
        <StatCard title="Tamamlanan Taramalar" value={stats?.completed_crawls || 0} icon={<Activity size={24} />} color="#8b5cf6" bgColor="#ede9fe" />
      </div>

      {/* GRAFİKLER BÖLÜMÜ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        
        {/* 1. Bar Chart: Zafiyet Dağılımı */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#334155', textAlign: 'center' }}>Zafiyet Dağılımı</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Line Chart: Zaman Çizelgesi Grafiği */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#334155', textAlign: 'center' }}>Günlük Toplanan Zafiyetler</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(tick) => new Date(tick).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  labelFormatter={(label) => {
                    const value = Array.isArray(label) ? label[0] : label;
                    if (typeof value !== 'string' && typeof value !== 'number') {
                      return 'Tarih yok';
                    }
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
          </div>
        </div>

      </div>
    </div>
  );
}