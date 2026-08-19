import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Sources from './pages/Sources';
import Advisories from './pages/Advisories';
import Crawls from './pages/Crawls'; // YENİ EKLENDİ

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="sources" element={<Sources />} />
          {/* GEÇİCİ KOD SİLİNDİ, GERÇEK SAYFA EKLENDİ */}
          <Route path="crawls" element={<Crawls />} />
          <Route path="advisories" element={<Advisories />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;