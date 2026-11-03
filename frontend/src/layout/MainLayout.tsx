import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Database, Activity, ShieldAlert, Terminal } from 'lucide-react';

export default function MainLayout() {
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: <Home size={20} aria-hidden="true" /> },
    { name: 'Kaynaklar', path: '/sources', icon: <Database size={20} aria-hidden="true" /> },
    { name: 'Tarama İşleri', path: '/crawls', icon: <Activity size={20} aria-hidden="true" /> },
    { name: 'Zafiyetler', path: '/advisories', icon: <ShieldAlert size={20} aria-hidden="true" /> },
    { name: 'Loglar', path: '/logs', icon: <Terminal size={20} aria-hidden="true" /> },
  ];

  return (
    <div className="app-shell">
      {/* Sol Menü (Sidebar) - tablette sadece ikonlar görünür */}
      <aside className="app-sidebar">
        <h2 className="app-sidebar-title">OSINT Crawler</h2>
        <nav aria-label="Ana menü" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                title={item.name}
                className="app-nav-link"
                style={{
                  color: isActive ? '#38bdf8' : '#cbd5e1',
                  backgroundColor: isActive ? '#0f172a' : 'transparent',
                }}
              >
                {item.icon}
                <span className="app-nav-label">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Dinamik İçerik Alanı */}
      <main className="app-main">
        <Outlet /> 
      </main>
    </div>
  );
}
