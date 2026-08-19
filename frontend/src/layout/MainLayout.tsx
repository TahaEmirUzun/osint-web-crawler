import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Database, Activity, ShieldAlert } from 'lucide-react';

export default function MainLayout() {
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: <Home size={20} /> },
    { name: 'Kaynaklar', path: '/sources', icon: <Database size={20} /> },
    { name: 'Tarama İşleri', path: '/crawls', icon: <Activity size={20} /> },
    { name: 'Zafiyetler', path: '/advisories', icon: <ShieldAlert size={20} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6f8' }}>
      {/* Sol Menü (Sidebar) */}
      <aside style={{ width: '250px', backgroundColor: '#1e293b', color: 'white', padding: '1rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '2rem', paddingLeft: '0.5rem' }}>OSINT Crawler</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  textDecoration: 'none',
                  color: isActive ? '#38bdf8' : '#cbd5e1',
                  backgroundColor: isActive ? '#0f172a' : 'transparent',
                  borderRadius: '0.375rem',
                  transition: 'all 0.2s',
                }}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Dinamik İçerik Alanı */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {/* Tıklanan sayfanın içeriği bu Outlet bileşeninin içine render edilir */}
        <Outlet /> 
      </main>
    </div>
  );
}