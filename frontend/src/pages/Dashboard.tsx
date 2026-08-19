import { useEffect, useState } from 'react';
import { getSummary } from '../api/dashboardService';
import type { DashboardSummary } from '../api/dashboardService';
import { ShieldAlert, AlertOctagon, AlertTriangle, Database, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    getSummary()
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('API bağlantı hatası, sahte (mock) veri yükleniyor...', err);
        // Backend endpointi henüz hazır değilse arayüzü görebilmek için yedek veri
        setSummary({
          total_advisories: 425,
          critical: 38,
          high: 124,
          medium: 190,
          low: 73,
          active_sources: 6,
          completed_crawls: 14,
        });
        setLoading(false);
      });
  }, []);

  if (loading || !summary) {
    return <p>İstatistikler yükleniyor...</p>;
  }

  // Grafik için veriyi şekillendiriyoruz
  const chartData = [
    { name: 'Kritik', adet: summary.critical, fill: '#ef4444' },
    { name: 'Yüksek', adet: summary.high, fill: '#f97316' },
    { name: 'Orta', adet: summary.medium, fill: '#eab308' },
    { name: 'Düşük', adet: summary.low, fill: '#3b82f6' },
  ];

  // Yardımcı kart bileşeni
  const StatCard = ({ title, value, icon, color }: { title: string, value: number, icon: any, color: string }) => (
    <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ backgroundColor: color, color: 'white', padding: '1rem', borderRadius: '8px', display: 'flex' }}>
        {icon}
      </div>
      <div>
        <h3 style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>{title}</h3>
        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a' }}>{value}</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <h1 style={{ margin: 0, color: '#1e293b' }}>Gösterge Paneli</h1>
      
      {/* İstatistik Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <StatCard title="Toplam Zafiyet" value={summary.total_advisories} icon={<ShieldAlert size={24} />} color="#6366f1" />
        <StatCard title="Kritik Zafiyetler" value={summary.critical} icon={<AlertOctagon size={24} />} color="#ef4444" />
        <StatCard title="Yüksek Seviye" value={summary.high} icon={<AlertTriangle size={24} />} color="#f97316" />
        <StatCard title="Aktif Kaynaklar" value={summary.active_sources} icon={<Database size={24} />} color="#10b981" />
        <StatCard title="Tamamlanan Taramalar" value={summary.completed_crawls} icon={<Activity size={24} />} color="#8b5cf6" />
      </div>

      {/* Dağılım Grafiği */}
      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', height: '400px' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', color: '#1e293b' }}>Zafiyet Dağılımı</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="adet" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}